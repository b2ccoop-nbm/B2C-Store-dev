# B2CCoop Store — MVP Launch Readiness Plan

> **Focus:** Enable members and the public to **purchase products** through the marketplace as quickly as possible.  
> **Out of scope for this plan:** Rewards, Booster Credits, patronage UX, share capital, CMS, lending, insurance, advanced search, gamification, persona dashboards, and platform P4+ capabilities.  
> **Constraint:** Do not redesign architecture — wire existing API + Accounting to a shippable storefront.

**Audit date:** 2026-06-09  
**Repos:** `B2C-Store` (API + web), `B2C-Accounting`, `B2C-PMES` (member link only)

---

## Executive summary

| Layer | Launch readiness |
|-------|------------------|
| **Store API** | ~**85%** — catalog, checkout, orders, admin confirm, accounting post **exist and run in production** |
| **Storefront (web)** | ~**85%** — MVP commerce flow wired (catalog → cart → checkout → receipt → admin queue) |
| **Accounting** | ~**90%** — `marketplace-sale` live on Railway |
| **Infrastructure** | ~**75%** — API + Pages deployed; **`store.b2ccoop.com` custom domain** and **prod Pages rebuild** may be incomplete |

**Critical path:** Reconnect storefront to existing API (catalog → detail → cart → checkout → receipt) + staff pickup UI. **No new platform services required.**

---

## Capability audit

### 1. Homepage

| Field | Detail |
|-------|--------|
| **Current status** | 🟡 Partial — `src/pages/index.astro` has Sprint 1 marketing stub + links; **no live product grid** from `GET /catalog` |
| **Missing pieces** | SSR fetch catalog; category entry cards; featured products grid; remove “Sprint 1” placeholder copy |
| **Blocking dependencies** | `PUBLIC_API_URL` on Pages build; CORS (already allows Pages origins) |
| **Estimated effort** | **0.5 day** |
| **Recommended sequence** | **#1** (after catalog service module) |

---

### 2. Product catalog

| Field | Detail |
|-------|--------|
| **Current status** | 🟢 API **done** — `GET /catalog` returns active products (13 in prod). 🔴 UI **missing** — `/category/[slug]` is RouteStub; old `/catalog` page removed |
| **Missing pieces** | `services/catalog.ts`; category page filtering client or `?category=`; product cards with price + Add to cart; map `/category/products` to full list |
| **Blocking dependencies** | None on API |
| **Estimated effort** | **1 day** |
| **Recommended sequence** | **#2** |

---

### 3. Product detail page

| Field | Detail |
|-------|--------|
| **Current status** | 🔴 Not implemented — `/offering/[slug]` is stub. API has **no** `GET /products/:sku`; catalog item identity is **vendorCode + sku** |
| **Missing pieces** | **Option A (MVP-fast):** resolve product from catalog list by slug (`sku` lowercased). **Option B:** add `GET /catalog/items/:sku` API. Detail UI: name, price, qty, Add to cart |
| **Blocking dependencies** | Cart store/module |
| **Estimated effort** | **0.5–1 day** (Option A); **+0.5 day** if new API route |
| **Recommended sequence** | **#3** |

---

### 4. Cart

| Field | Detail |
|-------|--------|
| **Current status** | 🟡 Partial — `public/scripts/cart.js` + localStorage logic **exists** from Phase 1; `/cart` page is **stub**; not integrated with design system or new shell |
| **Missing pieces** | Port cart to `src/stores/cart.ts` or reuse cart.js; cart page with line items, qty, remove, subtotal; cart badge on bottom nav; single-vendor rule messaging |
| **Blocking dependencies** | Catalog prices in cart lines |
| **Estimated effort** | **1 day** |
| **Recommended sequence** | **#4** |

---

### 5. Checkout

