#!/usr/bin/env bash
# Verify a store order posted to B2C-Accounting (idempotent marketplace-sale replay).
#
# Usage:
#   npm run smoke:accounting -- <order-uuid>
#   npm run smoke:accounting -- 17b3ec8f-3bd1-402e-8d27-3a2f2d2e1636
#
# Env overrides:
#   STORE_API_URL          (default: production store API)
#   ACCOUNTING_API_URL     (from apps/api/.dev.vars)
#   ACCOUNTING_INTEGRATION_SECRET (from apps/api/.dev.vars)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV_VARS="$ROOT/apps/api/.dev.vars"
PROD_ENV="$ROOT/apps/web/.env.production"

ORDER_ID="${1:-${SMOKE_ORDER_ID:-}}"

if [[ "$ORDER_ID" == "-h" || "$ORDER_ID" == "--help" ]]; then
  echo "Usage: npm run smoke:accounting -- <order-uuid>" >&2
  echo "  Verifies store order status and Accounting journal (already_posted)." >&2
  exit 0
fi
if [[ -z "$ORDER_ID" ]]; then
  echo "Usage: npm run smoke:accounting -- <order-uuid>" >&2
  exit 1
fi

read_dev_var() {
  local key="$1"
  if [[ -f "$DEV_VARS" ]]; then
    grep -E "^${key}=" "$DEV_VARS" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
  fi
}

WRANGLER_PROD="$ROOT/apps/api/wrangler.production.jsonc"
DEFAULT_STORE_API="https://b2ccoop-store-api.nmatunog.workers.dev"
DEFAULT_ACCOUNTING_API="https://b2ccoop-accounting-production.up.railway.app"

if [[ -f "$PROD_ENV" ]]; then
  url="$(grep -E '^PUBLIC_API_URL=' "$PROD_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  [[ -n "$url" ]] && DEFAULT_STORE_API="$url"
fi

if [[ -f "$WRANGLER_PROD" ]]; then
  url="$(grep -E '"ACCOUNTING_API_URL"' "$WRANGLER_PROD" | head -1 | sed -E 's/.*"ACCOUNTING_API_URL"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
  [[ -n "$url" && "$url" != *ACCOUNTING_API_URL* ]] && DEFAULT_ACCOUNTING_API="$url"
fi

STORE_API_URL="${STORE_API_URL:-$DEFAULT_STORE_API}"
DEV_ACCOUNTING_URL="$(read_dev_var ACCOUNTING_API_URL)"

# Default accounting target: production when store API is production, else .dev.vars (local).
if [[ -n "${ACCOUNTING_API_URL:-}" ]]; then
  : # explicit env wins
elif [[ "$STORE_API_URL" == *localhost* || "$STORE_API_URL" == *127.0.0.1* ]]; then
  ACCOUNTING_API_URL="${DEV_ACCOUNTING_URL:-http://localhost:3010}"
else
  ACCOUNTING_API_URL="$DEFAULT_ACCOUNTING_API"
fi

ACCOUNTING_SECRET="${ACCOUNTING_INTEGRATION_SECRET:-$(read_dev_var ACCOUNTING_INTEGRATION_SECRET)}"

if [[ -z "$ACCOUNTING_API_URL" || -z "$ACCOUNTING_SECRET" ]]; then
  echo "ERROR: Set ACCOUNTING_API_URL and ACCOUNTING_INTEGRATION_SECRET in apps/api/.dev.vars" >&2
  exit 1
fi

ACCOUNTING_API_URL="${ACCOUNTING_API_URL%/}"
STORE_API_URL="${STORE_API_URL%/}"

echo "== B2CCoop accounting smoke test =="
echo "Store API:      $STORE_API_URL"
echo "Accounting API: $ACCOUNTING_API_URL"
echo "Order ID:       $ORDER_ID"
echo ""

ORDER_JSON="$(curl -sf "$STORE_API_URL/orders/$ORDER_ID")" || {
  echo "FAIL: Could not fetch order from store API" >&2
  exit 1
}

