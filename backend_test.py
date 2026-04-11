import requests
import sys
import json
import asyncio
import websockets
from datetime import datetime

class DentistAITester:
    def __init__(self, base_url="https://clinic-command-11.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 200:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, {}

    def test_auth_flow(self):
        """Test authentication endpoints"""
        print("\n🔐 TESTING AUTHENTICATION")
        
        # Test login with demo credentials
        success, response = self.run_test(
            "Login with demo credentials",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@dentistai.com", "password": "admin123"}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token obtained: {self.token[:20]}...")
            
            # Test get current user
            self.run_test(
                "Get current user",
                "GET", 
                "auth/me",
                200
            )
            
            return True
        else:
            print("❌ Login failed, cannot continue with authenticated tests")
            return False

    def test_dashboard_endpoints(self):
        """Test dashboard related endpoints"""
        print("\n📊 TESTING DASHBOARD")
        
        self.run_test(
            "Get dashboard stats",
            "GET",
            "dashboard/stats", 
            200
        )
        
        self.run_test(
            "Get today's schedule",
            "GET",
            "dashboard/today-schedule",
            200
        )
        
        self.run_test(
            "Get activity feed",
            "GET",
            "activity-feed",
            200
        )

    def test_aria_chat(self):
        """Test ARIA chat functionality"""
        print("\n🤖 TESTING ARIA CHAT")
        
        success, response = self.run_test(
            "ARIA chat - simple question",
            "POST",
            "aria/chat",
            200,
            data={"message": "What appointments do we have today?"}
        )
        
        if success and 'conversation_id' in response:
            conversation_id = response['conversation_id']
            print(f"   Conversation ID: {conversation_id}")
            
            # Test getting conversation history
            self.run_test(
                "Get ARIA conversation history",
                "GET",
                f"aria/conversations/{conversation_id}",
                200
            )

    def test_appointments_crud(self):
        """Test appointments CRUD operations"""
        print("\n📅 TESTING APPOINTMENTS")
        
        # Get appointments
        success, appointments = self.run_test(
            "Get all appointments",
            "GET",
            "appointments",
            200
        )
        
        if success:
            print(f"   Found {len(appointments)} appointments")
        
        # Create new appointment
        new_appointment = {
            "patient_name": "Test Patient",
            "patient_phone": "+1-555-9999",
            "date": "2024-12-20",
            "time": "10:00",
            "duration_mins": 30,
            "treatment_type": "Cleaning",
            "notes": "Test appointment"
        }
        
        success, created = self.run_test(
            "Create new appointment",
            "POST",
            "appointments",
            201,
            data=new_appointment
        )
        
        if success and 'id' in created:
            appointment_id = created['id']
            print(f"   Created appointment ID: {appointment_id}")
            
            # Update appointment
            self.run_test(
                "Update appointment",
                "PUT",
                f"appointments/{appointment_id}",
                200,
                data={"notes": "Updated test appointment"}
            )
            
            # Delete appointment
            self.run_test(
                "Delete appointment",
                "DELETE",
                f"appointments/{appointment_id}",
                200
            )

    def test_patients_crud(self):
        """Test patients CRUD operations"""
        print("\n👥 TESTING PATIENTS")
        
        # Get patients
        success, patients = self.run_test(
            "Get all patients",
            "GET",
            "patients",
            200
        )
        
        if success:
            print(f"   Found {len(patients)} patients")
            
            if patients:
                # Get specific patient
                patient_id = patients[0]['id']
                self.run_test(
                    "Get specific patient",
                    "GET",
                    f"patients/{patient_id}",
                    200
                )
        
        # Create new patient
        new_patient = {
            "name": "Test Patient API",
            "phone": "+1-555-8888",
            "email": "test@example.com",
            "notes": "Test patient from API"
        }
        
        success, created = self.run_test(
            "Create new patient",
            "POST",
            "patients",
            200,
            data=new_patient
        )
        
        if success and 'id' in created:
            patient_id = created['id']
            print(f"   Created patient ID: {patient_id}")

    def test_calls_endpoints(self):
        """Test calls endpoints"""
        print("\n📞 TESTING CALLS")
        
        success, calls = self.run_test(
            "Get all calls",
            "GET",
            "calls",
            200
        )
        
        if success:
            print(f"   Found {len(calls)} calls")
            
            if calls:
                # Get specific call
                call_id = calls[0]['id']
                self.run_test(
                    "Get specific call",
                    "GET",
                    f"calls/{call_id}",
                    200
                )

    def test_messages_endpoints(self):
        """Test WhatsApp messages endpoints"""
        print("\n💬 TESTING WHATSAPP MESSAGES")
        
        success, conversations = self.run_test(
            "Get message conversations",
            "GET",
            "messages/conversations",
            200
        )
        
        if success:
            print(f"   Found {len(conversations)} conversations")
            
            if conversations:
                # Get messages for first conversation
                patient_id = conversations[0]['patient_id']
                self.run_test(
                    "Get messages for patient",
                    "GET",
                    f"messages/{patient_id}",
                    200
                )

    def test_follow_ups_endpoints(self):
        """Test follow-ups endpoints"""
        print("\n🔄 TESTING FOLLOW-UPS")
        
        self.run_test(
            "Get follow-ups",
            "GET",
            "follow-ups",
            200
        )

    def test_settings_endpoints(self):
        """Test settings endpoints"""
        print("\n⚙️ TESTING SETTINGS")
        
        success, settings = self.run_test(
            "Get settings",
            "GET",
            "settings",
            200
        )
        
        if success:
            print(f"   Practice: {settings.get('name', 'Unknown')}")

    def test_logout(self):
        """Test logout"""
        print("\n🚪 TESTING LOGOUT")
        
        self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )

    def test_integrations_status(self):
        """Test GET /api/integrations/status"""
        print("\n🔌 TESTING INTEGRATIONS STATUS")
        success, response = self.run_test(
            "Get integrations status",
            "GET",
            "integrations/status",
            200
        )
        if success:
            # Check if all 4 integrations are present
            expected_integrations = ['retell', 'twilio', 'google_calendar', 'stripe']
            for integration in expected_integrations:
                if integration not in response:
                    print(f"   ⚠️  Missing integration: {integration}")
                    return False
            print(f"   ✅ All integrations present: {list(response.keys())}")
        return success

    def test_retell_status(self):
        """Test GET /api/retell/status"""
        print("\n📞 TESTING RETELL AI")
        success, response = self.run_test(
            "Get Retell AI status",
            "GET",
            "retell/status",
            200
        )
        if success:
            if 'connected' in response:
                print(f"   ✅ Retell connected: {response.get('connected')}")
                if response.get('connected'):
                    print(f"   ✅ Agents count: {response.get('agents', 0)}")
            else:
                print(f"   ⚠️  Missing 'connected' field in response")
        return success

    def test_twilio_status(self):
        """Test GET /api/twilio/status"""
        print("\n💬 TESTING TWILIO WHATSAPP")
        success, response = self.run_test(
            "Get Twilio status",
            "GET",
            "twilio/status",
            200
        )
        if success:
            if 'connected' in response and 'message' in response:
                print(f"   ✅ Twilio connected: {response.get('connected')}")
                print(f"   ✅ Message: {response.get('message')}")
                # Should mention Account SID needed
                if 'Account SID' in response.get('message', ''):
                    print(f"   ✅ Correctly indicates Account SID needed")
            else:
                print(f"   ⚠️  Missing expected fields in response")
        return success

    def test_google_auth_url(self):
        """Test GET /api/google/auth-url"""
        print("\n📅 TESTING GOOGLE CALENDAR")
        success, response = self.run_test(
            "Get Google OAuth URL",
            "GET",
            "google/auth-url",
            200
        )
        if success:
            if 'url' in response:
                url = response.get('url')
                if url and 'accounts.google.com' in str(url):
                    print(f"   ✅ Valid Google OAuth URL returned")
                elif url is None:
                    print(f"   ✅ No URL (not configured): {response.get('message', '')}")
                else:
                    print(f"   ⚠️  Invalid OAuth URL: {url}")
            else:
                print(f"   ⚠️  Missing 'url' field in response")
        return success

    def test_billing_plans(self):
        """Test GET /api/billing/plans"""
        print("\n💳 TESTING STRIPE BILLING")
        success, response = self.run_test(
            "Get billing plans",
            "GET",
            "billing/plans",
            200
        )
        if success:
            if 'plans' in response:
                plans = response['plans']
                expected_plans = ['starter', 'professional', 'enterprise']
                for plan in expected_plans:
                    if plan in plans:
                        plan_data = plans[plan]
                        print(f"   ✅ {plan}: ${plan_data.get('price', 0)} - {len(plan_data.get('features', []))} features")
                    else:
                        print(f"   ⚠️  Missing plan: {plan}")
                        return False
            else:
                print(f"   ⚠️  Missing 'plans' field in response")
        return success

    def test_billing_checkout(self):
        """Test POST /api/billing/checkout"""
        success, response = self.run_test(
            "Create Stripe checkout session",
            "POST",
            "billing/checkout",
            200,
            data={"plan": "starter", "origin_url": "https://test.com"}
        )
        if success:
            if 'url' in response and 'session_id' in response:
                print(f"   ✅ Checkout session created")
                print(f"   ✅ Session ID: {response.get('session_id', '')[:20]}...")
            else:
                print(f"   ⚠️  Missing checkout URL or session ID")
        return success

    def test_retell_webhook(self):
        """Test POST /api/webhooks/retell"""
        print("\n🔗 TESTING WEBHOOKS")
        webhook_payload = {
            "call": {
                "call_id": "test-call-123",
                "transcript": "Hello, I'd like to book an appointment for next week",
                "from_number": "+1-555-0101",
                "direction": "inbound",
                "duration_ms": 45000
            }
        }
        success, response = self.run_test(
            "Retell webhook",
            "POST",
            "webhooks/retell",
            200,
            data=webhook_payload
        )
        if success:
            if response.get('status') == 'received':
                print(f"   ✅ Webhook processed successfully")
            else:
                print(f"   ⚠️  Unexpected webhook response: {response}")
        return success

    def test_whatsapp_webhook(self):
        """Test POST /api/webhooks/whatsapp"""
        webhook_payload = {
            "Body": "Hi, I need to reschedule my appointment",
            "From": "whatsapp:+1-555-0102"
        }
        success, response = self.run_test(
            "WhatsApp webhook",
            "POST",
            "webhooks/whatsapp",
            200,
            data=webhook_payload
        )
        if success:
            if response.get('status') == 'received':
                print(f"   ✅ WhatsApp webhook processed successfully")
            else:
                print(f"   ⚠️  Unexpected webhook response: {response}")
        return success

    async def test_websocket(self):
        """Test WebSocket connection"""
        ws_url = self.base_url.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/demo-practice-001'
        print(f"\n🌐 TESTING WEBSOCKET")
        print(f"   URL: {ws_url}")
        
        try:
            # Use asyncio.wait_for for timeout instead of websockets timeout parameter
            async def connect_and_test():
                async with websockets.connect(ws_url) as websocket:
                    print(f"   ✅ WebSocket connected successfully")
                    
                    # Send a ping
                    await websocket.send("ping")
                    response = await asyncio.wait_for(websocket.recv(), timeout=5)
                    response_data = json.loads(response)
                    
                    if response_data.get('type') == 'pong':
                        print(f"   ✅ Ping/pong successful")
                        return True
                    else:
                        print(f"   ⚠️  Unexpected response: {response}")
                        self.failed_tests.append("WebSocket: Unexpected ping response")
                        return False
            
            result = await asyncio.wait_for(connect_and_test(), timeout=10)
            if result:
                self.tests_passed += 1
            self.tests_run += 1
            return result
                
        except Exception as e:
            print(f"   ❌ WebSocket connection failed: {str(e)}")
            self.failed_tests.append(f"WebSocket: {str(e)}")
            self.tests_run += 1
            return False

