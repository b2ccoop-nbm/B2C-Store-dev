# B2CCoop Store — Revised Stack & Security Architecture

> **Status:** Planning (evaluation only — not implemented yet)  
> **Goal:** Public e-commerce that is secure, fast, simple to operate, and cost-efficient — without adding checkout friction for shoppers.

---

## Executive summary

The original plan (NestJS on Railway + Vite on Pages + Neon Postgres) is **familiar** but **not optimal** for a **public storefront**. It exposes a long-lived API directly to the internet with CORS as the main gate — fine for staff tools, weaker for open commerce.

**Revised approach:** put **Cloudflare at the edge** for every public request, keep **one small API** behind it, and use **progressive auth** (browse freely, sign in only when needed).

| Principle | Choice |
|-----------|--------|
| **Simpler ops** | One Cloudflare account, one domain (`store.b2ccoop.com`), fewer moving parts than WebApp’s Pages + OpenNext split |
| **Faster globally** | Static catalog shell on Pages + API on Worker at the edge |
| **Cheaper at scale** | Free/low Pages + Worker tiers; R2 for images; Hyperdrive connection pooling to Postgres |
| **Stronger security** | WAF + Turnstile + rate limits at edge *before* code runs |
| **Low shopper friction** | Guest checkout path; Firebase only for “member perks” (patronage, order history) |

---

## Revised stack (recommended)

### Public layer (Cloudflare — single security perimeter)

| Component | Technology | Role |
|-----------|------------|------|
| **Storefront UI** | **Astro** on **Cloudflare Pages** | Mostly static HTML; fast TTFB; minimal JS for catalog (**confirmed**) |
| **Store API** | **Hono** on **Cloudflare Worker** | Thin REST API; no raw DB exposed to browser |
| **Edge security** | **Cloudflare WAF** (managed rules), **Bot Fight Mode**, **Rate Limiting** | Block SQLi/XSS probes, credential stuffing, scraping |
| **Human verification** | **Turnstile** (invisible mode) | Checkout + sign-up only — not on every page view |
| **CDN / TLS** | Cloudflare proxy (orange cloud) | TLS 1.3, HSTS, automatic cert renewal |
| **Images** | **Cloudflare R2** + **Images** (resize on edge) | No public bucket listing; signed URLs for admin uploads |
| **Session / cart cache** | **Workers KV** or **Durable Object** (one cart per visitor) | Short-lived cart; no PII in KV keys |

**Why not full NestJS on Railway for the public API?**  
Railway is a good fit for **Accounting** (staff-only, low public traffic). A **public store** benefits from edge rate limits and WAF *before* your app code. NestJS can stay for **admin batch jobs** later if needed; MVP does not require it.

### Data layer

| Component | Technology | Role |
|-----------|------------|------|
| **Primary DB** | **Neon Postgres** (serverless, `ap-southeast-1`) — database **`b2ccoop_store`** | Orders, catalog, inventory — separate from WebApp and Accounting DBs. *Accounting uses Supabase Postgres today; WebApp uses Neon — see [FIREBASE-SUPABASE-DATABASE.md](./FIREBASE-SUPABASE-DATABASE.md).* |
| **DB access from Worker** | **Hyperdrive** | Pooled connections; credentials never in browser; parameterized queries only |
| **ORM / queries** | **Drizzle ORM** (or Prisma if team prefers consistency) | Type-safe SQL; migrations via `drizzle-kit` |

**SQL injection defense:** Drizzle/Prisma use **parameterized queries only**. Never `sql.raw()` with user input. Global `ValidationPipe`-style validation on every body/query (Zod on Worker).

### Identity & auth (progressive, low friction)

