# Continuous deployment (GitHub Actions → Cloud Run)

Push to `main` → the changed service redeploys automatically:

- change under `web/**` → **tickrr-web** redeploys
- change under `backend/**` → **tickrr-api** redeploys

Auth is **keyless** via **Workload Identity Federation** (no service-account key in GitHub), and
deploys use `gcloud run deploy --source`, which rebuilds the image and **preserves the service's
existing env vars / secrets** (Gemini, Buffer, Firestore, media, etc.).

Two workflows do this: [`.github/workflows/deploy-web.yml`](../.github/workflows/deploy-web.yml)
and [`.github/workflows/deploy-api.yml`](../.github/workflows/deploy-api.yml). Both also support
manual runs (**Actions → Run workflow**).

---

## One-time setup (run in Cloud Shell)

```bash
PROJECT_ID=tickrr-20260701-17076
REGION=us-central1
REPO=vn-envy/Tickrr                      # owner/repo
gcloud config set project "$PROJECT_ID"

PROJNUM=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com \
  cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com

# 1) Deploy service account + roles it needs for source-deploys
gcloud iam service-accounts create gha-deployer --display-name "GitHub Actions deployer" 2>/dev/null || true
SA="gha-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
for r in roles/run.admin roles/cloudbuild.builds.editor roles/artifactregistry.admin \
         roles/storage.admin roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role="$r" >/dev/null
done
# let the deployer act as the runtime (compute default) SA
gcloud iam service-accounts add-iam-policy-binding "${PROJNUM}-compute@developer.gserviceaccount.com" \
  --member="serviceAccount:$SA" --role="roles/iam.serviceAccountUser" >/dev/null

# 2) Workload Identity pool + GitHub OIDC provider (locked to your repo)
gcloud iam workload-identity-pools create github --location global --display-name "GitHub" 2>/dev/null || true
gcloud iam workload-identity-pools providers create-oidc github \
  --location global --workload-identity-pool github --display-name "GitHub OIDC" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition "assertion.repository=='${REPO}'" \
  --issuer-uri "https://token.actions.githubusercontent.com" 2>/dev/null || true

# 3) Let the repo impersonate the deploy SA
POOL=$(gcloud iam workload-identity-pools describe github --location global --format='value(name)')
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/${POOL}/attribute.repository/${REPO}" >/dev/null

# 4) Print the values to paste into GitHub
echo ""
echo "GCP_PROJECT_ID = $PROJECT_ID"
echo "GCP_REGION     = $REGION"
echo "GCP_DEPLOY_SA  = $SA"
echo "GCP_WIF_PROVIDER = $(gcloud iam workload-identity-pools providers describe github \
  --location global --workload-identity-pool github --format='value(name)')"
```

## Add the GitHub repository variables

GitHub → the repo → **Settings → Secrets and variables → Actions → Variables → New repository
variable**. Add all four (these are **Variables**, not Secrets — none are sensitive):

| Name | Value |
|---|---|
| `GCP_PROJECT_ID` | `tickrr-20260701-17076` |
| `GCP_REGION` | `us-central1` |
| `GCP_DEPLOY_SA` | `gha-deployer@tickrr-20260701-17076.iam.gserviceaccount.com` |
| `GCP_WIF_PROVIDER` | the long `projects/…/providers/github` value printed above |

## Done

From now on, `git push` to `main` deploys automatically — no more manual `gcloud run deploy`.
Watch runs under the repo's **Actions** tab. To deploy without a code change, use **Run workflow**
(manual dispatch). Secrets/keys never leave Cloud Run; the workflow only triggers rebuilds.
