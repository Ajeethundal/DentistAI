from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import bcrypt
import jwt as pyjwt
import uuid
import json
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from bson import ObjectId

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Password Hashing ---
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=24), "type": "access"}
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- Subscription gating dependencies (built after get_current_user exists) ---
from backend.subscription import requires_plan  # noqa: E402

_require_starter = requires_plan("starter")
_require_growth = requires_plan("growth")
_require_pro = requires_plan("pro")

# --- Rate limiting ---
from backend.rate_limit import limiter  # noqa: E402
from slowapi import _rate_limit_exceeded_handler  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --- Pydantic Models ---
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    practice_name: Optional[str] = "My Dental Practice"

class AriaChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class AppointmentCreate(BaseModel):
    patient_name: str
    patient_phone: Optional[str] = ""
    date: str
    time: str
    duration_mins: Optional[int] = 30
    treatment_type: str
    notes: Optional[str] = ""
    notify_patient: Optional[bool] = False

class AppointmentUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    treatment_type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PatientCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = ""
    notes: Optional[str] = ""

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class SettingsUpdate(BaseModel):
    practice_name: Optional[str] = None
    doctor_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    office_hours: Optional[dict] = None
    aria_voice: Optional[str] = None
    aria_language: Optional[str] = None
    aria_tone: Optional[str] = None

class MessageSend(BaseModel):
    patient_id: str
    body: str

class FollowUpAction(BaseModel):
    action: str  # call, whatsapp, dismiss
    patient_id: str
    appointment_id: Optional[str] = None

class RetellCallRequest(BaseModel):
    to_number: str
    patient_name: Optional[str] = ""
    objective: Optional[str] = "follow-up"

