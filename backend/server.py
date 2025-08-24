from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

import PyPDF2
from docx import Document
from io import BytesIO
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    content: str
    file_type: str
    upload_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentCreate(BaseModel):
    filename: str
    content: str
    file_type: str

class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    answer: str
    relevant_document: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuestionRequest(BaseModel):
    question: str

class QuestionResponse(BaseModel):
    answer: str
    relevant_document_id: Optional[str]
    relevant_document_name: Optional[str]


# Helper functions
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
    """Soruya en uygun belgeyi bulma - geliştirilmiş versiyon"""
    documents = await db.documents.find().to_list(1000)
    
    if not documents:
        return None
    
    # Geliştirilmiş arama algoritması
    best_match = None
    best_score = 0
    
    # Soruyu temizle ve anahtar kelimeleri çıkar
    question_clean = question.lower().strip()
    question_words = set(question_clean.split())
    
    # Stopwords'leri çıkar (basit Türkçe stopwords)
    stopwords = {'bir', 'bu', 'şu', 've', 'ile', 'için', 'ne', 'nedir', 'nasıl', 'hangi', 'kim', 'niye', 'niçin', 'mi', 'mı', 'mu', 'mü'}
    question_keywords = question_words - stopwords
    
    for doc in documents:
        content_lower = doc['content'].lower()
        content_words = set(content_lower.split())
        
        # Kelime eşleşme skoru
        common_words = question_keywords & content_words
        word_score = len(common_words) * 2
        
        # Phrase eşleşme skoru (2-3 kelimelik ifadeler)
        phrase_score = 0
        for word in question_keywords:
            if word in content_lower:
                phrase_score += content_lower.count(word)
        
        # Dosya tipine göre bonus
        file_type_bonus = 0
        if doc['file_type'] == 'pdf':
            file_type_bonus = 1  # PDF'ler genelde daha kaliteli
        
        # Dosya adı eşleşme skoru
        filename_score = 0
        filename_lower = doc['filename'].lower()
        for word in question_keywords:
            if word in filename_lower:
                filename_score += 3  # Dosya adındaki eşleşmeler önemli
        
        # Toplam skor
        total_score = word_score + phrase_score + file_type_bonus + filename_score
        
        if total_score > best_score:
            best_score = total_score
            best_match = doc
    
    # Minimum skor kontrolü - çok düşükse None döndür
    if best_score < 2:
        return None
        
    return best_match