export ORDER_JSON ACCOUNTING_API_URL ACCOUNTING_SECRET
python3 <<'PY'
import json, os, sys, urllib.request

order = json.loads(os.environ["ORDER_JSON"])
accounting_base = os.environ["ACCOUNTING_API_URL"]
secret = os.environ["ACCOUNTING_SECRET"]

order_id = order.get("orderId", "?")
status = order.get("status", "?")
external_id = order.get("externalId", "")

print(f"1. Store order")
print(f"   status:     {status}")
print(f"   externalId: {external_id}")
print(f"   gross:      PHP {order.get('grossAmount', '?')}")
print(f"   vendor:     {order.get('vendorCode', '?')}")

if status not in ("POSTED_TO_LEDGER", "FAILED"):
    print(f"\nWARN: Order status is {status} — expected POSTED_TO_LEDGER after confirm payment")
    if status == "PENDING_PICKUP":
        print("     Confirm payment at /admin or the order receipt first.")
        sys.exit(1)

payload = {
    "externalId": external_id,
    "occurredAt": order.get("createdAt") or "2026-01-01T00:00:00.000Z",
    "currency": order.get("currency", "PHP"),
    "grossAmount": float(order["grossAmount"]),
    "salesAmount": float(order["salesAmount"]),
    "vendorPayableAmount": float(order["vendorPayableAmount"]),
    "cogsAmount": float(order.get("cogsAmount") or 0),
    "patronageAmount": float(order.get("patronageAmount") or 0),
    "vendorCode": order["vendorCode"],
    "memo": order.get("memo") or f"Smoke test order {order_id}",
}
if order.get("participantId"):
    payload["buyerParticipantId"] = order["participantId"]

body = json.dumps(payload).encode()
req = urllib.request.Request(
    f"{accounting_base}/api/v1/finance/marketplace-sale",
    data=body,
    headers={
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
    },
    method="POST",
)

print("\n2. Accounting replay (idempotent)")
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        http_status = resp.status
        result = json.loads(resp.read().decode())
except urllib.error.HTTPError as e:
    err_body = e.read().decode()[:500]
    print(f"   FAIL: HTTP {e.code} — {err_body}")
    sys.exit(1)
except urllib.error.URLError as e:
    print(f"   FAIL: {e.reason}")
    print("   Tip: local stack → STORE_API_URL=http://localhost:8787 npm run smoke:accounting -- <id>")
    sys.exit(1)

acct_status = result.get("status", "?")
entry = result.get("entry") or {}
lines = entry.get("lines") or []

print(f"   HTTP:   {http_status}")
print(f"   status: {acct_status}")

if acct_status not in ("already_posted", "created"):
    print(f"   FAIL: unexpected accounting status {acct_status!r}")
    print(json.dumps(result, indent=2))
    sys.exit(1)

if not lines:
    print("   FAIL: no journal lines in response")
    sys.exit(1)

debits = credits = 0.0
print("\n3. Journal lines")
print(f"   voucher: {entry.get('id', '?')}")
print(f"   memo:    {entry.get('memo', '')}")
for line in lines:
    d = float(line.get("debit") or 0)
    c = float(line.get("credit") or 0)
    debits += d
    credits += c
    code = line.get("accountCode", "????")
    name = line.get("accountName", "")
    print(f"   {code:6} {name:32} Dr {d:>10.2f}  Cr {c:>10.2f}")

print(f"\n4. Balance check")
print(f"   total debits:  PHP {debits:.2f}")
print(f"   total credits: PHP {credits:.2f}")

if abs(debits - credits) > 0.01:
    print("   FAIL: debits != credits")
    sys.exit(1)

print("   OK: balanced")

if status == "POSTED_TO_LEDGER" and acct_status == "already_posted":
    print("\nPASS: Store and Accounting are in sync for this order.")
elif status == "FAILED" and acct_status == "already_posted":
    print("\nWARN: Store order FAILED but Accounting entry exists — investigate store metadata.")
    sys.exit(1)
elif acct_status == "created":
    print("\nPASS: Accounting entry created (first post for this externalId).")
else:
    print("\nPASS: Accounting entry verified.")
PY
