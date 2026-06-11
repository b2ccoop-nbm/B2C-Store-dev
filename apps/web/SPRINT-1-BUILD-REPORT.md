# Sprint 1 Foundation — Build Verification Report

**Date:** 2026-06-09  
**App:** `apps/web` (@b2ccoop/store-web)  
**Status:** ✅ `npm run build` passes (astro check + astro build)

---

## 1. Folder structure

```
src/
├── components/
│   ├── atoms/          # Button, Input, Textarea, Select, Badge, Chip, Avatar, Card,
│   │                   # Skeleton, EmptyState, LoadingState, Modal, Sheet, Toast
│   └── organisms/shell/  # SkipLink, headers, bottom nav, PersonaSwitcher, TrustFooter
├── features/
│   └── shared/         # RouteStub
├── layouts/            # BaseLayout, MarketplaceLayout, DashboardLayout, AdminLayout
├── lib/                # cn, constants, api (stub)
├── pages/              # All P0 route skeletons (see below)
├── stores/             # persona.ts (nanostores)
└── styles/             # tokens.css, global.css (Tailwind v4)
```

## 2. Design tokens

| System | Location |
|--------|----------|
| CSS variables + `@theme` | `src/styles/tokens.css` |
| Tailwind + utilities | `src/styles/global.css` |
| Colors | brand, accent, coop, member, neutral, semantic |
| Typography | display, title, body, caption, price |
| Spacing | 4px grid + `--spacing-touch` (48px) |
| Elevation | `.elevation-1` … `.elevation-4` |
| Radius | md, lg, xl via tokens |

## 3. App shell

| Piece | Component |
|-------|-----------|
| Mobile bottom nav | `MobileBottomNav.astro` — Home, Search, Cart, Messages, You |
| Desktop top nav | `DesktopHeader.astro` — shop links, search, notifications, messages, cart, persona |
| Mobile top bar | `MobileHeader.astro` — notifications, messages, persona |
| Officer banner | `OfficerBanner.astro` (client, persona-driven) |
| Trust footer | `TrustFooter.astro` |
| Skip link | `SkipLink.astro` |

## 4. Routes (skeleton)

| Route | Layout | Page |
|-------|--------|------|
| `/` | Marketplace | `index.astro` |
| `/search` | Marketplace | `search.astro` |
| `/category/[slug]` | Marketplace | `category/[slug].astro` |
| `/offering/[slug]` | Marketplace | `offering/[slug].astro` |
| `/store/[slug]` | Marketplace | `store/[slug].astro` |
| `/cart` | Marketplace | `cart.astro` |
| `/checkout` | Marketplace | `checkout.astro` |
| `/activity` | Marketplace | `activity.astro` |
| `/my-coop` | Marketplace | `my-coop.astro` |
| `/messages` | Marketplace | `messages.astro` |
| `/notifications` | Marketplace | `notifications.astro` |
| `/profile` | Marketplace | `profile.astro` |
| `/sell` | Dashboard | `sell/index.astro` |
| `/sell/listings` | Dashboard | `sell/listings.astro` |
| `/sell/new` | Dashboard | `sell/new.astro` |
| `/sell/activity` | Dashboard | `sell/activity.astro` |
| `/admin` | Admin | `admin/index.astro` |

**Redirects:** `/catalog` → `/category/products`, `/coop` → `/my-coop`, `/account` → `/profile`, `/order/:id` → `/activity`

## 5. Persona framework

- Store: `src/stores/persona.ts` (`nanostores` + `@nanostores/persistent`)
- Personas: customer, member, merchant, officer, admin
- UI: `PersonaSwitcher.astro` + officer banner sync
- No role-specific business logic

## 6. Build output

```
Result (51 files): 0 errors
Client JS (gzip): ~1.9 kB (persona + shell scripts)
```

## 7. Manual verification

```bash
cd apps/web && npm run dev
```

- [ ] Bottom nav visible &lt; 768px; desktop header ≥ 768px
- [ ] All routes above return 200 (no 404)
- [ ] Persona switch updates label and officer banner
- [ ] Touch targets ≥ 48px on nav and buttons (md size)
- [ ] Tab / Enter navigates interactive controls

## 8. Out of scope (Sprint 1)

- Catalog API, cart logic, checkout, auth
- Booster credits (P4)
- Search server integration
