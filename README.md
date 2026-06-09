# B2CCoop Store

Cooperative e-commerce for **B2C Consumers Cooperative** — connected to [B2C-PMES](../B2C-PMES) (membership) and [B2C-Accounting](../B2C-Accounting) (ledger).

**Domain (production):** `store.b2ccoop.com`

## Stack (Phase 0)

| Layer | Tech |
|-------|------|
| Storefront | Astro → Cloudflare Pages |
| API | Hono → Cloudflare Worker |
| Database | PostgreSQL (`b2ccoop_store`) — local Docker; Neon in production |
| Auth (Phase 1+) | Firebase (same project as WebApp) |

## Structure

```
B2C-Store/
├── apps/
│   ├── web/          # Astro storefront
│   └── api/          # Hono Worker + Drizzle
├── packages/
│   └── shared/       # Zod schemas & shared types
├── docs/             # Architecture & integration
└── docker-compose.yml
```

## Quick start

**Prerequisite:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

Run **one command per line** (do not paste `#` comment lines into the terminal).

```bash
npm install
npm run setup
```

`npm run setup` creates env files, starts Postgres (`:5434`), runs migrations, and seeds the demo catalog.

Then open **two terminals**:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

| Service | URL |
|---------|-----|
| Store web | http://localhost:5175 |
| Store API health | http://localhost:8787/health |

Manual steps (if you prefer):

```bash
npm run db:up
npm run db:migrate
npm run db:seed
```

Copy env templates once:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env
```

Health check:

```bash
npm run check
curl http://localhost:8787/health
```

## Local ports

| Service | URL |
|---------|-----|
| Store web | http://localhost:5175 |
| Store API | http://localhost:8787 |
| Postgres | localhost:**5434** |

WebApp (`3000` / `5173`) and Accounting (`3010` / `5174`) are separate repos.

## Documentation

| Doc | Topic |
|-----|--------|
| [docs/STACK-AND-SECURITY.md](./docs/STACK-AND-SECURITY.md) | Security architecture |
| [docs/PLATFORM-EVALUATION.md](./docs/PLATFORM-EVALUATION.md) | Custom vs Shopify/Medusa |
| [docs/FIREBASE-SUPABASE-DATABASE.md](./docs/FIREBASE-SUPABASE-DATABASE.md) | Auth & Postgres strategy |
| [docs/INTEGRATION.md](./docs/INTEGRATION.md) | WebApp & Accounting contracts |
| [docs/DEV-TESTING.md](./docs/DEV-TESTING.md) | Mock products & dev test accounts |

## Phase roadmap

- **Phase 0** ✓ scaffold, schema, health, seed catalog
- **Phase 1** ✓ catalog, guest checkout, pay-on-pickup, staff confirm → Accounting
- **Phase 2** (in progress) PayMongo checkout + webhook, Turnstile, Firebase member sign-in, WebApp member resolve
- **Phase 2b** Deploy `store.b2ccoop.com`, WebApp `VITE_COOP_STORE_URL`