def main():
    print("🦷 DentistAI Backend API Testing")
    print("=" * 50)
    
    tester = DentistAITester()
    
    # Test authentication first
    if not tester.test_auth_flow():
        print("\n❌ Authentication failed - stopping tests")
        return 1
    
    # Test all existing endpoints
    tester.test_dashboard_endpoints()
    tester.test_aria_chat()
    tester.test_appointments_crud()
    tester.test_patients_crud()
    tester.test_calls_endpoints()
    tester.test_messages_endpoints()
    tester.test_follow_ups_endpoints()
    tester.test_settings_endpoints()
    
    # Test new integration endpoints
    tester.test_integrations_status()
    tester.test_retell_status()
    tester.test_twilio_status()
    tester.test_google_auth_url()
    tester.test_billing_plans()
    tester.test_billing_checkout()
    tester.test_retell_webhook()
    tester.test_whatsapp_webhook()
    
    # Test WebSocket connection
    try:
        asyncio.run(tester.test_websocket())
    except Exception as e:
        print(f"❌ WebSocket test failed with exception: {str(e)}")
        tester.failed_tests.append(f"WebSocket: {str(e)}")
        tester.tests_run += 1
    
    tester.test_logout()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests:")
        for failure in tester.failed_tests:
            print(f"   • {failure}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    if success_rate >= 90:
        print("🎉 Backend is working excellently!")
        return 0
    elif success_rate >= 70:
        print("⚠️ Backend has some issues but mostly working")
        return 0
    else:
        print("❌ Backend has significant issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())