#!/usr/bin/env bash
# Enable product image storage: R2 bucket, public dev URL, Worker binding, secret, deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT/apps/api"
WRANGLER_CONFIG="wrangler.production.jsonc"
BUCKET="${R2_BUCKET:-b2ccoop}"
ACCOUNT_ID="66e72ecb625c7e76d017a366156ec53f"

cd "$API_DIR"

echo "Checking R2 access on account $ACCOUNT_ID..."
if ! npx wrangler r2 bucket list -c "$WRANGLER_CONFIG" 2>&1 | tee /tmp/wrangler-r2-check.log; then
  if grep -q '10042' /tmp/wrangler-r2-check.log; then
    echo ""
    echo "R2 is not enabled on this Cloudflare account yet."
    echo "1. Open: https://dash.cloudflare.com/$ACCOUNT_ID/r2/overview"
    echo "2. Click Get started and add a payment method if prompted (free tier applies)."
    echo "3. Re-run: npm run setup:r2"
    exit 1
  fi
  exit 1
fi

if ! npx wrangler r2 bucket list -c "$WRANGLER_CONFIG" | grep -q "$BUCKET"; then
  echo "Creating bucket $BUCKET..."
  npx wrangler r2 bucket create "$BUCKET" -c "$WRANGLER_CONFIG"
else
  echo "Bucket $BUCKET already exists."
fi

PUBLIC_URL="${PUBLIC_IMAGES_BASE_URL:-https://b2ccoop-store-api.nmatunog.workers.dev/media}"

echo "Enabling r2.dev public URL for $BUCKET (optional fallback)..."
npx wrangler r2 bucket dev-url enable "$BUCKET" -c "$WRANGLER_CONFIG" || true

PUBLIC_URL="${PUBLIC_URL%/}"
echo "Public images base URL: $PUBLIC_URL"

WRANGLER_FILE="$API_DIR/$WRANGLER_CONFIG"
if grep -q '// "r2_buckets"' "$WRANGLER_FILE"; then
  echo "Uncommenting r2_buckets in $WRANGLER_CONFIG..."
  sed -i '' 's|^[[:space:]]*// "r2_buckets"|  "r2_buckets"|' "$WRANGLER_FILE"
fi

echo "Setting PUBLIC_IMAGES_BASE_URL secret..."
printf '%s' "$PUBLIC_URL" | npx wrangler secret put PUBLIC_IMAGES_BASE_URL -c "$WRANGLER_CONFIG"

echo "Deploying store API..."
npx wrangler deploy -c "$WRANGLER_CONFIG"

echo "Done. Product photo uploads should work at POST /merchant/listings/:sku/image"