| Field | Detail |
|-------|--------|
| **Current status** | 🟢 API **done** — `POST /checkout` (guest email, items, Turnstile, optional Firebase token). 🔴 UI **missing** |
| **Missing pieces** | Checkout page: email, name optional, order summary; Turnstile widget (`PUBLIC_TURNSTILE_SITE_KEY`); POST to API; payment method **pickup only** for MVP launch; redirect to order confirmation |
| **Blocking dependencies** | Cart; env keys on Pages + Worker |
| **Estimated effort** | **1–1.5 days** |
| **Recommended sequence** | **#5** |

**MVP payment scope:** **Pay on pickup** only. PayMongo (online) is **post-launch** unless keys already configured.

---

### 6. Order confirmation

| Field | Detail |
|-------|--------|
| **Current status** | 🟡 API **done** — `GET /orders/:id`. 🔴 UI **missing** — `/order/:id` redirects to `/activity` stub |
| **Missing pieces** | `/order/[id].astro` (or `/activity/[id]`) receipt: order id, lines, total, status `PENDING_PICKUP`, pickup instructions |
| **Blocking dependencies** | Successful checkout redirect |
| **Estimated effort** | **0.5 day** |
| **Recommended sequence** | **#6** |

---

### 7. Order tracking

| Field | Detail |
|-------|--------|
| **Current status** | 🔴 Minimal — lookup **by order UUID only** (`GET /orders/:id`). No `GET /orders?email=` |
| **Missing pieces** | **MVP:** “Find my order” form (email + order id) on `/activity`. **Nice-to-have:** email-only list API (defer) |
| **Blocking dependencies** | Order confirmation route |
| **Estimated effort** | **0.5 day** (form + id lookup) |
| **Recommended sequence** | **#7** |

---

### 8. Merchant order management

| Field | Detail |
|-------|--------|
| **Current status** | 🟢 API **done** — `GET /admin/orders/pending`, `PATCH /admin/orders/:id/confirm-pickup` (Bearer `DEV_ADMIN_SECRET`). 🔴 UI **missing** — `/admin` and `/sell/activity` are stubs; **old staff page deleted** |
| **Missing pieces** | Staff pickup queue UI (reuse AdminLayout): list pending, confirm button, show errors; secret entry (localStorage or prompt); link from officer persona optional |
| **Blocking dependencies** | `DEV_ADMIN_SECRET` in prod; Accounting API reachable |
| **Estimated effort** | **1 day** |
| **Recommended sequence** | **#8** (parallel with checkout after API stable) |

---

### 9. Payment handling

| Field | Detail |
|-------|--------|
| **Current status** | 🟢 **Pickup (MVP):** order created as `PENDING_PICKUP`; payment at counter. 🟡 **PayMongo:** scaffolded (`PENDING_PAYMENT`, webhook) — **not required for first launch** |
| **Missing pieces** | Storefront copy: “Pay when you pick up”; staff confirm triggers payment recorded. Online payments: secrets + webhook URL + success URL fix (`/order/` path) — **defer** |
| **Blocking dependencies** | Staff confirm flow for revenue recognition |
| **Estimated effort** | **0** for pickup MVP; **+2 days** if online payment at launch |
| **Recommended sequence** | Pickup **#5–8**; PayMongo **post-launch** |

---

### 10. Accounting posting

| Field | Detail |
|-------|--------|
| **Current status** | 🟢 **Done** — `confirm-pickup` → `POST /api/v1/finance/marketplace-sale` on Accounting; order → `POSTED_TO_LEDGER` or `FAILED` with retry |
| **Missing pieces** | Prod verification smoke test; ensure `ACCOUNTING_API_URL` + secret on Worker; treasurer aware of journal source |
| **Blocking dependencies** | Accounting Railway uptime; correct integration secret |
| **Estimated effort** | **0.25 day** (verify + runbook) |
| **Recommended sequence** | **#9** (verify before go-live) |

---

## Recommended build sequence

