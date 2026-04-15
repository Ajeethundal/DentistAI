# DentistAI — Engineering Handoff

**For the next Claude (or human) picking this up.** Read this end-to-end before touching anything.

---

## 1. Mission

DentistAI is a dental practice management SaaS. ARIA (AI receptionist) answers the phone, messages on WhatsApp, books appointments, follows up on no-shows. Pricing: Starter £49 / Growth £99 / Pro £199 per month, 14-day free trial, billed via Paddle.

Live frontend: <https://0-ai00.vercel.app> (auto-deploys from `main`).
Backend: **not yet deployed anywhere persistent** — code is ready for AWS EB.

---

## 2. Repo map

```
DentistAI/
├── backend/                 # FastAPI (Python 3.11)
│   ├── server.py            # Main app, ~1700 lines, 42+ routes
│   ├── aria_client.py       # Anthropic SDK wrapper (ARIA chat)
│   ├── paddle_client.py     # Paddle Billing API + HMAC verification
│   ├── paddle_routes.py     # /api/paddle/* routes, incl. webhook + demo-activate
│   ├── subscription.py      # requires_plan() dependency factory
│   ├── rate_limit.py        # slowapi Limiter
│   ├── webhook_security.py  # Twilio + Retell HMAC verification
│   ├── demo_mode.py         # Canned ARIA replies + mock calls + mock SMS
│   ├── tests/
│   │   ├── test_smoke.py              # End-to-end (needs live backend)
│   │   └── test_paddle_signatures.py  # Unit tests
│   ├── requirements.txt
│   ├── .env                 # LOCAL ONLY — gitignored, already populated
│   └── .env.example         # Canonical reference
├── frontend/                # React 19 + Tailwind + shadcn/ui
│   └── src/
│       ├── App.js                        # Routes
│       ├── context/AuthContext.js        # Auth + axios interceptors (401/402/429)
│       ├── lib/paddle.js                 # Paddle.js lazy loader
│       ├── components/
│       │   ├── UpgradeModal.jsx          # Listens for 402 → upgrade prompt
│       │   ├── ErrorBoundary.jsx
│       │   ├── Toast.jsx
│       │   └── layout/
│       │       ├── Layout.jsx
│       │       └── Sidebar.jsx           # Includes SubscriptionBadge
│       └── pages/
│           ├── LandingPage.jsx           # Public "/"
│           ├── PricingPage.jsx           # Public "/pricing" (demo-aware)
│           ├── BillingPage.jsx           # Authed "/billing"
│           ├── LoginPage.jsx
│           ├── DashboardPage.jsx
│           ├── CalendarPage.jsx
│           ├── PatientsPage.jsx
│           ├── CallsPage.jsx
│           ├── WhatsAppPage.jsx
│           ├── FollowUpsPage.jsx
│           └── SettingsPage.jsx
├── deploy/
│   └── AWS_DEPLOY.md        # Full EB walkthrough
├── Dockerfile               # Multi-stage, non-root, /api/health healthcheck
├── .dockerignore
├── docker-compose.yml       # MongoDB + backend, one command
├── vercel.json              # Frontend build config
├── railway.toml             # Optional Railway config
├── Procfile                 # Optional PaaS config
├── README.md                # Product + quickstart
└── HANDOFF.md               # This file
```

---

## 3. Architecture

```
dentistai.com (future)        api.dentistai.com (future)
   │                                 │
   ▼                                 ▼
┌─────────┐                   ┌────────────────────┐     ┌──────────────┐
│ Vercel  │──── /api/* ──────▶│ AWS EB t2.micro    │────▶│ Atlas M0     │
│ React   │                   │ FastAPI + Docker   │     │ (MongoDB)    │
│ SPA     │                   └────────────────────┘     └──────────────┘
└─────────┘                     │      │      │     │
                                ▼      ▼      ▼     ▼
                             Twilio  Retell  SendGrid  Paddle
                             (WhatsApp)(AI call)(email)(billing)
```

Tech stack:
- **Frontend**: React 19, Tailwind CSS, shadcn/ui, React Router, Axios, Paddle.js
- **Backend**: FastAPI, Motor (async MongoDB), JWT + bcrypt, slowapi rate limiting, Sentry (optional), Anthropic Claude SDK
- **Deploy**: Docker image runs on EB / App Runner / Fargate / Lightsail / Railway / Fly
- **Auth**: JWT access (24h) + refresh (7d), HTTP-only cookies, X-Forwarded-For aware

