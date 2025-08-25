from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import PyPDF2
from docx import Document
from io import BytesIO
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import asyncio
import jwt
import bcrypt
from email_validator import validate_email, EmailNotValidError
import base64
from PIL import Image


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 30  # 30 gün

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
security = HTTPBearer(auto_error=False)

# MongoDB indexes oluştur
async def create_indexes():
    """Veritabanı indexlerini oluştur"""
    try:
        # User indexes
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id")
        
        # Chat indexes
        await db.chats.create_index([("user_id", 1), ("created_at", -1)])
        await db.chats.create_index("id")
        
        # Document indexes
        await db.documents.create_index([("content", "text"), ("filename", "text")])
        
        logger.info("MongoDB indexes oluşturuldu")
    except Exception as e:
        logger.warning(f"Index oluşturma hatası: {e}")

# Create the main app without a prefix
app = FastAPI()

@app.on_event("startup")
async def startup_event():
    """Uygulama başlangıcında çalışacak"""
    await create_indexes()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    last_ip: Optional[str] = None

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime

class ChatSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str = "Yeni Sohbet"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message_count: int = 0

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chat_id: str
    user_id: str
    type: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    content: str
    file_type: str
    upload_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

async def process_image_with_vision(image_bytes: bytes, user_question: str = None) -> str:
    """OpenAI Vision ile fotoğraf işleme ve yazı okuma"""
    try:
        # Fotoğrafı base64'e çevir
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        
        # OpenAI Vision için system message
        system_message = """Sen BİLGİN adlı akıllı bir AI asistanısın. Fotoğraflardaki yazıları okur ve soruları cevaplayabilirsin.

Görevin:
1. Fotoğraftaki tüm yazıları dikkatli oku
2. Eğer matematik, fizik, kimya vs. soru varsa çöz
3. Eğer sadece yazı okuma isteniyorsa yazıları döndür
4. Türkçe yanıtla, net ve anlaşılır ol"""

        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message=system_message
        ).with_model("openai", "gpt-4o")  # Vision için gpt-4o kullan
        
        if user_question:
            prompt = f"""Bu fotoğraftaki yazıları oku ve şu soruyu cevapla: {user_question}

Fotoğraftaki yazıları okuduktan sonra soruyu yanıtla."""
        else:
            prompt = """Bu fotoğraftaki tüm yazıları oku ve eğer soru varsa çöz.

Fotoğrafta:
- Yazıları tam olarak oku
- Matematik/fizik/kimya sorusu varsa çöz
- Genel bilgi sorusu varsa cevapla
- Sadece yazı varsa yazıları döndür"""
        
        # Vision mesajı oluştur - emergentintegrations'a uygun format
        user_message = UserMessage(
            text=prompt,
            images=[{
                "type": "base64",
                "data": base64_image
            }]
        )
        
        response = await chat.send_message(user_message)
        return response
        
    except Exception as e:
        logger.error(f"Fotoğraf işleme hatası: {str(e)}")
        return f"Fotoğraf işlenirken hata oluştu: {str(e)}"


class ImageRequest(BaseModel):
    question: str = ""
    chat_id: Optional[str] = None


class QuestionRequest(BaseModel):
    question: str
    chat_id: Optional[str] = None

class QuestionResponse(BaseModel):
    answer: str
    chat_id: str
    chat_title: str


# Helper functions
def hash_password(password: str) -> str:
    """Şifreyi hash'le"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Şifreyi doğrula"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str) -> str:
    """JWT token oluştur"""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_client_ip(request: Request) -> str:
    """Client IP adresini al"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    """JWT token'dan kullanıcı bilgilerini al"""
    if not credentials:
        return None
    
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            return None
        
        user = await db.users.find_one({"id": user_id})
        return user
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None

def extract_text_from_pdf(file_bytes):
    """PDF dosyasından metin çıkarma"""
    try:
        pdf_reader = PyPDF2.PdfReader(BytesIO(file_bytes))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF okuma hatası: {str(e)}")

def extract_text_from_docx(file_bytes):
    """Word dosyasından metin çıkarma"""
    try:
        doc = Document(BytesIO(file_bytes))
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Word dosyası okuma hatası: {str(e)}")

