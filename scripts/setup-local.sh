#!/usr/bin/env bash
# One-shot local setup: env files, Docker Postgres, migrate, seed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== B2CCoop Store local setup =="

if [[ ! -f apps/api/.dev.vars ]]; then
  cp apps/api/.dev.vars.example apps/api/.dev.vars
  echo "Created apps/api/.dev.vars"
fi

if [[ ! -f apps/web/.env ]]; then
  cp apps/web/.env.example apps/web/.env
  echo "Created apps/web/.env"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker CLI not found. Install Docker Desktop." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Starting Docker Desktop…"
  if [[ "$(uname)" == "Darwin" ]]; then
    open -a Docker || true
  fi
  echo -n "Waiting for Docker"
  for _ in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then
      echo " ready."
      break
    fi
    echo -n "."
    sleep 2
  done
  echo ""
  if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker still not ready. Open Docker Desktop manually, then re-run: npm run setup" >&2
    exit 1
  fi
fi

echo "Starting Postgres on localhost:5434…"
docker compose up -d

echo -n "Waiting for Postgres"
for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U postgres -d b2ccoop_store >/dev/null 2>&1; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 1
done

if ! docker compose exec -T postgres pg_isready -U postgres -d b2ccoop_store >/dev/null 2>&1; then
  echo ""
  echo "ERROR: Postgres did not become ready." >&2
  exit 1
fi

npm run db:migrate
npm run db:seed

echo ""
echo "Setup complete."
echo "  Terminal 1:  npm run dev:api"
echo "  Terminal 2:  npm run dev:web"
echo "  Store web:   http://localhost:5175"
echo "  Store API:   http://localhost:8787/health"
