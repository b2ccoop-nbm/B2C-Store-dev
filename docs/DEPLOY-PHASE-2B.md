# Phase 2b — Production go-live

Store at **`https://store.b2ccoop.com`** (custom domain) backed by Worker **`b2ccoop-store-api`** and Pages **`b2ccoop-store`**.

## Architecture

| Component | Production URL |
|-----------|----------------|
| Storefront | https://store.b2ccoop.com |
| Store API | https://b2ccoop-store-api.nmatunog.workers.dev |
| WebApp (member resolve) | https://b2ccoop-webapp.nmatunog.workers.dev/api |
| Accounting API | https://b2ccoop-accounting-production.up.railway.app |
| Neon DB | Same project as WebApp — database **`b2ccoop_store`** |

## Store API — Worker secrets

Non-secret vars are in `apps/api/wrangler.production.jsonc`. Set secrets once:

```bash
cd apps/api

printf '%s' 'YOUR_INTEGRATION_SECRET' | npx wrangler secret put WEBAPP_INTEGRATION_SECRET -c wrangler.production.jsonc
printf '%s' 'YOUR_INTEGRATION_SECRET' | npx wrangler secret put ACCOUNTING_INTEGRATION_SECRET -c wrangler.production.jsonc
printf '%s' 'YOUR_STRONG_ADMIN_SECRET' | npx wrangler secret put DEV_ADMIN_SECRET -c wrangler.production.jsonc
# DATABASE_URL — Neon pooled URL for b2ccoop_store (already set if health shows database ok)
```

`WEBAPP_INTEGRATION_SECRET` must match **`STORE_INTEGRATION_SECRET`** on the WebApp Worker.

## Store web — build & deploy

```bash
cd apps/web
PUBLIC_API_URL=https://b2ccoop-store-api.nmatunog.workers.dev \
PUBLIC_STORE_URL=https://store.b2ccoop.com \
npm run build

npx wrangler pages deploy dist --project-name=b2ccoop-store
```

## Custom domain `store.b2ccoop.com`

Cloudflare Dashboard → **Workers & Pages** → **b2ccoop-store** → **Custom domains** → Add **`store.b2ccoop.com`**.

DNS must be on Cloudflare (same account as `b2ccoop.com`). HTTPS provisions automatically.

## WebApp — coop store link

`frontend/.env.production`:

```bash
VITE_COOP_STORE_URL=https://store.b2ccoop.com
```

Redeploy **b2ccoop-webapp-ui** (Vite Pages) after build.

Member resolve for Store checkout:

```bash
# On Worker b2ccoop-webapp (OpenNext API)
STORE_INTEGRATION_SECRET=<same as WEBAPP_INTEGRATION_SECRET on Store API>
```

Route: `GET /api/integrations/v1/members/resolve?email=`

Redeploy OpenNext Worker after adding the edge route:

```bash
cd B2C-PMES/frontend
# If wrangler/workerd fails, reinstall: rm -rf node_modules && npm ci
npm run cf:deploy:web:safe
```

## Smoke test

```bash
curl -s https://b2ccoop-store-api.nmatunog.workers.dev/health
curl -s https://b2ccoop-store-api.nmatunog.workers.dev/catalog | head -c 200
curl -s "https://b2ccoop-webapp.nmatunog.workers.dev/api/integrations/v1/members/resolve?email=member.demo@b2ccoop.test" \
  -H "Authorization: Bearer $STORE_INTEGRATION_SECRET"
```

Open https://store.b2ccoop.com/catalog → checkout → staff confirm (requires Accounting API + `DEV_ADMIN_SECRET`).

## Optional (Phase 2)

- `PAYMONGO_SECRET_KEY` / `PAYMONGO_WEBHOOK_SECRET` on Store Worker
- `TURNSTILE_SECRET_KEY` + `PUBLIC_TURNSTILE_SITE_KEY` on web build
- `PUBLIC_FIREBASE_*` on web build for member sign-in at checkout
