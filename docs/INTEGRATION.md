# B2CCoop Store — integration contracts

Store is a **separate product** with its own Postgres database. It links to WebApp and Accounting via HTTP only — never direct DB access to sibling apps.

## Systems

| System | Role |
|--------|------|
| **B2C-Store** | Catalog, cart, checkout, orders, patronage accrual (guest email → member link) |
| **B2C-PMES (WebApp)** | `Participant.id`, Firebase member identity, deep links from member portal |
| **B2C-Accounting** | Ledger posts via `marketplace-sale` |

## Stable member key

Use WebApp **`Participant.id` (UUID)** when known. Until link:

- Checkout stores **normalized guest email**
- Patronage accrues on email in Store DB
- On Firebase sign-in + link, merge accruals to `participantId`

## Accounting — marketplace sale (Phase 1)

```http
POST {ACCOUNTING_API_URL}/api/v1/finance/marketplace-sale
Authorization: Bearer {ACCOUNTING_INTEGRATION_SECRET}
Content-Type: application/json

{
  "externalId": "order:<uuid>",
  "occurredAt": "2026-06-09T10:00:00.000Z",
  "currency": "PHP",
  "grossAmount": 470.00,
  "salesAmount": 70.00,
  "vendorPayableAmount": 400.00,
  "cogsAmount": 400.00,
  "patronageAmount": 7.00,
  "vendorCode": "B2C-DEMO",
  "buyerParticipantId": "<optional Participant.id>",
  "memo": "Coop store — …",
  "metadata": { "guestEmail": "shopper@example.com", "orderId": "…" }
}
```

Triggered after **pay on pickup** confirmation (MVP) or PayMongo webhook (Phase 2).

See [B2C-Accounting/ACCOUNTING-INTEGRATION.md](../../B2C-Accounting/ACCOUNTING-INTEGRATION.md).

## WebApp — member resolve (Phase 1, to implement on WebApp)

```http
GET {WEBAPP_API_URL}/integrations/v1/members/resolve?email=member@example.com
Authorization: Bearer {WEBAPP_INTEGRATION_SECRET}
```

Response:

```json
{
  "participantId": "<uuid>",
  "memberIdNo": "B2C-…",
  "email": "member@example.com"
}
```

## WebApp UI link

```bash
# B2C-PMES frontend/.env
VITE_COOP_STORE_URL=https://store.b2ccoop.com
```

Member portal “Coop store” opens Store in a new tab.

## Environment (Store API Worker)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Local dev / fallback |
| `HYPERDRIVE` | Production Neon via Cloudflare Hyperdrive |
| `FIREBASE_PROJECT_ID` | Verify member ID tokens |
| `WEBAPP_API_URL` | Member resolve |
| `WEBAPP_INTEGRATION_SECRET` | Service auth to WebApp |
| `ACCOUNTING_API_URL` | Ledger posts |
| `ACCOUNTING_INTEGRATION_SECRET` | Same as Accounting `INTEGRATION_SERVICE_SECRET` |
| `TURNSTILE_SECRET_KEY` | Checkout bot protection (Phase 1) |

## Migrated from PMES demo store

Logic ported from:

- `B2C-PMES/backend/src/store/store-catalog.ts` → Store DB seed
- `B2C-PMES/backend/src/store/store.service.ts` → Phase 1 checkout service
- `B2C-PMES/frontend/src/components/CoopStore.jsx` → Phase 1 Astro catalog/checkout UI

Deprecate embedded WebApp store after cutover.

## Local dev ports

| Service | URL |
|---------|-----|
| Store API | http://localhost:8787 |
| Store web | http://localhost:5175 |
| WebApp API | http://localhost:3000 |
| Accounting API | http://localhost:3010 |
