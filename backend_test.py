import requests
import sys
import json
import io
from datetime import datetime

class AcademicPaperAPITester:
    def __init__(self, base_url="https://paper-insight.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_message = "Akademik Makale Soru-Cevap Sistemi"
                if data.get("message") == expected_message:
                    self.log_test("Root Endpoint", True)
                    return True
                else:
                    self.log_test("Root Endpoint", False, f"Unexpected message: {data}")
                    return False
            else:
                self.log_test("Root Endpoint", False, f"Status code: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Exception: {str(e)}")
            return False

    def test_get_documents(self):
        """Test getting documents list"""
        try:
            response = requests.get(f"{self.api_url}/documents", timeout=10)
            success = response.status_code == 200
            
            if success:
                documents = response.json()
                if isinstance(documents, list):
                    self.log_test("Get Documents", True, f"Found {len(documents)} documents")
                    return documents
                else:
                    self.log_test("Get Documents", False, "Response is not a list")
                    return []
            else:
                self.log_test("Get Documents", False, f"Status code: {response.status_code}")
                return []
                
        except Exception as e:
            self.log_test("Get Documents", False, f"Exception: {str(e)}")
            return []

    def test_get_questions(self):
        """Test getting question history"""
        try:
            response = requests.get(f"{self.api_url}/questions", timeout=10)
            success = response.status_code == 200
            
            if success:
                questions = response.json()
                if isinstance(questions, list):
                    self.log_test("Get Questions History", True, f"Found {len(questions)} questions")
                    return questions
                else:
                    self.log_test("Get Questions History", False, "Response is not a list")
                    return []
            else:
                self.log_test("Get Questions History", False, f"Status code: {response.status_code}")
                return []
                
        except Exception as e:
            self.log_test("Get Questions History", False, f"Exception: {str(e)}")
            return []

    def test_upload_document(self):
        """Test document upload with a sample text file"""
        try:
            # Create a sample text file
            test_content = """Bu bir test belgesidir.
            
Akademik Makale Test İçeriği:

1. Giriş
Bu belge, akademik makale soru-cevap sistemini test etmek için oluşturulmuştur.

2. Metodoloji  
Test metodolojisi şu adımları içerir:
- Belge yükleme testi
- Soru sorma testi
- Cevap alma testi

3. Sonuç
Bu test belgesi, sistemin Türkçe içerik işleme kabiliyetini test eder.

Anahtar kelimeler: test, akademik, makale, sistem, Türkçe
"""
            
            # Create file-like object
            files = {
                'file': ('test_document.txt', io.StringIO(test_content), 'text/plain')
            }
            
            response = requests.post(f"{self.api_url}/upload", files=files, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                document_id = data.get('document_id')
                if document_id:
                    self.log_test("Upload Document", True, f"Document ID: {document_id}")
                    return document_id
                else:
                    self.log_test("Upload Document", False, "No document ID returned")
                    return None
            else:
                self.log_test("Upload Document", False, f"Status code: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Upload Document", False, f"Exception: {str(e)}")
            return None

    def test_ask_question(self, question="Bu belge ne hakkında?"):
        """Test asking a question"""
        try:
            payload = {"question": question}
            response = requests.post(
                f"{self.api_url}/ask", 
                json=payload, 
                headers={'Content-Type': 'application/json'},
                timeout=60  # Longer timeout for AI response
            )
            
            if response.status_code == 200:
                data = response.json()
                answer = data.get('answer')
                relevant_doc = data.get('relevant_document_name')
                
                if answer:
                    self.log_test("Ask Question", True, f"Answer received (length: {len(answer)}), Relevant doc: {relevant_doc}")
                    return data
                else:
                    self.log_test("Ask Question", False, "No answer in response")
                    return None
            else:
                self.log_test("Ask Question", False, f"Status code: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Ask Question", False, f"Exception: {str(e)}")
            return None

    def test_invalid_file_upload(self):
        """Test uploading an invalid file type"""
        try:
            # Create a fake image file
            files = {
                'file': ('test.jpg', io.BytesIO(b'fake image content'), 'image/jpeg')
            }
            
            response = requests.post(f"{self.api_url}/upload", files=files, timeout=10)
            
            # Should return 400 for invalid file type
            if response.status_code == 400:
                self.log_test("Invalid File Upload", True, "Correctly rejected invalid file type")
                return True
            else:
                self.log_test("Invalid File Upload", False, f"Expected 400, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Invalid File Upload", False, f"Exception: {str(e)}")
            return False

    def test_empty_question(self):
        """Test asking an empty question"""
        try:
            payload = {"question": ""}
            response = requests.post(
                f"{self.api_url}/ask", 
                json=payload, 
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            # Should return 400 for empty question
            if response.status_code == 400:
                self.log_test("Empty Question", True, "Correctly rejected empty question")
                return True
            else:
                self.log_test("Empty Question", False, f"Expected 400, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Empty Question", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Academic Paper Q&A API Tests")
        print(f"📍 Testing API at: {self.api_url}")
        print("=" * 60)
        
        # Test basic endpoints
        print("\n📋 Testing Basic Endpoints:")
        self.test_root_endpoint()
        
        # Test data retrieval
        print("\n📊 Testing Data Retrieval:")
        documents = self.test_get_documents()
        questions = self.test_get_questions()
        
        # Test document upload
        print("\n📤 Testing Document Upload:")
        document_id = self.test_upload_document()
        
        # Test question asking
        print("\n❓ Testing Question Asking:")
        if document_id or len(documents) > 0:
            answer_data = self.test_ask_question("Bu belge ne hakkında? Kısa bir özet verir misin?")
        else:
            print("⚠️  No documents available for question testing")
        
        # Test error handling
        print("\n🚫 Testing Error Handling:")
        self.test_invalid_file_upload()
        self.test_empty_question()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY:")
        print(f"✅ Tests Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}/{self.tests_run}")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check the details above.")
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['name']}: {result['details']}")
            return 1

def main():
    tester = AcademicPaperAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())