def extract_text_from_txt(file_bytes):
    """Metin dosyasından içerik çıkarma"""
    try:
        return file_bytes.decode('utf-8')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Metin dosyası okuma hatası: {str(e)}")

async def find_relevant_document(question: str):
    """Soruya en uygun belgeyi bulma"""
    documents = await db.documents.find().to_list(1000)
    
    if not documents:
        return None
    
    question_clean = question.lower().strip()
    question_words = set(question_clean.split())
    
    stopwords = {'bir', 'bu', 'şu', 've', 'ile', 'için', 'ne', 'nedir', 'nasıl', 'hangi', 'kim', 'niye', 'niçin', 'mi', 'mı', 'mu', 'mü'}
    question_keywords = question_words - stopwords
    
    best_match = None
    best_score = 0
    
    for doc in documents:
        content_lower = doc['content'].lower()
        content_words = set(content_lower.split())
        
        common_words = question_keywords & content_words
        word_score = len(common_words) * 2
        
        phrase_score = 0
        for word in question_keywords:
            if word in content_lower:
                phrase_score += content_lower.count(word)
        
        filename_score = 0
        filename_lower = doc['filename'].lower()
        for word in question_keywords:
            if word in filename_lower:
                filename_score += 3
        
        total_score = word_score + phrase_score + filename_score
        
        if total_score > best_score:
            best_score = total_score
            best_match = doc
    
    if best_score < 2:
        return None
        
    return best_match

async def get_chat_context(chat_id: str, limit: int = 10) -> str:
    """Chat geçmişini context olarak al"""
    messages = await db.chat_messages.find(
        {"chat_id": chat_id}
    ).sort("timestamp", 1).limit(limit).to_list(limit)
    
    context = ""
    for msg in messages:
        role = "Kullanıcı" if msg['type'] == 'user' else "BİLGİN"
        context += f"\n{role}: {msg['content']}"
    
    return context

async def generate_chat_title(first_message: str) -> str:
    """İlk mesajdan anlamlı chat title oluştur"""
    try:
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="Sen kısa ve anlamlı chat başlıkları oluşturan bir asistansın. Verilen sorudan 2-4 kelimelik Türkçe başlık üret. Genel selamlaşmalarda 'Genel Sohbet' de."
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=f"Bu soru için kısa bir başlık oluştur: {first_message[:100]}")
        response = await chat.send_message(user_message)
        
        title = response.strip().replace('"', '').replace("'", '')
        
        # Başlığı temizle ve kısalt
        if len(title) > 30:
            title = title[:30] + "..."
            
        return title if title else "Genel Sohbet"
    except:
        # Hata durumunda basit başlık oluştur
        words = first_message.lower().split()[:3]
        if any(word in first_message.lower() for word in ['merhaba', 'selam', 'nasıl']):
            return "Genel Sohbet"
        elif any(word in words for word in ['nedir', 'ne', 'nasıl']):
            return f"{' '.join(words[:2]).title()} Sorusu"
        else:
            return f"{' '.join(words[:2]).title()}"

