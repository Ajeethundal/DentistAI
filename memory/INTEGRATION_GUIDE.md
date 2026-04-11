# DentistAI Integration Configuration Guide

## 1. Retell AI (Voice Calls) - CONNECTED
**Status**: Connected with 2 agents
**Key**: `key_4f811d5d68c939cbbe154b443d0e` (stored in backend .env)

### To make real calls:
1. Go to https://www.retell.ai/dashboard
2. Create a voice agent (or use existing ones - you have 2)
3. Purchase a phone number in Retell dashboard
4. Set the webhook URL to: `https://clinic-command-11.preview.emergentagent.com/api/webhooks/retell`
5. In Settings page, the "Test" button verifies connection

### Webhook URL for Retell:
```
https://clinic-command-11.preview.emergentagent.com/api/webhooks/retell
```

---

## 2. Twilio WhatsApp - NEEDS ACCOUNT SID
**Status**: API Key configured, but missing Account SID
**API Key SID**: SK75b35af47b9cbde14cb0b3fe15505230
**API Key Secret**: Stored in .env

### What you need to provide:
1. **Account SID** (starts with `AC...`): Find at https://console.twilio.com/ on the main dashboard
2. **WhatsApp Number**: Either sandbox (+14155238886) or your business number
3. **Auth Token** (for webhook validation): Found on Twilio Console dashboard

### To configure:
Add these to `/app/backend/.env`:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=+14155238886
TWILIO_AUTH_TOKEN=your_auth_token_here
```
Then restart backend: `sudo supervisorctl restart backend`

### Webhook URL for Twilio:
```
https://clinic-command-11.preview.emergentagent.com/api/webhooks/whatsapp
```
Set this in Twilio Console > Messaging > WhatsApp Sandbox > Webhook URL

---

## 3. Google Calendar - NEEDS REDIRECT URI SETUP
**Status**: OAuth credentials configured, needs redirect URI in Google Console
**Client ID**: 952269827379-...apps.googleusercontent.com

### Required Google Console Configuration:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth client "Web client 2"
3. Add **Authorized redirect URI**:
   ```
   https://clinic-command-11.preview.emergentagent.com/api/google/callback
   ```
4. Add **Authorized JavaScript origin**:
   ```
   https://clinic-command-11.preview.emergentagent.com
   ```
5. Enable the **Google Calendar API**:
   - Go to: https://console.cloud.google.com/apis/library
   - Search "Google Calendar API" and click Enable

6. Add test users (if app is in testing mode):
   - Go to OAuth consent screen > Test users
   - Add your Google email address

### After configuration:
Click "Connect" on the Settings page to start the OAuth flow.

---

## 4. Stripe Billing - ACTIVE
**Status**: Test key active (`sk_test_emergent`)
**Plans**: Starter ($49/mo), Professional ($149/mo), Enterprise ($399/mo)

### For production:
Replace `STRIPE_API_KEY` in `.env` with your live Stripe key.

---

## 5. WebSocket (Real-time Updates) - ACTIVE
**Status**: Working
**URL**: `wss://clinic-command-11.preview.emergentagent.com/ws/{practice_id}`
Dashboard automatically connects and receives live activity feed updates.
