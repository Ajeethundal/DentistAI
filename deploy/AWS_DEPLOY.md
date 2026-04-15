# AWS Deployment — DentistAI Backend

This walks through deploying the FastAPI backend to AWS. The frontend is already on
Vercel and needs no AWS work other than pointing a DNS record at it.

## Architecture

```
  dentistai.com       →  Vercel        (React SPA, already live)
  api.dentistai.com   →  AWS EB/AppRunner  (FastAPI + MongoDB)
```

## Pre-requisites (do these once, in order)

### 1. MongoDB Atlas (free forever, 512 MB)

Why Atlas and not AWS DocumentDB? DocumentDB has no free tier and costs ~$50/mo minimum.
Atlas M0 is free forever, backed by AWS under the hood, and your code works unchanged.

1. Go to <https://cloud.mongodb.com/> and sign up.
2. Create a **Free Shared** cluster, region `aws / us-east-1` (or nearest to your AWS region).
3. **Database Access** → add a user (e.g. `dentistai-app`) with a strong random password.
4. **Network Access** → add IP `0.0.0.0/0` (we'll tighten this later to EB's security group IPs).
5. **Connect → Drivers → Python** → copy the connection string. It looks like:
   ```
   mongodb+srv://dentistai-app:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Save this — you'll paste it into AWS as `MONGO_URL`.

### 2. Paddle sandbox products

1. Log in to <https://sandbox-vendors.paddle.com/>.
2. **Catalog → Products → New product**. Create three: `Starter`, `Growth`, `Pro`.
3. For each product, **Add price**: recurring monthly, amount as in your pricing
   (£49 / £99 / £199), currency GBP.
4. Copy each **Price ID** (format `pri_01h...`).
5. **Developer tools → Authentication → Client-side tokens → Generate** → copy it.
6. **Developer tools → Notifications → Add destination**:
   - URL: `https://YOUR-BACKEND-URL/api/paddle/webhook` (you'll know this after step 4 below)
   - Events: subscribe to `subscription.*` and `transaction.completed`
   - Copy the generated **secret key**.

Save these six values — you'll paste them into AWS as env vars.

## Option A — AWS Elastic Beanstalk (recommended, Free Tier eligible)

EB runs your Docker image on a t2.micro EC2 instance. Free for 12 months; ~$15/mo
after if you stay on t2.micro (or ~$7/mo if you move to Lightsail).

### Step 1 — Install EB CLI (once)

```bash
brew install awsebcli      # macOS
# or: pip install awsebcli
```

### Step 2 — Configure AWS credentials

In the AWS console: **IAM → Users → Create user** with `AdministratorAccess-AWSElasticBeanstalk`
(scope down later). Create an access key (CLI type). Then:

```bash
aws configure
# AWS Access Key ID: ...
# AWS Secret Access Key: ...
# Default region: us-east-1   (or eu-west-2 if you want London)
# Default output: json
```

### Step 3 — Initialize EB app

From the repo root:

```bash
eb init -p docker dentistai-backend --region us-east-1
```

When asked about CodeCommit, say **No**. It'll create `.elasticbeanstalk/config.yml`.

### Step 4 — Create the environment

```bash
eb create dentistai-prod \
  --instance-type t2.micro \
  --single \
  --cname dentistai-api
```

This takes ~5 min. The `--single` flag skips the load balancer (saves money; a single
EC2 gets a public IP directly). When done, it prints your URL:
```
Application available at: dentistai-api.us-east-1.elasticbeanstalk.com
```

### Step 5 — Set environment variables