---

## 4. What's done (commit log, most recent first)

```
5cf7410  feat: Complete demo mode + docker-compose + tests + Paddle sandbox pre-configured
1dda7cc  feat: Rate limiting, webhook signature verification, upgrade UX
7122c1b  feat: Production-ready — AWS deploy, Paddle payments, landing/pricing/billing
4fac411  feat: Rebrand to DentistAI and harden for production
81ca317  (earlier Emergent baseline)
```

By feature area:

### Backend
- ✅ Dockerfile (multi-stage, non-root, honors `$PORT`, healthcheck)
- ✅ `/api/health` endpoint for load balancer probes
- ✅ Paddle Billing fully wired:
  - `/api/paddle/plans` (public catalog)
  - `/api/paddle/config` (client-side token + environment)
  - `/api/paddle/subscription` (current plan)
  - `/api/paddle/subscription/cancel`
  - `/api/paddle/demo-activate` (demo-only instant upgrade)
  - `/api/paddle/webhook` with **HMAC-SHA256 signature verification + replay protection**
- ✅ Subscription tier gating via `requires_plan()` dependency:
  - `/api/retell/call` → Growth tier
  - `/api/twilio/send` → Starter tier
- ✅ Removed `emergentintegrations` entirely. ARIA now uses Anthropic SDK directly, with canned fallback when `ANTHROPIC_API_KEY` is unset + `DEMO_MODE=true`.
- ✅ Removed Stripe code (was dead; `STRIPE_API_KEY` was never set).
- ✅ CORS locked to `FRONTEND_URL` env var (comma-sep list), no `*` fallback with credentials.
- ✅ Rate limiting: 10/min login, 5/min register, 30/min ARIA chat, 200/min global default. X-Forwarded-For aware.
- ✅ Webhook HMAC verification for Twilio (SDK) and Retell (custom HMAC-SHA256). Soft-fail in dev, hard-fail with `{TWILIO,RETELL}_ENFORCE_SIGNATURES=true`.
- ✅ Sentry wiring (optional, triggered by `SENTRY_DSN`).
- ✅ Startup no longer writes `/app/memory/test_credentials.md` (would crash on read-only FS).

### Frontend
- ✅ `/` landing page (hero, features, CTA). Logged-in users redirect to dashboard.
- ✅ `/pricing` — fetches plan catalog + config, demo-aware: skips Paddle.js when `demo_mode` true, calls `/api/paddle/demo-activate` instead.
- ✅ `/billing` — current plan, period end, cancel button (at period end), upgrade link.
- ✅ Paddle.js lazy loader (`frontend/src/lib/paddle.js`).
- ✅ `UpgradeModal` listens for `upgrade-required` CustomEvent → shows when any API returns 402.
- ✅ `SubscriptionBadge` in sidebar showing current plan with upgrade/manage link.
- ✅ Axios 402 + 429 + 401 response interceptors.
- ✅ Mobile-responsive sidebar with overlay.
- ✅ Removed all "Made with Emergent" / "Powered by ARIA" branding.
- ✅ Removed PostHog analytics pointing at Emergent's project.

### Demo mode (`DEMO_MODE=true`)
- ✅ Scripted AI call transcripts (3 realistic dialogs: reminder, no-show recovery, new patient inquiry) via `/api/retell/call`.
- ✅ WhatsApp mock: outbound delivers, ~30% probability of fabricated patient reply.
- ✅ ARIA canned replies: 7 intent-keyed responses (schedule / no-shows / revenue / patients / help / booking / tomorrow).
- ✅ `/api/paddle/demo-activate` — instantly marks practice as subscribed to any tier. Frontend pricing page uses this when demo_mode.
- ✅ All subscription gates bypass in demo mode.
- ✅ Rich seed data: 12 patients, 30+ appointments across past/today/tomorrow/future, 10+ calls with transcripts, threaded WhatsApp conversations, activity feed.

### Tests
- ✅ `backend/tests/test_paddle_signatures.py` — Paddle HMAC: valid / tampered / stale / malformed / empty-secret cases.
- ✅ `backend/tests/test_smoke.py` — end-to-end: health / auth / dashboard / patients / subscription / demo-activate / mocked retell / ARIA.

### Infrastructure
- ✅ `docker-compose.yml`: MongoDB + backend in one command, with pre-configured Paddle sandbox IDs as defaults.
- ✅ `Dockerfile` portable across all major PaaS.
- ✅ `deploy/AWS_DEPLOY.md` step-by-step EB Free-Tier walkthrough.

