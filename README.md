# DentistAI

AI-powered dental practice management platform with an intelligent receptionist (ARIA), appointment management, patient records, voice calls (Retell AI), and WhatsApp messaging (Twilio).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | FastAPI (Python), MongoDB (Motor async) |
| Auth | JWT (access 24h / refresh 7d), bcrypt |
| Integrations | Retell AI, Twilio, Google Calendar, Stripe, Claude AI |

## Features

- **ARIA** — Claude-powered AI receptionist for scheduling, follow-ups, and queries
- **Calendar** — Create, update, and track appointments with status flow
- **Patients** — Patient profiles with visit history, notes, and linked communications
- **Calls** — Outbound AI voice calls via Retell AI with transcripts
- **WhatsApp** — Two-way patient messaging via Twilio
- **Follow-ups** — No-show tracking, overdue recalls, pending confirmations
- **Dashboard** — Real-time activity feed over WebSocket
- **Billing** — Stripe subscription plans (Starter / Professional / Enterprise)

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB (local or Atlas)

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=dentistai
JWT_SECRET=your-secret-key-here

# Set to true in production (requires HTTPS)
COOKIE_SECURE=false

# Frontend origin(s), comma-separated for multiple
FRONTEND_URL=http://localhost:3000

# Optional integrations
EMERGENT_LLM_KEY=       # Claude AI (ARIA chat)
RETELL_API_KEY=         # Retell AI voice calls
TWILIO_ACCOUNT_SID=     # Twilio WhatsApp
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
STRIPE_SECRET_KEY=      # Stripe billing
GOOGLE_CLIENT_ID=       # Google Calendar OAuth
GOOGLE_CLIENT_SECRET=
```

```bash
uvicorn server:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## API Overview

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new practice |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/dashboard/stats` | Dashboard metrics |
| GET/POST | `/api/appointments` | List / create appointments |
| PUT/DELETE | `/api/appointments/{id}` | Update / delete appointment |
| GET/POST | `/api/patients` | List / create patients |
| PUT | `/api/patients/{id}` | Update patient |
| POST | `/api/aria/chat` | Chat with ARIA |
| GET | `/api/calls` | Call history |
| POST | `/api/retell/call` | Initiate AI voice call |
| GET | `/api/messages/conversations` | WhatsApp conversations |
| POST | `/api/messages/send` | Send WhatsApp message |
| GET | `/api/followups` | Follow-up tasks |
| GET/PUT | `/api/settings` | Practice settings |
| WS | `/ws/{practice_id}?token=` | Real-time activity feed |

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URL` | Yes | — | MongoDB connection string |
| `DB_NAME` | Yes | — | MongoDB database name |
| `JWT_SECRET` | Yes | — | Secret for signing JWTs |
| `COOKIE_SECURE` | No | `false` | Set `true` in production |
| `FRONTEND_URL` | No | `http://localhost:3000` | Allowed CORS origin(s) |
| `EMERGENT_LLM_KEY` | No | — | Enables ARIA AI chat |
| `RETELL_API_KEY` | No | — | Enables AI voice calls |
| `TWILIO_*` | No | — | Enables WhatsApp messaging |
| `STRIPE_SECRET_KEY` | No | — | Enables billing |
| `GOOGLE_CLIENT_*` | No | — | Enables Calendar sync |

## Production Checklist

- [ ] Set `COOKIE_SECURE=true` and serve over HTTPS
- [ ] Set `FRONTEND_URL` to your production domain (no wildcards)
- [ ] Use a strong, random `JWT_SECRET`
- [ ] Restrict MongoDB network access
- [ ] Configure Twilio webhook URL to `/api/twilio/webhook`
