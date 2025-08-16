# og-mini

**og-mini** is a minimal API that fetches Open Graph (OGP) metadata from a given URL. It is designed to be simple, low-cost, and easy to maintain. The API runs on Google Cloud Functions (Gen2) and supports Japanese text encoding (EUC-JP, Shift_JIS, UTF-8).

---

## Features

- ✅ Fetches Open Graph and Twitter Card metadata
- ✅ Handles Japanese text encoding automatically (EUC-JP, Shift_JIS, UTF-8)
- ✅ Simple deployment with `npm run deploy`
- ✅ Configurable project ID and region
- ✅ CORS enabled for browser requests

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Deployment

Copy and edit the environment configuration:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Google Cloud Configuration
PROJECT_ID=your-actual-project-id
REGION=asia-northeast1
FUNCTION_NAME=og-mini
RUNTIME=nodejs20
MEMORY=256MB
TIMEOUT=8s
```

### 3. Deploy

```bash
npm run deploy
```

### 4. View Logs

```bash
# View recent logs
npm run logs

# Stream logs in real-time
npm run logs:stream

# View specific number of logs
npm run logs -- --limit=50
```

### 5. Test Locally

```bash
npm start
# Test: curl "http://localhost:8080/?url=https://example.com"
```

---

## NPM Scripts

| Script                      | Description                      | Usage                  |
| --------------------------- | -------------------------------- | ---------------------- |
| `npm start`                 | Start local development server   | Test functions locally |
| `npm run deploy`            | Deploy to Google Cloud Functions | One-command deployment |
| `npm run logs`              | View recent function logs        | Debug and monitor      |
| `npm run logs:stream`       | Stream logs in real-time         | Live monitoring        |
| `npm run logs -- --limit=N` | View specific number of logs     | Custom log count       |

---

## Configuration

### Supported Regions

- `asia-northeast1` (Tokyo) - Recommended for Japan
- `us-central1` (Iowa) - Default Google region
- `europe-west1` (Belgium) - Europe
- `asia-southeast1` (Singapore) - Southeast Asia

### Configuration File (`.env`)

| Variable          | Description             | Default        | Example                                      |
| ----------------- | ----------------------- | -------------- | -------------------------------------------- |
| `PROJECT_ID`      | Google Cloud Project ID | -              | `my-project-123`                             |
| `REGION`          | Deployment region       | -              | `asia-northeast1`                            |
| `FUNCTION_NAME`   | Cloud Function name     | -              | `og-mini`                                    |
| `RUNTIME`         | Node.js runtime version | `nodejs20`     | `nodejs20`                                   |
| `MEMORY`          | Memory allocation       | `256MB`        | `512MB`                                      |
| `TIMEOUT`         | Function timeout        | `8s`           | `10s`                                        |
| `SERVICE_ACCOUNT` | Custom service account  | auto-generated | `og-mini-sa@project.iam.gserviceaccount.com` |

---

## Setup & Deployment (Detailed)

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

Test deployed function:

```bash
curl -s "https://asia-northeast1-$PROJECT_ID.cloudfunctions.net/og?url=https%3A%2F%2Fexample.com" | jq .
```

### Example with Japanese Text

Test Japanese text encoding (should display correctly without mojibake):

```bash
curl -s "https://asia-northeast1-$PROJECT_ID.cloudfunctions.net/og?url=https%3A%2F%2Fitem.rakuten.co.jp%2Fanbo%2F148348-358%2F" | jq .
```

---

## Logs & Monitoring

### Using NPM Scripts (Recommended)

View recent logs:

```bash
npm run logs
```

Stream logs in real-time:

```bash
npm run logs:stream
```

View specific number of logs:

```bash
npm run logs -- --limit=50
```

### Manual gcloud Commands

```bash
# Read recent logs
gcloud functions logs read og --gen2 --region=asia-northeast1 --limit=100

# Stream logs in real-time
gcloud functions logs tail og --gen2 --region=asia-northeast1
```

---

## Updating & Redeploying

When code under `functions/` changes, simply run:

```bash
npm run deploy
```

This automatically handles the complete gcloud deployment command with all the correct parameters from your `.env` configuration.

---

## Usage Examples

### Basic OGP Extraction

```bash
# Extract Open Graph data from a website
curl "https://asia-northeast1-your-project.cloudfunctions.net/og?url=https://example.com" | jq .