async def get_ai_answer(question: str, chat_context: str = "", document_content: str = None):
    """AI'dan akıllı ve uygun cevap alma"""
    try:
        system_message = """Sen BİLGİN adlı akıllı bir AI asistanısın. Davranış kuralların:

ARKADAŞ CANLISI DURUMLAR (emoji kullan, samimi ol):
- Selamlaşma (merhaba, selam, nasılsın)
- Teşekkür, övgü, şaka
- Kişisel sorular (adın ne, kimsin)

NORMAL EĞİTİM DURUMLARI (profesyonel ol, emoji kullanma):
- Akademik sorular
- Bilgi talebi
- Ders konuları
- Araştırma soruları

CEVAP UZUNLUĞU:
- Normal: Kısa ve net (2-3 cümle)
- "Uzun", "detaylı", "geniş" istenirse: Kapsamlı açıklama
- "Örnekle", "açıkla" istenirse: Örneklerle destekle

ASLA YAPMA:
- Her cevaba emoji ekleme
- Kaynak belirtme
- Başlık ve numaralandırma kullanma"""
        
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message=system_message
        ).with_model("openai", "gpt-4o-mini")
        
        prompt_parts = []
        
        if chat_context:
            prompt_parts.append(f"Önceki sohbetimiz:\n{chat_context}\n")
        
        if document_content:
            prompt_parts.append(f"Kaynak bilgiler:\n{document_content[:3000]}\n")
        
        prompt_parts.append(f"Kullanıcının sorusu: {question}")
        
        # Soru tipini analiz et ve uygun talimat ver
        question_lower = question.lower()
        if any(word in question_lower for word in ['merhaba', 'selam', 'nasıl', 'kimsin', 'adın', 'teşekkür']):
            prompt_parts.append("\nBu arkadaş canlısı bir soru. Samimi ve emoji ile cevapla.")
        elif any(word in question_lower for word in ['uzun', 'detaylı', 'geniş', 'kapsamlı', 'açıkla']):
            prompt_parts.append("\nKullanıcı detaylı cevap istiyor. Kapsamlı açıklama yap.")
        else:
            prompt_parts.append("\nBu eğitim sorusu. Kısa, net ve profesyonel cevapla.")
        
        prompt = "\n".join(prompt_parts)
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return response
    except Exception as e:
        logger.error(f"AI cevap alma hatası: {str(e)}")
        return "Üzgünüm, şu anda kafam biraz karışık. Biraz sonra tekrar dener misin?"


# Authentication Routes
@api_router.post("/register")
async def register(user_data: UserRegister, request: Request):
    """Kullanıcı kaydı"""
    try:
        # Email validation
        try:
            validate_email(user_data.email)
        except EmailNotValidError:
            raise HTTPException(status_code=400, detail="Geçersiz e-posta adresi")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data.email.lower()})
        if existing_user:
            raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı")
        
        # Create user
        user = User(
            name=user_data.name.strip(),
            email=user_data.email.lower(),
            password_hash=hash_password(user_data.password),
            last_ip=get_client_ip(request)
        )
        
        await db.users.insert_one(user.dict())
        
        # Create token
        token = create_access_token(user.id)
        
        return {
            "message": "Kayıt başarılı",
            "token": token,
            "user": UserResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                created_at=user.created_at
            )
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Kayıt hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Kayıt işlemi başarısız")

@api_router.post("/login")
async def login(user_data: UserLogin, request: Request):
    """Kullanıcı girişi"""
    try:
        # Find user
        user = await db.users.find_one({"email": user_data.email.lower()})
        if not user or not verify_password(user_data.password, user['password_hash']):
            raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
        
        # Update login info
        client_ip = get_client_ip(request)
        await db.users.update_one(
            {"id": user['id']},
            {
                "$set": {
                    "last_login": datetime.now(timezone.utc),
                    "last_ip": client_ip
                }
            }
        )
        
        # Create token
        token = create_access_token(user['id'])
        
        return {
            "message": "Giriş başarılı",
            "token": token,
            "user": UserResponse(
                id=user['id'],
                name=user['name'],
                email=user['email'],
                created_at=user['created_at']
            )
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Giriş hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Giriş işlemi başarısız")

@api_router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Kullanıcı profili"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Oturum açmanız gerekiyor")
    
    return UserResponse(
        id=current_user['id'],
        name=current_user['name'],
        email=current_user['email'],
        created_at=current_user['created_at']
    )

@api_router.get("/check-session")
async def check_session(request: Request, current_user: dict = Depends(get_current_user)):
    """Session ve IP kontrolü"""
    if not current_user:
        return {"valid": False}
    
    client_ip = get_client_ip(request)
    same_ip = current_user.get('last_ip') == client_ip
    
    return {
        "valid": True,
        "same_ip": same_ip,
        "user": UserResponse(
            id=current_user['id'],
            name=current_user['name'],
            email=current_user['email'],
            created_at=current_user['created_at']
        )
    }


