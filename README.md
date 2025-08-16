# og-mini

**og-mini** is a minimal API that fetches Open Graph (OGP) metadata from a given URL. It is designed to be simple, low-cost, and easy to maintain. The API runs on Google Cloud Functions (Gen2) and is typically called through Cloudflare Workers, which handle caching and CORS. This setup allows you to keep the backend URL private, leverage edge caching, and centralize access control.

---

## Setup & Deployment

### 0. Prerequisites (macOS via Homebrew)

```bash
brew update
brew upgrade
brew install --cask google-cloud-sdk
```

Check versions:

```bash
gcloud -v
node -v
npm -v
```

---

### 1. Authenticate & Select Project

```bash
gcloud auth login
gcloud config set account <YOUR_GMAIL_OR_WORK_ACCOUNT>
gcloud config set project <YOUR_PROJECT_ID>
gcloud config set functions/region asia-northeast1
```

---

### 2. Enable Required APIs

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iamcredentials.googleapis.com
```

---

### 3. Grant IAM for Cloud Build

```bash
PROJECT_ID=<YOUR_PROJECT_ID>
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
CB_SA="$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/iam.serviceAccountUser"
```

Wait \~1–2 minutes before retrying if you just added roles.

---

### 4. Create a Runtime Service Account

```bash
gcloud iam service-accounts create og-mini-sa --display-name="og-mini runtime"
RUNTIME_SA="og-mini-sa@$PROJECT_ID.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/monitoring.metricWriter"
```

---

### 5. First Deploy

From the repo root (where `functions/index.js` lives):

```bash
gcloud functions deploy og \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --entry-point=og \
  --trigger-http \
  --allow-unauthenticated \
  --memory=256MB \
  --timeout=8s \
  --service-account="og-mini-sa@$PROJECT_ID.iam.gserviceaccount.com"
```

Get URLs:

```bash
gcloud functions describe og --gen2 --region=asia-northeast1 \
  --format="value(serviceConfig.uri,url)"
```

Test:

```bash
curl -s "https://asia-northeast1-$PROJECT_ID.cloudfunctions.net/og?url=https%3A%2F%2Fexample.com" | jq .
```

---

## Updating & Redeploying

When code under `functions/` changes:

```bash
gcloud functions deploy og \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --entry-point=og \
  --trigger-http \
  --allow-unauthenticated \
  --memory=256MB \
  --timeout=8s \
  --service-account="og-mini-sa@$PROJECT_ID.iam.gserviceaccount.com"
```

Logs:

```bash
gcloud functions logs read og --gen2 --region=asia-northeast1 --limit=100
# or stream:
gcloud functions logs tail og --gen2 --region=asia-northeast1
```

---

## Hardened Access (Optional)

If you want the API to be callable **only from Workers**:

1. Add a shared secret (HMAC) verification in `functions/index.js`.
2. Store the shared key in Cloudflare Workers as a Wrangler `secret`.
3. Send signed headers (`X-OG-Key`, `X-OG-Sig`, `X-OG-Ts`) from Workers.
4. Reject requests with invalid/missing signatures.

This ensures the GCF endpoint is not usable directly from browsers.

---

## Troubleshooting

- **`invalid_grant` when setting project** → Run `gcloud auth login` again, then re-set project.
- **API not found** → Ensure correct spelling: `artifactregistry.googleapis.com`.
- **Build failed due to missing permissions** → Make sure Step 3 IAM grants are applied; wait 1–2 minutes.
- **Service account not found** → Run Step 4 before deploying with `--service-account`.
- **Warning: Cloud Run service not found, redeployed with defaults** → Safe to ignore on first deploy.