```bash
eb setenv \
  MONGO_URL='mongodb+srv://dentistai-app:PASS@cluster.mongodb.net/?retryWrites=true&w=majority' \
  DB_NAME='dentistai' \
  JWT_SECRET='PASTE-A-64-CHAR-RANDOM-STRING' \
  COOKIE_SECURE='true' \
  FRONTEND_URL='https://dentistai.com,https://www.dentistai.com,https://0-ai00.vercel.app' \
  ADMIN_EMAIL='admin@dentistai.com' \
  ADMIN_PASSWORD='CHANGE-ME-STRONG' \
  ANTHROPIC_API_KEY='sk-ant-...' \
  TWILIO_ACCOUNT_SID='AC...' \
  TWILIO_AUTH_TOKEN='...' \
  TWILIO_PHONE_NUMBER='+1...' \
  TWILIO_WHATSAPP_FROM='+14155238886' \
  RETELL_API_KEY='key_...' \
  RETELL_AGENT_ID='agent_...' \
  SENDGRID_API_KEY='SG...' \
  FROM_EMAIL='noreply@dentistai.com' \
  PADDLE_ENVIRONMENT='sandbox' \
  PADDLE_API_KEY='pdl_sdbx_apikey_...' \
  PADDLE_CLIENT_TOKEN='test_...' \
  PADDLE_WEBHOOK_SECRET='pdl_ntfset_...' \
  PADDLE_PRICE_STARTER='pri_01...' \
  PADDLE_PRICE_GROWTH='pri_01...' \
  PADDLE_PRICE_PRO='pri_01...' \
  DEMO_MODE='false'
```

EB will redeploy after env changes. Wait ~2 min.

### Step 6 — Verify

```bash
eb status
curl https://dentistai-api.us-east-1.elasticbeanstalk.com/api/health
# → {"status":"ok","service":"dentistai-backend","environment":"production","paddle_env":"sandbox"}
```

### Step 7 — Update Vercel env var

In Vercel dashboard → Project settings → Environment variables:
```
REACT_APP_BACKEND_URL = https://dentistai-api.us-east-1.elasticbeanstalk.com
```
Redeploy. Your app now talks to the AWS backend.

### Step 8 — Lock down Atlas

Back in MongoDB Atlas → Network Access → remove `0.0.0.0/0` and add EB's EC2 public IP
(find via EB console → Environment → Configuration → Security group → Inbound rules,
or just the EC2 instance public IP).

## Option B — AWS App Runner (easier but NOT free tier)

If you skip the free tier and want push-to-deploy simplicity: connect App Runner to your
GitHub repo, it builds the Dockerfile automatically, ~$5–$25/mo.

Not covered here — use EB path above.

## Custom domain (after deploy is green)

### DNS records

At your domain registrar (Namecheap, Cloudflare, or Route 53):

```
dentistai.com          →  CNAME  →  cname.vercel-dns.com
www.dentistai.com      →  CNAME  →  cname.vercel-dns.com
api.dentistai.com      →  CNAME  →  dentistai-api.us-east-1.elasticbeanstalk.com
```

### SSL

- **Vercel**: automatic via Let's Encrypt — just add the domain in Project → Domains.
- **EB**: request a free cert in **AWS Certificate Manager** for `api.dentistai.com`,
  then in the EB console attach it to a load balancer. Easiest path: re-create EB
  environment WITHOUT `--single` so it gets an ALB, which can terminate SSL.
  Alternative: put CloudFront or Cloudflare in front of EB for free SSL.

### After DNS propagates

Update `FRONTEND_URL` on EB (add the real domain) and redeploy:
```bash
eb setenv FRONTEND_URL='https://dentistai.com,https://www.dentistai.com'
```

## Configure integration webhooks (once backend is live)

### Paddle
Set webhook destination URL to `https://api.dentistai.com/api/paddle/webhook` and save.

### Twilio
- Messaging → WhatsApp sandbox → When a message comes in:
  `https://api.dentistai.com/api/webhooks/whatsapp` (POST)
- Phone Numbers → your number → Voice:
  `https://api.dentistai.com/api/webhooks/retell` (POST)

### Retell
Link your Twilio number to the Retell agent (one API call — see main README).

## Zero-downtime redeploys

After the first deploy, any `git push origin main` can be followed by:
```bash
eb deploy
```

(Or set up CodePipeline / GitHub Actions for auto-deploy on push.)

## Troubleshooting

- **"Application was unable to launch"** → `eb logs` to see the container stdout.
  Usually a missing env var or bad `MONGO_URL`.
- **CORS errors in browser** → confirm `FRONTEND_URL` includes your frontend domain
  exactly (with scheme, no trailing slash).
- **Webhook "Invalid signature"** → `PADDLE_WEBHOOK_SECRET` mismatch. Copy it again
  from Paddle dashboard.
- **High cost** → set AWS Budgets alert at $10/mo in the Billing dashboard.
