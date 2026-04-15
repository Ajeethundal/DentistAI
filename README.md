# DentistAI

**Your dental practice runs itself.** AI-powered practice management with an intelligent receptionist (ARIA), AI voice calls, WhatsApp messaging, smart scheduling, and Paddle-based subscription billing.

**Live demo:** [https://0-ai00.vercel.app](https://0-ai00.vercel.app) (login: `admin@dentistai.com` / `admin123`)

---

## What's inside

| Layer | Technology |
|---|---|
| Frontend | React 19 + Tailwind + shadcn/ui, deployed on Vercel |
| Backend | FastAPI (Python 3.11), WebSockets, Motor (async MongoDB) |
| Database | MongoDB (Atlas free tier recommended) |
| Auth | JWT access+refresh, bcrypt, secure cookies |
| Payments | Paddle Billing (subscriptions, webhooks, cancellation) |
| AI | Anthropic Claude (ARIA chat), Retell AI (voice calls) |
| Comms | Twilio (WhatsApp two-way), SendGrid (email) |
| Deploy | Docker — runs on EB / App Runner / Fargate / Lightsail / Railway / Fly |
| Hardening | Rate limiting (slowapi), webhook HMAC verification, CORS allow-list, optional Sentry |

---

## Features

- **ARIA** — Claude-powered AI receptionist answers questions, books appointments, chases no-shows
- **Calendar** — Appointment CRUD with conflict detection, status flow, mobile-responsive
- **Patients** — Profiles with visit history, WhatsApp threads, linked calls
- **AI Voice Calls** — Outbound calls via Retell AI with full transcripts (Growth tier+)
- **WhatsApp** — Two-way patient messaging through Twilio (Starter tier+)
- **Follow-ups** — No-show recovery, overdue recall, pending confirmation workflows
- **Dashboard** — Real-time activity feed over WebSocket
- **Subscription Billing** — Paddle-based Starter £49 / Growth £99 / Pro £199 monthly with 14-day free trial
- **Subscription gating** — Paid features return `402` → frontend shows upgrade modal
- **Demo mode** — Everything works without any external API keys; perfect for investor/customer demos

---

## 5-minute local quickstart

```bash
# 1. Clone
git clone https://github.com/Ajeethundal/DentistAI.git
cd DentistAI

# 2. Backend + MongoDB via Docker (requires Docker Desktop)
docker compose up -d

# 3. Frontend
cd frontend
yarn install --ignore-engines
REACT_APP_BACKEND_URL=http://localhost:8000 yarn start
```

Open <http://localhost:3000>. Log in with `admin@dentistai.com` / `admin123`.

**No Docker?** Run backend directly:
```bash
cd backend
pip install -r requirements.txt
# Make sure MongoDB is running on localhost:27017
python -m uvicorn server:app --reload --port 8000
```

---

## Demo mode — sell-from-it-today

Set `DEMO_MODE=true` (default in `docker-compose.yml`) and everything works offline:
- **Paddle checkout** → one-click "activate" upgrades the demo account to any tier
- **AI voice calls** → scripted transcripts play out in the UI
- **WhatsApp** → outbound messages deliver, ~30% generate a patient reply
- **ARIA chat** → canned-but-smart responses keyed on message content
- **Subscription gating** → bypassed for the demo account

Demo data is seeded on first boot: 12 patients, 30+ appointments across past/today/tomorrow/future, 10+ recorded calls with transcripts, threaded WhatsApp conversations, activity feed.

Turn DEMO_MODE off when you wire real integrations.

---

## Production deployment

Full guide: **[deploy/AWS_DEPLOY.md](deploy/AWS_DEPLOY.md)** — step-by-step Elastic Beanstalk walkthrough (Free Tier eligible).

**At a glance:**
1. Create MongoDB Atlas M0 free cluster, get connection string
2. Create Paddle sandbox products (already done for your account — IDs in `deploy/AWS_DEPLOY.md`)
3. Generate a Paddle client-side token in dashboard (Settings → Developer tools → Authentication)
4. `eb init -p docker dentistai-backend && eb create dentistai-prod --single --instance-type t2.micro`
5. `eb setenv` with all keys from `backend/.env.example`
6. Point `REACT_APP_BACKEND_URL` (Vercel) at the EB URL
7. Configure webhook URLs in Twilio (`/api/webhooks/whatsapp`, `/api/webhooks/retell`) and Paddle (`/api/paddle/webhook`)

Total time: ~30 min once accounts are set up.

---

## API surface

| Method | Path | Description | Gate |
|---|---|---|---|
| GET | `/api/health` | Liveness probe | — |
| POST | `/api/auth/register` | Create practice + admin user | 5/min |
| POST | `/api/auth/login` | Password login, returns JWT | 10/min |
| POST | `/api/auth/logout` | Clear auth cookies | — |
| GET | `/api/auth/me` | Current user + practice | auth |
| GET | `/api/dashboard/stats` | Counts + KPIs | auth |
| GET/POST | `/api/appointments` | List / create | auth |
| PUT/DELETE | `/api/appointments/{id}` | Update / delete | auth |
| GET/POST | `/api/patients` | List / create | auth |
| PUT | `/api/patients/{id}` | Update | auth |
| POST | `/api/aria/chat` | Chat with ARIA (Claude) | auth, 30/min |
| GET | `/api/calls` | Call history | auth |
| POST | `/api/retell/call` | Initiate outbound AI call | **Growth+** |
| POST | `/api/twilio/send` | Send WhatsApp | **Starter+** |
| GET | `/api/messages/conversations` | All conversations | auth |
| GET | `/api/follow-ups` | Follow-up queue | auth |
| GET | `/api/paddle/plans` | Public plan catalog | — |
| GET | `/api/paddle/config` | Paddle.js init config | — |
| GET | `/api/paddle/subscription` | Current subscription | auth |
| POST | `/api/paddle/subscription/cancel` | Cancel at period end | auth |
| POST | `/api/paddle/demo-activate` | Instant demo upgrade | auth (demo only) |
| POST | `/api/paddle/webhook` | Paddle Notifications sink | HMAC verified |
| POST | `/api/webhooks/whatsapp` | Twilio WhatsApp inbound | Twilio sig verified |
| POST | `/api/webhooks/retell` | Retell call-ended | Retell sig verified |
| WS | `/ws/{practice_id}?token=` | Real-time activity feed | auth |

---

## Environment variables

See `backend/.env.example` for the full reference. Minimum required: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`.

Everything else is optional — the app boots, logs warnings for missing integrations, and falls back to demo/canned behavior.

---

## Testing

```bash
# Unit tests (Paddle signature logic — no server needed)
cd backend && python -m pytest tests/test_paddle_signatures.py -v

# Smoke tests (needs running backend)
docker compose up -d
cd backend && python -m pytest tests/test_smoke.py -v
```

---

## Production checklist

Before accepting real paying customers:

- [ ] Rotate all API keys (any that ever appeared in logs/chat/screenshots)
- [ ] Set `DEMO_MODE=false`
- [ ] Set `COOKIE_SECURE=true` (requires HTTPS)
- [ ] Set a 64+ char random `JWT_SECRET`
- [ ] Set `FRONTEND_URL` to your exact production domain(s), no wildcards
- [ ] Set `TWILIO_ENFORCE_SIGNATURES=true` and `RETELL_ENFORCE_SIGNATURES=true`
- [ ] Lock down MongoDB Atlas network access to the backend's EC2 security group
- [ ] Point Paddle live environment (not sandbox) — set `PADDLE_ENVIRONMENT=production`
- [ ] Configure Sentry via `SENTRY_DSN` for error monitoring
- [ ] Set up a $10/mo AWS Budget alert
- [ ] Confirm Twilio + Retell + Paddle webhook destinations target your live backend URL
- [ ] Smoke test: register → subscribe → place a call → send WhatsApp → receive webhook

---

## License

Proprietary. © 2026 DentistAI.
