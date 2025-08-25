import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { Send, Loader2, Upload, Settings, X, MessageCircle } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { useToast } from "./hooks/use-toast";
import { Toaster } from "./components/ui/toaster";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [showChatInterface, setShowChatInterface] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showFullAdminPanel, setShowFullAdminPanel] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [adminView, setAdminView] = useState('upload'); // upload, documents, analytics
  const [keysPressed, setKeysPressed] = useState(new Set());
  const { toast } = useToast();

  // Admin toggle (Alt+A tuşu kombinasyonu)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.altKey && event.key === 'a') {
        setShowAdminPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Belgeleri yükle
  const loadDocuments = async () => {
    try {
      const response = await axios.get(`${API}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error("Belgeler yüklenemedi:", error);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Ana soru sorma butonu - chat interface'i başlat
  const handleStartChat = () => {
    setShowChatInterface(true);
    setConversation([]);
  };

  // Soru sorma
  const handleAskQuestion = async () => {
    if (!currentQuestion.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen bir soru yazın",
        variant: "destructive",
      });
      return;
    }

    // Soruyu conversation'a ekle
    const newQuestion = {
      type: 'question',
      content: currentQuestion,
      timestamp: new Date()
    };

    setConversation(prev => [...prev, newQuestion]);
    const questionToAsk = currentQuestion;
    setCurrentQuestion("");
    setIsAsking(true);

    try {
      const response = await axios.post(`${API}/ask`, {
        question: questionToAsk
      });

      // Cevabı conversation'a ekle
      const newAnswer = {
        type: 'answer',
        content: response.data.answer,
        relevant_document: response.data.relevant_document_name,
        timestamp: new Date()
      };

      setConversation(prev => [...prev, newAnswer]);

      toast({
        title: "Cevap alındı",
        description: "Sorunuz başarıyla cevaplanmıştır",
      });
    } catch (error) {
      console.error("Soru cevaplama hatası:", error);
      toast({
        title: "Hata",
        description: error.response?.data?.detail || "Soru cevaplanamadı",
        variant: "destructive",
      });
      
      // Hata mesajını conversation'a ekle
      const errorMessage = {
        type: 'error',
        content: "Özür dilerim, şu anda sorunuzu cevaplayamıyorum. Lütfen tekrar deneyin.",
        timestamp: new Date()
      };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setIsAsking(false);
    }
  };

  // Admin dosya yükleme
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
      console.error("Dosya yükleme hatası:", error);
      toast({
        title: "Hata",
        description: error.response?.data?.detail || "Dosya yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Sohbeti yeniden başlat
  const handleNewChat = () => {
    setConversation([]);
    setCurrentQuestion("");
  };

  // Ana sayfaya dön
  const handleBackToHome = () => {
    setShowChatInterface(false);
    setConversation([]);
    setCurrentQuestion("");
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <Toaster />
      
      {/* Admin Panel */}
      {showAdminPanel && (
        <div className="fixed top-4 right-4 z-50">
          <Card className="bg-gray-900 border-gray-700 w-80">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Settings className="h-4 w-4 text-gray-400" />
                  <span>Admin Panel</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdminPanel(false)}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Toplam Belge:</span>
                  <span className="text-sm font-medium">{documents.length}</span>
                </div>
                
                <div className="border-t border-gray-700 pt-3">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="admin-upload"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="admin-upload"
                    className="flex items-center space-x-2 cursor-pointer p-2 rounded border border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    <Upload className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-300">
                      {isUploading ? "Yükleniyor..." : "Dosya Yükle"}
                    </span>
                  </label>
                </div>
                
                {documents.length > 0 && (
                  <div className="border-t border-gray-700 pt-3">
                    <p className="text-xs text-gray-400 mb-2">Son Yüklenen:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {documents.slice(0, 3).map((doc, index) => (
                        <div key={index} className="text-xs text-gray-300 truncate">
                          {doc.filename}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logo */}
      <div className="fixed top-8 left-8 z-100">
        <h1 className="text-2xl font-bold text-white tracking-wider">
          BİLGİN
        </h1>
      </div>

      <div className="relative min-h-screen flex flex-col">
        
        {/* Ana İçerik - Hoşgeldin Ekranı */}
        {!showChatInterface && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-8 animate-fadeIn">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-6xl font-light text-white mb-8">
                  Ne öğrenmek istersin?
                </h2>
                <Button
                  onClick={handleStartChat}
                  className="px-8 py-4 text-lg bg-white text-black hover:bg-gray-200 rounded-full transition-all duration-300 transform hover:scale-105"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Sohbete Başla
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Interface */}
        {showChatInterface && (
          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 pt-20">
            
            {/* Chat Header */}
            <div className="flex items-center justify-between py-6 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <MessageCircle className="h-5 w-5 text-gray-400" />
                <span className="text-lg font-medium">Sohbet</span>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={handleNewChat}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Temizle
                </Button>
                <Button
                  onClick={handleBackToHome}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Ana Sayfa
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto py-6 space-y-4">
              {conversation.length === 0 && (
                <div className="text-center text-gray-500 py-12">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Sohbete başlamak için bir soru sorun</p>
                </div>
              )}
              
              {conversation.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.type === 'question' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  <div
                    className={`max-w-[75%] rounded-xl p-4 ${
                      message.type === 'question'
                        ? 'bg-white text-black'
                        : message.type === 'error'
                        ? 'bg-red-900 text-red-100'
                        : 'bg-gray-800 text-white'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                    
                    {message.relevant_document && (
                      <div className="mt-3 pt-3 border-t border-gray-600 text-xs text-gray-400">
                        Kaynak: {message.relevant_document}
                      </div>
                    )}
                    
                    <div className={`text-xs mt-2 ${
                      message.type === 'question' ? 'text-gray-600' : 'text-gray-500'
                    }`}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              
              {isAsking && (
                <div className="flex justify-start animate-fadeIn">
                  <div className="bg-gray-800 text-white rounded-xl p-4">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Cevaplanıyor...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-800 py-4">
              <div className="flex space-x-3">
                <Textarea
                  placeholder="Merak ettiğiniz konuyu buraya yazın..."
                  value={currentQuestion}
                  onChange={(e) => setCurrentQuestion(e.target.value)}
                  className="flex-1 min-h-[50px] max-h-[120px] bg-gray-900 border-gray-700 text-white placeholder-gray-400 resize-none"
                  disabled={isAsking}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskQuestion();
                    }
                  }}
                />
                <Button
                  onClick={handleAskQuestion}
                  disabled={isAsking || !currentQuestion.trim()}
                  className="px-4 py-2 bg-white text-black hover:bg-gray-200 self-end"
                >
                  {isAsking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Enter ile gönder, Shift+Enter ile yeni satır
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Alt bilgi */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-600">
        Alt+A: Admin Panel
      </div>
    </div>
  );
}

export default App;