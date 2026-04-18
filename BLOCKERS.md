# BLOCKERS — Things that require user action

## URGENT: Rotate leaked credentials

All of the following keys were exposed in chat and should be rotated immediately:

| Service | What to rotate | Where |
|---|---|---|
| MongoDB Atlas | Database user password (`3wXztEWYfJjSo656`) | Atlas Console → Database Access |
| Twilio | Auth token (`b71a...6caa`) | Twilio Console → Account → Auth tokens |
| Retell AI | API key (`key_4f81...0e`) | Retell Dashboard → API Keys |
| SendGrid | API key (`SG.SyWB...WQc`) | SendGrid → Settings → API Keys (revoke + create new) |
| Paddle | API key (`pdl_sdbx_apikey_...`) | Paddle → Developer tools → Authentication |
| Google OAuth | Client secret (`GOCSPX-...`) | Google Cloud Console → Credentials |
| JWT | Secret (`a9f3c7...`) | Generate new 64-char random string, update .env |

**After rotating**: update `backend/.env` with new values. No code changes needed.

## Backend deploy (blocked on user)

- AWS CLI + EB CLI not confirmed installed. See `deploy/AWS_DEPLOY.md`.
- MongoDB Atlas cluster needs to be verified accessible from deploy target.
- Paddle webhook URL needs updating to live backend URL once deployed.
- Retell webhook URL needs updating similarly.

## Anthropic API key

- `ANTHROPIC_API_KEY` is blank in `.env`. ARIA chat uses canned demo responses until a key is added.
- Get a key from https://console.anthropic.com/ → API Keys.

## Paddle USD re-provisioning

- Current Paddle sandbox has GBP prices (£49/£99/£199). Source of truth is USD ($99/$249/$499).
- Needs new USD prices created in Paddle dashboard, then price IDs updated in `.env`.
- Plan names need updating: Growth → Professional, Pro → Enterprise.
