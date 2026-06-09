# B2CCoop Store — Firebase vs Supabase & Database Strategy

> Answers: *Should we keep Firebase + Cloudflare or switch to Supabase? Are we using Supabase PostgreSQL?*

---

## What you run today (actual state)

| System | Auth | App / edge | Production Postgres |
|--------|------|------------|---------------------|
| **B2C-PMES (WebApp)** | **Firebase** (`b2ccoop-87114`) + Firestore for PMES resume | **Cloudflare** Pages + OpenNext Worker | **Neon** |
| **B2C-Accounting** | **Firebase** (staff UI) + staff JWT | Railway API + Cloudflare Pages UI | **Supabase** |
| **B2C-Store (planned)** | TBD in docs | **Cloudflare** Pages + Worker | Planned **Neon** in early docs |

Local dev for all apps: **Docker Postgres** (different ports per app).

**Important:** You already use **PostgreSQL everywhere**. The question is not “Postgres vs Supabase” — it is **which Postgres host(s)** and **whether auth stays on Firebase or moves to Supabase Auth**.

---

## Supabase is not a drop-in replacement for “Firebase + Cloudflare”

These solve different layers:

| Layer | Firebase + Cloudflare (current) | Supabase (alternative) |
|-------|-----------------------------------|-------------------------|
| **Member/staff login** | Firebase Auth | Supabase Auth |
| **Edge / CDN / WAF / DDoS** | **Cloudflare** | Supabase does **not** replace this — you still want Cloudflare in front of a public store |
| **Serverless API** | Cloudflare **Workers** (Hono) | Supabase **Edge Functions** (Deno) — different model, weaker WAF story unless still behind Cloudflare |
| **Relational data** | Neon or Supabase **Postgres** (either works) | Supabase Postgres (+ optional RLS) |
| **PMES resume progress** | Firestore | Would need migration to Postgres or Supabase realtime |
| **File storage** | Cloudflare **R2** | Supabase Storage |

**Replacing the whole stack with “Supabase only”** would mean:

- Migrating every member and staff account off Firebase
- Rewriting `Participant.firebaseUid`, staff `firebase-session`, Accounting Firebase Admin setup
- Losing Cloudflare WAF/Turnstile-at-edge unless you **still** put Cloudflare in front
- Migrating Firestore PMES progress

That is a **multi-month platform migration**, not a Store MVP decision.

---

## Recommendation: keep Firebase + Cloudflare; standardize Postgres separately

### 1. Auth — **stay on Firebase**

| Reason | Detail |
|--------|--------|
| **Already wired** | WebApp, Accounting UI, `Participant.firebaseUid`, staff flows |
| **Store MVP** | Guest checkout needs no auth; members reuse same login for patronage link |
| **Cost** | Firebase free tier covers coop member counts; no per-seat auth fee |
| **Risk** | Supabase Auth migration = re-login all users + schema/API churn across 3 repos |

Use **Firebase App Check + Turnstile** on the Store for abuse control — not a platform swap.

**When Supabase Auth would make sense:** Greenfield product with zero Firebase users. That is not B2CCoop.

### 2. Edge / hosting — **stay on Cloudflare for Store**

Public `store.b2ccoop.com` needs WAF, rate limits, Pages, Worker API, R2 images. Supabase does not provide that perimeter.

**Pattern:** Cloudflare → Astro (Pages) + Hono (Worker) → Postgres (Neon or Supabase) + Firebase token verify on Worker.

### 3. Database — **PostgreSQL yes; pick one host strategy**

You are **not required** to use Supabase because Accounting does. You **are required** to use **Postgres** (Prisma/Drizzle, same as siblings).

#### Option A — **Neon for Store** (recommended default)

| Pro | Con |
|-----|-----|
| Aligns with WebApp production (`cursor_docs.md`, `deploy-neon.md`) | Accounting stays on Supabase until a later consolidation |
| **Hyperdrive** + Worker is well documented for Neon | Two Postgres vendors in org (same as today) |
| Separate Neon database `b2ccoop_store` — blast radius | |
| Free tier sufficient for MVP | |

**Use when:** Store integrates heavily with WebApp (`Participant.id`, member resolve) and you want one less new vendor.

#### Option B — **Supabase Postgres for Store**