| Actor | Method | When required |
|-------|--------|---------------|
| **Guest shopper** | Anonymous session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`) | Browse, add to cart |
| **Guest checkout** | Email + Turnstile + optional OTP link | Pay without account |
| **Member (coop)** | **Firebase Auth** — Google, email magic link, or password | Patronage accrual, order history; **guest email accrues patronage until account link** (**confirmed**) |
| **Staff / vendor admin** | Firebase + **role claim** or staff JWT | Catalog CRUD, fulfillment |
| **Service-to-service** | **Cloudflare mTLS** or **signed service tokens** (short TTL) | Store → WebApp member resolve; Store → Accounting post |

**Shopper UX rule:** Do **not** force Firebase sign-in to view products. Require auth only at:

- Checkout (if claiming **member patronage**)
- “My orders” / saved addresses
- Staff admin routes

**Firebase hardening (same project `b2ccoop-87114`):**

- Enable **App Check** (reCAPTCHA Enterprise or Turnstile provider) on Store web app
- Restrict API key by **HTTP referrer** (`store.b2ccoop.com`)
- Use **Firebase Admin SDK** only on Worker (verify ID tokens server-side)
- Prefer **magic link / Google** over passwords for members (fewer weak passwords)

### Payments (**confirmed**: pickup first, then PayMongo)

| Phase | Flow |
|-------|------|
| **MVP** | **Pay on pickup** — order `PENDING_PICKUP` → staff confirms payment → post to Accounting |
| **Phase 2** | **PayMongo** hosted checkout → webhook HMAC → post ledger after `payment.paid` |

| Component | Technology |
|-----------|------------|
| **Gateway (Phase 2)** | **PayMongo** (PH) — hosted checkout page |
| **Webhook** | Worker route with **HMAC signature verification** + idempotency key |
| **PCI scope** | Never touch raw card numbers — redirect to PayMongo |

Accounting post runs **after** payment is confirmed (pickup confirm or PayMongo webhook), not at cart submit.

### Integrations (unchanged contracts)

| Target | Protocol | Auth |
|--------|----------|------|
| **WebApp** | `GET /integrations/v1/members/resolve?email=` | Service token |
| **Accounting** | `POST /api/v1/finance/marketplace-sale` | `INTEGRATION_SERVICE_SECRET` |

Use **Cloudflare Service Bindings** or private Worker-to-Worker calls where possible instead of public HTTP between your own services.

---

## Architecture diagram

```
                    Internet (public)
                           │
                           ▼
              ┌────────────────────────────┐
              │     Cloudflare Edge        │
              │  WAF · Bot Mgmt · TLS      │
              │  Rate limits · Turnstile     │
              └─────────────┬──────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   Pages (static)    Worker (Hono API)     R2 + Images
   catalog UI        /catalog               product photos
                     /cart
                     /checkout  ──► Hyperdrive ──► Neon (store DB)
                     /webhooks/paymongo
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
        WebApp Worker                 Accounting API
        (member resolve)              (marketplace-sale)
        private/service binding       integration secret
