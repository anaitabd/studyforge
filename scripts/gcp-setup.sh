#!/usr/bin/env bash
# gcp-setup.sh — One-time GCP infrastructure setup for StudyForge
#
# Run this ONCE before the first Cloud Build deploy.
# Safe to re-run — all steps check if the resource already exists.
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project YOUR_PROJECT_ID
#   gcloud services enable run.googleapis.com sqladmin.googleapis.com \
#     redis.googleapis.com storage.googleapis.com secretmanager.googleapis.com \
#     artifactregistry.googleapis.com cloudbuild.googleapis.com \
#     iam.googleapis.com aiplatform.googleapis.com
#
# Usage:
#   chmod +x scripts/gcp-setup.sh
#   ./scripts/gcp-setup.sh

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}── $* ──${NC}"; }

# ── Config ────────────────────────────────────────────────────────────────────
REGION="${REGION:-europe-west9}"
DB_INSTANCE="${DB_INSTANCE:-studyforge-db}"
DB_NAME="${DB_NAME:-studyforge}"
REDIS_INSTANCE="${REDIS_INSTANCE:-studyforge-cache}"
AR_REPO="${AR_REPO:-studyforge}"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

[[ -z "$PROJECT_ID" ]] && err "No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"

GCS_BUCKET="${GCS_BUCKET:-studyforge-${PROJECT_ID}-files}"
CB_SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')@cloudbuild.gserviceaccount.com"

echo ""
echo "=================================================="
echo " StudyForge — GCP Infrastructure Setup"
echo "=================================================="
echo " Project : $PROJECT_ID"
echo " Region  : $REGION"
echo " Bucket  : $GCS_BUCKET"
echo "=================================================="
echo ""
read -rp "Proceed? (y/N) " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# ── 1. Enable APIs ────────────────────────────────────────────────────────────
step "1/8 Enabling required APIs"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  aiplatform.googleapis.com \
  --quiet
ok "APIs enabled"

# ── 2. Artifact Registry ──────────────────────────────────────────────────────
step "2/8 Artifact Registry"
if gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" &>/dev/null; then
  ok "Repository '$AR_REPO' already exists"
else
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="StudyForge Docker images"
  ok "Created repository '$AR_REPO'"
fi
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
ok "Docker credential helper configured"

# ── 3. Cloud SQL (PostgreSQL 16) ──────────────────────────────────────────────
step "3/8 Cloud SQL"
if gcloud sql instances describe "$DB_INSTANCE" &>/dev/null; then
  ok "Cloud SQL instance '$DB_INSTANCE' already exists"
else
  warn "Creating Cloud SQL instance (this takes ~5 minutes)…"
  gcloud sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_16 \
    --edition=ENTERPRISE \
    --tier=db-g1-small \
    --region="$REGION" \
    --storage-type=SSD \
    --storage-size=10GB \
    --backup-start-time=02:00 \
    --deletion-protection
  ok "Created Cloud SQL instance '$DB_INSTANCE'"
fi

# Create database
if gcloud sql databases describe "$DB_NAME" --instance="$DB_INSTANCE" &>/dev/null; then
  ok "Database '$DB_NAME' already exists"
else
  gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
  ok "Created database '$DB_NAME'"
fi

# Set postgres password
DB_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
gcloud sql users set-password postgres \
  --instance="$DB_INSTANCE" \
  --password="$DB_PASSWORD"
ok "Postgres password set"

DB_CONN_NAME=$(gcloud sql instances describe "$DB_INSTANCE" --format='value(connectionName)')
DATABASE_URL="postgresql+asyncpg://postgres:${DB_PASSWORD}@/studyforge?host=/cloudsql/${DB_CONN_NAME}"
echo ""
warn "Save this — you will NOT see the password again:"
echo "  DATABASE_URL = $DATABASE_URL"
echo "  DB_CONN_NAME = $DB_CONN_NAME"
echo ""

