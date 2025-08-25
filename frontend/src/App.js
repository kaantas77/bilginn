import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { Send, Loader2, Upload, Settings, X, MessageCircle, Shield, FileText, BarChart3, User, LogOut, Plus, History, Trash2, Camera, Image } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { useToast } from "./hooks/use-toast";
import { Toaster } from "./components/ui/toaster";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authLoading, setAuthLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  
  // Auth form states
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ name: '', email: '', password: '' });
  
  // Chat states
  const [currentChatId, setCurrentChatId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  
  // Image upload states
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageQuestion, setImageQuestion] = useState("");
  
  // Admin states
  const [showFullAdminPanel, setShowFullAdminPanel] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminView, setAdminView] = useState('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  
  const { toast } = useToast();

  // Token yönetimi
  const getToken = () => localStorage.getItem('bilgin_token');
  const setToken = (token) => localStorage.setItem('bilgin_token', token);
  const removeToken = () => localStorage.removeItem('bilgin_token');

  // API header'ları
  const getAuthHeaders = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Session kontrolü
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const token = getToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/check-session`, {
        headers: getAuthHeaders()
      });

      if (response.data.valid) {
        setIsAuthenticated(true);
        setCurrentUser(response.data.user);
        await loadChatHistory();
      } else {
        removeToken();
      }
    } catch (error) {
      console.error("Session check error:", error);
      removeToken();
    } finally {
      setCheckingSession(false);
    }
  };

  // Chat geçmişini yükle
  const loadChatHistory = async () => {
    try {
      const response = await axios.get(`${API}/chats`, {
        headers: getAuthHeaders()
      });
      setChatHistory(response.data);
    } catch (error) {
      console.error("Chat history load error:", error);
    }
  };

  // Chat mesajlarını yükle
  const loadChatMessages = async (chatId) => {
    try {
      const response = await axios.get(`${API}/chat/${chatId}/messages`, {
        headers: getAuthHeaders()
      });
      setChatMessages(response.data);
    } catch (error) {
      console.error("Chat messages load error:", error);
      setChatMessages([]);
    }
  };

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      const response = await axios.post(`${API}/login`, loginData);
      
      setToken(response.data.token);
      setIsAuthenticated(true);
      setCurrentUser(response.data.user);
      setLoginData({ email: '', password: '' });
      
      await loadChatHistory();
      
      toast({
        title: "Hoş Geldin!",
        description: `Merhaba ${response.data.user.name}! 😊`,
      });
    } catch (error) {
      toast({
        title: "Giriş Hatası",
        description: error.response?.data?.detail || "Giriş yapılamadı",
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  // Register
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      const response = await axios.post(`${API}/register`, registerData);
      
      setToken(response.data.token);
      setIsAuthenticated(true);
      setCurrentUser(response.data.user);
      setRegisterData({ name: '', email: '', password: '' });
      
      await loadChatHistory();
      
      toast({
        title: "Kayıt Başarılı!",
        description: `Hoş geldin ${response.data.user.name}! BİLGİN'e katıldığın için teşekkürler! 🎉`,
      });
    } catch (error) {
      toast({
        title: "Kayıt Hatası",
        description: error.response?.data?.detail || "Kayıt oluşturulamadı",
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    removeToken();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setChatHistory([]);
    setChatMessages([]);
    setCurrentChatId(null);
    
    toast({
      title: "Çıkış Yapıldı",
      description: "Görüşmek üzere! 👋",
    });
  };

  // Yeni chat
  const handleNewChat = async () => {
    try {
      const response = await axios.post(`${API}/chat/new`, {}, {
        headers: getAuthHeaders()
      });
      
      setCurrentChatId(response.data.chat_id);
      setChatMessages([]);
      
      // Yeni chat'i hemen listeye ekle (başlık henüz 'Yeni Sohbet')
      const newChat = {
        id: response.data.chat_id,
        title: "Yeni Sohbet", // İlk mesaj gönderilince değişecek
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 0
      };
      setChatHistory(prev => [newChat, ...prev]);
      
    } catch (error) {
      console.error("New chat error:", error);
      toast({
        title: "Hata",
        description: "Yeni sohbet oluşturulamadı",
        variant: "destructive",
      });
    }
  };

  // Chat seç
  const handleSelectChat = async (chatId) => {
    setCurrentChatId(chatId);
    await loadChatMessages(chatId);
  };

  // Soru sor
  const handleAskQuestion = async () => {
    if (!currentQuestion.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen bir soru yazın",
        variant: "destructive",
      });
      return;
    }

    const questionText = currentQuestion;
    setCurrentQuestion("");
    setIsAsking(true);

    // Kullanıcı mesajını UI'ye ekle
    const userMessage = {
      type: 'user',
      content: questionText,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, userMessage]);

    try {
      const response = await axios.post(`${API}/ask`, {
        question: questionText,
        chat_id: currentChatId
      }, {
        headers: getAuthHeaders()
      });

      // AI cevabını UI'ye ekle
      const aiMessage = {
        type: 'assistant',
        content: response.data.answer,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, aiMessage]);

      // Chat ID'yi güncelle (yeni chat ise)
      if (!currentChatId) {
        setCurrentChatId(response.data.chat_id);
      }

      // Chat geçmişini güncelle ve title'ı güncelle
      setChatHistory(prevHistory => {
        const updatedHistory = prevHistory.map(chat => 
          chat.id === response.data.chat_id 
            ? { ...chat, title: response.data.chat_title, updated_at: new Date().toISOString() }
            : chat
        );
        
        // Eğer yeni chat ise ve listede yoksa ekle
        const chatExists = updatedHistory.some(chat => chat.id === response.data.chat_id);
        if (!chatExists) {
          const newChat = {
            id: response.data.chat_id,
            title: response.data.chat_title,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message_count: 2
          };
          return [newChat, ...updatedHistory];
        }
        
        return updatedHistory;
      });

    } catch (error) {
      console.error("Ask question error:", error);
      toast({
        title: "Hata",
        description: error.response?.data?.detail || "Soru cevaplanamadı",
        variant: "destructive",
      });
    } finally {
      setIsAsking(false);
    }
  };

  // Admin panel fonksiyonları
  const handleAdminLogin = () => {
    if (adminPassword === "mugusko7715") {
      setIsAdminAuthenticated(true);
      setAdminPassword("");
      loadDocuments();
      toast({
        title: "Admin Girişi Başarılı",
        description: "Admin paneline hoş geldiniz!",
      });
    } else {
      toast({
        title: "Hata",
        description: "Yanlış şifre!",
        variant: "destructive",
      });
      setAdminPassword("");
    }
  };

  // Admin paneli kapatma
  const handleCloseAdminPanel = () => {
    setShowFullAdminPanel(false);
    setIsAdminAuthenticated(false);
    setAdminPassword("");
    setAdminView('upload');
  };

  // Belgeler yükle
  const loadDocuments = async () => {
    try {
      const response = await axios.get(`${API}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error("Documents load error:", error);
    }
  };

  // Dosya yükleme
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Hata",
        description: "Sadece PDF, Word ve TXT dosyaları yükleyebilirsiniz",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast({
        title: "Başarı",
        description: `${file.name} başarıyla yüklendi`,
      });

      loadDocuments();
      event.target.value = '';
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Hata",
        description: error.response?.data?.detail || "Dosya yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Admin tuş kombinasyonu
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.altKey && event.key === 'h') {
        setShowFullAdminPanel(true);
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // İsim formatlaması
  const formatName = (name) => {
    return name.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Fotoğraf yükleme
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Dosya tipi kontrolü
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Hata",
        description: "Sadece fotoğraf dosyaları yükleyebilirsiniz",
        variant: "destructive",
      });
      return;
    }

    // Boyut kontrolü (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Hata", 
        description: "Fotoğraf boyutu 10MB'dan küçük olmalı",
        variant: "destructive",
      });
      return;
    }

    setSelectedImage(file);
    
    // Preview oluştur
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // Fotoğraf silme
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview("");
    setImageQuestion("");
  };

  // Fotoğraf ile soru sorma
  const handleAskWithImage = async () => {
    if (!selectedImage) {
      toast({
        title: "Hata",
        description: "Lütfen bir fotoğraf seçin",
        variant: "destructive",
      });
      return;
    }

    setIsAsking(true);
    
    // UI'ye kullanıcı mesajını ekle
    const userMessage = {
      type: 'user',
      content: `📸 Fotoğraf yükledi${imageQuestion ? ` ve sordu: ${imageQuestion}` : ''}`,
      timestamp: new Date().toISOString(),
      hasImage: true
    };
    setChatMessages(prev => [...prev, userMessage]);

    try {
      const formData = new FormData();
      formData.append('file', selectedImage);
      formData.append('question', imageQuestion);
      formData.append('chat_id', currentChatId || '');

      const response = await axios.post(`${API}/ask-image`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });

      // AI cevabını UI'ye ekle
      const aiMessage = {
        type: 'assistant',
        content: response.data.answer,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, aiMessage]);

      // Chat ID'yi güncelle (yeni chat ise)
      if (!currentChatId) {
        setCurrentChatId(response.data.chat_id);
      }

      // Chat geçmişini güncelle
      setChatHistory(prevHistory => {
        const updatedHistory = prevHistory.map(chat => 
          chat.id === response.data.chat_id 
            ? { ...chat, title: response.data.chat_title, updated_at: new Date().toISOString() }
            : chat
        );
        
        const chatExists = updatedHistory.some(chat => chat.id === response.data.chat_id);
        if (!chatExists) {
          const newChat = {
            id: response.data.chat_id,
            title: response.data.chat_title,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message_count: 2
          };
          return [newChat, ...updatedHistory];
        }
        
        return updatedHistory;
      });

      // Fotoğrafı temizle
      handleRemoveImage();

      toast({
        title: "Başarı",
        description: "Fotoğraf başarıyla analiz edildi",
      });

    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        title: "Hata",
        description: error.response?.data?.detail || "Fotoğraf işlenemedi",
        variant: "destructive",
      });
    } finally {
      setIsAsking(false);
    }
  };

  // Chat silme
  const handleDeleteChat = async (chatId, chatTitle) => {
    if (!confirm(`"${chatTitle}" sohbetini silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/chat/${chatId}`, {
        headers: getAuthHeaders()
      });

      // Chat listesinden kaldır
      setChatHistory(prev => prev.filter(chat => chat.id !== chatId));
      
      // Eğer silinen chat aktif ise ana sayfaya dön
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setChatMessages([]);
      }

      toast({
        title: "Başarı",
        description: "Sohbet silindi",
      });
    } catch (error) {
      console.error("Chat delete error:", error);
      toast({
        title: "Hata",
        description: "Sohbet silinemedi",
        variant: "destructive",
      });
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'pdf': return '📄';
      case 'docx': return '📝';
      case 'txt': return '📋';
      default: return '📄';
    }
  };

  // Session kontrol ediliyor
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>BİLGİN yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Admin panel render ediliyorsa
  if (showFullAdminPanel) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Toaster />
        
        {!isAdminAuthenticated ? (
          // Admin Login
          <div className="min-h-screen flex items-center justify-center">
            <Card className="w-96 bg-gray-900 border-gray-700">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-red-900 rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-8 w-8 text-red-400" />
                </div>
                <CardTitle className="text-xl text-white">Admin Paneli</CardTitle>
                <p className="text-gray-400">Erişim için şifre gerekli</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="password"
                  placeholder="Admin şifresi..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAdminLogin();
                    }
                  }}
                />
                <div className="flex space-x-2">
                  <Button
                    onClick={handleAdminLogin}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    Giriş Yap
                  </Button>
                  <Button
                    onClick={handleCloseAdminPanel}
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    İptal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Admin Dashboard
          <div className="min-h-screen">
            {/* Admin Header */}
            <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">BİLGİN Admin Panel</h1>
                    <p className="text-sm text-gray-400">Sistem Yönetimi</p>
                  </div>
                </div>
                
                <Button
                  onClick={handleCloseAdminPanel}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <X className="h-4 w-4 mr-2" />
                  Çıkış
                </Button>
              </div>
            </div>

            {/* Admin Navigation */}
            <div className="bg-gray-800 px-6 py-3 border-b border-gray-700">
              <div className="flex space-x-6">
                <button
                  onClick={() => setAdminView('upload')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    adminView === 'upload' 
                      ? 'bg-red-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <Upload className="h-4 w-4 inline mr-2" />
                  Dosya Yükle
                </button>
                <button
                  onClick={() => setAdminView('documents')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    adminView === 'documents' 
                      ? 'bg-red-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <FileText className="h-4 w-4 inline mr-2" />
                  Belgeler ({documents.length})
                </button>
              </div>
            </div>

            {/* Admin Content */}
            <div className="p-6">
              {adminView === 'upload' && (
                <div className="max-w-4xl">
                  <Card className="bg-gray-900 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white">Dosya Yükleme</CardTitle>
                      <p className="text-gray-400">PDF, Word, TXT dosyalarını sisteme yükleyin</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="border-2 border-dashed border-gray-600 rounded-lg p-8">
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="admin-file-upload"
                          disabled={isUploading}
                          multiple
                        />
                        <label
                          htmlFor="admin-file-upload"
                          className="cursor-pointer flex flex-col items-center space-y-4"
                        >
                          {isUploading ? (
                            <div className="flex items-center space-x-2 text-blue-400">
                              <Loader2 className="h-8 w-8 animate-spin" />
                              <span className="text-lg">Yükleniyor...</span>
                            </div>
                          ) : (
                            <>
                              <Upload className="h-16 w-16 text-gray-400" />
                              <div className="text-center">
                                <p className="text-lg text-white">Dosyaları buraya sürükleyin</p>
                                <p className="text-sm text-gray-400">veya tıklayarak seçin</p>
                              </div>
                            </>
                          )}
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {adminView === 'documents' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-white">Yüklenen Belgeler</h2>
                  <div className="grid gap-4">
                    {documents.length === 0 ? (
                      <Card className="bg-gray-900 border-gray-700">
                        <CardContent className="p-8 text-center">
                          <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                          <p className="text-gray-400">Henüz belge yüklenmemiş</p>
                        </CardContent>
                      </Card>
                    ) : (
                      documents.map((doc, index) => (
                        <Card key={index} className="bg-gray-900 border-gray-700">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="text-2xl">{getFileIcon(doc.file_type)}</div>
                                <div>
                                  <h3 className="font-medium text-white">{doc.filename}</h3>
                                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                                    <span>Tip: {doc.file_type.toUpperCase()}</span>
                                    <span>Boyut: {formatFileSize(doc.content_length || 0)}</span>
                                    <span>Tarih: {formatDate(doc.upload_date)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Auth ekranları
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Toaster />
        
        {/* Logo */}
        <div className="absolute top-8 left-8">
          <h1 className="text-2xl font-bold text-white tracking-wider">
            BİLGİN
          </h1>
        </div>

        <div className="min-h-screen flex items-center justify-center px-4">
          <Card className="w-full max-w-md bg-black/80 backdrop-blur-sm border-gray-800/50">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-white mb-2">
                {authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </CardTitle>
              <p className="text-gray-400">
                {authMode === 'login' 
                  ? 'BİLGİN\'e hoş geldin!' 
                  : 'BİLGİN ailesine katıl!'
                }
              </p>
            </CardHeader>
            <CardContent>
              {authMode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="E-posta adresin"
                    value={loginData.email}
                    onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                    className="bg-gray-900/50 backdrop-blur-sm border-gray-700/50 text-white"
                  />
                  <Input
                    type="password"
                    placeholder="Şifren"
                    value={loginData.password}
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                    className="bg-gray-900/50 backdrop-blur-sm border-gray-700/50 text-white"
                  />
                  <Button
                    type="submit"
                    className="w-full bg-blue-600/80 hover:bg-blue-700/80 backdrop-blur-sm"
                    disabled={authLoading}
                  >
                    {authLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Giriş yapılıyor...
                      </>
                    ) : (
                      'Giriş Yap'
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Adın Soyadın"
                    value={registerData.name}
                    onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
                    className="bg-gray-900/50 backdrop-blur-sm border-gray-700/50 text-white"
                    required
                  />
                  <Input
                    type="email"
                    placeholder="E-posta adresin"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                    className="bg-gray-900/50 backdrop-blur-sm border-gray-700/50 text-white"
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Şifren (en az 6 karakter)"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                    className="bg-gray-900/50 backdrop-blur-sm border-gray-700/50 text-white"
                    minLength="6"
                    required
                  />
                  <Button
                    type="submit"
                    className="w-full bg-green-600/80 hover:bg-green-700/80 backdrop-blur-sm"
                    disabled={authLoading}
                  >
                    {authLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Kayıt oluşturuluyor...
                      </>
                    ) : (
                      'Kayıt Ol'
                    )}
                  </Button>
                </form>
              )}

              <Separator className="my-6 bg-gray-700/50" />

              <Button
                variant="ghost"
                className="w-full text-gray-400 hover:text-white hover:bg-gray-800/50"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              >
                {authMode === 'login' 
                  ? 'Hesabın yok mu? Kayıt ol' 
                  : 'Zaten hesabın var mı? Giriş yap'
                }
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Ana uygulama (authenticated)
  return (
    <div className="min-h-screen bg-black text-white flex">
      <Toaster />

      {/* Sol Sidebar - Chat History */}
      <div className="w-80 bg-gray-900/50 backdrop-blur-sm border-r border-gray-700/50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white">BİLGİN</h1>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white p-2"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-gray-600">
              <User className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{formatName(currentUser?.name || '')}</p>
              <p className="text-xs text-gray-400">{currentUser?.email}</p>
            </div>
          </div>

          <Button
            onClick={handleNewChat}
            className="w-full bg-black/80 hover:bg-gray-900/80 backdrop-blur-sm border border-gray-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Yeni Sohbet
          </Button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {chatHistory.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Henüz sohbet geçmişin yok</p>
                <p className="text-xs">Yeni sohbet başlat!</p>
              </div>
            ) : (
              chatHistory.map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative p-3 rounded-lg transition-colors ${
                    currentChatId === chat.id
                      ? 'bg-gray-700/60 border border-gray-600/50 backdrop-blur-sm'
                      : 'hover:bg-gray-800/40 backdrop-blur-sm'
                  }`}
                >
                  <button
                    onClick={() => handleSelectChat(chat.id)}
                    className="w-full text-left flex items-center space-x-3"
                  >
                    <MessageCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {chat.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(chat.updated_at)}
                      </p>
                    </div>
                  </button>
                  
                  {/* Silme butonu - sadece hover'da görünür */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(chat.id, chat.title);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-600/20"
                    title="Sohbeti sil"
                  >
                    <Trash2 className="h-4 w-4 text-red-400 hover:text-red-300" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Ana İçerik */}
      <div className="flex-1 flex flex-col">
        {!currentChatId && chatMessages.length === 0 ? (
          // Hoşgeldin ekranı
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center animate-fadeIn">
              <h2 className="text-4xl md:text-5xl font-light text-white mb-4 animate-slideUp">
                Merhaba {formatName(currentUser?.name || '')}, ne öğrenmek istersin?
              </h2>
              <p className="text-gray-400 mb-8 animate-slideUp" style={{animationDelay: '0.3s'}}>
                Merak ettiğin her şeyi sorabilirsin!
              </p>
              <div className="animate-slideUp" style={{animationDelay: '0.6s'}}>
                <Button
                  onClick={handleNewChat}
                  className="px-8 py-4 text-lg bg-black/80 hover:bg-gray-900/80 backdrop-blur-sm border border-gray-600 rounded-full transition-all duration-300 transform hover:scale-105"
                >
                  Ayrıca yeni bir sohbet başlatmak için tıkla
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Chat Interface
          <div className="flex-1 flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-xl p-4 ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-white'
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>
                      <div className={`text-xs mt-2 ${
                        message.type === 'user' ? 'text-blue-200' : 'text-gray-400'
                      }`}>
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 text-white rounded-xl p-4">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>BİLGİN düşünüyor...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-800/50 backdrop-blur-sm p-6">
              <div className="max-w-4xl mx-auto">
                
                {/* Fotoğraf Önizleme */}
                {imagePreview && (
                  <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="flex items-start space-x-3">
                      <img
                        src={imagePreview}
                        alt="Yüklenen fotoğraf"
                        className="w-20 h-20 object-cover rounded-lg border border-gray-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-300 mb-2">📸 Fotoğraf yüklendi</p>
                        <Input
                          placeholder="Bu fotoğraf hakkında soru sormak isterseniz yazın (isteğe bağlı)"
                          value={imageQuestion}
                          onChange={(e) => setImageQuestion(e.target.value)}
                          className="bg-gray-900/50 border-gray-700/50 text-white text-sm"
                        />
                      </div>
                      <Button
                        onClick={handleRemoveImage}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex justify-end mt-3 space-x-2">
                      <Button
                        onClick={handleAskWithImage}
                        disabled={isAsking}
                        className="bg-blue-600/80 hover:bg-blue-700/80 backdrop-blur-sm"
                      >
                        {isAsking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analiz ediliyor...
                          </>
                        ) : (
                          <>
                            <Camera className="mr-2 h-4 w-4" />
                            Fotoğrafı Analiz Et
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Normal Chat Input */}
                {!imagePreview && (
                  <div className="flex space-x-3">
                    <Textarea
                      placeholder="Ne merak ediyorsun? Sor bana!"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      className="flex-1 min-h-[50px] max-h-[120px] bg-gray-900/50 backdrop-blur-sm border-gray-700/50 text-white placeholder-gray-400 resize-none"
                      disabled={isAsking}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAskQuestion();
                        }
                      }}
                    />
                    
                    {/* Fotoğraf yükleme butonu */}
                    <div className="flex flex-col space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <Button
                        onClick={() => document.getElementById('image-upload').click()}
                        variant="outline"
                        className="p-3 border-gray-600/50 text-gray-300 hover:bg-gray-800/50"
                        title="Fotoğraf yükle"
                      >
                        <Image className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        onClick={handleAskQuestion}
                        disabled={isAsking || !currentQuestion.trim()}
                        className="px-4 py-2 bg-blue-600/80 hover:bg-blue-700/80 backdrop-blur-sm self-end"
                      >
                        {isAsking ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-2">
                  Enter ile gönder, Shift+Enter ile yeni satır • Fotoğraf yükleyerek yazıları okutabilirsiniz
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;