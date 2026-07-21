#!/usr/bin/env bash
# Deploy Tickrr (API + web) to Google Cloud Run and wire the SEO scheduler.
# Builds remotely via Cloud Build — no local Docker needed. See docs/DEPLOY.md.
#
#   export PROJECT_ID=your-project REGION=us-central1
#   export SEO_CRON_SECRET=$(openssl rand -hex 24)   # + any optional keys
#   bash deploy.sh
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-nam5}"  # US multi-region (use eur3 for EU)

# Optional — default to empty so unset vars don't break --set-env-vars.
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
RAZORPAY_KEY_ID="${RAZORPAY_KEY_ID:-}"        # Razorpay checkout — keys live ONLY in env/secrets, never the repo
RAZORPAY_KEY_SECRET="${RAZORPAY_KEY_SECRET:-}"
RAZORPAY_CURRENCY="${RAZORPAY_CURRENCY:-USD}"
ODDS_API_KEY="${ODDS_API_KEY:-}"              # The Odds API — sportsbook consensus (backend)
SEO_CRON_SECRET="${SEO_CRON_SECRET:-}"       # guards /api/seo/cron
APP_URL="${APP_URL:-}"                        # public site origin (e.g. https://tickrr.tech); defaults to the Cloud Run URL

gcloud config set project "$PROJECT_ID"
echo "==> Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com cloudscheduler.googleapis.com firestore.googleapis.com

# Fresh projects: the default compute SA lacks Cloud Build permissions, so `run deploy --source`
# fails to build. Grant the builder role up front. https://cloud.google.com/build/docs/...
echo "==> Granting Cloud Build permissions to the default compute service account"
PROJNUM=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJNUM}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder" --quiet >/dev/null

echo "==> Ensuring Firestore database (durable growth-draft store)"
gcloud firestore databases create --location="$FIRESTORE_LOCATION" --quiet 2>/dev/null \
  || echo "    (Firestore database already exists — skipping)"

echo "==> Deploying tickrr-api (backend)"
gcloud run deploy tickrr-api --source backend --region "$REGION" --allow-unauthenticated --quiet \
  --set-env-vars "ODDS_API_KEY=${ODDS_API_KEY}"
API_URL=$(gcloud run services describe tickrr-api --region "$REGION" --format='value(status.url)')
echo "    API_URL=$API_URL"

echo "==> Deploying tickrr-web (frontend + server)"
gcloud run deploy tickrr-web --source web --region "$REGION" --allow-unauthenticated \
  --min-instances 1 --memory 1Gi --quiet \
  --set-env-vars "MARKET_API=${API_URL},GEMINI_API_KEY=${GEMINI_API_KEY},RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID},RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET},RAZORPAY_CURRENCY=${RAZORPAY_CURRENCY},SEO_CRON_SECRET=${SEO_CRON_SECRET}"
WEB_URL=$(gcloud run services describe tickrr-web --region "$REGION" --format='value(status.url)')

# Canonical site origin — drives SEO canonicals/sitemap/llms + Razorpay redirects. Use the custom
# domain if the operator exported APP_URL (e.g. https://tickrr.tech); else the Cloud Run URL.
SITE_URL="${APP_URL:-$WEB_URL}"
gcloud run services update tickrr-web --region "$REGION" --quiet \
  --update-env-vars "APP_URL=${SITE_URL}" >/dev/null
echo "    WEB_URL=$WEB_URL"
echo "    APP_URL=$SITE_URL"

# Grant the web service's runtime identity access to Firestore (done now that the SA exists).
echo "==> Granting Firestore access to the web service account"
PROJNUM=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
WEB_SA=$(gcloud run services describe tickrr-web --region "$REGION" --format='value(spec.template.spec.serviceAccountName)')
[ -z "$WEB_SA" ] && WEB_SA="${PROJNUM}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${WEB_SA}" --role="roles/datastore.user" --quiet >/dev/null

# Retire any scheduler left by an older production deployment.
gcloud scheduler jobs delete tickrr-autodraft --location "$REGION" --quiet 2>/dev/null \
  || echo "    (growth scheduler already absent)"

# Daily AI SEO post (the AI SEO editor writes an answer-first, intel-only post from live signals).
# Uses its own dedicated secret.
SEO_KEY="${SEO_CRON_SECRET}"
if [ -n "$SEO_KEY" ]; then
  echo "==> Scheduling daily AI SEO post (1pm ET)"
  if gcloud scheduler jobs describe tickrr-seo --location "$REGION" >/dev/null 2>&1; then
    gcloud scheduler jobs update http tickrr-seo --location "$REGION" \
      --uri "${WEB_URL}/api/seo/cron" --http-method POST \
      --update-headers "x-cron-key=${SEO_KEY}" --schedule "0 13 * * *" --time-zone "America/New_York" --quiet
  else
    gcloud scheduler jobs create http tickrr-seo --location "$REGION" \
      --uri "${WEB_URL}/api/seo/cron" --http-method POST \
      --headers "x-cron-key=${SEO_KEY}" --schedule "0 13 * * *" --time-zone "America/New_York" --quiet
  fi
else
  echo "==> No cron secret set — skipping SEO scheduler"
fi

echo ""
echo "Done. Tickrr is live:"
echo "  Web: $WEB_URL"
echo "  API: $API_URL"
