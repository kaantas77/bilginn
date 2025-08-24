import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { Upload, FileText, MessageCircle, Send, Book, Loader2 } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { useToast } from "./hooks/use-toast";
import { Toaster } from "./components/ui/toaster";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [documents, setDocuments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const { toast } = useToast();

  // Belgeleri yükle
  const loadDocuments = async () => {
    try {
      const response = await axios.get(`${API}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error("Belgeler yüklenemedi:", error);
      toast({
        title: "Hata",
        description: "Belgeler yüklenemedi",
        variant: "destructive",
      });
    }
  };

  // Soru geçmişini yükle
  const loadQuestions = async () => {
    try {
      const response = await axios.get(`${API}/questions`);
      setQuestions(response.data.slice(0, 5)); // Son 5 soruyu göster
    } catch (error) {
      console.error("Soru geçmişi yüklenemedi:", error);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadQuestions();
  }, []);

  // Dosya yükleme
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Dosya tipi kontrolü
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
      const response = await axios.post(`${API}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast({
        title: "Başarı",
        description: `${file.name} başarıyla yüklendi`,
      });

      loadDocuments();
      event.target.value = ''; // Input'u temizle
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
      loadQuestions();

      toast({
        title: "Başarı",
        description: "Sorunuz cevaplanıyor",
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  const getFileTypeIcon = (fileType) => {
    switch (fileType) {
      case 'pdf':
        return '📄';
      case 'docx':
        return '📝';
      case 'txt':
        return '📋';
      default:
        return '📄';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Toaster />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Book className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Akademik Makale Asistanı</h1>
              <p className="text-gray-600">Makalelerinizi yükleyin ve sorular sorun</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sol Panel - Dosya Yükleme ve Belgeler */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Dosya Yükleme */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5" />
                  <span>Belge Yükle</span>
                </CardTitle>
                <CardDescription>
                  PDF, Word veya TXT dosyalarınızı yükleyin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    {isUploading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Yükleniyor...</span>
                      </div>
                    ) : (
                      <div>
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          Dosya seçmek için tıklayın
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PDF, Word, TXT
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Yüklenen Belgeler */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Yüklenen Belgeler ({documents.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    Henüz belge yüklenmemiş
                  </p>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <span className="text-lg">{getFileTypeIcon(doc.file_type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {doc.filename}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(doc.upload_date)}
                            </p>
                            <Badge variant="secondary" className="mt-1">
                              {doc.file_type.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sağ Panel - Soru Sorma ve Cevaplar */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Soru Sorma */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Soru Sor</span>
                </CardTitle>
                <CardDescription>
                  Yüklediğiniz belgeler hakkında soru sorun
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    placeholder="Sorunuzu buraya yazın..."
                    value={currentQuestion}
                    onChange={(e) => setCurrentQuestion(e.target.value)}
                    className="min-h-[100px]"
                    disabled={isAsking}
                  />
                  <Button 
                    onClick={handleAskQuestion}
                    disabled={isAsking || !currentQuestion.trim()}
                    className="w-full"
                  >
                    {isAsking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cevap alınıyor...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Soru Sor
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Güncel Cevap */}
            {currentAnswer && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-blue-900">Cevap</CardTitle>
                  {currentAnswer.relevant_document_name && (
                    <CardDescription className="text-blue-700">
                      Kaynak: {currentAnswer.relevant_document_name}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-800 whitespace-pre-wrap">{currentAnswer.answer}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Soru Geçmişi */}
            {questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Son Sorular</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {questions.map((qa, index) => (
                      <div key={qa.id} className="border-l-4 border-gray-200 pl-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 mb-1">
                              {qa.question}
                            </p>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-3">
                              {qa.answer}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(qa.timestamp)}
                            </p>
                          </div>
                        </div>
                        {index < questions.length - 1 && <Separator className="mt-4" />}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;