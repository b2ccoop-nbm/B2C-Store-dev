#!/usr/bin/env bash
# E2E smoke: seller apply → HQ approve → listing → publish → storefront
set -euo pipefail

API_BASE="${API_BASE:-https://b2ccoop-store-api.nmatunog.workers.dev}"
ADMIN_SECRET="${ADMIN_SECRET:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "$ADMIN_SECRET" && -f "$ROOT/apps/api/.dev.vars" ]]; then
  ADMIN_SECRET="$(grep -E '^DEV_ADMIN_SECRET=' "$ROOT/apps/api/.dev.vars" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi

if [[ -z "$ADMIN_SECRET" ]]; then
  echo "Set ADMIN_SECRET or DEV_ADMIN_SECRET in apps/api/.dev.vars" >&2
  exit 1
fi

VENDOR_CODE="${VENDOR_CODE:-B2C-FARM}"
STAMP="$(date +%s)"
EMAIL="merchant.smoke.${STAMP}@b2ccoop.test"
SKU="SMOKE-${STAMP}"
BUSINESS="Smoke Test Farm ${STAMP}"

echo "== 1. Submit seller application =="
APP_RES=$(curl -sS -X POST "$API_BASE/seller/applications" \
  -H "Content-Type: application/json" \
  -d "{\"applicantEmail\":\"$EMAIL\",\"businessName\":\"$BUSINESS\",\"businessType\":\"farm\",\"description\":\"Automated smoke test\"}")
echo "$APP_RES" | python3 -m json.tool
APP_ID=$(echo "$APP_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['application']['applicationId'])")

echo "== 2. Approve seller =="
curl -sS -X PATCH "$API_BASE/admin/seller-applications/$APP_ID/approve" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool

VENDOR_CODE=$(curl -sS "$API_BASE/seller/applications?email=$EMAIL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['application']['vendor']['code'])")
SLUG=$(curl -sS "$API_BASE/seller/applications?email=$EMAIL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['application']['vendor']['slug'])")
echo "Vendor: $VENDOR_CODE slug: $SLUG"

echo "== 3. Create listing =="
LIST_RES=$(curl -sS -X POST "$API_BASE/merchant/listings" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "X-Vendor-Code: $VENDOR_CODE" \
  -H "Content-Type: application/json" \
  -d "{\"sku\":\"$SKU\",\"name\":\"Smoke Test Honey\",\"category\":\"Produce\",\"unitPrice\":\"99.00\",\"patronagePerUnit\":\"2.00\",\"submitForReview\":true}")
echo "$LIST_RES" | python3 -m json.tool

echo "== 4. Publish listing =="
curl -sS -X PATCH "$API_BASE/admin/listings/$VENDOR_CODE/$SKU/approve" \
  -H "Authorization: Bearer $ADMIN_SECRET" | python3 -m json.tool

echo "== 5. Verify storefront =="
curl -sS "$API_BASE/storefront/$SLUG" | python3 -c "
import sys, json
d = json.load(sys.stdin)
items = d.get('items', [])
skus = [i['sku'] for i in items]
assert '$SKU' in skus, f'SKU $SKU not in storefront: {skus}'
print('OK — listing visible on storefront:', d.get('name'), len(items), 'products')
"

echo ""
echo "Merchant E2E smoke passed."
