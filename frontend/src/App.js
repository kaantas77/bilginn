import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { Send, Loader2, Upload, Settings } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { useToast } from "./hooks/use-toast";
import { Toaster } from "./components/ui/toaster";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [showQuestionBox, setShowQuestionBox] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
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

  // Ana soru sorma butonu
  const handleStartQuestion = () => {
    setShowQuestionBox(true);
    setCurrentAnswer(null);
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

    setIsAsking(true);
    setCurrentAnswer(null);

    try {
      const response = await axios.post(`${API}/ask`, {
        question: currentQuestion
      });

      setCurrentAnswer(response.data);
      setCurrentQuestion("");

      toast({
        title: "Cevap alındı",
        description: "Sorunuz başarıyla cevaplamdı",
      });
    } catch (error) {
      console.error("Soru cevaplama hatası:", error);
      toast({
        title: "Hata",
        description: error.response?.data?.detail || "Soru cevaplanamadı",
        variant: "destructive",
      });
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

  // Yeni soru sorma
  const handleNewQuestion = () => {
    setCurrentAnswer(null);
    setCurrentQuestion("");
    setShowQuestionBox(true);
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <Toaster />
      
      {/* Admin Panel Toggle */}
      {showAdminPanel && (
        <div className="fixed top-4 right-4 z-50">
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <Settings className="h-5 w-5 text-gray-400" />
                <div>
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
                    className="cursor-pointer text-sm text-blue-400 hover:text-blue-300"
                  >
                    {isUploading ? "Yükleniyor..." : "PDF Yükle"}
                  </label>
                </div>
                <div className="text-xs text-gray-500">
                  {documents.length} belge
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logo */}
      <div className="absolute top-8 left-8 z-10">
        <h1 className="text-2xl font-bold text-white tracking-wider">
          BİLGİN
        </h1>
      </div>

      <div className="relative min-h-screen flex flex-col">
        
        {/* Ana İçerik */}
        {!showQuestionBox && !currentAnswer && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-8 animate-fadeIn">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-6xl font-light text-white mb-8">
                  Ne öğrenmek istersin?
                </h2>
                <Button
                  onClick={handleStartQuestion}
                  className="px-8 py-4 text-lg bg-white text-black hover:bg-gray-200 rounded-full transition-all duration-300 transform hover:scale-105"
                >
                  Soru Sor
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Soru Sorma Alanı */}
        {showQuestionBox && !currentAnswer && (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="w-full max-w-2xl animate-slideUp">
              <div className="space-y-6">
                <h3 className="text-2xl font-light text-center text-gray-200 mb-8">
                  Sorunuzu yazın
                </h3>
                <div className="relative">
                  <Textarea
                    placeholder="Merak ettiğiniz konuyu buraya yazabilirsiniz..."
                    value={currentQuestion}
                    onChange={(e) => setCurrentQuestion(e.target.value)}
                    className="min-h-[120px] bg-gray-900 border-gray-700 text-white placeholder-gray-400 text-lg p-6 rounded-xl focus:border-white focus:ring-1 focus:ring-white resize-none"
                    disabled={isAsking}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        handleAskQuestion();
                      }
                    }}
                  />
                </div>
                <div className="flex justify-center space-x-4">
                  <Button
                    onClick={() => setShowQuestionBox(false)}
                    variant="outline"
                    className="px-6 py-3 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white rounded-full"
                  >
                    Geri
                  </Button>
                  <Button
                    onClick={handleAskQuestion}
                    disabled={isAsking || !currentQuestion.trim()}
                    className="px-8 py-3 bg-white text-black hover:bg-gray-200 rounded-full transition-all duration-300"
                  >
                    {isAsking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cevaplanıyor...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Gönder
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-center text-sm text-gray-500">
                  Ctrl + Enter ile gönderebilirsiniz
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cevap Görüntüleme */}
        {currentAnswer && (
          <div className="flex-1 flex items-start justify-center px-4 pt-20">
            <div className="w-full max-w-4xl animate-fadeIn">
              <div className="space-y-8">
                
                {/* Cevap */}
                <Card className="bg-gray-900 border-gray-700">
                  <CardContent className="p-8">
                    <div className="prose prose-invert max-w-none">
                      <div className="text-lg leading-relaxed text-gray-100 whitespace-pre-wrap">
                        {currentAnswer.answer}
                      </div>
                    </div>
                    
                    {currentAnswer.relevant_document_name && (
                      <div className="mt-6 pt-6 border-t border-gray-700">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm text-gray-400">
                            Kaynak: {currentAnswer.relevant_document_name}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Yeni Soru Butonu */}
                <div className="flex justify-center">
                  <Button
                    onClick={handleNewQuestion}
                    className="px-8 py-3 bg-white text-black hover:bg-gray-200 rounded-full transition-all duration-300"
                  >
                    Yeni Soru Sor
                  </Button>
                </div>
              </div>
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