# B2CCoop Marketplace — Domain Model (Established)

> **Status:** Established — do not redesign in platform-service phases.  
> New capabilities extend this model; they do not replace it.

B2CCoop is a **Community Commerce and Services Marketplace**, not a product-only store.

## Core object: `offering`

All marketplace listings inherit from **offerings**. Specialized detail tables extend offerings by type.

### Offering types (registry — add-only)

| Type | Examples |
|------|----------|
| `PRODUCT` | Physical goods, coop products, member products, corporate supplier products |
| `SERVICE` | Skilled trades, professional services, community services |
| `TOUR` | Tours, activities, travel packages |
| `RENTAL` | Vehicles, equipment |
| `INSURANCE` | Insurance products |
| `FINANCIAL` | Loans, cooperative financing |
| `TICKET` | Airline, ferry, bus, events |
| `EVENT` | Event listings and registrations |
| `DIGITAL` | Digital goods and licenses |

### Booking / transaction models

| Model | Use when |
|-------|----------|
| `ORDER` | Cart checkout, instant or deferred payment, pickup/delivery |
| `BOOKING` | Date/time, capacity, or asset reservation required |
| `INQUIRY` | Quote-first, staff-mediated pricing |
| `LEAD` | Capture intent; conversion happens offline or in CRM |

Each offering declares a **booking model**. Checkout, workflow, and payment adapters branch on that declaration — not on separate product silos.

## Merchant model (established)

**Sellers** (evolution of current `vendors`) represent listing parties:

| `seller_kind` | Description |
|---------------|-------------|
| `COOP` | Cooperative-operated listings |
| `MEMBER` | Member seller linked to `Participant.id` |
| `CORPORATE` | Corporate / supplier partner |
| `PARTNER` | External marketplace partner |

One seller may list multiple offering types.

## Transaction model (established)

**Transactions** unify commerce flows (current `orders` are `transaction_kind = ORDER`):

- Shared: buyer identity, seller, status, amounts, accounting splits, `external_id`, patronage
- Kind-specific extensions: `bookings`, `inquiries`, `leads` (child tables)

Accounting posts via **`marketplace-sale`** (and future journal event types) — adapters, not domain roots.

## Modular monolith (established)

| Module / system | Responsibility |
|-----------------|----------------|
| **B2C-Store (Marketplace API)** | Offerings, catalog, transactions, platform services |
| **B2C-PMES (WebApp)** | `Participant.id`, Firebase identity, member lifecycle |
| **B2C-Accounting** | Ledger, patronage balances, finance integrations |

Cross-system integration is **HTTP + events only** — no cross-database joins.

## Current MVP mapping (Phase 1–2)

| Established concept | Implemented today |
|--------------------|-------------------|
| `PRODUCT` offering | `products` table |
| `COOP` / `CORPORATE` seller | `vendors` table |
| `ORDER` transaction | `orders` + `order_lines` |
| Patronage | `patronage_accruals` |
| Accounting adapter | `POST /api/v1/finance/marketplace-sale` |

Phase 3+ introduces `offerings` / `transactions` tables and migrates MVP tables additively.

## Related docs

- [PLATFORM-CORE-SERVICES.md](./PLATFORM-CORE-SERVICES.md) — platform capabilities (this phase)
- [INTEGRATION.md](./INTEGRATION.md) — cross-system contracts
- [STACK-AND-SECURITY.md](./STACK-AND-SECURITY.md) — edge and security