# ── 4. Memorystore (Redis) ────────────────────────────────────────────────────
step "4/8 Memorystore Redis"
if gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" &>/dev/null; then
  ok "Redis instance '$REDIS_INSTANCE' already exists"
  REDIS_IP=$(gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" --format='value(host)')
else
  warn "Creating Memorystore instance (~3 minutes)…"
  gcloud redis instances create "$REDIS_INSTANCE" \
    --size=1 \
    --region="$REGION" \
    --tier=BASIC \
    --redis-version=redis_7_0
  REDIS_IP=$(gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" --format='value(host)')
  ok "Created Redis instance — host: $REDIS_IP"
fi
REDIS_URL="redis://${REDIS_IP}:6379/0"
echo "  REDIS_URL = $REDIS_URL"

# ── 5. GCS bucket ────────────────────────────────────────────────────────────
step "5/8 Cloud Storage bucket"
if gcloud storage buckets describe "gs://${GCS_BUCKET}" &>/dev/null; then
  ok "Bucket 'gs://${GCS_BUCKET}' already exists"
else
  gcloud storage buckets create "gs://${GCS_BUCKET}" --location="$REGION"
  ok "Created bucket 'gs://${GCS_BUCKET}'"
fi
# CORS for presigned URL downloads
cat > /tmp/gcs-cors.json <<'CORS'
[{"origin":["*"],"method":["GET","HEAD"],"responseHeader":["Content-Type"],"maxAgeSeconds":3600}]
CORS
gcloud storage buckets update "gs://${GCS_BUCKET}" --cors-file=/tmp/gcs-cors.json
ok "CORS configured on bucket"

# Uniform bucket-level access
gcloud storage buckets update "gs://${GCS_BUCKET}" --uniform-bucket-level-access 2>/dev/null || true

# ── 6. Secret Manager ─────────────────────────────────────────────────────────
step "6/8 Secret Manager"

create_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" &>/dev/null; then
    gcloud secrets versions add "$name" --data-file=<(echo -n "$value") --quiet
    ok "Updated secret '$name'"
  else
    echo -n "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic
    ok "Created secret '$name'"
  fi
}

create_secret "DATABASE_URL" "$DATABASE_URL"
create_secret "REDIS_URL"    "$REDIS_URL"

# Interactive secrets
echo ""
read -rp "Enter CLERK_SECRET_KEY (sk_live_...): " CLERK_SK
create_secret "CLERK_SECRET_KEY" "$CLERK_SK"

SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
create_secret "SECRET_KEY" "$SECRET_KEY"
echo "  Generated SECRET_KEY and stored in Secret Manager"

# Optional secrets (skip if empty)
read -rp "Enter SENDGRID_API_KEY (or Enter to skip): " SENDGRID_KEY
[[ -n "$SENDGRID_KEY" ]] && create_secret "SENDGRID_API_KEY" "$SENDGRID_KEY"

read -rp "Enter STRIPE_SECRET_KEY (or Enter to skip): " STRIPE_KEY
[[ -n "$STRIPE_KEY" ]] && create_secret "STRIPE_SECRET_KEY" "$STRIPE_KEY"

# ── 7. IAM for Cloud Build ────────────────────────────────────────────────────
step "7/8 IAM — Cloud Build service account"

grant() {
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${CB_SA}" \
    --role="$1" \
    --condition=None \
    --quiet
}

grant roles/run.admin
grant roles/secretmanager.secretAccessor
grant roles/iam.serviceAccountUser
grant roles/artifactregistry.writer
grant roles/cloudsql.client
grant roles/storage.objectAdmin
ok "IAM roles granted to Cloud Build SA: $CB_SA"

# Cloud Run SA needs storage.objectAdmin on the bucket + iam.serviceAccountTokenCreator for signed URLs
CR_SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
  --member="serviceAccount:${CR_SA}" \
  --role=roles/storage.objectAdmin
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CR_SA}" \
  --role=roles/iam.serviceAccountTokenCreator \
  --condition=None \
  --quiet
ok "Cloud Run default SA granted storage + token-creator roles"

# ── 8. Cloud Build trigger ───────────────────────────────────────────────────
step "8/8 Cloud Build GitHub trigger"
echo ""
echo "  Connect your GitHub repo to Cloud Build manually:"
echo "  https://console.cloud.google.com/cloud-build/triggers/connect"
echo ""
echo "  Then create a trigger:"
echo "    Name:        deploy-on-push-main"
echo "    Event:       Push to branch  (^main\$)"
echo "    Config:      cloudbuild.yaml"
echo "    Substitutions:"
echo "      _CLERK_KEY   → your NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
echo "      _API_URL     → (set after first deploy, update trigger later)"
echo ""
echo "  Or trigger manually right now:"
echo "  gcloud builds submit . --config=cloudbuild.yaml \\"
echo "    --substitutions=_CLERK_KEY=pk_live_...,_API_URL=https://placeholder"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " Setup complete! Summary"
echo "=================================================="
echo " Cloud SQL  : $DB_CONN_NAME"
echo " Redis      : $REDIS_IP:6379"
echo " GCS bucket : gs://${GCS_BUCKET}"
echo " AR repo    : ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
echo ""
echo " Secrets in Secret Manager:"
echo "   DATABASE_URL, REDIS_URL, CLERK_SECRET_KEY, SECRET_KEY"
echo ""
echo " Next step: push to main or run:"
echo "   git push origin main"
echo "=================================================="