```text
1. catalog service + category/home grid     (1.5 d)
2. product detail + add to cart             (1 d)
3. cart page + nav badge                    (1 d)
4. checkout + Turnstile + pickup              (1.5 d)
5. order confirmation + find-order            (1 d)
6. admin pickup queue                         (1 d)
7. prod deploy + smoke E2E + domain           (0.5 d)
────────────────────────────────────────────
Total MVP commerce UI                       ~7–8 person-days
```

---

## Launch checklist

Engineering tasks to mark **launch-capable** (commerce only):

- [ ] Home page loads products from `GET /catalog`
- [ ] User can open product detail and add to cart
- [ ] Cart persists (localStorage) and shows correct totals
- [ ] Checkout submits to `POST /checkout` with Turnstile
- [ ] Guest receives order id and confirmation screen
- [ ] User can retrieve order status with order id (+ email check client-side)
- [ ] Staff can list pending pickups and confirm
- [ ] Confirm posts to Accounting; order shows `POSTED_TO_LEDGER`
- [ ] `PUBLIC_API_URL` and secrets set on production Pages build
- [ ] Custom domain `store.b2ccoop.com` serves latest build
- [ ] WebApp “Coop store” link opens production store URL

**Explicitly not required for launch:**

- [ ] ~~Booster credits / referrals~~
- [ ] ~~Patronage / My Coop UI~~ (backend accrual may still run silently)
- [ ] ~~Member Firebase checkout~~ (guest email sufficient)
- [ ] ~~PayMongo online pay~~
- [ ] ~~Search server / geo~~
- [ ] ~~Messages / notifications~~
- [ ] ~~CMS homepage editor~~

---

## Go-live checklist

### Infrastructure

- [ ] `curl https://b2ccoop-store-api.../health` → `database: ok`
- [ ] `curl .../catalog` → `itemCount` > 0
- [ ] Cloudflare Pages project `b2ccoop-store` — latest `dist` deployed
- [ ] Custom domain **`store.b2ccoop.com`** active on Pages (not API worker)
- [ ] Worker secrets: `DATABASE_URL`, `ACCOUNTING_INTEGRATION_SECRET`, `DEV_ADMIN_SECRET`, `TURNSTILE_SECRET_KEY`
- [ ] Pages env at build: `PUBLIC_API_URL`, `PUBLIC_STORE_URL`, `PUBLIC_TURNSTILE_SITE_KEY`

### Integrations

- [ ] Accounting: `POST marketplace-sale` smoke from Store confirm
- [ ] CORS allows `store.b2ccoop.com` and `*.pages.dev` preview

### Operational

- [ ] Staff trained: pickup counter uses `/admin` queue
- [ ] `DEV_ADMIN_SECRET` shared with pickup clerks (rotate post-launch)
- [ ] Product catalog seeded with **real** coop products (not only demo SKUs)
- [ ] Support path: guest email + order id for inquiries

### WebApp (optional for guest-only launch)

- [ ] `VITE_COOP_STORE_URL=https://store.b2ccoop.com` on WebApp Pages
- [ ] Member resolve on Worker — **defer** unless member checkout at launch

---

## Risk assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Storefront still skeleton — **no revenue** | Critical | **Current** | Prioritize commerce UI over docs/platform |
| Custom domain not attached | High | Medium | Use `*.pages.dev` temporarily; fix DNS in parallel |
| Accounting down at confirm | High | Low | Show `FAILED` status + retry button (API supports); monitor Railway |
| Turnstile misconfigured | Medium | Medium | Test checkout in staging; disable only in dev |
| Staff secret leakage (`DEV_ADMIN_SECRET`) | Medium | Medium | IP restrict or replace with staff Firebase later |
| Single-vendor cart confuses users | Low | Medium | Clear error from API; one coop vendor for MVP |
| PayMongo half-enabled | Low | Medium | **Hide online pay** in UI until fully configured |
| Scope creep (patronage, personas, P4) | High | High | This plan is authoritative; defer non-commerce work |

---

## 48-hour action plan

**Goal:** End-to-end **guest purchase → pickup confirm → ledger** on dev or preview URL.

