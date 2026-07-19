# Deploying Tickrr to Google Cloud Run

Two containers, both provided with Dockerfiles:

- **`tickrr-api`** — the FastAPI intelligence engine (`backend/`).
- **`tickrr-web`** — the terminal UI + Express server (`web/`), which **proxies** market data
  from `tickrr-api` (so the browser stays same-origin: no CORS, no compile-time backend URL).

```
browser ─▶ tickrr-web (public) ─▶ tickrr-api (MARKET_API)
                 └─ Gemini · Razorpay · growth engine
Cloud Scheduler ─▶ tickrr-web /api/growth/cron
```

`gcloud run deploy --source` builds each image remotely with **Cloud Build** using the
Dockerfile — you do **not** need Docker installed locally.

---

## Prerequisites

1. Install the **gcloud CLI** and sign in: `gcloud auth login`.
2. A **Google Cloud project** (for the XPRIZE, create one *after May 19, 2026*) with **billing enabled**
   (the $300 free trial covers this comfortably).
3. Set your project and enable the APIs:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com cloudscheduler.googleapis.com firestore.googleapis.com

# Durable growth-draft store (Firestore Native mode). nam5 = US multi-region (eur3 for EU).
gcloud firestore databases create --location=nam5   # once per project
# (deploy.sh grants the web service's runtime SA roles/datastore.user after it's deployed.)
```

`deploy.sh` does all of the above for you. The web service runs with `GROWTH_STORE=firestore`, so
the approval queue **survives restarts, redeploys, and scale-to-zero**. Without a reachable
Firestore it degrades gracefully to an on-disk file store, so nothing hard-fails.

---

## One-shot: `deploy.sh`

From the repo root:

```bash
export PROJECT_ID=your-project
export REGION=us-central1
export GEMINI_API_KEY=...            # optional (else demo mode)
export GROWTH_CRON_SECRET=$(openssl rand -hex 24)
# optional publishing creds:
export DISCORD_WEBHOOK_URL=...
export BLUESKY_HANDLE=...  BLUESKY_APP_PASSWORD=...
export BUFFER_ACCESS_TOKEN=...  BUFFER_CHANNEL_IDS=...
export GROWTH_NOTIFY_WEBHOOK=...

bash deploy.sh
```

It deploys the API, wires the web service to it, and (if `GROWTH_CRON_SECRET` is set) creates the
Cloud Scheduler job. The steps below are what it runs, if you prefer to go manually.

---

## Manual steps

### 1. Deploy the API

```bash
gcloud run deploy tickrr-api \
  --source backend \
  --region "$REGION" \
  --allow-unauthenticated

API_URL=$(gcloud run services describe tickrr-api --region "$REGION" --format='value(status.url)')
echo "$API_URL"
```

### 2. Deploy the web app (pointed at the API)

```bash
gcloud run deploy tickrr-web \
  --source web \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 1 \
  --set-env-vars "MARKET_API=$API_URL,GEMINI_API_KEY=$GEMINI_API_KEY,GROWTH_CRON_SECRET=$GROWTH_CRON_SECRET,DISCORD_WEBHOOK_URL=$DISCORD_WEBHOOK_URL,BLUESKY_HANDLE=$BLUESKY_HANDLE,BLUESKY_APP_PASSWORD=$BLUESKY_APP_PASSWORD,BUFFER_ACCESS_TOKEN=$BUFFER_ACCESS_TOKEN,BUFFER_CHANNEL_IDS=$BUFFER_CHANNEL_IDS,GROWTH_NOTIFY_WEBHOOK=$GROWTH_NOTIFY_WEBHOOK"

WEB_URL=$(gcloud run services describe tickrr-web --region "$REGION" --format='value(status.url)')
echo "$WEB_URL"
```

`--min-instances 1` keeps the in-memory growth queue warm (see the note on persistence below).

### 3. Schedule autonomous drafting (free tier: 3 jobs/mo)

```bash
gcloud scheduler jobs create http tickrr-autodraft \
  --location "$REGION" \
  --schedule "0 9,17 * * *" \
  --time-zone "America/New_York" \
  --uri "$WEB_URL/api/growth/cron?count=3" \
  --http-method POST \
  --headers "x-cron-key=$GROWTH_CRON_SECRET"
```

Twice-daily, the agent drafts posts from live signals and pings you; **you still approve** before
anything publishes. Re-run with `jobs update` to change the cadence.

---

## Secrets (recommended for production)

For anything beyond a quick demo, store keys in **Secret Manager** instead of `--set-env-vars`:

```bash
echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-key --data-file=-
gcloud run deploy tickrr-web ... --set-secrets "GEMINI_API_KEY=gemini-key:latest"
```

---

## Notes & caveats

- **Requirements met:** the deployed web app makes real **Gemini** calls (`/api/insights`,
  `/api/deliberate`) and runs on **Google Cloud Run** + **Cloud Scheduler** — satisfying the
  XPRIZE "≥1 Gemini call" and "≥1 Google Cloud product" gates.
- **Growth queue persistence:** the queue is stored in **Firestore** (collection `growth_drafts`),
  so it persists across restarts, redeploys, and scale-to-zero. Locally (or if Firestore is
  unreachable) it falls back to an on-disk JSON file. Toggle with `GROWTH_STORE=firestore|file`.
- **Razorpay:** set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (env / Secret Manager — NEVER in the repo) and `APP_URL=$WEB_URL` for real hosted checkout;
  otherwise "Go Pro" runs in demo mode.
- **Cost:** well within the free tiers + $300 trial for hackathon-scale traffic. Scale to zero by
  dropping `--min-instances 1` if you don't need the warm queue.
- **Redeploying:** just re-run the same `gcloud run deploy` commands (or `deploy.sh`).