# Response:
{
  "url": "https://example.com",
  "finalUrl": "https://example.com",
  "title": "Example Domain",
  "description": "This domain is for use in illustrative examples...",
  "image": null,
  "siteName": null,
  "type": null,
  "lang": "en",
  "favicon": "https://example.com/favicon.ico",
  "fetchedAt": "2025-08-16T05:48:46.575Z"
}
```

### Japanese Website (EUC-JP Encoding)

```bash
# Japanese e-commerce site with proper encoding handling
curl "https://asia-northeast1-your-project.cloudfunctions.net/og?url=https://item.rakuten.co.jp/anbo/148348-358/" | jq .

# Response with correctly decoded Japanese text:
{
  "title": "【楽天市場】手ぬぐい「さるすべり」百日紅／猿滑／crape myrtle...",
  "description": "染の安坊 手ぬぐい 綿100% 特岡 日本製 35cm×100cm...",
  "siteName": "楽天市場",
  "lang": "ja"
}
```

### Error Handling

```bash
# Invalid URL
curl "https://asia-northeast1-your-project.cloudfunctions.net/og?url=invalid-url"
# Response: {"error": "invalid url"}

# Timeout or unreachable site
curl "https://asia-northeast1-your-project.cloudfunctions.net/og?url=https://unreachable.example.com"
# Response: {"error": "timeout", "url": "https://unreachable.example.com"}

# Non-HTML content
curl "https://asia-northeast1-your-project.cloudfunctions.net/og?url=https://example.com/image.jpg"
# Response: {"error": "content is not HTML", "contentType": "image/jpeg"}
```

---

## API Reference

### Endpoint

```
GET https://{region}-{project-id}.cloudfunctions.net/{function-name}?url={encoded-url}
```

### Parameters

| Parameter | Type   | Required | Description                                      |
| --------- | ------ | -------- | ------------------------------------------------ |
| `url`     | string | Yes      | URL-encoded website URL to extract OGP data from |

### Response

| Field         | Type         | Description                        |
| ------------- | ------------ | ---------------------------------- |
| `url`         | string       | Original requested URL             |
| `finalUrl`    | string       | Final URL after redirects          |
| `title`       | string\|null | Page title or og:title             |
| `description` | string\|null | Meta description or og:description |
| `image`       | string\|null | Absolute URL of og:image           |
| `siteName`    | string\|null | og:site_name                       |
| `type`        | string\|null | og:type                            |
| `lang`        | string\|null | Page language                      |
| `favicon`     | string\|null | Absolute URL of favicon            |
| `fetchedAt`   | string       | ISO timestamp of fetch             |

### Error Response

| Field   | Type   | Description                            |
| ------- | ------ | -------------------------------------- |
| `error` | string | Error message                          |
| `url`   | string | Original requested URL (if applicable) |

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

### Common Issues

- **`invalid_grant` when setting project** → Run `gcloud auth login` again, then re-set project.
- **API not found** → Ensure correct spelling: `artifactregistry.googleapis.com`.
- **Build failed due to missing permissions** → Make sure Step 3 IAM grants are applied; wait 1–2 minutes.
- **Service account not found** → Run Step 4 before deploying with `--service-account`.
- **Warning: Cloud Run service not found, redeployed with defaults** → Safe to ignore on first deploy.

### Deployment Issues

- **`.env file not found`** → Copy `.env.example` to `.env` and configure your settings.
- **`PROJECT_ID not set`** → Edit `.env` file and set your actual Google Cloud project ID.
- **Permission denied** → Ensure you have proper IAM roles and are authenticated with `gcloud auth login`.

### Log Issues

- **No logs showing** → Function may not have been invoked yet. Try making a test request first.
- **Permission denied for logs** → Ensure your account has `roles/logging.viewer` permission.

### Japanese Text Issues

If you see mojibake (garbled Japanese text):

- The encoding detection should handle this automatically
- Check that the source website has proper charset declaration
- Verify the response in your browser to ensure the API is working correctly
