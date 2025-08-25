import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { Send, Loader2, Upload, Settings, X, MessageCircle, Shield, FileText, BarChart3, Trash2, Eye, Calendar } from "lucide-react";
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
  const { toast } = useToast();

  // Admin toggle kombinasyonları
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Alt+A kombinasyonu (eski mini admin panel)
      if (event.altKey && event.key === 'a') {
        setShowAdminPanel(prev => !prev);
      }
      
      // Alt+Tab+H kombinasyonu (yeni full admin panel)
      if (event.altKey && event.key === 'Tab') {
        event.preventDefault(); // Tab'ın varsayılan davranışını engelle
      }
      
      if (event.altKey && event.key === 'h') {
        setShowFullAdminPanel(true);
        setShowAdminPanel(false);
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
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

  // Admin şifre kontrolü
  const handleAdminLogin = () => {
    if (adminPassword === "mugosko770329") {
      setIsAdminAuthenticated(true);
      setAdminPassword("");
      toast({
        title: "Giriş Başarılı",
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
  // Admin dosya yükleme (geliştirilmiş)
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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

  // Admin paneli render ediliyorsa tüm ekranı kapla
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
                <p className="text-xs text-gray-500 text-center">
                  Alt+Tab+H ile açıldı
                </p>
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
                
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-400">
                    {documents.length} belge yüklü
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
                <button
                  onClick={() => setAdminView('analytics')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    adminView === 'analytics' 
                      ? 'bg-red-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <BarChart3 className="h-4 w-4 inline mr-2" />
                  Analitik
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
                                <p className="text-xs text-gray-500 mt-2">
                                  Desteklenen: PDF, Word, TXT (Çoklu seçim desteklenir)
                                </p>
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
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Yüklenen Belgeler</h2>
                    <div className="text-sm text-gray-400">
                      Toplam: {documents.length} belge
                    </div>
                  </div>

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
                              <div className="flex items-center space-x-2">
                                <Badge variant="secondary" className="bg-gray-700">
                                  {doc.content_length} karakter
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )}

              {adminView === 'analytics' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-white">Sistem Analitikleri</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-gray-900 border-gray-700">
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                            <FileText className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-white">{documents.length}</p>
                            <p className="text-sm text-gray-400">Toplam Belge</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-900 border-gray-700">
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                            <MessageCircle className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-white">-</p>
                            <p className="text-sm text-gray-400">Toplam Soru</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-900 border-gray-700">
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                            <BarChart3 className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-white">Aktif</p>
                            <p className="text-sm text-gray-400">Sistem Durumu</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-gray-900 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white">Dosya Tipleri</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {['pdf', 'docx', 'txt'].map(type => {
                          const count = documents.filter(doc => doc.file_type === type).length;
                          const percentage = documents.length > 0 ? (count / documents.length) * 100 : 0;
                          return (
                            <div key={type} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <span className="text-xl">{getFileIcon(type)}</span>
                                <span className="text-white">{type.toUpperCase()}</span>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="w-24 bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm text-gray-400 w-12">{count} adet</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

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
      <div className="absolute bottom-4 left-4 text-xs text-gray-600">
        <div>Alt+A: Mini Panel</div>
        <div>Alt+Tab+H: Admin Panel</div>
        {/* Test butonu - geliştirme için */}
        <button 
          onClick={() => setShowFullAdminPanel(true)}
          className="mt-2 px-2 py-1 bg-red-600 text-white text-xs rounded opacity-50 hover:opacity-100"
        >
          Admin Test
        </button>
      </div>
    </div>
  );
}

export default App;