"""Demo mode — makes the full product work end-to-end without external APIs.

When DEMO_MODE=true:
- `/api/retell/call` returns a realistic mock call with a scripted transcript
  and seeds it into the activity feed.
- `/api/twilio/send` returns a mock success and threads the message into the
  patient conversation.
- `/api/paddle/demo-activate` lets a demo user "subscribe" to any tier instantly.
- ARIA chat falls back to canned-but-smart responses if Anthropic isn't configured.
- Subscription gates bypass (enforced in subscription.requires_plan()).

This lets a prospect log in as admin@dentistai.com / admin123 and exercise
every feature before you wire real Twilio / Retell / Paddle for their account.
"""
from __future__ import annotations

import os
import random
from datetime import datetime, timezone
from typing import Optional


def is_demo() -> bool:
    return os.environ.get("DEMO_MODE", "false").lower() == "true"


# ---------------------------------------------------------------------------
# Retell mock — produces a call record with a realistic transcript.
# ---------------------------------------------------------------------------

SCRIPTED_CALLS = [
    {
        "objective": "appointment reminder",
        "duration_secs": 62,
        "outcome": "confirmed",
        "summary": "Patient confirmed Thursday 2 PM cleaning appointment.",
        "transcript": [
            {"speaker": "aria", "text": "Hi, this is ARIA from SmileCare Dental. I'm calling to confirm your appointment on Thursday at 2 PM for a cleaning. Is that still good for you?"},
            {"speaker": "patient", "text": "Yes, Thursday at 2 works great."},
            {"speaker": "aria", "text": "Perfect. I'll send a WhatsApp confirmation now. One last thing — any changes to your insurance or contact info we should know about?"},
            {"speaker": "patient", "text": "No, everything's the same."},
            {"speaker": "aria", "text": "Wonderful. See you Thursday. Have a great day!"},
        ],
    },
    {
        "objective": "no-show follow-up",
        "duration_secs": 48,
        "outcome": "rescheduled",
        "summary": "Rescheduled Friday 11 AM after missed Tuesday appointment.",
        "transcript": [
            {"speaker": "aria", "text": "Hi, this is ARIA from SmileCare Dental. I noticed we missed you Tuesday — everything OK?"},
            {"speaker": "patient", "text": "Sorry, I got stuck at work and forgot to call."},
            {"speaker": "aria", "text": "No worries at all. Would you like to reschedule? We have Friday at 11 AM or Monday at 3 PM."},
            {"speaker": "patient", "text": "Friday 11 is perfect."},
            {"speaker": "aria", "text": "Booked. I'll text you a reminder Thursday evening. Take care!"},
        ],
    },
    {
        "objective": "new patient inquiry",
        "duration_secs": 94,
        "outcome": "booked",
        "summary": "New patient booked Monday consultation — referred by Sarah Mitchell.",
        "transcript": [
            {"speaker": "patient", "text": "Hi, my friend Sarah Mitchell recommended you. Are you taking new patients?"},
            {"speaker": "aria", "text": "Absolutely! We'd love to have you. Can I grab your name and a quick reason for the visit?"},
            {"speaker": "patient", "text": "I'm David Kim. Just want a cleaning and check-up — haven't been to a dentist in about two years."},
            {"speaker": "aria", "text": "Got it, David. First visits run about an hour — cleaning, exam, and any X-rays we need. Monday at 2:30 PM work for you?"},
            {"speaker": "patient", "text": "Yeah that's great."},
            {"speaker": "aria", "text": "Booked. I'll text you intake forms to fill in advance. Welcome to SmileCare!"},
        ],
    },
]


def generate_mock_call(patient_name: str, patient_phone: str, objective: str) -> dict:
    """Pick a scripted call most matching the objective, or random."""
    obj_lower = (objective or "").lower()
    match = None
    for s in SCRIPTED_CALLS:
        if obj_lower and obj_lower in s["objective"]:
            match = s
            break
    if not match:
        match = random.choice(SCRIPTED_CALLS)
    return {
        "call_id": f"demo_call_{int(datetime.now(timezone.utc).timestamp())}_{random.randint(1000, 9999)}",
        "from_number": patient_phone,
        "to_number": os.environ.get("TWILIO_PHONE_NUMBER", "+15551234567"),
        "direction": "outbound",
        "duration_secs": match["duration_secs"],
        "transcript": match["transcript"],
        "outcome": match["outcome"],
        "summary": match["summary"],
        "status": "completed",
    }