### Paddle sandbox (provisioned via API — **already done**)
- ✅ Products created: `DentistAI Starter`, `DentistAI Growth`, `DentistAI Pro`
- ✅ Monthly GBP prices with 14-day trial, price IDs stored in `backend/.env`
- ✅ Webhook notification endpoint created; secret stored in `backend/.env`

---

## 5. What remains — user-blocked (cannot be done by any Claude)

These require the user to click things in external dashboards. No API path exists.

| # | Task | Where | Est. time |
|---|---|---|---|
| 1 | Rotate leaked API keys (Twilio, SendGrid, Paddle, Google, Retell, Anthropic) | Each provider's dashboard | 15 min |
| 2 | Generate Paddle **client-side** token (API creation not supported) | <https://sandbox-vendors.paddle.com/> → Developer tools → Authentication → Client-side tokens | 1 min |
| 3 | Create MongoDB Atlas M0 free cluster + database user | <https://cloud.mongodb.com/> | 10 min |
| 4 | Install AWS CLI + EB CLI locally (or deploy via AWS Console) | macOS: `brew install awscli awsebcli` | 5 min |
| 5 | AWS deploy: `eb init` + `eb create` + `eb setenv …` | See `deploy/AWS_DEPLOY.md` | 15 min |
| 6 | Point `REACT_APP_BACKEND_URL` in Vercel at EB URL | Vercel → Project → Env Vars | 2 min |
| 7 | Configure Twilio WhatsApp webhook to `<backend>/api/webhooks/whatsapp` | Twilio Console | 3 min |
| 8 | Configure Twilio phone number voice webhook to `<backend>/api/webhooks/retell` | Twilio Console | 3 min |
| 9 | Update Paddle webhook destination URL to live `<backend>/api/paddle/webhook` | Paddle Developer tools → Notifications | 2 min |
| 10 | Link Retell agent to Twilio number via Retell API (a Claude can run the curl after user approval) | Retell API | 2 min |
| 11 | Buy custom domain + point DNS (optional for MVP) | Route 53 or registrar | 15 min |

**Total if user does all: ~75 minutes.**

---

## 6. What remains — autonomous (next Claude can do these)

- Pair with user through AWS Console deployment live (walk them step-by-step).
- After backend URL is known, make Retell phone-number-link API call (one `curl`, shown in original brief).
- Add landing page polish (testimonials section, FAQ, demo video embed).
- Add subscription analytics (MRR, churn reports for admin).
- Add onboarding tour (shepherd.js or similar) for first-time users.
- Add SEO: meta tags, OpenGraph images, sitemap.xml.
- Add privacy policy + terms of service pages (blank templates OK for MVP).
- Add admin user impersonation (so support can view customer accounts).
- Add CSV export for patients, appointments, calls.

---

## 7. Critical references

### Accounts in play
| Service | Account | Status |
|---|---|---|
| GitHub | `Ajeethundal/DentistAI`, branch `main` | ✅ active |
| Vercel | Project `0-ai00`, auto-deploys from `main` | ✅ active |
| Emergent | `clinic-command-11.preview.emergentagent.com` | ⚠️ being retired, backend needs to move off |
| Paddle | Sandbox, products + webhook notification already created via API | ✅ ready, needs client-side token |
| Anthropic | Needs account + API key for ARIA chat | ❌ not set up |
| Twilio | Account with `+16626645703`, sandbox join code `key-ten` | ✅ credentials exist (to be rotated) |
| Retell | Agent `agent_53c7e56d76cc43ebdc7d486051` | ✅ agent exists (to be rotated) |
| SendGrid | Has API key (to be rotated) | ✅ |
| Google OAuth | Client ID exists (to be rotated) | ✅ |
| MongoDB Atlas | Not created yet | ❌ |
| AWS | User is signed in, region TBD, no CLI installed | ⚠️ |

### Paddle sandbox — created values (committed to `backend/.env`, NOT committed to git)
```
PADDLE_PRICE_STARTER=pri_01kp9ettksfwf60gjy50sz3y7c
PADDLE_PRICE_GROWTH=pri_01kp9etv4cydbfqr018amtvgf7
PADDLE_PRICE_PRO=pri_01kp9etvmm0427gc7781pxqgx4
PADDLE_WEBHOOK_SECRET=pdl_ntfset_01kp9exm5rt3hyxtkes70j3tbt_...  (in backend/.env)
```
Webhook destination (configurable in Paddle dashboard): placeholder `https://api.dentistai.com/api/paddle/webhook` — update to live EB URL once deployed.

