# DentistAI — Foundation Audit

Generated: 2026-04-18

---

## 1. TODOs / FIXMEs / Stubs

No explicit `TODO`, `FIXME`, or `HACK` comments exist anywhere in the codebase. The implicit stubs are listed below.

---

## 2. Demo Mode Branches in Backend

| File | Line(s) | What it does |
|---|---|---|
| `server.py` | 877 | `if is_demo() or not retell_key:` → returns mock call data instead of calling Retell |
| `server.py` | 981 | `if is_demo() or not account_sid or not api_key:` → fabricates WhatsApp send + ~30% mock inbound reply |
| `server.py` | 1308–1610 | `seed_demo_data()` → seeds 12 patients, 30+ appointments, 8 calls with transcripts, threaded WhatsApp conversations, 12 activity feed items |
| `server.py` | 1626 | Hardcoded `practice_id = "demo-practice-001"` for admin seed |
| `demo_mode.py` | entire file | `is_demo()`, `generate_mock_call()`, `generate_mock_inbound_reply()`, 7 canned ARIA responses |
| `subscription.py` | ~45 | `if _demo_mode(): return user` — bypasses all tier gating |
| `paddle_routes.py` | 113 | `/config` returns `demo_mode: true/false` flag to frontend |
| `paddle_routes.py` | ~179 | `/demo-activate` endpoint: instant plan upgrade without Paddle |

---

## 3. Backend Endpoint Audit

### Auth
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/auth/login` | POST | No | 10/min | **Working** |
| `/api/auth/register` | POST | No | 5/min | **Working** |
| `/api/auth/logout` | POST | No | — | **Working** |
| `/api/auth/me` | GET | Yes | — | **Working** |

### Dashboard
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/dashboard/stats` | GET | Yes | — | **Working** |
| `/api/dashboard/today-schedule` | GET | Yes | — | **Working** |
| `/api/activity-feed` | GET | Yes | — | **Working** |

### ARIA
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/aria/chat` | POST | Yes | 30/min | **Working** (falls back to canned in demo) |
| `/api/aria/conversations/{id}` | GET | Yes | — | **Working** |

### Appointments
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/appointments` | GET | Yes | — | **Working** |
| `/api/appointments` | POST | Yes | **MISSING** | **Working** — conflict detection present |
| `/api/appointments/{id}` | PUT | Yes | **MISSING** | **Working** — but no practice_id filter (see Security) |
| `/api/appointments/{id}` | DELETE | Yes | **MISSING** | **Working** — hard delete, no practice_id filter |

### Patients
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/patients` | GET | Yes | — | **Working** |
| `/api/patients/{id}` | GET | Yes | — | **Working** — no practice_id filter (see Security) |
| `/api/patients` | POST | Yes | **MISSING** | **Working** |
| `/api/patients/{id}` | PUT | Yes | **MISSING** | **Working** — no practice_id filter |

### Calls
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/calls` | GET | Yes | — | **Working** |
| `/api/calls/{id}` | GET | Yes | — | **Working** — no practice_id filter |

### Messages (WhatsApp)
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/messages/conversations` | GET | Yes | — | **Working** |
| `/api/messages/{patient_id}` | GET | Yes | — | **Working** |
| `/api/messages/send` | POST | Yes | **MISSING** | **Working** (internal only, no Twilio) |

### Follow-ups
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/follow-ups` | GET | Yes | — | **Working** |
| `/api/follow-ups/action` | POST | Yes | **MISSING** | **Working** (internal only, no real calls/SMS) |

### Settings
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/settings` | GET | Yes | — | **Working** |
| `/api/settings` | PUT | Yes | **MISSING** | **Working** |

### Integrations
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/retell/call` | POST | Growth tier | **MISSING** | **Stub** — demo mock only, real Retell path untested |
| `/api/retell/status` | GET | Yes | — | **Working** |
| `/api/twilio/send` | POST | Starter tier | **MISSING** | **Working** (demo + real path) |
| `/api/twilio/status` | GET | Yes | — | **Working** |
| `/api/integrations/status` | GET | Yes | — | **Working** |

### Google Calendar
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/google/auth-url` | GET | Yes | — | **Working** |
| `/api/google/callback` | GET | **NONE** | — | **SECURITY ISSUE** — see below |
| `/api/google/status` | GET | Yes | — | **Working** |
| `/api/google/calendars` | GET | Yes | — | **Working** |
| `/api/google/sync` | POST | Yes | — | **Working** |

### Webhooks (public, signature-verified)
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/webhooks/retell` | POST | Signature | — | **Working** — hardcoded practice_id "demo-practice-001" (line 781) |
| `/api/webhooks/whatsapp` | POST | Signature | — | **Working** |