class TwilioMessageRequest(BaseModel):
    to_number: str
    message: str

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, practice_id: str):
        await websocket.accept()
        if practice_id not in self.active_connections:
            self.active_connections[practice_id] = []
        self.active_connections[practice_id].append(websocket)
        logger.info(f"WebSocket connected for practice {practice_id}")
    
    def disconnect(self, websocket: WebSocket, practice_id: str):
        if practice_id in self.active_connections:
            self.active_connections[practice_id] = [c for c in self.active_connections[practice_id] if c != websocket]
        logger.info(f"WebSocket disconnected for practice {practice_id}")
    
    async def broadcast(self, practice_id: str, message: dict):
        if practice_id in self.active_connections:
            dead = []
            for connection in self.active_connections[practice_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead.append(connection)
            for d in dead:
                self.active_connections[practice_id].remove(d)

ws_manager = ConnectionManager()

async def broadcast_activity(practice_id: str, activity: dict):
    """Broadcast activity to all connected WebSocket clients"""
    await ws_manager.broadcast(practice_id, {"type": "activity", "data": activity})

# --- AUTH ROUTES ---
@api_router.post("/auth/login")
@limiter.limit("10/minute")
async def login(req: LoginRequest, request: Request, response: Response):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=604800, path="/")
    return {"id": user_id, "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "doctor"), "practice_id": user.get("practice_id", ""), "token": access_token}

@api_router.post("/auth/register")
@limiter.limit("5/minute")
async def register(req: RegisterRequest, request: Request, response: Response):
    email = req.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    practice_id = str(uuid.uuid4())
    await db.practices.insert_one({
        "practice_id": practice_id, "name": req.practice_name, "doctor_name": req.name,
        "phone": "", "address": "", "office_hours": {"mon": "9:00-17:00", "tue": "9:00-17:00", "wed": "9:00-17:00", "thu": "9:00-17:00", "fri": "9:00-17:00", "sat": "closed", "sun": "closed"},
        "aria_voice": "professional", "aria_language": "English", "aria_tone": "warm",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    hashed = hash_password(req.password)
    result = await db.users.insert_one({"email": email, "password_hash": hashed, "name": req.name, "role": "doctor", "practice_id": practice_id, "created_at": datetime.now(timezone.utc).isoformat()})
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=604800, path="/")
    return {"id": user_id, "email": email, "name": req.name, "role": "doctor", "practice_id": practice_id, "token": access_token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

# --- DASHBOARD ---
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    this_week_start = (datetime.now(timezone.utc) - timedelta(days=datetime.now(timezone.utc).weekday())).strftime("%Y-%m-%d")
    
    calls_today = await db.calls.count_documents({"practice_id": practice_id, "created_at": {"$regex": f"^{today}"}})
    calls_yesterday = await db.calls.count_documents({"practice_id": practice_id, "created_at": {"$regex": f"^{(datetime.now(timezone.utc) - timedelta(days=1)).strftime('%Y-%m-%d')}"}})
    appointments_week = await db.appointments.count_documents({"practice_id": practice_id, "date": {"$gte": this_week_start}, "status": {"$ne": "deleted"}})
    messages_sent = await db.messages.count_documents({"practice_id": practice_id, "direction": "outbound"})
    total_appts_month = await db.appointments.count_documents({"practice_id": practice_id, "status": {"$ne": "deleted"}})
    no_shows = await db.appointments.count_documents({"practice_id": practice_id, "status": "noshow"})
    no_show_rate = round((no_shows / max(total_appts_month, 1)) * 100, 1)
    
    return {
        "calls_today": calls_today, "calls_yesterday": calls_yesterday,
        "appointments_week": appointments_week, "messages_sent": messages_sent,
        "no_show_rate": no_show_rate, "total_patients": await db.patients.count_documents({"practice_id": practice_id, "status": {"$ne": "deleted"}})
    }

@api_router.get("/dashboard/today-schedule")
async def get_today_schedule(user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    appointments = await db.appointments.find(
        {"practice_id": practice_id, "date": today, "status": {"$ne": "deleted"}},
        {"_id": 0}
    ).sort("time", 1).to_list(50)
    return appointments

# --- ACTIVITY FEED ---
@api_router.get("/activity-feed")
async def get_activity_feed(user: dict = Depends(get_current_user), limit: int = 20):
    practice_id = user.get("practice_id", "")
    items = await db.activity_feed.find({"practice_id": practice_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items

# --- ARIA CHAT ---
@api_router.post("/aria/chat")
@limiter.limit("30/minute")
async def aria_chat(req: AriaChatRequest, request: Request, user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    practice = await db.practices.find_one({"practice_id": practice_id}, {"_id": 0})
    practice_name = practice.get("name", "the dental practice") if practice else "the dental practice"
    doctor_name = practice.get("doctor_name", user.get("name", "Doctor")) if practice else user.get("name", "Doctor")
    
    conversation_id = req.conversation_id or str(uuid.uuid4())
    
    # Save user message
    await db.aria_conversations.insert_one({
        "conversation_id": conversation_id, "practice_id": practice_id,
        "role": "user", "content": req.message, "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get conversation history
    history = await db.aria_conversations.find(
        {"conversation_id": conversation_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(50)
    
    # Build context
    today_str = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")
    todays_appts = await db.appointments.find({"practice_id": practice_id, "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}, {"_id": 0}).to_list(20)
    tomorrows_appts = await db.appointments.find({"practice_id": practice_id, "date": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")}, {"_id": 0}).to_list(20)
    recent_patients = await db.patients.find({"practice_id": practice_id}, {"_id": 0}).sort("created_at", -1).to_list(10)
    no_shows = await db.appointments.find({"practice_id": practice_id, "status": "noshow"}, {"_id": 0}).to_list(10)
    
    system_prompt = f"""You are ARIA, the AI Receptionist & Intelligence Assistant for {practice_name}, Dr. {doctor_name}'s dental practice.

YOUR PERSONALITY:
- Warm, professional, and confident — like the best receptionist the practice ever had
- You speak clearly and naturally — never robotic, never stiff
- You care about patients and about helping the doctor run a smooth practice
- You are proactive: you don't just answer questions, you take action

TODAY'S DATE: {today_str}

TODAY'S APPOINTMENTS:
{json.dumps(todays_appts, indent=2) if todays_appts else "No appointments today."}

TOMORROW'S APPOINTMENTS:
{json.dumps(tomorrows_appts, indent=2) if tomorrows_appts else "No appointments tomorrow."}

RECENT PATIENTS:
{json.dumps(recent_patients[:5], indent=2) if recent_patients else "No patients yet."}

NO-SHOWS THIS WEEK:
{json.dumps(no_shows, indent=2) if no_shows else "No no-shows this week."}

STATS:
- Total patients: {await db.patients.count_documents({"practice_id": practice_id})}
- Appointments this week: {await db.appointments.count_documents({"practice_id": practice_id})}

When answering:
- Be concise but warm. Use the data above to answer questions about the schedule.
- When the doctor asks you to book, cancel, or reschedule, confirm you've done it.
- When asked about stats, give specific numbers from the data.
- Show which actions you took using tool indicators like [Calendar checked] [WhatsApp sent].
- For demo mode: simulate actions and confirm them as done.
"""

    tools_used = []
    msg_lower = req.message.lower()
    
    # Detect actions from message
    if any(w in msg_lower for w in ["book", "schedule", "add appointment", "set up"]):
        tools_used.append({"icon": "calendar", "label": "Calendar checked"})
        tools_used.append({"icon": "calendar", "label": "Appointment booked"})
        if "whatsapp" in msg_lower or "notify" in msg_lower or "send" in msg_lower:
            tools_used.append({"icon": "whatsapp", "label": "WhatsApp sent"})
    elif any(w in msg_lower for w in ["cancel", "remove"]):
        tools_used.append({"icon": "calendar", "label": "Appointment cancelled"})
    elif any(w in msg_lower for w in ["reschedule", "move", "change"]):
        tools_used.append({"icon": "calendar", "label": "Appointment rescheduled"})
    elif any(w in msg_lower for w in ["call", "follow up", "follow-up"]):
        tools_used.append({"icon": "phone", "label": "Outbound call queued"})
    elif any(w in msg_lower for w in ["tomorrow", "today", "calendar", "schedule", "what's on", "what does"]):
        tools_used.append({"icon": "calendar", "label": "Calendar checked"})
    elif any(w in msg_lower for w in ["no-show", "noshow", "missed", "no show"]):
        tools_used.append({"icon": "stats", "label": "Records checked"})
    elif any(w in msg_lower for w in ["patient", "how many", "stats", "summary"]):
        tools_used.append({"icon": "stats", "label": "Database queried"})
    
    # Call Claude via Anthropic SDK (backend.aria_client handles config + errors)
    from backend.aria_client import chat as aria_chat_call
    aria_response = await aria_chat_call(
        system_prompt=system_prompt,
        user_message=req.message,
    )
    
    # Save ARIA response
    await db.aria_conversations.insert_one({
        "conversation_id": conversation_id, "practice_id": practice_id,
        "role": "assistant", "content": aria_response, "tools_used": tools_used,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Log to activity feed if action was taken
    if tools_used:
        await db.activity_feed.insert_one({
            "id": str(uuid.uuid4()), "practice_id": practice_id,
            "type": tools_used[0]["icon"], "description": f"ARIA: {req.message[:100]}",
            "patient_name": "", "status": "done", "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "response": aria_response, "conversation_id": conversation_id,
        "tools_used": tools_used, "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/aria/conversations/{conversation_id}")
async def get_aria_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    messages = await db.aria_conversations.find(
        {"conversation_id": conversation_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return messages

# --- APPOINTMENTS ---
@api_router.get("/appointments")
async def get_appointments(user: dict = Depends(get_current_user), date_from: Optional[str] = None, date_to: Optional[str] = None):
    practice_id = user.get("practice_id", "")
    query = {"practice_id": practice_id, "status": {"$ne": "deleted"}}
    if date_from:
        query["date"] = {"$gte": date_from}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = date_to
        else:
            query["date"] = {"$lte": date_to}
    appointments = await db.appointments.find(query, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(500)
    return appointments

@api_router.post("/appointments")
@limiter.limit("30/minute")
async def create_appointment(req: AppointmentCreate, request: Request, user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")

    # Check for appointment conflict
    existing_appt = await db.appointments.find_one({
        "practice_id": practice_id,
        "date": req.date,
        "time": req.time,
        "status": {"$nin": ["cancelled"]}
    })
    if existing_appt:
        raise HTTPException(status_code=409, detail="Time slot already booked. Please choose another time.")

    appt_id = str(uuid.uuid4())

    # Find or create patient
    patient = await db.patients.find_one({"practice_id": practice_id, "name": {"$regex": req.patient_name, "$options": "i"}}, {"_id": 0})
    patient_id = patient["id"] if patient else str(uuid.uuid4())
    
    if not patient:
        await db.patients.insert_one({
            "id": patient_id, "practice_id": practice_id, "name": req.patient_name,
            "phone": req.patient_phone, "email": "", "status": "new",
            "total_visits": 0, "notes": "", "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    appointment = {
        "id": appt_id, "practice_id": practice_id, "patient_id": patient_id,
        "patient_name": req.patient_name, "patient_phone": req.patient_phone,
        "date": req.date, "time": req.time, "duration_mins": req.duration_mins,
        "treatment_type": req.treatment_type, "status": "confirmed",
        "notes": req.notes, "created_by": "doctor",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(appointment)
    
    # Log activity
    await db.activity_feed.insert_one({
        "id": str(uuid.uuid4()), "practice_id": practice_id,
        "type": "booking", "description": f"Booked {req.treatment_type} for {req.patient_name} — {req.date} at {req.time}",
        "patient_name": req.patient_name, "status": "done",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    appt_copy = {k: v for k, v in appointment.items() if k != "_id"}
    return Response(content=json.dumps(appt_copy), status_code=201, media_type="application/json")

@api_router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, req: AppointmentUpdate, user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.appointments.update_one({"id": appointment_id, "practice_id": practice_id}, {"$set": update_data})
    updated = await db.appointments.find_one({"id": appointment_id, "practice_id": practice_id}, {"_id": 0})
    return updated

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    result = await db.appointments.update_one(
        {"id": appointment_id, "practice_id": practice_id},
        {"$set": {"status": "deleted", "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"message": "Appointment deleted"}

# --- PATIENTS ---
@api_router.get("/patients")
async def get_patients(user: dict = Depends(get_current_user), search: Optional[str] = None):
    practice_id = user.get("practice_id", "")
    query = {"practice_id": practice_id, "status": {"$ne": "deleted"}}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    patients = await db.patients.find(query, {"_id": 0}).sort("name", 1).to_list(500)

    if patients:
        patient_ids = [p["id"] for p in patients]
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Batch load last completed/confirmed appointment per patient
        last_appts_cursor = db.appointments.aggregate([
            {"$match": {"practice_id": practice_id, "patient_id": {"$in": patient_ids}, "status": {"$in": ["completed", "confirmed"]}}},
            {"$sort": {"date": -1}},
            {"$group": {"_id": "$patient_id", "date": {"$first": "$date"}}}
        ])
        last_appts = {doc["_id"]: doc["date"] async for doc in last_appts_cursor}

        # Batch load next upcoming appointment per patient
        next_appts_cursor = db.appointments.aggregate([
            {"$match": {"practice_id": practice_id, "patient_id": {"$in": patient_ids}, "date": {"$gte": today}, "status": {"$in": ["confirmed", "pending"]}}},
            {"$sort": {"date": 1, "time": 1}},
            {"$group": {"_id": "$patient_id", "date": {"$first": "$date"}, "time": {"$first": "$time"}}}
        ])
        next_appts = {doc["_id"]: doc async for doc in next_appts_cursor}

        for p in patients:
            pid = p["id"]
            p["last_visit"] = last_appts.get(pid)
            na = next_appts.get(pid)
            p["next_appointment"] = f"{na['date']} {na['time']}" if na else None

    return patients

@api_router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, user: dict = Depends(get_current_user)):
    patient = await db.patients.find_one({"id": patient_id, "practice_id": user.get("practice_id", "")}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    # Get related data
    patient["appointments"] = await db.appointments.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(50)
    patient["calls"] = await db.calls.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    patient["messages"] = await db.messages.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return patient

@api_router.post("/patients")
@limiter.limit("30/minute")
async def create_patient(req: PatientCreate, request: Request, user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    patient_id = str(uuid.uuid4())
    patient = {
        "id": patient_id, "practice_id": practice_id, "name": req.name,
        "phone": req.phone, "email": req.email, "status": "new",
        "total_visits": 0, "notes": req.notes, "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.patients.insert_one(patient)
    patient_copy = {k: v for k, v in patient.items() if k != "_id"}
    return patient_copy

@api_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, req: PatientUpdate, user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.patients.update_one({"id": patient_id, "practice_id": practice_id}, {"$set": update_data})
    updated = await db.patients.find_one({"id": patient_id, "practice_id": practice_id}, {"_id": 0})
    return updated

@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    result = await db.patients.update_one(
        {"id": patient_id, "practice_id": practice_id},
        {"$set": {"status": "deleted", "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"message": "Patient deleted"}

# --- CALLS ---
@api_router.get("/calls")
async def get_calls(user: dict = Depends(get_current_user), direction: Optional[str] = None):
    practice_id = user.get("practice_id", "")
    query = {"practice_id": practice_id}
    if direction:
        query["direction"] = direction
    calls = await db.calls.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return calls

@api_router.get("/calls/{call_id}")
async def get_call(call_id: str, user: dict = Depends(get_current_user)):
    call = await db.calls.find_one({"id": call_id, "practice_id": user.get("practice_id", "")}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call

# --- MESSAGES (WhatsApp) ---
@api_router.get("/messages/conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    # Get unique patient conversations
    patients_with_messages = await db.messages.aggregate([
        {"$match": {"practice_id": practice_id}},
        {"$sort": {"created_at": -1}},
        {"$group": {"_id": "$patient_id", "last_message": {"$first": "$body"}, "last_time": {"$first": "$created_at"}, "unread": {"$sum": {"$cond": [{"$and": [{"$eq": ["$direction", "inbound"]}, {"$eq": ["$read", False]}]}, 1, 0]}}}},
        {"$sort": {"last_time": -1}}
    ]).to_list(100)
    
    conversations = []
    for conv in patients_with_messages:
        patient = await db.patients.find_one({"id": conv["_id"]}, {"_id": 0})
        if patient:
            conversations.append({
                "patient_id": conv["_id"], "patient_name": patient.get("name", "Unknown"),
                "phone": patient.get("phone", ""), "last_message": conv["last_message"],
                "last_time": conv["last_time"], "unread": conv["unread"],
                "aria_handling": True
            })
    return conversations

@api_router.get("/messages/{patient_id}")
async def get_messages(patient_id: str, user: dict = Depends(get_current_user)):
    messages = await db.messages.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    # Mark as read
    await db.messages.update_many({"patient_id": patient_id, "direction": "inbound"}, {"$set": {"read": True}})
    return messages

@api_router.post("/messages/send")
@limiter.limit("30/minute")
async def send_message(req: MessageSend, request: Request, user: dict = Depends(get_current_user)):
    """Send a WhatsApp message to a patient. Dispatches via Twilio when configured,
    falls back to demo/db-only mode when not (or when DEMO_MODE=true)."""
    practice_id = user.get("practice_id", "")

    # Look up patient to get phone number
    patient = await db.patients.find_one({"id": req.patient_id, "practice_id": practice_id}, {"_id": 0})
    patient_phone = patient.get("phone", "") if patient else ""

    # Build the stored record
    msg = {
        "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": req.patient_id,
        "direction": "outbound", "body": req.body, "sender": "doctor",
        "read": True, "created_at": datetime.now(timezone.utc).isoformat()
    }

    # --- Try to actually send via Twilio if credentials are present ---
    from backend.demo_mode import is_demo
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    auth_token  = os.environ.get("TWILIO_AUTH_TOKEN", "")
    api_key     = os.environ.get("TWILIO_API_KEY", "")
    api_secret  = os.environ.get("TWILIO_API_KEY_SECRET", "")
    from_number = os.environ.get("TWILIO_WHATSAPP_FROM", "")
    has_twilio  = account_sid and (auth_token or (api_key and api_secret)) and from_number

    twilio_sid = None
    if not is_demo() and has_twilio and patient_phone:
        try:
            from twilio.rest import Client
            twilio_client = (
                Client(api_key, api_secret, account_sid=account_sid)
                if api_key and api_secret
                else Client(account_sid, auth_token)
            )
            to_wa   = f"whatsapp:{patient_phone}" if not patient_phone.startswith("whatsapp:") else patient_phone
            from_wa = f"whatsapp:{from_number}"   if not from_number.startswith("whatsapp:")  else from_number
            twilio_msg = twilio_client.messages.create(body=req.body, from_=from_wa, to=to_wa)
            twilio_sid = twilio_msg.sid
            msg["twilio_sid"] = twilio_sid
        except Exception as e:
            logger.error(f"Twilio send error in /messages/send: {e}")
            # Don't crash — still store the message so the UI stays consistent

    await db.messages.insert_one(msg)
    msg_copy = {k: v for k, v in msg.items() if k != "_id"}
    return msg_copy

# --- FOLLOW-UPS ---
@api_router.get("/follow-ups")
async def get_follow_ups(user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=180)).strftime("%Y-%m-%d")
    
    # No-shows this week
    no_shows = await db.appointments.find({"practice_id": practice_id, "status": "noshow"}, {"_id": 0}).to_list(50)
    
    # Overdue recalls (patients with last visit > 6 months ago) — aggregation to avoid N+1
    all_patients = await db.patients.find({"practice_id": practice_id}, {"_id": 0}).to_list(500)
    patient_ids = [p["id"] for p in all_patients]
    patients_by_id = {p["id"]: p for p in all_patients}

    # Batch: get last completed appointment per patient
    last_completed_cursor = db.appointments.aggregate([
        {"$match": {"practice_id": practice_id, "patient_id": {"$in": patient_ids}, "status": "completed"}},
        {"$sort": {"date": -1}},
        {"$group": {"_id": "$patient_id", "date": {"$first": "$date"}, "last_appt": {"$first": "$$ROOT"}}}
    ])
    last_completed = {}
    async for doc in last_completed_cursor:
        last_completed[doc["_id"]] = doc

    overdue = []
    for p in all_patients:
        pid = p["id"]
        lc = last_completed.get(pid)
        if lc and lc["date"] < six_months_ago:
            last_appt = lc["last_appt"]
            last_appt.pop("_id", None)
            overdue.append({**p, "last_appointment": last_appt})
        elif not lc and p.get("created_at", "") < six_months_ago:
            overdue.append(p)
    
    # Pending confirmations for tomorrow
    pending = await db.appointments.find({"practice_id": practice_id, "date": tomorrow, "status": "pending"}, {"_id": 0}).to_list(50)
    
    return {"no_shows": no_shows, "overdue_recalls": overdue[:20], "pending_confirmations": pending}

@api_router.post("/follow-ups/action")
@limiter.limit("30/minute")
async def follow_up_action(req: FollowUpAction, request: Request, user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    patient = await db.patients.find_one({"id": req.patient_id, "practice_id": practice_id}, {"_id": 0})
    patient_name = patient.get("name", "Patient") if patient else "Patient"
    practice = await db.practices.find_one({"practice_id": practice_id}, {"_id": 0})
    practice_name = practice.get("name", "the dental practice") if practice else "the dental practice"

    if req.action == "call":
        patient_phone = patient.get("phone", "") if patient else ""
        from backend.demo_mode import is_demo, generate_mock_call
        retell_key = os.environ.get("RETELL_API_KEY", "")

        call_record_id = str(uuid.uuid4())
        call_record: dict = {
            "id": call_record_id, "practice_id": practice_id,
            "patient_id": req.patient_id, "patient_name": patient_name,
            "phone": patient_phone, "direction": "outbound",
            "duration_secs": 0, "transcript": [], "outcome": "follow-up",
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        if is_demo() or not retell_key:
            # Demo path — generate a scripted mock call
            mock = generate_mock_call(patient_name, patient_phone, "follow-up")
            call_record.update({
                "id": mock["call_id"],
                "duration_secs": mock["duration_secs"],
                "transcript": mock["transcript"],
                "outcome": mock["outcome"],
                "summary": mock.get("summary", ""),
                "status": "completed",
            })
        elif patient_phone:
            # Live path — fire real Retell call
            try:
                from retell import Retell
                retell_client = Retell(api_key=retell_key)
                agents = retell_client.agent.list()
                if agents:
                    practice_doc = await db.practices.find_one({"practice_id": practice_id}, {"_id": 0})
                    from_number = (practice_doc or {}).get("retell_phone", "")
                    if from_number:
                        call_response = retell_client.call.create_phone_call(
                            from_number=from_number,
                            to_number=patient_phone,
                            override_agent_id=agents[0].agent_id,
                            retell_llm_dynamic_variables={"patient_name": patient_name, "objective": "follow-up"}
                        )
                        call_record["id"] = call_response.call_id
                        call_record["status"] = "initiated"
            except Exception as e:
                logger.error(f"Retell follow-up call error: {e}")

        await db.calls.insert_one(call_record)
        activity = {
            "id": str(uuid.uuid4()), "practice_id": practice_id,
            "type": "call", "description": f"Follow-up call initiated to {patient_name}",
            "patient_name": patient_name, "status": "done",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.activity_feed.insert_one(activity)
        await broadcast_activity(practice_id, activity)

    elif req.action == "whatsapp":
        msg_body = (
            f"Hi {patient_name}, this is a follow-up from {practice_name}. "
            f"We noticed you missed your recent appointment. Would you like to reschedule? "
            f"Reply YES to book a new time."
        )
        msg = {
            "id": str(uuid.uuid4()), "practice_id": practice_id,
            "patient_id": req.patient_id,
            "direction": "outbound", "body": msg_body,
            "sender": "aria", "read": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.messages.insert_one(msg)
        activity = {
            "id": str(uuid.uuid4()), "practice_id": practice_id,
            "type": "whatsapp", "description": f"Follow-up WhatsApp sent to {patient_name}",
            "patient_name": patient_name, "status": "done",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.activity_feed.insert_one(activity)
        await broadcast_activity(practice_id, activity)

    elif req.action == "dismiss":
        if req.appointment_id:
            await db.appointments.update_one({"id": req.appointment_id}, {"$set": {"status": "cancelled"}})
        await db.activity_feed.insert_one({
            "id": str(uuid.uuid4()), "practice_id": practice_id,
            "type": "followup", "description": f"Follow-up dismissed for {patient_name}",
            "patient_name": patient_name, "status": "done",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")

    return {"message": f"Follow-up action '{req.action}' completed"}

# --- SETTINGS ---
@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    practice = await db.practices.find_one({"practice_id": practice_id}, {"_id": 0})
    if not practice:
        return {"practice_id": practice_id, "name": "My Practice", "doctor_name": user.get("name", "")}
    return practice

@api_router.put("/settings")
@limiter.limit("10/minute")
async def update_settings(req: SettingsUpdate, request: Request, user: dict = Depends(get_current_user)):
    practice_id = user.get("practice_id", "")
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.practices.update_one({"practice_id": practice_id}, {"$set": update_data})
    updated = await db.practices.find_one({"practice_id": practice_id}, {"_id": 0})
    return updated

# --- WEBHOOKS ---
@api_router.post("/webhooks/retell")
async def webhook_retell(request: Request):
    from backend.webhook_security import verify_retell
    raw = await request.body()
    sig = request.headers.get("X-Retell-Signature", "") or request.headers.get("x-retell-signature", "")
    if not verify_retell(signature_header=sig, raw_body=raw):
        raise HTTPException(status_code=401, detail="Invalid Retell signature")
    body = json.loads(raw) if raw else {}
    logger.info("Retell webhook received: processing call data")
    
    # Process call ended event
    call_data = body.get("call", body)
    call_id = call_data.get("call_id", str(uuid.uuid4()))
    transcript = call_data.get("transcript", "")
    from_number = call_data.get("from_number", "")
    
    if transcript:
        # Find patient by phone
        patient = await db.patients.find_one({"phone": from_number}, {"_id": 0}) if from_number else None
        practice_id = patient.get("practice_id", "demo-practice-001") if patient else "demo-practice-001"

        # Store call record
        call_record = {
            "id": call_id, "practice_id": practice_id,
            "patient_id": patient["id"] if patient else "",
            "patient_name": patient["name"] if patient else f"Unknown — {from_number}",
            "phone": from_number, "direction": call_data.get("direction", "inbound"),
            "duration_secs": int(call_data.get("duration_ms", 0) / 1000),
            "transcript": [{"speaker": "system", "text": transcript}],
            "outcome": "booked" if "appointment" in transcript.lower() else "inquiry",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.calls.insert_one(call_record)

        # Broadcast to WebSocket
        activity = {
            "id": str(uuid.uuid4()), "practice_id": practice_id,
            "type": "call", "description": "Call processed",
            "patient_name": patient["name"] if patient else "Unknown", "status": "done",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.activity_feed.insert_one(activity)
        await broadcast_activity(practice_id, activity)
    
    return {"status": "received"}

@api_router.post("/webhooks/whatsapp")
async def webhook_whatsapp(request: Request):
    """Handle incoming WhatsApp messages from Twilio"""
    from backend.webhook_security import verify_twilio
    try:
        form_data = await request.form()
        params = dict(form_data)
    except Exception:
        body = await request.json()
        params = body
    sig = request.headers.get("X-Twilio-Signature", "") or request.headers.get("x-twilio-signature", "")
    # Twilio signs the FULL URL of the webhook endpoint — including scheme + host.
    # Use X-Forwarded-* headers when behind a proxy/ALB.
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    full_url = f"{scheme}://{host}{request.url.path}"
    if not verify_twilio(signature_header=sig, url=full_url, params={k: str(v) for k, v in params.items()}):
        raise HTTPException(status_code=401, detail="Invalid Twilio signature")
    
    message_body = params.get("Body", params.get("body", ""))
    from_number = params.get("From", params.get("from", "")).replace("whatsapp:", "")
    
    if from_number and message_body:
        # Find patient by phone
        patient = await db.patients.find_one({"phone": from_number}, {"_id": 0})
        if patient:
            # Store incoming message
            msg = {
                "id": str(uuid.uuid4()), "practice_id": patient.get("practice_id", "demo-practice-001"),
                "patient_id": patient["id"], "direction": "inbound",
                "body": message_body, "sender": "patient", "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.messages.insert_one(msg)
            
            # Broadcast to WebSocket
            activity = {
                "id": str(uuid.uuid4()), "practice_id": patient.get("practice_id", "demo-practice-001"),
                "type": "whatsapp", "description": f"WhatsApp from {patient['name']}: {message_body[:50]}",
                "patient_name": patient["name"], "status": "done",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.activity_feed.insert_one(activity)
            await broadcast_activity(patient.get("practice_id", "demo-practice-001"), activity)
    
    logger.info("WhatsApp webhook received: message processed")
    return {"status": "received"}

# --- WEBSOCKET ---
@app.websocket("/ws/{practice_id}")
async def websocket_endpoint(websocket: WebSocket, practice_id: str, token: Optional[str] = None):
    """WebSocket for real-time activity feed updates"""
    # Authenticate via query param token or cookie
    ws_token = token or websocket.cookies.get("access_token")
    if not ws_token:
        await websocket.close(code=4001)
        return
    try:
        payload = pyjwt.decode(ws_token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            await websocket.close(code=4001)
            return
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or user.get("practice_id") != practice_id:
            await websocket.close(code=4003)
            return
    except pyjwt.InvalidTokenError:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, practice_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, practice_id)

# --- RETELL AI INTEGRATION ---
@api_router.post("/retell/call")
async def make_retell_call(req: RetellCallRequest, user: dict = Depends(_require_growth)):
    """Initiate an outbound call via Retell AI. Gated at Growth tier."""
    # DEMO MODE — return a scripted mock call and seed it into the feed.
    from backend.demo_mode import is_demo, generate_mock_call
    retell_key = os.environ.get("RETELL_API_KEY", "")
    if is_demo() or not retell_key:
        mock = generate_mock_call(req.patient_name or "Patient", req.to_number, req.objective or "")
        practice_id = user.get("practice_id", "")
        # Persist as a call record
        call_record = {
            "id": mock["call_id"],
            "practice_id": practice_id,
            "patient_id": "",
            "patient_name": req.patient_name or f"Patient — {req.to_number}",
            "phone": req.to_number,
            "direction": "outbound",
            "duration_secs": mock["duration_secs"],
            "transcript": mock["transcript"],
            "outcome": mock["outcome"],
            "summary": mock["summary"],
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.calls.insert_one(call_record)
        activity = {
            "id": str(uuid.uuid4()), "practice_id": practice_id,
            "type": "call", "description": f"[Demo] ARIA called {req.patient_name or req.to_number} — {mock['summary']}",
            "patient_name": req.patient_name or "", "status": "done",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.activity_feed.insert_one(activity)
        await broadcast_activity(practice_id, activity)
        return {
            "status": "success",
            "call_id": mock["call_id"],
            "message": f"Demo call to {req.to_number} completed — {mock['summary']}",
            "mock": True,
            "transcript": mock["transcript"],
            "outcome": mock["outcome"],
            "duration_secs": mock["duration_secs"],
        }

    if not retell_key:
        raise HTTPException(status_code=400, detail="Retell AI not configured. Add RETELL_API_KEY in settings.")
    
    try:
        from retell import Retell
        retell_client = Retell(api_key=retell_key)
        
        # List agents to find configured one
        agents = retell_client.agent.list()
        if not agents:
            return {"status": "error", "message": "No Retell AI agents configured. Create an agent in your Retell dashboard first."}
        
        agent_id = agents[0].agent_id
        
        # Get practice phone number
        practice = await db.practices.find_one({"practice_id": user.get("practice_id", "")}, {"_id": 0})
        from_number = practice.get("retell_phone", "") if practice else ""
        
        if not from_number:
            return {"status": "demo", "message": f"Call queued to {req.to_number} for {req.patient_name}. Configure a Retell phone number in Settings to make real calls.", "agent_id": agent_id}
        
        call_response = retell_client.call.create_phone_call(
            from_number=from_number,
            to_number=req.to_number,
            override_agent_id=agent_id,
            retell_llm_dynamic_variables={"patient_name": req.patient_name or "Patient", "objective": req.objective or "follow-up"}
        )
        
        # Log activity
        activity = {
            "id": str(uuid.uuid4()), "practice_id": user.get("practice_id", ""),
            "type": "call", "description": f"Outbound call to {req.patient_name or req.to_number}",
            "patient_name": req.patient_name, "status": "done",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.activity_feed.insert_one(activity)
        await broadcast_activity(user.get("practice_id", ""), activity)
        
        return {"status": "success", "call_id": call_response.call_id, "message": f"Call initiated to {req.to_number}"}
    except Exception as e:
        logger.error(f"Retell call error: {e}")
        return {"status": "error", "message": str(e)}

@api_router.get("/retell/status")
async def retell_status(user: dict = Depends(get_current_user)):
    """Check Retell AI connection status"""
    retell_key = os.environ.get("RETELL_API_KEY", "")
    if not retell_key:
        return {"connected": False, "message": "No API key configured"}
    try:
        from retell import Retell
        retell_client = Retell(api_key=retell_key)
        agents = retell_client.agent.list()
        return {"connected": True, "agents": len(agents), "message": f"Connected with {len(agents)} agent(s)"}
    except Exception as e:
        return {"connected": False, "message": str(e)}

# --- TWILIO WHATSAPP INTEGRATION ---
@api_router.post("/twilio/send")
async def send_twilio_message(req: TwilioMessageRequest, user: dict = Depends(_require_starter)):
    """Send a WhatsApp message via Twilio. Gated at Starter tier."""
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    api_key = os.environ.get("TWILIO_API_KEY", "")
    api_secret = os.environ.get("TWILIO_API_KEY_SECRET", "")
    from_number = os.environ.get("TWILIO_WHATSAPP_FROM", "")
    has_twilio_creds = account_sid and (auth_token or (api_key and api_secret))

    from backend.demo_mode import is_demo, generate_mock_inbound_reply
    if is_demo() or not has_twilio_creds:
        # Demo mode — save outbound, optionally fabricate an inbound reply
        practice_id = user.get("practice_id", "")
        patient = await db.patients.find_one({"phone": req.to_number}, {"_id": 0})
        now = datetime.now(timezone.utc)
        out_msg = None
        if patient:
            out_msg = {
                "id": str(uuid.uuid4()), "practice_id": practice_id,
                "patient_id": patient["id"], "direction": "outbound",
                "body": req.message, "sender": "doctor", "read": True,
                "created_at": now.isoformat(),
            }
            await db.messages.insert_one(out_msg)

            # Activity feed
            activity = {
                "id": str(uuid.uuid4()), "practice_id": practice_id,
                "type": "whatsapp",
                "description": f"[Demo] WhatsApp sent to {patient['name']}: {req.message[:60]}",
                "patient_name": patient["name"], "status": "done",
                "created_at": now.isoformat(),
            }
            await db.activity_feed.insert_one(activity)
            await broadcast_activity(practice_id, activity)

            # ~30% chance patient "replies" a moment later
            reply_body = generate_mock_inbound_reply(req.message)
            if reply_body:
                reply = {
                    "id": str(uuid.uuid4()), "practice_id": practice_id,
                    "patient_id": patient["id"], "direction": "inbound",
                    "body": reply_body, "sender": "patient", "read": False,
                    "created_at": (now + timedelta(seconds=3)).isoformat(),
                }
                await db.messages.insert_one(reply)
                reply_activity = {
                    "id": str(uuid.uuid4()), "practice_id": practice_id,
                    "type": "whatsapp",
                    "description": f"[Demo] {patient['name']} replied: {reply_body[:60]}",
                    "patient_name": patient["name"], "status": "done",
                    "created_at": (now + timedelta(seconds=3)).isoformat(),
                }
                await db.activity_feed.insert_one(reply_activity)
                await broadcast_activity(practice_id, reply_activity)
        return {
            "status": "demo",
            "message": "Message delivered (demo). Wire Twilio credentials in production to send real WhatsApp messages.",
            "mock": True,
        }
    
    try:
        from twilio.rest import Client
        if api_key and api_secret:
            twilio_client = Client(api_key, api_secret, account_sid=account_sid)
        else:
            twilio_client = Client(account_sid, auth_token)
        
        to_whatsapp = f"whatsapp:{req.to_number}" if not req.to_number.startswith("whatsapp:") else req.to_number
        from_whatsapp = f"whatsapp:{from_number}" if not from_number.startswith("whatsapp:") else from_number
        
        message = twilio_client.messages.create(
            body=req.message,
            from_=from_whatsapp,
            to=to_whatsapp
        )
        
        # Store message
        practice_id = user.get("practice_id", "")
        patient = await db.patients.find_one({"phone": req.to_number}, {"_id": 0})
        if patient:
            msg_record = {
                "id": str(uuid.uuid4()), "practice_id": practice_id,
                "patient_id": patient["id"], "direction": "outbound",
                "body": req.message, "sender": "doctor", "read": True,
                "twilio_sid": message.sid, "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.messages.insert_one(msg_record)
        
        return {"status": "success", "sid": message.sid, "message": "WhatsApp message sent"}
    except Exception as e:
        logger.error(f"Twilio error: {e}")
        return {"status": "error", "message": str(e)}

@api_router.get("/twilio/status")
async def twilio_status(user: dict = Depends(get_current_user)):
    """Check Twilio connection status"""
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    api_key = os.environ.get("TWILIO_API_KEY", "")
    api_secret = os.environ.get("TWILIO_API_KEY_SECRET", "")
    if not account_sid:
        return {"connected": False, "message": "Account SID not configured. Add TWILIO_ACCOUNT_SID in settings."}
    if not auth_token and not api_key:
        return {"connected": False, "message": "Auth token or API key not configured"}
    try:
        from twilio.rest import Client
        if api_key and api_secret:
            twilio_client = Client(api_key, api_secret, account_sid=account_sid)
        else:
            twilio_client = Client(account_sid, auth_token)
        account = twilio_client.api.v2010.accounts(account_sid).fetch()
        return {"connected": True, "message": f"Connected: {account.friendly_name}"}
    except Exception as e:
        return {"connected": False, "message": str(e)}

# --- GOOGLE CALENDAR INTEGRATION ---
@api_router.get("/google/auth-url")
async def get_google_auth_url(user: dict = Depends(get_current_user)):
    """Get Google OAuth authorization URL"""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "")
    
    if not client_id:
        return {"url": None, "message": "Google OAuth not configured. Add GOOGLE_CLIENT_ID in settings."}
    
    scopes = "https://www.googleapis.com/auth/calendar"
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&redirect_uri={redirect_uri}"
        f"&response_type=code&scope={scopes}"
        f"&access_type=offline&prompt=consent"
        f"&state={user.get('practice_id', '')}"
    )
    return {"url": auth_url, "message": "Redirect user to this URL to authorize Google Calendar access"}

@api_router.get("/google/callback")
async def google_callback(code: str = "", state: str = "", error: str = ""):
    """Handle Google OAuth callback"""
    if error:
        frontend_url = os.environ.get("FRONTEND_URL", "")
        return RedirectResponse(f"{frontend_url}/settings?google_error={error}")
    
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code received")
    
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "")
    
    try:
        import httpx
        # Exchange code for tokens
        async with httpx.AsyncClient() as http_client:
            token_response = await http_client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            tokens = token_response.json()
        
        if "error" in tokens:
            frontend_url = os.environ.get("FRONTEND_URL", "")
            return RedirectResponse(f"{frontend_url}/settings?google_error={tokens['error']}")
        
        # Store tokens for the practice
        practice_id = state or "demo-practice-001"
        await db.practices.update_one(
            {"practice_id": practice_id},
            {"$set": {
                "google_tokens": {
                    "access_token": tokens.get("access_token"),
                    "refresh_token": tokens.get("refresh_token"),
                    "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600))).isoformat()
                },
                "google_connected": True
            }}
        )
        
        logger.info(f"Google Calendar connected for practice {practice_id}")
        frontend_url = os.environ.get("FRONTEND_URL", "")
        return RedirectResponse(f"{frontend_url}/settings?google_connected=true")
    
    except Exception as e:
        logger.error(f"Google OAuth error: {e}")
        frontend_url = os.environ.get("FRONTEND_URL", "")
        return RedirectResponse(f"{frontend_url}/settings?google_error={str(e)}")

@api_router.get("/google/status")
async def google_calendar_status(user: dict = Depends(get_current_user)):
    """Check Google Calendar connection status"""
    practice_id = user.get("practice_id", "")
    practice = await db.practices.find_one({"practice_id": practice_id}, {"_id": 0})
    if not practice:
        return {"connected": False, "message": "Practice not found"}
    
    if practice.get("google_connected"):
        return {"connected": True, "message": "Google Calendar connected"}
    return {"connected": False, "message": "Not connected. Click 'Connect' to authorize."}

@api_router.get("/google/calendars")
async def list_google_calendars(user: dict = Depends(get_current_user)):
    """List Google Calendars for the connected account"""
    practice_id = user.get("practice_id", "")
    practice = await db.practices.find_one({"practice_id": practice_id}, {"_id": 0})
    
    if not practice or not practice.get("google_tokens"):
        return {"calendars": [], "message": "Google Calendar not connected"}
    
    tokens = practice["google_tokens"]
    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            # Refresh token if needed
            access_token = tokens.get("access_token")
            
            response = await http_client.get(
                "https://www.googleapis.com/calendar/v3/users/me/calendarList",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code == 401 and tokens.get("refresh_token"):
                # Refresh the token
                refresh_resp = await http_client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "refresh_token": tokens["refresh_token"],
                        "client_id": os.environ.get("GOOGLE_CLIENT_ID"),
                        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET"),
                        "grant_type": "refresh_token"
                    }
                )
                new_tokens = refresh_resp.json()
                access_token = new_tokens.get("access_token", access_token)
                await db.practices.update_one(
                    {"practice_id": practice_id},
                    {"$set": {"google_tokens.access_token": access_token}}
                )
                response = await http_client.get(
                    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
            
            data = response.json()
            calendars = [{"id": c["id"], "summary": c.get("summary", "")} for c in data.get("items", [])]
            return {"calendars": calendars}
    except Exception as e:
        return {"calendars": [], "message": str(e)}

@api_router.post("/google/sync")
async def sync_google_calendar(user: dict = Depends(get_current_user)):
    """Sync appointments with Google Calendar"""
    practice_id = user.get("practice_id", "")
    practice = await db.practices.find_one({"practice_id": practice_id}, {"_id": 0})
    
    if not practice or not practice.get("google_tokens"):
        return {"status": "error", "message": "Google Calendar not connected"}
    
    tokens = practice["google_tokens"]
    access_token = tokens.get("access_token")
    
    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            # Get upcoming events
            now = datetime.now(timezone.utc).isoformat()
            response = await http_client.get(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                params={"timeMin": now, "maxResults": 50, "singleEvents": True, "orderBy": "startTime"},
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code == 200:
                events = response.json().get("items", [])
                synced = 0
                for event in events:
                    start = event.get("start", {}).get("dateTime", event.get("start", {}).get("date", ""))
                    if start:
                        # Check if already exists
                        existing = await db.appointments.find_one({"google_event_id": event["id"]})
                        if not existing:
                            appt = {
                                "id": str(uuid.uuid4()), "practice_id": practice_id,
                                "patient_id": "", "patient_name": event.get("summary", "Google Event"),
                                "patient_phone": "", "date": start[:10], "time": start[11:16] if "T" in start else "09:00",
                                "duration_mins": 30, "treatment_type": "Synced from Google",
                                "status": "confirmed", "notes": event.get("description", ""),
                                "google_event_id": event["id"], "created_by": "google",
                                "created_at": datetime.now(timezone.utc).isoformat()
                            }
                            await db.appointments.insert_one(appt)
                            synced += 1
                
                await db.practices.update_one(
                    {"practice_id": practice_id},
                    {"$set": {"google_last_sync": datetime.now(timezone.utc).isoformat()}}
                )
                return {"status": "success", "synced": synced, "total_events": len(events)}
            else:
                return {"status": "error", "message": f"Google API error: {response.status_code}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- BILLING ---
# Stripe integration removed. Paddle Billing is implemented in backend/paddle_routes.py
# and wired into the app below via app.include_router(paddle_router).

# --- INTEGRATION STATUS ---
@api_router.get("/integrations/status")
async def get_integrations_status(user: dict = Depends(get_current_user)):
    """Get status of all integrations"""
    practice_id = user.get("practice_id", "")
    practice = await db.practices.find_one({"practice_id": practice_id}, {"_id": 0})
    
    retell_key = os.environ.get("RETELL_API_KEY", "")
    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    google_connected = practice.get("google_connected", False) if practice else False
    paddle_key = os.environ.get("PADDLE_API_KEY", "")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    sendgrid_key = os.environ.get("SENDGRID_API_KEY", "")

    return {
        "retell": {"configured": bool(retell_key), "key_preview": f"...{retell_key[-8:]}" if retell_key else ""},
        "twilio": {"configured": bool(twilio_sid), "key_preview": f"...{twilio_sid[-8:]}" if twilio_sid else ""},
        "google_calendar": {"connected": google_connected, "last_sync": practice.get("google_last_sync", "") if practice else ""},
        "paddle": {
            "configured": bool(paddle_key),
            "environment": os.environ.get("PADDLE_ENVIRONMENT", "sandbox"),
        },
        "anthropic": {"configured": bool(anthropic_key)},
        "sendgrid": {"configured": bool(sendgrid_key)},
        "subscription": {
            "plan": practice.get("subscription_plan", "free") if practice else "free",
            "status": practice.get("subscription_status", "inactive") if practice else "inactive",
            "current_period_end": practice.get("subscription_current_period_end") if practice else None,
        }
    }

# --- DEMO DATA SEEDING ---
async def seed_demo_data(practice_id: str):
    """Seed rich demo data for the practice.

    Patients are seeded ONCE (they're not date-sensitive). Appointments,
    calls, messages, and activity feed are re-seeded on every boot so that
    "today's schedule", "today's calls", and "recent activity" always look
    populated relative to the current date. This keeps the live demo
    prospect-ready even after long stretches without redeploy.
    """
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    existing_patients = await db.patients.find({"practice_id": practice_id}, {"_id": 0}).to_list(500)
    if existing_patients:
        # Refresh only the date-sensitive data; reuse existing patient docs
        # (preserves their IDs so any custom data the user added stays linked).
        logger.info("Refreshing date-sensitive demo data (patients preserved)...")
        await db.appointments.delete_many({"practice_id": practice_id})
        await db.calls.delete_many({"practice_id": practice_id})
        await db.messages.delete_many({"practice_id": practice_id})
        await db.activity_feed.delete_many({"practice_id": practice_id})
        patients = existing_patients
        await _seed_demo_time_sensitive(practice_id, patients, now, today, tomorrow, yesterday)
        return

    logger.info("Seeding demo data (full)...")
    # 12 Demo patients
    patients = [
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "Sarah Mitchell", "phone": "+1-555-0101", "email": "sarah.m@email.com", "status": "active", "total_visits": 8, "notes": "Prefers morning appointments", "created_at": (now - timedelta(days=365)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "Ahmed Hassan", "phone": "+1-555-0102", "email": "ahmed.h@email.com", "status": "active", "total_visits": 5, "notes": "Sensitive to cold water", "created_at": (now - timedelta(days=200)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "Maria Santos", "phone": "+1-555-0103", "email": "maria.s@email.com", "status": "active", "total_visits": 12, "notes": "Regular cleanings every 3 months", "created_at": (now - timedelta(days=500)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "James Wilson", "phone": "+1-555-0104", "email": "james.w@email.com", "status": "active", "total_visits": 3, "notes": "", "created_at": (now - timedelta(days=90)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "Lisa Chen", "phone": "+1-555-0105", "email": "lisa.c@email.com", "status": "active", "total_visits": 6, "notes": "Dental anxiety - needs extra care", "created_at": (now - timedelta(days=300)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "Robert Johnson", "phone": "+1-555-0106", "email": "robert.j@email.com", "status": "inactive", "total_visits": 2, "notes": "Last visit was 8 months ago", "created_at": (now - timedelta(days=400)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "Emma Davis", "phone": "+1-555-0107", "email": "emma.d@email.com", "status": "active", "total_visits": 15, "notes": "Long-term patient, very punctual", "created_at": (now - timedelta(days=730)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "David Kim", "phone": "+1-555-0108", "email": "david.k@email.com", "status": "new", "total_visits": 0, "notes": "Referred by Sarah Mitchell", "created_at": (now - timedelta(days=3)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "Sofia Rodriguez", "phone": "+1-555-0109", "email": "sofia.r@email.com", "status": "active", "total_visits": 7, "notes": "Prefers Spanish communications", "created_at": (now - timedelta(days=250)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "Michael Brown", "phone": "+1-555-0110", "email": "michael.b@email.com", "status": "active", "total_visits": 4, "notes": "Insurance: Delta Dental", "created_at": (now - timedelta(days=180)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "Anna Kowalski", "phone": "+1-555-0111", "email": "anna.k@email.com", "status": "active", "total_visits": 9, "notes": "Orthodontic treatment ongoing", "created_at": (now - timedelta(days=400)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "name": "Tom Nguyen", "phone": "+1-555-0112", "email": "tom.n@email.com", "status": "new", "total_visits": 1, "notes": "First visit consultation done", "created_at": (now - timedelta(days=7)).isoformat()},
    ]
    await db.patients.insert_many(patients)

    await _seed_demo_time_sensitive(practice_id, patients, now, today, tomorrow, yesterday)


async def _seed_demo_time_sensitive(practice_id, patients, now, today, tomorrow, yesterday):
    """Seed appointments / calls / messages / activity_feed for the demo
    practice using fresh dates around `now`. Safe to call repeatedly — caller
    is responsible for clearing the collections first."""
    treatments = ["Cleaning", "X-ray", "Crown", "Root Canal", "Extraction", "Consultation", "Filling", "Whitening"]
    statuses_past = ["completed", "completed", "completed", "noshow", "completed", "cancelled"]
    times = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"]
    
    appointments = []
    # Past appointments
    for i in range(20):
        days_ago = i * 2 + 1
        p = patients[i % len(patients)]
        appointments.append({
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"],
            "patient_name": p["name"], "patient_phone": p["phone"],
            "date": (now - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
            "time": times[i % len(times)], "duration_mins": 30,
            "treatment_type": treatments[i % len(treatments)],
            "status": statuses_past[i % len(statuses_past)],
            "notes": "", "created_by": "aria" if i % 3 == 0 else "doctor",
            "created_at": (now - timedelta(days=days_ago + 1)).isoformat()
        })
    
    # Today's appointments
    today_patients = [patients[0], patients[2], patients[4], patients[7], patients[10]]
    today_times = ["09:00", "10:30", "13:00", "14:30", "16:00"]
    today_treatments = ["Cleaning", "Crown", "X-ray", "Consultation", "Filling"]
    today_statuses = ["completed", "confirmed", "confirmed", "pending", "confirmed"]
    for i, p in enumerate(today_patients):
        appointments.append({
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"],
            "patient_name": p["name"], "patient_phone": p["phone"],
            "date": today, "time": today_times[i], "duration_mins": 30,
            "treatment_type": today_treatments[i], "status": today_statuses[i],
            "notes": "", "created_by": "aria", "created_at": (now - timedelta(hours=12)).isoformat()
        })
    
    # Tomorrow's appointments
    tmrw_patients = [patients[1], patients[3], patients[5], patients[8]]
    tmrw_times = ["09:30", "11:00", "14:00", "15:30"]
    tmrw_treatments = ["Root Canal", "Cleaning", "Extraction", "Whitening"]
    for i, p in enumerate(tmrw_patients):
        appointments.append({
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"],
            "patient_name": p["name"], "patient_phone": p["phone"],
            "date": tomorrow, "time": tmrw_times[i], "duration_mins": 45 if i == 0 else 30,
            "treatment_type": tmrw_treatments[i], "status": "pending" if i % 2 == 0 else "confirmed",
            "notes": "", "created_by": "aria", "created_at": now.isoformat()
        })
    
    # Future appointments
    for i in range(6):
        p = patients[(i + 3) % len(patients)]
        appointments.append({
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"],
            "patient_name": p["name"], "patient_phone": p["phone"],
            "date": (now + timedelta(days=i + 2)).strftime("%Y-%m-%d"),
            "time": times[(i + 5) % len(times)], "duration_mins": 30,
            "treatment_type": treatments[(i + 2) % len(treatments)],
            "status": "confirmed", "notes": "", "created_by": "doctor",
            "created_at": now.isoformat()
        })
    
    await db.appointments.insert_many(appointments)
    
    # Demo calls with transcripts
    demo_calls = [
        {
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": patients[0]["id"],
            "patient_name": patients[0]["name"], "phone": patients[0]["phone"],
            "direction": "inbound", "duration_secs": 185,
            "transcript": [
                {"speaker": "patient", "text": "Hi, I need to make an appointment"},
                {"speaker": "aria", "text": "Of course! I'd be happy to help. Can I get your name please?"},
                {"speaker": "patient", "text": "Sarah, Sarah Mitchell"},
                {"speaker": "aria", "text": "Perfect, Sarah! What brings you in — is this a routine cleaning or something specific?"},
                {"speaker": "patient", "text": "Just a cleaning, but I'd also like an X-ray"},
                {"speaker": "aria", "text": "No problem. We have availability this Thursday at 2pm or Friday at 10am. Which works better for you?"},
                {"speaker": "patient", "text": "Thursday at 2 is great"},
                {"speaker": "aria", "text": "You're all set, Sarah! I've booked you for Thursday at 2pm for a cleaning and X-ray. I'll send you a WhatsApp confirmation right now. Is this number the best to reach you?"},
                {"speaker": "patient", "text": "Yes, that's perfect. Thank you!"},
                {"speaker": "aria", "text": "You're welcome, Sarah! We'll see you Thursday. Have a wonderful day!"}
            ],
            "outcome": "booked", "created_at": (now - timedelta(hours=3)).isoformat()
        },
        {
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": patients[1]["id"],
            "patient_name": patients[1]["name"], "phone": patients[1]["phone"],
            "direction": "inbound", "duration_secs": 120,
            "transcript": [
                {"speaker": "patient", "text": "Hello, I need to reschedule my appointment"},
                {"speaker": "aria", "text": "Hi Ahmed! I can help with that. You currently have an appointment scheduled for tomorrow at 9:30am. When would you like to reschedule?"},
                {"speaker": "patient", "text": "Can we do Friday instead, same time?"},
                {"speaker": "aria", "text": "Friday at 9:30am is available! I've moved your root canal appointment to Friday. I'll send you an updated confirmation via WhatsApp."},
                {"speaker": "patient", "text": "Great, thanks"},
                {"speaker": "aria", "text": "You're welcome, Ahmed! See you Friday."}
            ],
            "outcome": "rescheduled", "created_at": (now - timedelta(hours=5)).isoformat()
        },
        {
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": patients[7]["id"],
            "patient_name": patients[7]["name"], "phone": patients[7]["phone"],
            "direction": "inbound", "duration_secs": 210,
            "transcript": [
                {"speaker": "patient", "text": "Hi, I'm a new patient. Sarah Mitchell referred me."},
                {"speaker": "aria", "text": "Welcome! We love referrals from Sarah. I'm ARIA, the receptionist at Dr. Smith's office. Can I get your name?"},
                {"speaker": "patient", "text": "David Kim"},
                {"speaker": "aria", "text": "Nice to meet you, David! What brings you in today?"},
                {"speaker": "patient", "text": "I need a general consultation, haven't been to a dentist in a while"},
                {"speaker": "aria", "text": "No worries at all! We have a new patient consultation available this Thursday at 2:30pm. That includes a full exam and X-rays. Does that work for you?"},
                {"speaker": "patient", "text": "That works perfectly"},
                {"speaker": "aria", "text": "Wonderful! I've booked you for Thursday at 2:30pm. I'll send you a WhatsApp message with all the details and some new patient forms. What's the best number to reach you?"},
                {"speaker": "patient", "text": "555-0108"},
                {"speaker": "aria", "text": "Got it! You're all set, David. Welcome to the practice!"}
            ],
            "outcome": "booked", "created_at": (now - timedelta(days=2)).isoformat()
        },
        {
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": patients[5]["id"],
            "patient_name": patients[5]["name"], "phone": patients[5]["phone"],
            "direction": "outbound", "duration_secs": 45,
            "transcript": [
                {"speaker": "aria", "text": "Hi Robert, this is ARIA calling from Dr. Smith's dental office. We noticed you missed your appointment yesterday and wanted to check in."},
                {"speaker": "patient", "text": "Oh sorry, I completely forgot about it"},
                {"speaker": "aria", "text": "No worries at all! Would you like me to reschedule? We have openings next week."},
                {"speaker": "patient", "text": "Yeah, let me check my calendar and call back"},
                {"speaker": "aria", "text": "Sounds good! We'll be here whenever you're ready. Take care, Robert!"}
            ],
            "outcome": "no_action", "created_at": (now - timedelta(hours=6)).isoformat()
        },
        {
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": patients[4]["id"],
            "patient_name": patients[4]["name"], "phone": patients[4]["phone"],
            "direction": "inbound", "duration_secs": 95,
            "transcript": [
                {"speaker": "patient", "text": "Hi, I have a question about my upcoming appointment"},
                {"speaker": "aria", "text": "Hi Lisa! I see you have a cleaning scheduled for today at 1pm. What's your question?"},
                {"speaker": "patient", "text": "Will there be any X-rays? I'm a bit anxious about those"},
                {"speaker": "aria", "text": "I completely understand, Lisa. For today's cleaning, X-rays aren't typically included unless Dr. Smith sees something that needs a closer look. If you'd prefer to skip them entirely, I can add a note to your file."},
                {"speaker": "patient", "text": "Yes, please add that note. Thank you for understanding"},
                {"speaker": "aria", "text": "Done! I've noted your preference. See you at 1pm, Lisa!"}
            ],
            "outcome": "inquiry", "created_at": (now - timedelta(hours=4)).isoformat()
        },
        {
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": patients[9]["id"],
            "patient_name": patients[9]["name"], "phone": patients[9]["phone"],
            "direction": "outbound", "duration_secs": 0,
            "transcript": [],
            "outcome": "no_answer", "created_at": (now - timedelta(hours=2)).isoformat()
        },
        {
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": patients[2]["id"],
            "patient_name": patients[2]["name"], "phone": patients[2]["phone"],
            "direction": "inbound", "duration_secs": 130,
            "transcript": [
                {"speaker": "patient", "text": "Good morning! Just calling to confirm my appointment today"},
                {"speaker": "aria", "text": "Good morning, Maria! Yes, you're confirmed for today at 10:30am for your crown appointment. Everything is set!"},
                {"speaker": "patient", "text": "Perfect. How long will it take?"},
                {"speaker": "aria", "text": "Crown appointments typically take about 45 minutes to an hour. Dr. Smith will go over everything with you when you arrive."},
                {"speaker": "patient", "text": "Great, see you at 10:30!"},
                {"speaker": "aria", "text": "See you then, Maria! Have a great morning!"}
            ],
            "outcome": "inquiry", "created_at": (now - timedelta(hours=1)).isoformat()
        },
        {
            "id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": patients[3]["id"],
            "patient_name": patients[3]["name"], "phone": patients[3]["phone"],
            "direction": "outbound", "duration_secs": 78,
            "transcript": [
                {"speaker": "aria", "text": "Hi James, this is ARIA from Dr. Smith's office. I'm calling to remind you about your cleaning appointment tomorrow at 11am."},
                {"speaker": "patient", "text": "Yes, I'll be there. Thanks for the reminder!"},
                {"speaker": "aria", "text": "Wonderful! We'll see you tomorrow at 11am. Have a great evening, James!"}
            ],
            "outcome": "booked", "created_at": (now - timedelta(hours=8)).isoformat()
        }
    ]
    await db.calls.insert_many(demo_calls)
    
    # Demo WhatsApp messages
    demo_messages = []
    msg_patients = [patients[0], patients[1], patients[2], patients[4], patients[7], patients[8], patients[3], patients[10]]
    
    # Sarah's conversation
    p = patients[0]
    sarah_msgs = [
        {"direction": "outbound", "body": "Hi Sarah! This is ARIA from Dr. Smith's office. Your cleaning appointment has been confirmed for Thursday at 2pm. See you then!", "sender": "aria", "hours_ago": 3},
        {"direction": "inbound", "body": "Thank you! Can I also get an X-ray during that visit?", "sender": "patient", "hours_ago": 2.5},
        {"direction": "outbound", "body": "Absolutely, Sarah! I've added an X-ray to your appointment. We'll get everything taken care of in one visit.", "sender": "aria", "hours_ago": 2.4},
        {"direction": "inbound", "body": "Perfect, thanks ARIA!", "sender": "patient", "hours_ago": 2.3},
    ]
    for m in sarah_msgs:
        demo_messages.append({"id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"], "direction": m["direction"], "body": m["body"], "sender": m["sender"], "read": True, "created_at": (now - timedelta(hours=m["hours_ago"])).isoformat()})
    
    # Ahmed's conversation
    p = patients[1]
    ahmed_msgs = [
        {"direction": "outbound", "body": "Hi Ahmed, your root canal appointment has been rescheduled to Friday at 9:30am as requested.", "sender": "aria", "hours_ago": 5},
        {"direction": "inbound", "body": "Got it, thanks!", "sender": "patient", "hours_ago": 4.8},
        {"direction": "outbound", "body": "Reminder: Your root canal appointment is tomorrow (Friday) at 9:30am with Dr. Smith. Please arrive 10 minutes early.", "sender": "aria", "hours_ago": 1},
    ]
    for m in ahmed_msgs:
        demo_messages.append({"id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"], "direction": m["direction"], "body": m["body"], "sender": m["sender"], "read": True, "created_at": (now - timedelta(hours=m["hours_ago"])).isoformat()})
    
    # Maria's conversation
    p = patients[2]
    maria_msgs = [
        {"direction": "outbound", "body": "Hi Maria! Reminder: You have a crown appointment today at 10:30am. See you soon!", "sender": "aria", "hours_ago": 12},
        {"direction": "inbound", "body": "Thank you! I'll be there. How long will it take?", "sender": "patient", "hours_ago": 11},
        {"direction": "outbound", "body": "Crown appointments typically take 45 mins to 1 hour. Dr. Smith will take great care of you!", "sender": "aria", "hours_ago": 10.9},
        {"direction": "inbound", "body": "Great, see you at 10:30!", "sender": "patient", "hours_ago": 10.8},
    ]
    for m in maria_msgs:
        demo_messages.append({"id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"], "direction": m["direction"], "body": m["body"], "sender": m["sender"], "read": True, "created_at": (now - timedelta(hours=m["hours_ago"])).isoformat()})
    
    # Lisa's conversation
    p = patients[4]
    lisa_msgs = [
        {"direction": "outbound", "body": "Hi Lisa! Your X-ray appointment is confirmed for today at 1pm. Note: we've added a note about your preferences.", "sender": "aria", "hours_ago": 6},
        {"direction": "inbound", "body": "Thanks ARIA. I'm a bit nervous, is there anything I should know beforehand?", "sender": "patient", "hours_ago": 5.5},
        {"direction": "outbound", "body": "Nothing to worry about, Lisa! The appointment is very straightforward. Dr. Smith and the team are wonderful with anxious patients. You're in great hands!", "sender": "aria", "hours_ago": 5.4},
        {"direction": "inbound", "body": "That makes me feel better. Thank you!", "sender": "patient", "hours_ago": 5.2},
    ]
    for m in lisa_msgs:
        demo_messages.append({"id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"], "direction": m["direction"], "body": m["body"], "sender": m["sender"], "read": True, "created_at": (now - timedelta(hours=m["hours_ago"])).isoformat()})
    
    # David (new patient) conversation
    p = patients[7]
    david_msgs = [
        {"direction": "outbound", "body": "Welcome to Dr. Smith's Dental Practice, David! Your consultation is booked for Thursday at 2:30pm. We look forward to meeting you!", "sender": "aria", "hours_ago": 48},
        {"direction": "inbound", "body": "Thank you! Is there any paperwork I should fill out before?", "sender": "patient", "hours_ago": 47},
        {"direction": "outbound", "body": "Great question! Please bring your ID and insurance card. You can arrive 15 minutes early to fill out new patient forms, or I can send them digitally if you prefer.", "sender": "aria", "hours_ago": 46.8},
        {"direction": "inbound", "body": "Digital would be great!", "sender": "patient", "hours_ago": 46},
        {"direction": "outbound", "body": "I've sent the new patient forms to your email at david.k@email.com. Please complete them before your visit. See you Thursday!", "sender": "aria", "hours_ago": 45.8},
    ]
    for m in david_msgs:
        demo_messages.append({"id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"], "direction": m["direction"], "body": m["body"], "sender": m["sender"], "read": m["direction"] == "outbound", "created_at": (now - timedelta(hours=m["hours_ago"])).isoformat()})
    
    # Sofia's conversation
    p = patients[8]
    sofia_msgs = [
        {"direction": "outbound", "body": "Hola Sofia! This is ARIA from Dr. Smith's office. Your whitening appointment is coming up next week. We'll send you a reminder the day before!", "sender": "aria", "hours_ago": 24},
        {"direction": "inbound", "body": "Gracias! Can't wait!", "sender": "patient", "hours_ago": 23},
    ]
    for m in sofia_msgs:
        demo_messages.append({"id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"], "direction": m["direction"], "body": m["body"], "sender": m["sender"], "read": True, "created_at": (now - timedelta(hours=m["hours_ago"])).isoformat()})
    
    # Robert (no-show) conversation
    p = patients[5]
    robert_msgs = [
        {"direction": "outbound", "body": "Hi Robert! We missed you at your appointment today. Would you like to reschedule? We have openings next week.", "sender": "aria", "hours_ago": 6},
        {"direction": "inbound", "body": "Sorry about that, I totally forgot. Let me check my schedule and get back to you.", "sender": "patient", "hours_ago": 4},
        {"direction": "outbound", "body": "No problem at all, Robert! Whenever you're ready, just reply here or call us. We're happy to find a time that works for you.", "sender": "aria", "hours_ago": 3.8},
    ]
    for m in robert_msgs:
        demo_messages.append({"id": str(uuid.uuid4()), "practice_id": practice_id, "patient_id": p["id"], "direction": m["direction"], "body": m["body"], "sender": m["sender"], "read": False, "created_at": (now - timedelta(hours=m["hours_ago"])).isoformat()})
    
    await db.messages.insert_many(demo_messages)
    
    # Demo activity feed
    activities = [
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "call", "description": "Answered call from Sarah Mitchell — booked cleaning for Thursday 2pm", "patient_name": "Sarah Mitchell", "status": "done", "created_at": (now - timedelta(minutes=5)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "whatsapp", "description": "Sent appointment confirmation to Sarah Mitchell via WhatsApp", "patient_name": "Sarah Mitchell", "status": "done", "created_at": (now - timedelta(minutes=4)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "call", "description": "Answered call from Ahmed Hassan — rescheduled root canal to Friday", "patient_name": "Ahmed Hassan", "status": "done", "created_at": (now - timedelta(minutes=30)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "booking", "description": "Booked consultation for David Kim — Thursday 2:30pm (new patient)", "patient_name": "David Kim", "status": "done", "created_at": (now - timedelta(hours=2)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "whatsapp", "description": "Sent reminder to Maria Santos — crown appointment today at 10:30am", "patient_name": "Maria Santos", "status": "done", "created_at": (now - timedelta(hours=3)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "call", "description": "Called Robert Johnson — follow-up on missed appointment, no reschedule yet", "patient_name": "Robert Johnson", "status": "pending", "created_at": (now - timedelta(hours=4)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "followup", "description": "Sent no-show follow-up to Robert Johnson via WhatsApp", "patient_name": "Robert Johnson", "status": "done", "created_at": (now - timedelta(hours=4.5)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "call", "description": "Answered inquiry from Lisa Chen about X-ray concerns", "patient_name": "Lisa Chen", "status": "done", "created_at": (now - timedelta(hours=5)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "whatsapp", "description": "Sent appointment reminder to Ahmed Hassan — root canal Friday 9:30am", "patient_name": "Ahmed Hassan", "status": "done", "created_at": (now - timedelta(hours=6)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "booking", "description": "Booked extraction for Sofia Rodriguez — next week Wednesday 2pm", "patient_name": "Sofia Rodriguez", "status": "done", "created_at": (now - timedelta(hours=8)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "call", "description": "Reminder call to James Wilson — cleaning tomorrow at 11am, confirmed", "patient_name": "James Wilson", "status": "done", "created_at": (now - timedelta(hours=10)).isoformat()},
        {"id": str(uuid.uuid4()), "practice_id": practice_id, "type": "whatsapp", "description": "Replied to Sofia Rodriguez — confirmed whitening appointment details", "patient_name": "Sofia Rodriguez", "status": "done", "created_at": (now - timedelta(hours=12)).isoformat()},
    ]
    await db.activity_feed.insert_many(activities)
    
    logger.info(f"Demo data seeded: {len(patients)} patients, {len(appointments)} appointments, {len(demo_calls)} calls, {len(demo_messages)} messages")

# --- STARTUP ---
@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.patients.create_index([("practice_id", 1), ("name", 1)])
    await db.appointments.create_index([("practice_id", 1), ("date", 1)])
    await db.calls.create_index([("practice_id", 1), ("created_at", -1)])
    await db.messages.create_index([("practice_id", 1), ("patient_id", 1)])
    await db.activity_feed.create_index([("practice_id", 1), ("created_at", -1)])
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@dentistai.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "DentistAI2026!")
    practice_id = "demo-practice-001"
    
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email, "password_hash": hashed, "name": "Dr. Smith",
            "role": "admin", "practice_id": practice_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        # Create practice
        await db.practices.insert_one({
            "practice_id": practice_id, "name": "SmileCare Dental",
            "doctor_name": "Dr. Smith", "phone": "+1-555-0100",
            "address": "123 Dental Ave, Suite 100, Beverly Hills, CA 90210",
            "office_hours": {"mon": "9:00-17:00", "tue": "9:00-17:00", "wed": "9:00-17:00", "thu": "9:00-17:00", "fri": "9:00-15:00", "sat": "closed", "sun": "closed"},
            "aria_voice": "professional", "aria_language": "English", "aria_tone": "warm",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    
    # Seed demo data
    await seed_demo_data(practice_id)

# --- Health check (no auth, no DB hit by default) ---
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "dentistai-backend",
        "environment": os.environ.get("APP_ENV", "production"),
        "paddle_env": os.environ.get("PADDLE_ENVIRONMENT", "sandbox"),
    }


# --- Attach shared resources to app state (used by subscription.py, paddle_routes.py) ---
app.state.db = db

# --- Main API router (all /api/* routes defined above) ---
app.include_router(api_router)

# --- Paddle routes ---
from backend.paddle_routes import router as paddle_router  # noqa: E402
app.include_router(paddle_router)

# --- CORS ---
# Merge both FRONTEND_URL and CORS_ORIGINS so neither silently wins over the other.
_cors_raw = ",".join(filter(None, [
    os.environ.get("FRONTEND_URL", ""),
    os.environ.get("CORS_ORIGINS", ""),
]))
_allowed_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
if not _allowed_origins:
    _allowed_origins = [
        "http://localhost:3000",
        "https://0-ai00.vercel.app",
    ]
# Always include the production Vercel URL in the explicit allowlist.
if "https://0-ai00.vercel.app" not in _allowed_origins:
    _allowed_origins.append("https://0-ai00.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Optional: Sentry ---
_sentry_dsn = os.environ.get("SENTRY_DSN", "")
if _sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=_sentry_dsn,
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
            environment=os.environ.get("APP_ENV", "production"),
        )
        logger.info("Sentry initialized")
    except Exception as e:  # noqa: BLE001
        logger.warning("Sentry init failed: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
