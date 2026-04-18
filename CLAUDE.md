# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

DentistAI is a dental practice management SaaS with an AI receptionist (ARIA). Features: appointment scheduling, patient management, WhatsApp messaging (Twilio), AI voice calls (Retell), subscription billing (Paddle), and a Claude-powered chat assistant.

Live frontend: https://0-ai00.vercel.app — Login: `admin@dentistai.com` / `admin123`

## Commands

### Backend
```bash
# Run locally (requires MongoDB on localhost:27017 or MONGO_URL set)
cd backend && pip install -r requirements.txt && python -m uvicorn server:app --reload --port 8000

# Run with Docker (includes MongoDB)
docker compose up -d

# Unit tests (no server needed)
cd backend && python -m pytest tests/test_paddle_signatures.py -v

# Integration tests (needs running backend)
cd backend && python -m pytest tests/test_smoke.py -v
```

### Frontend
```bash
cd frontend && yarn install --ignore-engines && REACT_APP_BACKEND_URL=http://localhost:8000 yarn start
```
Uses **yarn** (not npm). `package-lock.json` is gitignored. Build: `CI=false yarn build` (CI=false required to avoid warnings-as-errors).

## Architecture

**Backend**: FastAPI (Python 3.11) with Motor (async MongoDB). Single main file `backend/server.py` (~1700 lines, 38+ routes). Runs on port 8000 (respects `$PORT` env var).

**Frontend**: React 19 + Tailwind CSS + shadcn/ui (Radix primitives), built with Craco. Single env var: `REACT_APP_BACKEND_URL`.

**Auth**: JWT (HS256) — 24h access + 7d refresh tokens. Stored in localStorage + httpOnly cookies. `AuthContext.js` provides `useApi()` hook with axios interceptors that handle 401 (logout), 402 (upgrade modal), 429 (rate limit toast).

**Subscription gating**: `requires_plan("starter"|"growth"|"pro")` FastAPI dependency in `backend/subscription.py`. Returns 402 when plan insufficient. Frontend `UpgradeModal.jsx` listens for 402 via CustomEvent. All gating bypassed when `DEMO_MODE=true`.

**Real-time**: WebSocket at `/ws/{practice_id}?token=<jwt>` for activity feed.

### Key Backend Modules
- `server.py` — all routes (auth, appointments, patients, calls, messages, follow-ups, dashboard, settings, Google Calendar)
- `aria_client.py` — Anthropic Claude wrapper; falls back to canned responses in demo mode
- `paddle_client.py` + `paddle_routes.py` — Paddle Billing (HMAC webhook verification, subscription lifecycle)
- `subscription.py` — tier gating dependency factory (free=0, starter=1, growth=2, pro=3)
- `demo_mode.py` — seeds mock data on startup, provides canned ARIA replies and mock WhatsApp/call responses
- `webhook_security.py` — Twilio + Retell signature verification (soft-fail in dev, hard-fail when enforce flags set)
- `rate_limit.py` — slowapi: 200/min global, 10/min login, 5/min register, 30/min ARIA chat

### Key Frontend Patterns
- All authenticated pages wrapped in `Layout.jsx` which guards auth and connects WebSocket
- `useApi()` from `AuthContext.js` is the standard way to make API calls (auto-attaches JWT)
- Paddle.js loaded lazily via `lib/paddle.js` only on pricing/billing pages
- Demo mode: pricing page calls `/api/paddle/demo-activate` instead of opening Paddle checkout

## Environment Variables

Reference: `backend/.env.example`. Core vars:
- `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `FRONTEND_URL` (comma-sep allowed origins, no `*` with credentials)
- `DEMO_MODE` — "true" bypasses all integrations and tier gating
- `ANTHROPIC_API_KEY` — for ARIA chat (optional in demo mode)
- `PADDLE_*` — environment, API key, client token, webhook secret, price IDs
- `TWILIO_*`, `RETELL_*`, `SENDGRID_*`, `GOOGLE_*` — integration credentials

## Gotchas

- `backend/.env` is gitignored; `.env.example` is the reference
- CORS requires exact origins in `FRONTEND_URL` (no wildcard with credentials)
- Admin user re-seeded on every boot — changing `ADMIN_PASSWORD` env resets the password
- Anthropic model is `claude-sonnet-4-5-20250929` in `aria_client.py`
- Paddle webhook signature verification fails open if `PADDLE_WEBHOOK_SECRET` is unset
- Twilio webhook validation uses full URL including scheme — needs correct `X-Forwarded-Proto`/`X-Forwarded-Host` behind a proxy

## Deployment

- **Frontend**: Vercel (auto-deploys from `main`). Config in `vercel.json`.
- **Backend**: Docker-ready. `Dockerfile` is multi-stage, non-root, with `/api/health` healthcheck. Full AWS EB guide in `deploy/AWS_DEPLOY.md`. Also supports Railway (`railway.toml`), Fly, App Runner.