| Hour block | Action | Owner |
|------------|--------|-------|
| 0–4h | `services/catalog.ts` + home/category pages with real grid | Frontend |
| 4–8h | Product detail by SKU + wire `cart.js` or `stores/cart.ts` | Frontend |
| 8–12h | Cart page + checkout form → `POST /checkout` (pickup) | Frontend |
| 12–16h | Order confirmation `/order/[id]` + fix redirect | Frontend |
| 16–20h | Rebuild admin pickup queue (minimal, from old `admin.astro` patterns) | Frontend |
| 20–24h | Local E2E: catalog → cart → checkout → confirm → Accounting | QA |
| 24–32h | Production Pages deploy with env vars | DevOps |
| 32–40h | Prod smoke + staff secret handoff | Ops |
| 40–48h | Fix blockers only; **no new features** | All |

**48h exit:** One real product purchasable on production or staging URL with accounting post.

---

## 7-day action plan

| Day | Deliverable |
|-----|-------------|
| **D1** | Catalog home + category grid + product detail |
| **D2** | Cart + badge + checkout (pickup + Turnstile) |
| **D3** | Order confirmation + activity/find-order |
| **D4** | Admin pickup queue + failed-order retry UI |
| **D5** | Production deploy, domain, env secrets, smoke tests |
| **D6** | Real product data review; staff UAT at pickup counter |
| **D7** | Soft launch; monitor orders; hotfix only |

**D7 exit:** Public can buy; staff can fulfill; Accounting receives sales.

---

## Definition of MVP complete

**MVP complete** means the **product purchase loop works in code**:

1. A visitor sees real products on the store.
2. They add items to cart and check out with email (guest).
3. The system creates an order in `PENDING_PICKUP`.
4. The visitor sees a confirmation with order reference.
5. Staff confirms pickup via admin UI.
6. The order reaches `POSTED_TO_LEDGER` and Accounting accepts `marketplace-sale`.

Does **not** require: custom domain, WebApp member link, online payment, search, or member-specific UX.

---

## Definition of launch ready

**Launch ready** means **MVP complete** plus **production operational readiness**:

1. Store served at **`store.b2ccoop.com`** (or approved public URL communicated to members).
2. Production API and Pages builds verified with smoke tests.
3. Staff trained and secret distributed for pickup queue.
4. Catalog contains approved live products (pricing, stock policy agreed offline).
5. Accounting integration verified in production at least once.
6. Rollback plan: previous Pages deployment ID noted in Cloudflare.

---

## What already works (do not rebuild)

| Asset | Location |
|-------|----------|
| Catalog API | `apps/api/src/routes/catalog.ts` |
| Checkout API | `apps/api/src/routes/checkout.ts` |
| Order read API | `apps/api/src/routes/orders.ts` |
| Admin confirm + accounting | `apps/api/src/routes/admin-orders.ts`, `services/orders.ts` |
| Accounting adapter | `apps/api/src/integrations/accounting-client.ts` |
| DB schema | `products`, `orders`, `order_lines` |
| Cart localStorage logic | `apps/web/public/scripts/cart.js` |
| App shell + routes | Sprint 1 `apps/web/src/` |
| Deploy docs | `docs/DEPLOY-PHASE-2B.md` |

---

## Document precedence

For MVP launch, **this document overrides** exploratory platform docs when they conflict on priority:

- Build commerce UI before Sprint 2+ platform features.
- Hide or omit patronage/rewards/member strips in UI until post-launch.
- Use existing API contracts in `docs/INTEGRATION.md` — no new endpoints unless product detail by SKU proves too fragile.

---

## Related docs

- [DEPLOY-PHASE-2B.md](./DEPLOY-PHASE-2B.md) — production deploy
- [DEV-TESTING.md](./DEV-TESTING.md) — test accounts
- [INTEGRATION.md](./INTEGRATION.md) — Accounting + WebApp contracts
- [apps/web/SPRINT-1-BUILD-REPORT.md](../apps/web/SPRINT-1-BUILD-REPORT.md) — current web status
