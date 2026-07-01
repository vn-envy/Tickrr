#!/usr/bin/env bash
# Deploy Tickrr (API + web) to Google Cloud Run, then wire the autonomous-drafting scheduler.
# Builds remotely via Cloud Build — no local Docker needed. See docs/DEPLOY.md.
#
#   export PROJECT_ID=your-project REGION=us-central1
#   export GROWTH_CRON_SECRET=$(openssl rand -hex 24)   # + any optional keys
#   bash deploy.sh
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-nam5}"  # US multi-region (use eur3 for EU)

# Optional — default to empty so unset vars don't break --set-env-vars.
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"
GROWTH_CRON_SECRET="${GROWTH_CRON_SECRET:-}"
GROWTH_NOTIFY_WEBHOOK="${GROWTH_NOTIFY_WEBHOOK:-}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
BLUESKY_HANDLE="${BLUESKY_HANDLE:-}"
BLUESKY_APP_PASSWORD="${BLUESKY_APP_PASSWORD:-}"
BUFFER_ACCESS_TOKEN="${BUFFER_ACCESS_TOKEN:-}"
BUFFER_CHANNEL_IDS="${BUFFER_CHANNEL_IDS:-}"

gcloud config set project "$PROJECT_ID"
echo "==> Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com cloudscheduler.googleapis.com firestore.googleapis.com

echo "==> Ensuring Firestore database (durable growth-draft store)"
gcloud firestore databases create --location="$FIRESTORE_LOCATION" --quiet 2>/dev/null \
  || echo "    (Firestore database already exists — skipping)"

echo "==> Deploying tickrr-api (backend)"
gcloud run deploy tickrr-api --source backend --region "$REGION" --allow-unauthenticated --quiet
API_URL=$(gcloud run services describe tickrr-api --region "$REGION" --format='value(status.url)')
echo "    API_URL=$API_URL"

echo "==> Deploying tickrr-web (frontend + server)"
gcloud run deploy tickrr-web --source web --region "$REGION" --allow-unauthenticated \
  --min-instances 1 --quiet \
  --set-env-vars "GROWTH_STORE=firestore,MARKET_API=${API_URL},GEMINI_API_KEY=${GEMINI_API_KEY},STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY},GROWTH_CRON_SECRET=${GROWTH_CRON_SECRET},GROWTH_NOTIFY_WEBHOOK=${GROWTH_NOTIFY_WEBHOOK},DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL},BLUESKY_HANDLE=${BLUESKY_HANDLE},BLUESKY_APP_PASSWORD=${BLUESKY_APP_PASSWORD},BUFFER_ACCESS_TOKEN=${BUFFER_ACCESS_TOKEN},BUFFER_CHANNEL_IDS=${BUFFER_CHANNEL_IDS}"
WEB_URL=$(gcloud run services describe tickrr-web --region "$REGION" --format='value(status.url)')

# Point Stripe redirects at the real URL.
gcloud run services update tickrr-web --region "$REGION" --quiet \
  --update-env-vars "APP_URL=${WEB_URL}" >/dev/null
echo "    WEB_URL=$WEB_URL"

# Grant the web service's runtime identity access to Firestore (done now that the SA exists).
echo "==> Granting Firestore access to the web service account"
PROJNUM=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
WEB_SA=$(gcloud run services describe tickrr-web --region "$REGION" --format='value(spec.template.spec.serviceAccountName)')
[ -z "$WEB_SA" ] && WEB_SA="${PROJNUM}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${WEB_SA}" --role="roles/datastore.user" --quiet >/dev/null

if [ -n "$GROWTH_CRON_SECRET" ]; then
  echo "==> Scheduling autonomous drafting (9am & 5pm ET)"
  if gcloud scheduler jobs describe tickrr-autodraft --location "$REGION" >/dev/null 2>&1; then
    gcloud scheduler jobs update http tickrr-autodraft --location "$REGION" \
      --uri "${WEB_URL}/api/growth/cron?count=3" --http-method POST \
      --update-headers "x-cron-key=${GROWTH_CRON_SECRET}" --schedule "0 9,17 * * *" --time-zone "America/New_York" --quiet
  else
    gcloud scheduler jobs create http tickrr-autodraft --location "$REGION" \
      --uri "${WEB_URL}/api/growth/cron?count=3" --http-method POST \
      --headers "x-cron-key=${GROWTH_CRON_SECRET}" --schedule "0 9,17 * * *" --time-zone "America/New_York" --quiet
  fi
else
  echo "==> GROWTH_CRON_SECRET unset — skipping scheduler (set it to enable autonomous drafting)"
fi

echo ""
echo "Done. Tickrr is live:"
echo "  Web: $WEB_URL"
echo "  API: $API_URL"
