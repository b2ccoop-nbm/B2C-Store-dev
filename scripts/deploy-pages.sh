#!/usr/bin/env bash
# Production Pages build + deploy (uses apps/web/.env.production).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/web"

npm run build:pages
npx wrangler pages deploy dist --project-name=b2ccoop-store --commit-dirty=true
