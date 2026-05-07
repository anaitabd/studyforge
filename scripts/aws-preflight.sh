#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/6] Checking required tooling..."
for cmd in terraform docker python3 node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: missing required tool: $cmd"
    exit 1
  fi
  echo "  - found $cmd"
done

echo "[2/6] Checking repo files..."
required_files=(
  "docker-compose.yml"
  "apps/api/requirements.txt"
  "apps/web/package.json"
  "infra/terraform/environments/dev/main.tf"
)
for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || { echo "ERROR: missing file $file"; exit 1; }
  echo "  - found $file"
done

echo "[3/6] Validating Terraform formatting..."
terraform -chdir=infra/terraform/environments/dev fmt -check -recursive >/dev/null
terraform -chdir=infra/terraform/environments/staging fmt -check -recursive >/dev/null
terraform -chdir=infra/terraform/environments/prod fmt -check -recursive >/dev/null
echo "  - terraform fmt check passed"

echo "[4/6] Checking API dependency lock inputs..."
python3 -m pip --version >/dev/null
echo "  - python/pip available"

echo "[5/6] Checking web install inputs..."
npm --prefix apps/web pkg get name >/dev/null
echo "  - apps/web package metadata is readable"

echo "[6/6] Validating env templates and required AWS vars..."
required_templates=("apps/api/.env.example" "apps/web/.env.local.example")
for file in "${required_templates[@]}"; do
  [[ -f "$file" ]] || { echo "ERROR: missing env template $file"; exit 1; }
  echo "  - found $file"
done

missing_vars=0
for v in APP_ENV DATABASE_URL REDIS_URL AI_PROVIDER AWS_REGION S3_BUCKET S3_REGION CLERK_SECRET_KEY CLERK_WEBHOOK_SECRET FRONTEND_URL SECRET_KEY; do
  if ! rg -n "^${v}=" apps/api/.env.example >/dev/null; then
    echo "ERROR: apps/api/.env.example missing key: $v"
    missing_vars=1
  fi
done
for v in NEXT_PUBLIC_API_URL NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY; do
  if ! rg -n "^${v}=" apps/web/.env.local.example >/dev/null; then
    echo "ERROR: apps/web/.env.local.example missing key: $v"
    missing_vars=1
  fi
done
[[ $missing_vars -eq 0 ]] || exit 1

echo "  - env templates contain required baseline keys"
echo "PASS: repo is ready for AWS setup checks; next fill real secrets in AWS Secrets Manager/SSM and deploy."
