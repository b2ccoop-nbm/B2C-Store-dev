#!/usr/bin/env bash
# Upload DEV_ADMIN_SECRET to production Worker (reads apps/api/.dev.vars unless arg passed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT/apps/api"
WRANGLER_CONFIG="wrangler.production.jsonc"
SECRET="${1:-}"

if [[ -z "$SECRET" && -f "$API_DIR/.dev.vars" ]]; then
  SECRET="$(grep -E '^DEV_ADMIN_SECRET=' "$API_DIR/.dev.vars" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi

if [[ -z "$SECRET" ]]; then
  echo "Usage: npm run secret:admin -- [secret]" >&2
  echo "  Or set DEV_ADMIN_SECRET in apps/api/.dev.vars" >&2
  exit 1
fi

cd "$API_DIR"
printf '%s' "$SECRET" | npx wrangler secret put DEV_ADMIN_SECRET -c "$WRANGLER_CONFIG"
echo "DEV_ADMIN_SECRET set on b2ccoop-store-api (production)."