# Chat Routes
@api_router.get("/chats")
async def get_user_chats(current_user: dict = Depends(get_current_user)):
    """Kullanıcının chat geçmişi"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Oturum açmanız gerekiyor")
    
    chats = await db.chats.find(
        {"user_id": current_user['id']}
    ).sort("updated_at", -1).to_list(50)
    
    # ObjectId'leri kaldır ve sadece gerekli alanları döndür
    result = []
    for chat in chats:
        result.append({
            "id": chat["id"],
            "title": chat["title"], 
            "created_at": chat["created_at"],
            "updated_at": chat["updated_at"],
            "message_count": chat.get("message_count", 0)
        })
    
    return result

@api_router.post("/chat/new")
async def create_new_chat(current_user: dict = Depends(get_current_user)):
    """Yeni chat oluştur"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Oturum açmanız gerekiyor")
    
    chat = ChatSession(user_id=current_user['id'])
    await db.chats.insert_one(chat.dict())
    
    return {"chat_id": chat.id, "title": chat.title}

@api_router.get("/chat/{chat_id}/messages")
async def get_chat_messages(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Chat mesajları"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Oturum açmanız gerekiyor")
    
    # Chat ownership kontrolü
    chat = await db.chats.find_one({"id": chat_id, "user_id": current_user['id']})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat bulunamadı")
    
    messages = await db.chat_messages.find(
        {"chat_id": chat_id}
    ).sort("timestamp", 1).to_list(1000)
    
    # ObjectId'leri kaldır ve sadece gerekli alanları döndür
    result = []
    for msg in messages:
        result.append({
            "id": msg["id"],
            "chat_id": msg["chat_id"],
            "type": msg["type"],
            "content": msg["content"],
            "timestamp": msg["timestamp"]
        })
    
    return result

