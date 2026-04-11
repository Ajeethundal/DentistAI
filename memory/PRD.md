# DentistAI - Product Requirements Document

## Problem Statement
Build a complete SaaS dental practice management platform called "DentistAI" powered by a single AI agent named ARIA (AI Receptionist & Intelligence Assistant). ARIA handles phone calls, WhatsApp messages, Google Calendar appointments, patient follow-ups, and answers the doctor's questions directly inside the dashboard.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + Framer Motion
- **Backend**: FastAPI (Python) + MongoDB (Motor async driver)
- **AI**: Claude Sonnet 4.5 via Emergent LLM Key (emergentintegrations library)
- **Auth**: JWT (email/password, bcrypt hashing, httpOnly cookies + Bearer tokens)
- **Demo Mode**: Rich mock dataset, real AI chat, simulated external integrations

## User Personas
1. **Dentist/Doctor**: Primary user, manages practice via dashboard and ARIA
2. **Receptionist**: (Future) Limited access for front desk management
3. **Patient**: Interacts via phone calls and WhatsApp (external)

## Core Requirements
- Auth system with demo login
- Dashboard with stats, activity feed, ARIA chat, today's schedule
- Calendar with week/month/day views + appointment CRUD
- Patient management with search, table, detail drawer
- Call management with transcript viewer
- WhatsApp inbox (like WhatsApp Web) with message sending
- Follow-up center (no-shows, overdue recalls, pending confirmations)
- Settings (practice info, doctor info, ARIA personality, office hours, integrations)

## What's Been Implemented (April 2026)
- [x] JWT Authentication with admin seeding and demo login
- [x] Dashboard with 4 stat cards, activity feed, ARIA chat, today's schedule
- [x] ARIA AI Chat with real Claude Sonnet 4.5 integration
- [x] Calendar (week/month/day) with appointment creation
- [x] Patients page with search, table, detail drawer (5 tabs)
- [x] Calls page with inbound/outbound tabs and transcript viewer
- [x] WhatsApp inbox with conversation list, chat thread, message templates
- [x] Follow-ups center with no-shows, overdue recalls, pending confirmations
- [x] Settings page with practice, doctor, ARIA, office hours, integrations
- [x] Demo mode with 12 patients, 35 appointments, 8 calls, 25+ messages
- [x] Collapsible sidebar with ARIA status indicator
- [x] Dark premium design system (Linear.app meets medical)
- [x] ARIA orb with pulse/breathing/ripple animations

## Prioritized Backlog
### P0 (Critical - Next Phase)
- Real Retell AI integration for phone calls
- Real Twilio WhatsApp integration
- Google Calendar bidirectional sync

### P1 (High Priority)
- Multi-tenant isolation (Supabase RLS equivalent in MongoDB)
- Subscription/billing (Stripe integration)
- Email notifications (daily summary, missed calls)
- Voice input for ARIA chat (speech-to-text)

### P2 (Medium Priority)
- Patient online booking portal
- Treatment plan management
- Insurance tracking
- Reporting & analytics dashboard
- Mobile responsive optimization

### P3 (Nice to Have)
- n8n webhook orchestration
- Custom ARIA voice selection
- Multi-language full support
- Waitlist management
- Patient satisfaction surveys

## Next Tasks
1. Connect real Retell AI for inbound/outbound calls
2. Connect real Twilio WhatsApp Business API
3. Google Calendar OAuth + sync
4. Add real-time WebSocket updates for activity feed
5. Implement multi-tenant data isolation