| Pro | Con |
|-----|-----|
| Same vendor as Accounting — one dashboard for finance + store data hosts | WebApp remains on Neon — still two vendors |
| Familiar if Accounting team owns Supabase | Hyperdrive to Supabase works but Neon is the path of least friction in CF docs |
| New DB `b2ccoop_store` in existing Supabase project (or new project) | |

**Use when:** You plan to **consolidate all apps onto Supabase Postgres** over time (see Option C).

#### Option C — **Long-term: one Postgres provider for all apps**

| Target | Effort |
|--------|--------|
| **All Neon** | Migrate Accounting off Supabase → Neon (Prisma migrations already portable) |
| **All Supabase** | Migrate WebApp off Neon → Supabase |

**Benefit:** Single billing, one backup/PITR policy, shared connection playbooks.  
**Cost:** One migration project; not blocking Store MVP.

---

## Direct answers

### “Continue Firebase–Cloudflare and not use Supabase?”

**Continue Firebase + Cloudflare.** Do **not** replace Firebase with Supabase Auth for B2CCoop.

You **may** use **Supabase only as Postgres hosting** for Store or Accounting — that is independent of auth. Many teams run **Firebase Auth + Supabase Postgres + Cloudflare** together.

### “Are we using Supabase PostgreSQL for database?”

**Partially, today:**

| App | Production DB |
|-----|----------------|
| WebApp | **Neon** PostgreSQL |
| Accounting | **Supabase** PostgreSQL |
| Store (planned) | **Not chosen yet** — recommend **Neon** (`b2ccoop_store`) unless you commit to consolidating on Supabase |

All apps use **PostgreSQL** via Prisma/Drizzle — not Firestore, not Supabase-only, for cooperative business data.

Firestore is **only** PMES progress resume in WebApp — optional, not the ledger or catalog.

---

## Suggested decision for B2C-Store

```
Auth:        Firebase (same project b2ccoop-87114)
Edge:        Cloudflare (Pages + Worker + WAF + Turnstile + R2)
Database:    Neon PostgreSQL — database name b2ccoop_store
Access:      Worker → Hyperdrive → Neon (no direct browser → DB)
```

Accounting integration unchanged (HTTP `marketplace-sale`). WebApp member resolve unchanged (HTTP + Firebase).

---

## Cost comparison (auth + DB + edge, MVP scale)

| Stack | Typical MVP monthly |
|-------|---------------------|
| **Firebase + Cloudflare + Neon** (recommended) | **$0–15** (free tiers) |
| **Supabase Auth + Supabase DB + Cloudflare** | **$0–25** (free tier; auth MAU limits) |
| **Full Supabase, no Cloudflare** | **Insufficient** for public store security |
| **Migrate everything to Supabase** | Migration labor >> monthly savings |

Medium term, **one Postgres vendor** saves ops time more than it saves dollars.

---

## What we should NOT do

| Anti-pattern | Why |
|--------------|-----|
| Supabase Auth + keep `firebaseUid` in WebApp | Two identity systems; patronage link breaks |
| Browser → Supabase client with RLS for checkout | Exposes DB surface; bypasses Worker validation and Accounting flow |
| Store on Firestore | Wrong tool for orders, inventory, patronage accrual |
| Shopify DB / hosted cart DB | Already rejected in PLATFORM-EVALUATION.md |

---

## Action items (when building Store)

1. Create **`b2ccoop_store`** on **Neon** (or Supabase if org picks Option B/C).
2. Keep **`VITE_FIREBASE_*`** in Store Astro app — same as WebApp `.env.example`.
3. Verify Firebase ID tokens on **Worker only** (Firebase Admin REST or JWKS).
4. Document in Store `INTEGRATION.md`: Postgres host URL is a secret; Firebase project id is public.
5. (Optional later) Schedule **Postgres consolidation** project: Neon-only or Supabase-only for all three apps.

---

## Related

- [STACK-AND-SECURITY.md](./STACK-AND-SECURITY.md)
- [B2C-PMES/cursor_docs.md](../../B2C-PMES/cursor_docs.md) — Firebase + Neon target
- [B2C-Accounting/OPERATIONS.md](../../B2C-Accounting/OPERATIONS.md) — Supabase production