@api_router.post("/ask-image")
async def ask_image(
    file: UploadFile = File(...),
    question: str = "",
    chat_id: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Fotoğraf yükleme ve işleme"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Oturum açmanız gerekiyor")
    
    try:
        # Desteklenen dosya tiplerini kontrol et
        allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail="Sadece JPEG, PNG ve WebP formatları destekleniyor."
            )
        
        # Dosya boyutu kontrolü (max 10MB)
        file_bytes = await file.read()
        if len(file_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Dosya boyutu 10MB'dan küçük olmalı.")
        
        # Fotoğrafı AI ile işle
        ai_response = await process_image_with_vision(file_bytes, question if question else None)
        
        # Chat yoksa oluştur
        if not chat_id:
            # Yeni chat oluştur - başlık fotoğraf işleme olsun
            chat_title = "Fotoğraf Analizi"
            chat = ChatSession(user_id=current_user['id'], title=chat_title)
            await db.chats.insert_one(chat.dict())
            chat_id = chat.id
        else:
            # Mevcut chat'i güncelle
            chat = await db.chats.find_one({"id": chat_id, "user_id": current_user['id']})
            if not chat:
                raise HTTPException(status_code=404, detail="Chat bulunamadı")
            chat_title = chat['title']
        
        # Kullanıcı mesajını kaydet (fotoğraf + soru)
        user_message_content = f"📸 Fotoğraf yükledi"
        if question:
            user_message_content += f" ve sordu: {question}"
        
        user_message = ChatMessage(
            chat_id=chat_id,
            user_id=current_user['id'],
            type='user',
            content=user_message_content
        )
        await db.chat_messages.insert_one(user_message.dict())
        
        # AI cevabını kaydet
        ai_message = ChatMessage(
            chat_id=chat_id,
            user_id=current_user['id'],
            type='assistant',
            content=ai_response
        )
        await db.chat_messages.insert_one(ai_message.dict())
        
        # Chat'i güncelle
        await db.chats.update_one(
            {"id": chat_id},
            {
                "$set": {"updated_at": datetime.now(timezone.utc)},
                "$inc": {"message_count": 2}
            }
        )
        
        return QuestionResponse(
            answer=ai_response,
            chat_id=chat_id,
            chat_title=chat_title
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fotoğraf işleme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fotoğraf işlenemedi: {str(e)}")


@api_router.delete("/chat/{chat_id}")
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Chat silme"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Oturum açmanız gerekiyor")
    
    # Chat ownership kontrolü
    chat = await db.chats.find_one({"id": chat_id, "user_id": current_user['id']})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat bulunamadı")
    
    try:
        # Chat mesajlarını sil
        await db.chat_messages.delete_many({"chat_id": chat_id})
        
        # Chat'i sil
        result = await db.chats.delete_one({"id": chat_id, "user_id": current_user['id']})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Chat silinemedi")
        
        return {"message": "Sohbet başarıyla silindi", "deleted_chat_id": chat_id}
        
    except Exception as e:
        logger.error(f"Chat silme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Chat silinemedi")


@api_router.post("/ask")
async def ask_question(request: QuestionRequest, current_user: dict = Depends(get_current_user)):
    """Soru sorma"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Oturum açmanız gerekiyor")
    
    try:
        question = request.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Soru boş olamaz")
        
        chat_id = request.chat_id
        chat_title = "Yeni Sohbet"
        
        # Chat varsa kontrol et, yoksa oluştur
        if chat_id:
            chat = await db.chats.find_one({"id": chat_id, "user_id": current_user['id']})
            if not chat:
                raise HTTPException(status_code=404, detail="Chat bulunamadı")
            chat_title = chat['title']
        else:
            # Yeni chat oluştur
            chat_title = await generate_chat_title(question)
            chat = ChatSession(user_id=current_user['id'], title=chat_title)
            await db.chats.insert_one(chat.dict())
            chat_id = chat.id
        
        # Yeni chat ise title oluştur
        if chat['message_count'] == 0:
            chat_title = await generate_chat_title(question)
        else:
            chat_title = chat['title']
        
        # Kullanıcı mesajını kaydet
        user_message = ChatMessage(
            chat_id=chat_id,
            user_id=current_user['id'],
            type='user',
            content=question
        )
        await db.chat_messages.insert_one(user_message.dict())
        
        # Chat context al
        chat_context = await get_chat_context(chat_id, limit=10)
        
        # İlgili belgeyi bul
        relevant_doc = await find_relevant_document(question)
        document_content = relevant_doc['content'] if relevant_doc else None
        
        # AI'dan cevap al
        answer = await get_ai_answer(question, chat_context, document_content)
        
        # AI cevabını kaydet
        ai_message = ChatMessage(
            chat_id=chat_id,
            user_id=current_user['id'],
            type='assistant',
            content=answer
        )
        await db.chat_messages.insert_one(ai_message.dict())
        
        # Chat'i güncelle ve title'ı güncelle
        await db.chats.update_one(
            {"id": chat_id},
            {
                "$set": {
                    "updated_at": datetime.now(timezone.utc),
                    "title": chat_title
                },
                "$inc": {"message_count": 2}
            }
        )
        
        return QuestionResponse(
            answer=answer,
            chat_id=chat_id,
            chat_title=chat_title
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Soru cevaplama hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Soru cevaplanamadı")


# Admin Routes (existing)
@api_router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Dosya yükleme (admin)"""
    try:
        allowed_types = {
            'application/pdf': 'pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'text/plain': 'txt'
        }
        
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail="Desteklenmeyen dosya tipi. Sadece PDF, Word ve TXT dosyaları yükleyebilirsiniz."
            )
        
        file_bytes = await file.read()
        file_type = allowed_types[file.content_type]
        
        if file_type == 'pdf':
            content = extract_text_from_pdf(file_bytes)
        elif file_type == 'docx':
            content = extract_text_from_docx(file_bytes)
        elif file_type == 'txt':
            content = extract_text_from_txt(file_bytes)
        
        if not content.strip():
            raise HTTPException(status_code=400, detail="Dosya içeriği boş veya okunamıyor.")
        
        document = DocumentModel(
            filename=file.filename,
            content=content,
            file_type=file_type
        )
        
        await db.documents.insert_one(document.dict())
        
        return {
            "message": "Dosya başarıyla yüklendi",
            "document_id": document.id,
            "filename": document.filename,
            "file_type": file_type,
            "content_length": len(content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dosya yükleme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Dosya yükleme hatası: {str(e)}")

@api_router.get("/documents")
async def get_documents():
    """Yüklenen belgeleri listele (admin)"""
    try:
        documents = await db.documents.find().to_list(1000)
        return [
            {
                "id": doc["id"],
                "filename": doc["filename"],
                "file_type": doc["file_type"],
                "upload_date": doc["upload_date"],
                "content_length": len(doc["content"])
            }
            for doc in documents
        ]
    except Exception as e:
        logger.error(f"Belge listeleme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Belgeler listelenemedi")


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()