### Demo credentials
```
Email:    admin@dentistai.com
Password: admin123
```
(This admin is seeded on every startup. Change in production by setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` envs.)

### Env vars reference
Canonical list in `backend/.env.example`. The local `backend/.env` is pre-populated with safe defaults.

---

## 8. Common commands

```bash
# Local dev (full stack)
docker compose up -d
cd frontend && yarn install --ignore-engines && REACT_APP_BACKEND_URL=http://localhost:8000 yarn start

# Local dev (backend only, if Mongo is elsewhere)
cd backend && python -m uvicorn server:app --reload --port 8000

# Unit tests (no server needed)
cd backend && python -m pytest tests/test_paddle_signatures.py -v

# Smoke tests (needs live backend)
cd backend && python -m pytest tests/test_smoke.py -v

# Deploy changes to frontend (auto via Vercel)
git push origin main

# Deploy changes to backend (after EB is set up)
eb deploy

# Verify /api/health on EB
curl https://<eb-url>/api/health
```

---

## 9. Key decisions already made

| Decision | Why |
|---|---|
| Paddle over Stripe | User preference, Paddle handles global tax/VAT |
| MongoDB Atlas over AWS DocumentDB | Atlas M0 is free forever, DocumentDB starts at ~$50/mo |
| Elastic Beanstalk over App Runner | EB t2.micro is Free Tier (12mo), App Runner is not |
| Docker deploy over native Python runtime | Portable across all PaaS, same image works everywhere |
| Anthropic SDK over emergentintegrations | emergentintegrations not on public PyPI, runtime `ModuleNotFoundError` in production |
| `subscription_plan` on practice doc | Reused existing schema (was there from Stripe days) |
| 14-day trial built into Paddle prices | Standard SaaS expectation; no CC needed to start |
| £49/£99/£199 GBP | User confirmed |
| Skip custom domain for MVP | User said ship on vercel.app + elasticbeanstalk.com first |
| Demo mode as core feature, not test-only | Lets sales happen before real infra is set up |

---

## 10. Known gotchas

- **`package-lock.json` is gitignored.** Project uses yarn. Don't commit npm's lock file.
- **`.env.example` has a negation rule in `.gitignore`** so it IS tracked despite `.env*` being ignored.
- **Sidebar uses `useApi()`** (shared axios from AuthContext) not raw axios — keeps token + 401 handling consistent.
- **CORS won't accept `*` with credentials.** If `FRONTEND_URL` is empty it falls back to `http://localhost:3000`, NOT `*`.
- **Paddle webhook signature check** fails open in sandbox if `PADDLE_WEBHOOK_SECRET` is unset (for local testing). Hard-fails in production.
- **Twilio signs webhooks with the FULL URL** including scheme + host + path. When behind a proxy (ALB, CloudFront), use `X-Forwarded-Proto` and `X-Forwarded-Host` to reconstruct. Already handled in `/api/webhooks/whatsapp`.
- **The demo admin password is `admin123`** — change it in prod by setting `ADMIN_PASSWORD` env before first boot, or update in DB after.
- **`startup()` re-seeds the admin on every boot** — harmless, but means changing `ADMIN_PASSWORD` in env will reset the password.
- **Vercel build command:** `cd frontend && yarn install --ignore-engines && CI=false yarn build` (configured in `vercel.json`).
- **Backend is still running on Emergent** at `clinic-command-11.preview.emergentagent.com` — but that container sleeps and will eventually die. MUST move to EB before real customers.

---

## 11. Your first move

1. Open the repo, run `docker compose up -d`, `cd frontend && yarn && yarn start`.
2. Log in at <http://localhost:3000/login> with demo credentials.
3. Click through: dashboard → calendar → patients → whatsapp → calls → billing → pricing.
4. Click "Start Free Trial" on a pricing card. Verify it activates instantly (demo mode).
5. On dashboard, use the ARIA chat and verify canned responses.
6. Ask the user: "Have you rotated the leaked API keys yet?" If no, remind them to do that first.
7. Ask the user: "Ready to deploy backend to AWS EB?" If yes, pair-deploy using `deploy/AWS_DEPLOY.md`.