### Paddle Billing
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/paddle/plans` | GET | No | — | **Working** |
| `/api/paddle/config` | GET | No | — | **Working** |
| `/api/paddle/subscription` | GET | Yes | — | **Working** |
| `/api/paddle/subscription/cancel` | POST | Yes | — | **Working** |
| `/api/paddle/demo-activate` | POST | Yes | — | **Working** (demo only) |
| `/api/paddle/webhook` | POST | Signature | — | **Working** |

### Other
| Endpoint | Method | Auth | Rate Limit | Status |
|---|---|---|---|---|
| `/api/health` | GET | No | — | **Working** |
| `/ws/{practice_id}` | WS | Token | — | **Working** |

---

## 4. Frontend Page Audit

### CallsPage.jsx — 100% MOCK DATA
- **No API calls at all.** Entire page uses `demoCallHistory` and `demoTranscriptLines` hardcoded arrays.
- Renders a fake "active call" with auto-advancing transcript.
- Stats cards (34 calls today, 89% booking rate, etc.) are hardcoded.
- Dialer modal exists but submits to nothing.
- **Must be rewritten** to use `/api/calls` and `/api/retell/call`.

### WhatsAppPage.jsx — 100% MOCK DATA
- **No API calls at all.** Uses `demoConversations` with 5 fabricated threads.
- AI auto-response uses local keyword matching (not API).
- Campaign templates section hardcoded.
- **Must be rewritten** to use `/api/messages/conversations`, `/api/messages/{id}`, `/api/messages/send`.

### SettingsPage.jsx — BROKEN REFERENCES
- Line 26: calls `api.get('/billing/plans')` — **this endpoint does not exist** (should be `/api/paddle/plans` via direct fetch, not through the authed axios instance).
- Line 98: calls `api.post('/billing/checkout')` — **this endpoint does not exist** (Stripe was removed). Dead code.
- Line 52: polls `api.get('/billing/status/${sessionId}')` — **does not exist**. Dead Stripe checkout polling.

### LoginPage.jsx
- Line 34: hardcoded demo password `DentistAI2026!` — **does not match backend** which uses `admin123` (from ADMIN_PASSWORD env / server.py line 1625). Demo fill button is broken.

### DashboardPage.jsx
- Stats cards render with null initial values (no skeleton loaders).
- WebSocket reconnection retry is hardcoded 5000ms with no backoff.
- ARIA chat panel hidden on mobile (lg:col-span-2 only visible at lg+).

### CalendarPage.jsx
- Month view grid (`grid-cols-7`) overflows on mobile — no responsive fallback.
- Week view grid (`grid-cols-8`) definitely overflows on phones.
- Detail panel is `w-80` fixed — overlaps content on small screens.
- No empty states for days with no appointments.

### PatientsPage.jsx
- Detail drawer (`w-3/5`) hidden on mobile — no way to view patient details on phone.
- Table doesn't scroll horizontally on narrow screens.
- No empty state for zero patients.
- Errors silently logged — no user feedback.

### FollowUpsPage.jsx
- Overdue Recalls section has Call/WhatsApp buttons that **don't call `handleAction()`** — they're display-only. Bug.
- No skeleton loaders.

### PricingPage.jsx
- Plan prices come from backend which still shows **£49 / £99 / £199 GBP** — source of truth in CLAUDE.md says **$99 / $249 / $499 USD**.
- No annual toggle.
- No feature comparison table.

### BillingPage.jsx
- Working correctly with Paddle API.
- Paddle customer portal URL hardcoded.
- Support email hardcoded to `billing@dentistai.com`.

### LandingPage.jsx
- Basic hero + 4 feature cards + CTA + footer.
- Static content, no animations, no testimonials, no FAQ.
- Functional but looks like a template.

---

## 5. Security Issues

### CRITICAL

**S1. Missing practice_id filter on single-resource endpoints**
- `GET /api/patients/{id}` (line 525): queries by `id` only — any authenticated user can read any patient.
- `PUT /api/patients/{id}` (line 548): same — any user can update any patient.
- `PUT /api/appointments/{id}` (line 470): same — any user can update any appointment.
- `DELETE /api/appointments/{id}` (line 479): same — any user can delete any appointment.
- `GET /api/calls/{id}` (line 568): same — any user can read any call transcript.

**S2. Google OAuth callback has no auth check**
- `GET /api/google/callback` (line 1100): the `state` parameter (which carries `practice_id`) comes from the client. An attacker can associate their Google tokens with any practice by setting `state=<victim_practice_id>`.

**S3. Webhook handlers hardcode practice_id**
- `POST /api/webhooks/retell` (lines 769, 781, 787): hardcodes `"demo-practice-001"` instead of looking up from Retell metadata. In production, all webhook calls would be attributed to the demo practice.

### HIGH

**S4. Hardcoded secrets in docker-compose.yml**
- Line 32: `JWT_SECRET=DEV_ONLY_CHANGE_IN_PROD_...` (64-char key)
- Line 37: `ADMIN_PASSWORD=admin123`
- Line 42: `PADDLE_WEBHOOK_SECRET=pdl_ntfset_01kp9exm5rt3hyxtkes70j3tbt_...` (real Paddle sandbox secret)
- These are default fallbacks, acceptable for local dev, but the Paddle secret is a real credential.

**S5. PHI in log lines**
- Line 836: `logger.info(f"WhatsApp webhook: from={from_number}, body={message_body[:50]}")` — logs patient phone numbers and message content.

**S6. Missing rate limits on mutation endpoints**
- `POST /api/appointments` — no limit
- `POST /api/patients` — no limit
- `POST /api/messages/send` — no limit
- `POST /api/follow-ups/action` — no limit
- `POST /api/retell/call` — no limit (calls external API)
- `POST /api/twilio/send` — no limit (calls external API)
- `PUT /api/settings` — no limit

### MEDIUM

**S7. Hard delete on appointments**
- `DELETE /api/appointments/{id}` does `delete_one` — no soft delete, no audit trail.

**S8. No CSRF protection**
- JWT in cookies with `samesite=lax` provides partial protection, but no CSRF tokens.

---

## 6. Dead Code / Broken Imports

| File | Issue |
|---|---|
| `server.py:17` | `import asyncio` — never used |
| `server.py:19` | `from pydantic import Field` — never used |
| `server.py:7` | `status` imported from fastapi — never used |
| `SettingsPage.jsx:26` | `api.get('/billing/plans')` — endpoint doesn't exist (Stripe removed) |
| `SettingsPage.jsx:98` | `api.post('/billing/checkout')` — endpoint doesn't exist |
| `SettingsPage.jsx:52` | `api.get('/billing/status/...')` — endpoint doesn't exist |

---

## 7. Pricing Mismatch

| Source | Starter | Mid-tier | Top-tier | Currency |
|---|---|---|---|---|
| **CLAUDE.md (source of truth)** | $99 | $249 | $499 | USD |
| `paddle_routes.py` PLAN_CATALOG | £49 | £99 | £199 | GBP |
| `HANDOFF.md` | £49 | £99 | £199 | GBP |
| Paddle sandbox prices | £49 | £99 | £199 | GBP |

Plan names also differ: CLAUDE.md says "Starter / Professional / Enterprise" but code uses "Starter / Growth / Pro".

---

## 8. Prioritized Punch List

### BLOCKERS (must fix before any real customer)

1. **S1 — Multi-tenant leak**: Add `practice_id` filter to all single-resource GET/PUT/DELETE endpoints. Without this, any logged-in user can access any other practice's data.
2. **S3 — Webhook practice_id**: Retell webhook hardcodes `"demo-practice-001"`. Must derive from call metadata or a mapping collection.
3. **CallsPage is fake**: Page renders zero real data — needs full rewrite to use existing `/api/calls` endpoint.
4. **WhatsAppPage is fake**: Same — needs rewrite to use existing `/api/messages/*` endpoints.
5. **SettingsPage broken references**: Three dead Stripe endpoint calls. Will throw 404 in console.
6. **Backend default admin password mismatch**: `server.py` line 1625 defaults to `admin123` but real `.env` uses `DentistAI2026!`. The LoginPage demo fill is correct — the backend fallback is stale.
7. **S5 — PHI logging**: Remove patient phone/message body from log lines.
8. **Pricing mismatch**: Backend serves GBP prices but source of truth is USD. Plan names differ.

### HIGH (should fix before launch)

9. **S2 — Google OAuth callback**: Add auth or use a signed/encrypted state parameter.
10. **S6 — Rate limits**: Add limits to all POST/PUT endpoints that create resources or call external APIs.
11. **S7 — Soft delete**: Appointments DELETE should set `status: "deleted"`, not remove the document.
12. **FollowUpsPage bug**: Overdue Recalls buttons are non-functional.
13. **Mobile breakpoints**: CalendarPage and PatientsPage are unusable on phones.
14. **Skeleton loaders**: 6 pages have no loading UI — just blank until API responds.

### HIGH (cont.)

21. **CORS env var mismatch**: `server.py` reads `FRONTEND_URL` but `.env` sets `CORS_ORIGINS`. CORS falls back to `http://localhost:3000` only — the live Vercel origin (`https://0-ai00.vercel.app`) is not allowed.

### NICE TO HAVE (polish)

15. Empty states for every list (patients, calls, appointments, messages, follow-ups).
16. Toast notifications for all async actions.
17. Error feedback to users (currently most pages `console.error` silently).
18. WebSocket reconnection backoff (currently fixed 5s retry).
19. Unused imports cleanup in `server.py`.
20. Landing page upgrade (animations, testimonials, FAQ).
