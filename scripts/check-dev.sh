#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${STORE_API_URL:-http://localhost:8787}"
WEB_URL="${STORE_WEB_URL:-http://localhost:5175}"

echo "== B2CCoop Store dev check =="

if ! docker compose ps postgres 2>/dev/null | grep -q "running"; then
  echo "WARN: Postgres container not running — run: npm run db:up"
else
  echo "OK  Postgres container running"
fi

if curl -sf "$API_URL/health" >/dev/null 2>&1; then
  echo "OK  API health at $API_URL/health"
  curl -s "$API_URL/health" | head -c 200
  echo ""
else
  echo "WARN: API not reachable at $API_URL — run: npm run dev:api"
fi

if curl -sf "$WEB_URL" >/dev/null 2>&1; then
  echo "OK  Web at $WEB_URL"
else
  echo "WARN: Web not reachable at $WEB_URL — run: npm run dev:web"
fi

echo "Done."