```

---

## Security controls (by threat)

### SQL injection

| Control | Implementation |
|---------|----------------|
| ORM only | Drizzle/Prisma — no string-concatenated SQL |
| Input validation | Zod schemas on every route; reject unknown fields |
| Least privilege DB user | Neon role: `store_app` — SELECT/INSERT/UPDATE on store tables only; no `DROP`, no access to other DBs |
| No DB in browser | Connection string exists **only** in Worker secrets / Hyperdrive |

### Hacking / intrusion / malware

| Control | Implementation |
|---------|----------------|
| **WAF managed rules** | OWASP Core Ruleset; block common exploits at edge |
| **Rate limiting** | e.g. 100 req/min/IP catalog; 10/min checkout; 5/min login |
| **Bot management** | Challenge suspicious bots; allow known good crawlers for SEO |
| **Turnstile** | Checkout, account creation, password reset |
| **No shell on edge** | Workers sandbox — no arbitrary file execution |
| **Dependency hygiene** | `npm audit`, Dependabot, lockfile; minimal dependencies (Hono ≈ small surface) |
| **Secrets** | Wrangler secrets + Neon; never in git or `VITE_*` |
| **Admin separation** | `/admin/*` on separate subdomain or path + Firebase role + IP allowlist optional for staff |
| **Upload safety** | Product images: MIME sniff, max size, strip EXIF; store in R2 — **never** execute uploads |

### Backend data protection

| Control | Implementation |
|---------|----------------|
| **Encryption at rest** | Neon / R2 default encryption |
| **Encryption in transit** | TLS everywhere; `Strict-Transport-Security` |
| **PII minimization** | Store email + shipping address; no full member profile copy |
| **Audit log** | Append-only `audit_events` table (order status changes, admin edits) |
| **Backup** | Neon PITR (point-in-time recovery) |
| **Integration tokens** | Rotate `STORE_INTEGRATION_SECRET` quarterly; separate secrets per env |

### Frontend / auth security (without hurting conversion)

| Control | Shopper impact |
|---------|----------------|
| Guest cart (cookie) | Zero sign-in to browse |
| Magic link / Google sign-in | One tap for members who want patronage |
| Turnstile invisible | No puzzle unless risk score triggers |
| CSP headers | Blocks injected scripts — transparent to user |
| `HttpOnly` session cookie | XSS cannot steal session from JS |
| Short-lived Firebase ID token | Refreshed automatically; sent only to your API |
| Clear “Continue as guest” | Always visible at checkout |

**Avoid:** CAPTCHA on every page, mandatory phone OTP, 15-minute session timeouts on browsing, forcing PMES completion to shop (patronage can require membership; shopping should not).

---

## HTTP security headers (Worker middleware)

Apply on all Store responses:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-site
```

Use **Cloudflare Transform Rules** for static Pages assets where Worker does not wrap them.

---

## Comparison: original vs revised

| Dimension | Original plan | Revised plan |
|-----------|---------------|--------------|
| **Public API** | NestJS on Railway (direct) | Hono Worker behind WAF |
| **Frontend** | Vite SPA | Astro or Vite on Pages (prefer static-first) |
| **DB access** | Prisma → Neon direct from Railway | Hyperdrive → Neon from Worker |
| **DDoS** | Railway + app-level | Cloudflare network (included) |
| **Bot/checkout abuse** | App throttler only | Edge rate limit + Turnstile |
| **Guest shopping** | Firebase required (current PMES store) | Guest path first |
| **Monthly cost (low traffic)** | Railway ~$5–20 + Neon free tier | Pages/Worker free tier + Neon free + R2 pennies |
| **Complexity** | Same as Accounting (Nest) | New stack (Hono) but **fewer deploy targets** |
| **Team familiarity** | High (Nest/Prisma) | Medium — Hono is ~15 lines to hello-world |

**Pragmatic hybrid:** If the team strongly prefers **NestJS + Prisma**, run Nest behind **Cloudflare Tunnel** or proxy through a **Worker** that enforces rate limits — but for greenfield Store MVP, **Hono + Drizzle on Worker** is simpler and cheaper for public read-heavy traffic.

---

## Simpler monorepo layout

```
B2C-Store/
├── apps/
│   ├── web/          # Astro or Vite — Cloudflare Pages
│   └── api/          # Hono Worker — wrangler.jsonc
├── packages/
│   └── shared/       # Zod schemas, types (catalog, checkout DTOs)
├── docs/
│   ├── STACK-AND-SECURITY.md   # this file
│   └── INTEGRATION.md
└── wrangler.jsonc    # or per-app configs
```

One `npm run deploy` pipeline: build web → Pages; deploy api → Worker.

---

## Phased security rollout

### Phase 1 — MVP (secure baseline)

- [ ] Cloudflare proxy + TLS on `store.b2ccoop.com`
- [ ] WAF managed rules (free/pro tier)
- [ ] Worker rate limiting on `/checkout`, `/auth/*`
- [ ] Turnstile on checkout
- [ ] Zod validation + Drizzle parameterized queries
- [ ] Guest cart + optional Firebase for patronage
- [ ] CORS: allow only `store.b2ccoop.com` (+ localhost dev)
- [ ] Security headers middleware

### Phase 2 — Hardening

- [ ] Firebase App Check
- [ ] PayMongo webhook HMAC + replay protection
- [ ] Neon read replica for catalog (optional)
- [ ] Audit log + alerting (Cloudflare Logpush or Sentry)
- [ ] Dependabot + CI `npm audit`

### Phase 3 — Operational

- [ ] Secret rotation runbook
- [ ] Pen test / OWASP ZAP on staging
- [ ] Bug bounty or responsible disclosure email on site footer

---

## Local development ports

| Service | URL |
|---------|-----|
| Store web | http://localhost:5175 |
| Store API (wrangler dev) | http://localhost:8787 |
| Store Postgres (Docker) | localhost:5434 |
| WebApp API | http://localhost:3000 |
| Accounting API | http://localhost:3010 |

---

## Confirmed decisions

| Item | Choice |
|------|--------|
| Storefront | **Astro** on Cloudflare Pages |
| Domain | **`store.b2ccoop.com`** |
| Patronage | Accrue on **guest email** until member links Firebase / `Participant.id` |
| Payments | **Pay on pickup** (MVP) → **PayMongo** (Phase 2) |
| Platform | **Lean custom** (Astro + Hono + Neon) — see [PLATFORM-EVALUATION.md](./PLATFORM-EVALUATION.md) |
| Auth + edge | **Firebase Auth** + **Cloudflare** (not Supabase Auth) — see [FIREBASE-SUPABASE-DATABASE.md](./FIREBASE-SUPABASE-DATABASE.md) |

## Open decisions

1. **Drizzle vs Prisma** — Prisma matches sibling repos; Drizzle is lighter on Workers cold start.
2. **Accounting guest patronage** — Confirm whether `21310` posts require `participantId` at sale time or can use email metadata until link.

---

## Related docs

- [PLATFORM-EVALUATION.md](./PLATFORM-EVALUATION.md) — Shopify / Medusa / custom comparison

- [B2C-Accounting/ACCOUNTING-INTEGRATION.md](../../B2C-Accounting/ACCOUNTING-INTEGRATION.md) — marketplace-sale contract
- [B2C-PMES/docs/ACCOUNTING-INTEGRATION.md](../../B2C-PMES/docs/ACCOUNTING-INTEGRATION.md) — current demo store / webhook
- [Cloudflare WAF](https://developers.cloudflare.com/waf/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
- [Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