# ---------------------------------------------------------------------------
# Twilio / WhatsApp mock — generates plausible inbound reply after a short
# delay, driven by the outbound message content.
# ---------------------------------------------------------------------------

PATIENT_REPLIES = [
    "Thanks! See you then 😊",
    "Perfect, confirmed.",
    "Can we move it to a bit later?",
    "Sounds good, thanks!",
    "Got it — I'll be there.",
    "Actually, can we reschedule?",
]


def generate_mock_inbound_reply(outbound_body: str) -> Optional[str]:
    """30% chance of generating a patient reply for the demo."""
    if random.random() < 0.3:
        return random.choice(PATIENT_REPLIES)
    return None


# ---------------------------------------------------------------------------
# ARIA canned responses — used when ANTHROPIC_API_KEY isn't set.
# Keyword-driven; good enough to demo without a real LLM call.
# ---------------------------------------------------------------------------

ARIA_CANNED = [
    (["today", "schedule", "appointments"],
     "Today you have 5 appointments: Sarah Mitchell (9:00 cleaning — completed), Maria Santos (10:30 crown), Lisa Chen (13:00 X-ray), David Kim (14:30 new patient consultation), and Michael Brown (16:00 filling). Sarah's is done. The others are all confirmed."),
    (["tomorrow"],
     "Tomorrow you have 4 appointments: Ahmed Hassan at 9:30 for a root canal (45 min), James Wilson at 11:00 cleaning, Robert Johnson at 14:00 extraction, and Sofia Rodriguez at 15:30 whitening."),
    (["no-show", "noshow", "missed"],
     "Over the last 30 days you've had 3 no-shows. I've already sent WhatsApp follow-ups to all three. Robert Johnson replied asking to reschedule — I've queued that for you to confirm."),
    (["book", "schedule", "new appointment"],
     "Happy to book that. I'll need the patient's name, preferred date/time, and treatment type. Once I have those I'll check for conflicts and send a WhatsApp confirmation."),
    (["revenue", "money", "earnings"],
     "This month's estimated revenue is £12,400 across 48 completed appointments. Your no-show rate improved from 12% last month to 7% — ARIA recovery calls saved roughly £1,800."),
    (["patient", "how many"],
     "You currently have 12 active patients in your demo database. 8 are regulars with 3+ visits, 2 are new (first visit within the last week), and 2 are inactive (no visit in 6+ months — worth a recall)."),
    (["help", "what can you do"],
     "I can: check your schedule, book/cancel/reschedule appointments, send WhatsApp reminders, place follow-up calls on no-shows, pull patient history, and summarize your day. Just ask in plain English."),
]


def canned_aria_reply(message: str) -> str:
    lower = (message or "").lower()
    for keywords, reply in ARIA_CANNED:
        if any(k in lower for k in keywords):
            return reply
    return ("I understand you're asking about: '" + (message[:80] if message else "") + "'. "
            "In demo mode I don't have a full LLM hooked up, but in production I'll use Claude to answer in real time. "
            "Try asking me about today's schedule, no-shows, revenue, or your patients.")


# ---------------------------------------------------------------------------
# Paddle "demo activate" — lets a demo user upgrade instantly without
# going through real checkout.
# ---------------------------------------------------------------------------

def demo_subscription_payload(plan: str) -> dict:
    """Return a fake Paddle subscription.* webhook payload for local testing."""
    return {
        "paddle_subscription_id": f"sub_demo_{plan}",
        "paddle_customer_id": "ctm_demo_user",
        "subscription_plan": plan,
        "subscription_status": "active",
        "subscription_current_period_end": None,
        "subscription_updated_at": datetime.now(timezone.utc).isoformat(),
    }
