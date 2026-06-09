# Dev testing — mock products & accounts

Local-only fixtures for B2CCoop Store. **Do not use `@b2ccoop.test` emails in production.**

## Load fixtures

```bash
npm run setup
# or re-seed after schema is up:
npm run db:seed
```

Seed creates **13 products** (2 vendors), **2 sample orders**, and patronage rows.  
Skip dev orders only: `SEED_DEV_FIXTURES=0 npm run db:seed`

## API (dev)

| URL | Purpose |
|-----|---------|
| http://localhost:8787/catalog | All active products + dev account hints |
| http://localhost:8787/dev/fixtures | Shoppers, staff, sample orders, demo cart |
| http://localhost:5175/catalog | Storefront catalog page |

## Mock shoppers (checkout)

| Email | Role | Notes |
|-------|------|--------|
| `guest.shopper@b2ccoop.test` | Guest | No Firebase — patronage on email only |
| `member.demo@b2ccoop.test` | Member | Mock `Participant.id` `a1111111-…` |
| `member.patron@b2ccoop.test` | Member | Second member for link/merge tests |

**Sample order (guest, pending pickup):** `order:dev-guest-pending-001` — rice + oil, ₱470, patronage ₱7.

**Sample order (member, paid):** `order:dev-member-paid-001` — sugar, ₱85.

## Mock staff (Phase 1c admin)

| Email | Role |
|-------|------|
| `store.admin@b2ccoop.test` | Store admin |
| `pickup.clerk@b2ccoop.test` | Pickup clerk |

Local staff API (coming in Phase 1c) will use:

```bash
# apps/api/.dev.vars
DEV_ADMIN_SECRET=b2ccoop-store-dev-admin-change-me
```

Send header: `Authorization: Bearer <DEV_ADMIN_SECRET>`

## Firebase (optional — member flows)

Project: **`b2ccoop-87114`** (same as WebApp).

In [Firebase Console → Authentication](https://console.firebase.google.com/), add test users:

| Email | Suggested password |
|-------|-------------------|
| `member.demo@b2ccoop.test` | `DevMember2026!` |
| `member.patron@b2ccoop.test` | `DevMember2026!` |

Guest shopper does **not** need Firebase.

## Vendors & products

| Vendor code | Categories |
|-------------|------------|
| `B2C-DEMO` | Groceries, dairy, household |
| `B2C-FARM` | Produce, pantry |

**Demo cart (PMES smoke):** `RICE-5KG` + `OIL-1L` → gross ₱470, patronage ₱7.

## Accounting (when testing pickup → ledger)

Run Accounting API locally (`localhost:3010`) and set in `apps/api/.dev.vars`:

```bash
ACCOUNTING_API_URL=http://localhost:3010
ACCOUNTING_INTEGRATION_SECRET=<same as B2C-Accounting INTEGRATION_SERVICE_SECRET>
```

Confirm pickup (Phase 1c) will post `marketplace-sale` with `externalId` `order:<uuid>`.

## JSON fixture

Human-readable copy: [scripts/fixtures/dev-accounts.json](../scripts/fixtures/dev-accounts.json)
