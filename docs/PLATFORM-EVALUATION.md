# B2CCoop Store — Platform Evaluation

> **Decision:** Build a **lean custom store** on Astro + Hono + Neon — **not** Shopify, Medusa, or full off-the-shelf commerce platforms as the core.  
> **Confirmed product choices:** Astro · guest-email patronage until account link · pay-on-pickup → PayMongo · `store.b2ccoop.com`

---

## Your constraints (what any platform must satisfy)

| Requirement | Why it matters |
|-------------|----------------|
| **`POST /api/v1/finance/marketplace-sale`** with split amounts (sales, vendor AP, COGS, patronage) | Already implemented in B2C-Accounting — not standard e-commerce |
| **`Participant.id`** as member key; guest email until Firebase link | Cooperative identity model — custom |
| **Patronage accrual** on purchases (Dr 50410 / Cr 21310) | CDA cooperative accounting — no SaaS cart does this natively |
| **Pay on pickup first**, then **PayMongo** (PH) | Custom payment state machine |
| **Firebase** (`b2ccoop-87114`) shared with WebApp | SSO path for members/staff |
| **Low startup cost**, efficient at medium scale | Avoid % fees and mandatory high-tier plans |
| **Public security** (WAF, Turnstile, rate limits) | Open internet storefront |

Any option that cannot post your exact journal shape without heavy glue code is a **poor fit**, regardless of catalog UX.

---

## Options compared

### 1. Shopify

| | |
|--|--|
| **Startup cost** | ~$39–105 USD/mo (Basic–Advanced) + 2–3% payment fees if not Shopify Payments |
| **Medium-term cost** | Grows with apps ($10–50/mo each), themes, transaction fees; **Shopify Plus ~$2,300/mo** for true multi-vendor marketplace |
| **Time to first sale** | Days (if you accept their checkout & accounting) |
| **Accounting integration** | **Poor.** Would need a custom app/webhook to map orders → your `marketplace-sale` API with per-SKU patronage splits. Shopify’s ledger is not your COA. |
| **Patronage / guest email link** | **Custom app** + Shopify customer object ≠ `Participant.id` |
| **PayMongo** | Third-party app or custom checkout; not first-class |
| **Verdict** | **Reject** for core platform. Fast for generic D2C; **expensive and wrong shape** for B2C cooperative + existing Accounting. |

**When Shopify *would* make sense:** Abandon custom Accounting for store revenue and use Shopify + QuickBooks/Xero only. That contradicts your current architecture.

---

### 2. Medusa (open-source headless commerce)

| | |
|--|--|
| **Startup cost** | $0 self-hosted; Medusa Cloud from ~$99/mo; needs Postgres + Redis + Node hosting |
| **Medium-term cost** | Self-host: Railway/Render ~$20–80/mo + DB + your time; Cloud: per-seat/plan scaling |
| **Time to first sale** | 1–3 weeks (setup + customization) |
| **Accounting integration** | **Medusa → webhook → your API** is doable, but you fight Medusa’s order/payment/subscriber model to inject patronage splits per line item |
| **Patronage / guest email** | Custom modules in Medusa backend |
| **Stack fit** | Node + Postgres (familiar) but **not** Cloudflare Worker edge model; another long-running server to secure |
| **Verdict** | **Reject as full platform.** Useful patterns (cart, order states) but **too much framework** for a coop store with ~dozens of SKUs and bespoke ledger posts. Ops + customization ≈ building lean custom anyway. |

---

### 3. WooCommerce / WordPress

| | |
|--|--|
| **Startup cost** | ~$5–25/mo shared hosting |
| **Medium-term cost** | Plugins, security patches, malware cleanup, managed WP premium |
| **Security (public)** | **Weak default.** PHP + plugin ecosystem = high attack surface for a public store |
| **Accounting integration** | Plugins or custom PHP hooks |
| **Verdict** | **Reject.** Cheap upfront, **expensive in security incidents and maintenance** for a public-facing coop store. |

---

### 4. Saleor / Vendure / other headless (GraphQL commerce)

Same story as Medusa: powerful for large catalogs and multi-tenant retail; **overkill** for B2CCoop. You pay in hosting, GraphQL complexity, and custom plugins for patronage + Accounting. **Reject** unless catalog exceeds hundreds of SKUs with complex promotions.

---

### 5. “Buy” a storefront — Snipcart, Gumroad, Versa (current)

| | |
|--|--|
| **Versa** (you link today) | External; webhook to WebApp exists — **ledger testing only**, not long-term coop identity/patronage UX |
| **Snipcart / similar** | Cart overlay; limited marketplace/vendor AP; still need custom backend for Accounting |
| **Verdict** | **Keep Versa only as parallel/legacy** during migration. Not the strategic platform. |

---

### 6. Lean custom build (recommended)

| | |
|--|--|
| **Startup cost** | **~$0–15/mo** — Cloudflare free tier + Neon free + R2 pennies; domain already on Cloudflare |
| **Medium-term (100–1k orders/mo)** | **~$20–50/mo** — Neon scale, Worker paid tier if needed, R2 egress minimal |
| **Long-term** | No **% of GMV** to Shopify; no mandatory Plus tier; scale with traffic not revenue |
| **Accounting integration** | **Native** — same logic as existing `B2C-PMES/backend/src/store/store.service.ts`, moved to Store API |
| **Patronage + guest email** | First-class in your schema (see below) |
| **Pay on pickup → PayMongo** | Simple order status enum; no platform payment lock-in |
| **Code reuse** | Catalog splits, checkout flow, `marketplace-sale` client already exist in PMES |
| **Verdict** | **Adopt.** Best cost curve and only path that treats Accounting as source of truth for money. |

---

## Cost projection (USD/month, illustrative)