async def get_ai_answer(question: str, document_content: str = None):
    """AI'dan cevap alma"""
    try:
        # Enhanced system message for learning and inference
        system_message = """Sen BİLGİN adlı akıllı öğretim asistanısın. Görevin:

1. ÖĞRENME: Sana verilen akademik makaleler, örnek sorular ve çözümlerden öğrenmek
2. ÇIKARIM: Öğrendiklerinle benzer soruları çözmek ve yeni cevaplar üretmek  
3. ÖĞRETME: Kullanıcının seviyesine uygun, anlaşılır açıklamalar yapmak

ÖNEMLİ KURALLAR:
- Sadece alıntı yapma, öğrendiklerinden yeni çıkarımlar yap
- Örneklerdeki mantığı anlayıp benzer sorulara uygula
- Adım adım çözüm yöntemleri göster
- Kavramları basit örneklerle açıkla
- Türkçe ve anlaşılır ol
- Eğer emin değilsen, "Bu konuda daha fazla örneğe ihtiyacım var" de

SEN BİR ÖĞRETMEN GİBİ DAVRAN, SADECE KOPYALA-YAPIŞTIR YAPAN BİR BOT DEĞİL."""
        
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message=system_message
        ).with_model("openai", "gpt-4o-mini")
        
        if document_content:
            prompt = f"""ÖĞRENME KAYNAĞI:
{document_content[:4000]}

ÖĞRENCİ SORUSU: {question}

Yukarıdaki kaynaktan öğrendiğin bilgi, yöntem ve mantığı kullanarak soruyu cevapla. 
Sadece metni kopyalama, öğrendiklerini UYGULAY:

1. Konuyu kendi cümlelerinle açıkla
2. Varsa benzer örnekler ver
3. Adım adım çözüm yolu göster
4. Kavramları günlük hayattan örneklerle destekle
5. Eğer kaynak yeterli değilse, genel bilginle tamamla

Unutma: Sen bir ÖĞRETMEN olarak cevap veriyorsun!"""
        else:
            prompt = f"""ÖĞRENCİ SORUSU: {question}

Bu soruyu öğretmen olarak cevapla:
1. Konuyu basit dille açıkla
2. Örneklerle destekle  
3. Adım adım anlat
4. Anlaşılır ol

Eğer bu konuda daha önce sana yüklenen örnekler varsa onlardan yararlan, yoksa genel eğitim bilginle cevapla."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return response
    except Exception as e:
        logger.error(f"AI cevap alma hatası: {str(e)}")
        return "Üzgünüm, şu anda sorunuzu cevaplayamıyorum. Lütfen daha sonra tekrar deneyin."


# Routes
@api_router.get("/")
async def root():
    return {"message": "Akademik Makale Soru-Cevap Sistemi"}

@api_router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Dosya yükleme endpoint'i"""
    try:
        # Dosya tipini kontrol et
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
        
        # Dosya içeriğini oku
        file_bytes = await file.read()
        file_type = allowed_types[file.content_type]
        
        # Dosya tipine göre metin çıkar
        if file_type == 'pdf':
            content = extract_text_from_pdf(file_bytes)
        elif file_type == 'docx':
            content = extract_text_from_docx(file_bytes)
        elif file_type == 'txt':
            content = extract_text_from_txt(file_bytes)
        
        if not content.strip():
            raise HTTPException(status_code=400, detail="Dosya içeriği boş veya okunamıyor.")
        
        # Veritabanına kaydet
        document = Document(
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
    """Yüklenen belgeleri listele"""
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

@api_router.post("/ask", response_model=QuestionResponse)
async def ask_question(request: QuestionRequest):
    """Soru sorma endpoint'i - geliştirilmiş öğrenme sistemi"""
    try:
        question = request.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Soru boş olamaz")
        
        # Soruyla ilgili tüm belgeleri al ve birleştir
        all_documents = await db.documents.find().to_list(1000)
        relevant_content = ""
        relevant_doc_name = None
        
        if all_documents:
            # En uygun belgeyi bul
            relevant_doc = await find_relevant_document(question)
            
            if relevant_doc:
                relevant_content = relevant_doc['content']
                relevant_doc_name = relevant_doc['filename']
                
                # Soru geçmişinden benzer soruları bul
                similar_questions = await db.questions.find({
                    "$text": {"$search": question}
                }).limit(3).to_list(3)
                
                # Önceki soru-cevapları da içeriğe ekle
                if similar_questions:
                    relevant_content += "\n\n--- ÖNCEKİ ÖRNEKLER ---\n"
                    for prev_qa in similar_questions:
                        relevant_content += f"\nÖrnek Soru: {prev_qa.get('question', '')}\n"
                        relevant_content += f"Örnek Cevap: {prev_qa.get('answer', '')}\n"
            else:
                # Hiçbir belge eşleşmezse, en son yüklenen belgeleri kullan
                recent_docs = sorted(all_documents, key=lambda x: x.get('upload_date', ''), reverse=True)[:2]
                for doc in recent_docs:
                    relevant_content += doc['content'][:1000] + "\n\n"
                relevant_doc_name = "Genel kaynaklardan"
        
        # AI'dan cevap al
        answer = await get_ai_answer(question, relevant_content if relevant_content.strip() else None)
        
        # Soru-cevap geçmişini kaydet
        qa_record = Question(
            question=question,
            answer=answer,
            relevant_document=relevant_doc['id'] if relevant_doc else ""
        )
        await db.questions.insert_one(qa_record.dict())
        
        return QuestionResponse(
            answer=answer,
            relevant_document_id=relevant_doc['id'] if relevant_doc else None,
            relevant_document_name=relevant_doc_name
        )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Soru cevaplama hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Soru cevaplanamadı")

@api_router.get("/questions")
async def get_question_history():
    """Soru-cevap geçmişini getir"""
    try:
        questions = await db.questions.find().sort("timestamp", -1).to_list(100)
        # Convert ObjectId to string for JSON serialization
        for question in questions:
            if '_id' in question:
                question['_id'] = str(question['_id'])
        return questions
    except Exception as e:
        logger.error(f"Soru geçmişi getirme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail="Soru geçmişi getirilemedi")


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