| Stage | Shopify Basic | Medusa self-host | **Lean custom (recommended)** |
|-------|---------------|------------------|-------------------------------|
| **Launch (MVP)** | $39 + apps ~$30 = **~$70** | **~$25–40** hosting + dev time | **$0–5** (free tiers) |
| **Year 1 steady** | **~$100–150** + 2% fees on sales | **~$50–80** + maintenance | **~$15–30** |
| **Multi-vendor growth** | **$2,300+** (Plus) or hacks | **~$100+** + module dev | **~$50–80** (scale Neon/Worker) |
| **GMV fee example** (₱500k/mo sales) | ~₱20k+ in payment/app friction | $0 GMV fee | **$0 GMV fee** |

Custom wins on **total cost of ownership** once you factor in cooperative-specific dev you’d do **anyway** on top of Shopify/Medusa.

---

## Recommended approach: “Custom core, borrowed parts”

**Do not** code a full Magento clone. **Do** build a **thin commerce core** (~15–25 API routes) and reuse battle-tested libraries.

### Build (your code)

| Module | Scope |
|--------|--------|
| Catalog | Products, categories, R2 images, pricing splits |
| Cart | KV or Durable Object session cart |
| Checkout | Guest email, Turnstile, pay-on-pickup, order create |
| Orders | Status: `PENDING_PICKUP` → `PAID` → `POSTED_TO_LEDGER` |
| Patronage ledger | Accrue by **normalized email**; merge to `participantId` on link |
| Accounting client | Port from PMES `accounting-client.service.ts` |
| WebApp client | Member resolve + account link |
| Admin | Astro admin routes or minimal React islands — staff Firebase |

### Borrow (don’t reinvent)

| Need | Library / service |
|------|-------------------|
| Storefront | **Astro** + Tailwind |
| API | **Hono** on Worker |
| DB | **Drizzle** + Neon + Hyperdrive |
| Validation | **Zod** |
| Auth | **Firebase Auth** + Admin verify on Worker |
| Bot protection | **Turnstile** |
| Payments (Phase 2) | **PayMongo** hosted checkout + webhook |
| Email receipts | **Cloudflare Email Workers** or Resend (free tier) |
| Optional CMS (Phase 2+) | **Sanity** or **Decap CMS** for product copy only — not order/payment core |

### Migrate from PMES (don’t rewrite logic)

| Existing asset | Action |
|----------------|--------|
| `store-catalog.ts` pricing model | Seed Store DB |
| `store.service.ts` checkout + accounting post | Port to Hono |
| `CoopStore.jsx` UX patterns | Rebuild in Astro components |
| `StoreOrder` model | Move to Store DB; deprecate in WebApp |
| Versa webhook | Deprecate after cutover |

---

## Guest patronage until account link (data model)

```
patronage_accrual
  id
  email_normalized     -- key for guests
  participant_id       -- null until linked
  order_id
  amount
  status               -- ACCRUED | MERGED | PAID_OUT
  linked_at            -- when Firebase/WebApp link happened
```

**On checkout (guest):** post `marketplace-sale` with `buyerParticipantId` null if unknown; store patronage against email in Store DB; Accounting may still post patronage line with metadata `{ guestEmail }`.

**On member link:** WebApp event or Store API `POST /account/link` → set `participant_id`, backfill open accruals, future checks use UUID.

Confirm with treasurer whether Accounting **`21310`** sub-ledger requires `participantId` at post time or can use email metadata until link — may need a small Accounting API extension for guest accruals.

---

## Payment phases

| Phase | Flow | Ledger trigger |
|-------|------|----------------|
| **MVP** | Checkout → `PENDING_PICKUP` → staff marks **Paid at pickup** → post `marketplace-sale` | Manual confirmation (treasurer-friendly) |
| **Phase 2** | PayMongo checkout → webhook `payment.paid` → post ledger | Automated |

Pay on pickup avoids PayMongo fees and PCI scope during MVP while you harden the public edge.

---

## Decision matrix (summary)

| Criterion | Shopify | Medusa | WooCommerce | **Lean custom** |
|-----------|---------|--------|-------------|-----------------|
| Startup cost | Low $, high lock-in | Medium | Lowest $ | **Lowest $** |
| Medium/long-term cost | **High** | Medium | Medium (risk) | **Low** |
| Accounting fit | Poor | Fair (glue) | Fair | **Excellent** |
| Patronage / coop rules | Poor | Fair | Fair | **Excellent** |
| Security (public) | Good (hosted) | You own it | **Poor** | **Good** (Cloudflare edge) |
| Time to MVP | Fast generic | Medium | Medium | **Medium** (4–6 weeks focused) |
| Team stack alignment | New ecosystem | Node | PHP | **Matches Cloudflare + Firebase plan** |

---

## Final recommendation

1. **Build lean custom** on Astro + Hono + Neon at `store.b2ccoop.com`.
2. **Do not** adopt Shopify or Medusa as the order/ledger core — integration tax exceeds license savings.
3. **Port** existing PMES store + Accounting contracts rather than starting from zero.
4. **Optional later:** Sanity/Decap for marketing content only if non-devs need to edit product descriptions often.
5. **Retire Versa** after native store proves checkout → ledger → patronage E2E.

**Not “from scratch” in the sense of reinventing commerce** — **from scratch UI/API shell** with **proven integration logic** and **minimal scope** for MVP.

---

## Related

- [STACK-AND-SECURITY.md](./STACK-AND-SECURITY.md)
- [B2C-Accounting/ACCOUNTING-INTEGRATION.md](../../B2C-Accounting/ACCOUNTING-INTEGRATION.md)
- [B2C-PMES/backend/src/store/store.service.ts](../../B2C-PMES/backend/src/store/store.service.ts)
