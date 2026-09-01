# Proposal: Online Catalog Publishing

## Why

The public catalog at `/catalogo/:branchSlug?` is a structurally complete demo served entirely from `src/features/catalog/data/mock-catalog.ts`. The backend already ships a real, tenant-isolated public catalog API (`houndfe-backend/src/public-catalog/`), but the frontend never calls it: no real products, no cart validation, and a hardcoded WhatsApp phone. At the same time, the backend model has publishing gaps that make a safe real launch impossible today: every active tenant is publicly discoverable, `Product.includeInOnlineCatalog` defaults to `true`, there is no variant publication flag, no merchant-selected public price list, and no configurable stock presentation.

The product has approved a conservative opt-in model: tenants choose to publish their catalog; operational stock always wins over presentation; variants inherit publication with explicit overrides; pricing uses explicitly-marked public price lists with a backend-authoritative selected context; and cart validation always recalculates server-side. The user has also decided the frontend will **wait for backend contracts before implementing** the dependent controls — no mock or local-only admin UI is allowed.

## Proposal question round

The exploration's interactive questions were resolved in a prior product round. The approved decisions (conservative tenant opt-in, operational stock precedence, variant inheritance + override, multi public price lists with no silent fallback, cart-bound selected price context, deferred WhatsApp bot) are recorded in the Delivered decisions section below. No open proposal question remains on the product side; remaining unknowns are reserved for backend architectural authority and are enumerated in the backend handoff (`docs/backend-requests/online-catalog-publishing.md`, section "Preguntas abiertas reservadas a la autoridad del backend").

## What changes

This is one coherent initiative delivered as dependent, reviewable capabilities. **The entire frontend initiative is paused** — including the technically possible real-v1 integration slice below — until the user explicitly resumes work after the backend team responds to the handoff document. Only this documentation/handoff is delivered now.

### Capability 1 — Real public catalog runtime (technically available; paused, not scheduled)

> Technical readiness note: the backend v1 endpoints below exist today, so this slice is **technically available without backend changes**. Per product decision, it is **not scheduled and will not be implemented** until the user resumes the initiative after the backend returns contracts/evidence.

Integrate the existing backend v1 public API into the current catalog UI without visual rewrite:

- Convert `src/features/catalog/api/catalog.api.ts` from mock data to an anonymous public HTTP client for the four existing routes (`GET /public/catalog/branches`, `GET /public/catalog/:tenantSlug/products`, `GET /public/catalog/:tenantSlug/products/:productId`, `POST /public/catalog/:tenantSlug/cart/validate`).
- Make the selected tenant slug the catalog context; synchronize branch selection with `/catalogo/:slug`.
- Replace `MOCK_CATEGORIES` with response facets; add page/limit state and loading/empty/404/429/retry rendering.
- Validate the cart server-side before enabling WhatsApp handoff; reconcile items, prices, warnings, and totals from the validated response; block checkout on `valid: false`.
- Render real product/variant images; hide rating/featured UI when the backend returns `null`.
- Keep the existing authenticated product-level `includeInOnlineCatalog` checkbox working under `update:Product`.

### Capability 2 — Catalog, product, and variant publication settings (backend-dependent)

- Tenant-level catalog publication switch (conservative opt-in; active tenants are not publicly discoverable until explicitly enabled).
- Public branch discovery filters by explicit catalog publication, not merely `Tenant.isActive`.
- Variant-level publication flag inheriting product publication, with per-variant override; unpublished variants are rejected by public cart validation.
- Authenticated read/write round-trip for `hidePriceInOnlineCatalog` (currently Prisma-only, not exposed in authenticated DTOs).

### Capability 3 — Public price lists and selected price context (backend-dependent)

- A tenant marks one or more global price lists as explicitly public and chooses one default; private lists are never enumerable or inferable from public APIs.
- Each product selects one or more of the tenant's public lists; variants inherit and may override.
- Visitors use one global public price-list selector per visit/cart; the selection is a backend-authoritative price context.
- Products/variants that do not support the selected public list are excluded from that result set — never silently repriced from another list.
- Cart validation binds to the selected public list and recalculates all prices server-side.

### Capability 4 — Stock presentation policy (backend-dependent)

- Merchant-configurable public stock presentation modes (system status, abstract status, custom public quantity, hidden) with documented inheritance/override from product to variant.
- Custom public quantity is presentation-only and never mutates operational stock.
- Real zero operational stock always blocks cart validation regardless of presentation.

### Deferred — WhatsApp bot conversion

Conversion will ultimately target the in-development WhatsApp bot, which is itself in development; this conversion is **deferred**. This change does not implement a temporary phone workflow and **no temporary phone workflow is approved** — the frontend will not send to any selected branch phone or other phone in the interim. Only the future integration boundary is documented in the backend handoff. The already-present hardcoded phone in the current demo (`useCatalogCart.ts`) is recorded as current-state evidence to be removed at resume time, not as an approved interim behavior.

## Relation to `products-catalog-coco`

This initiative is **independent of and unrelated to** `products-catalog-coco`; it neither amends nor supersedes it. The completed `products-catalog-coco` change was a POS product-management visual token migration that **explicitly excluded** `src/features/catalog/` and did **not** create the public catalog component topology or demo. The current public catalog demo (layout, components, mock data) is attributed solely to the existing `src/features/catalog/` implementation. This initiative preserves that existing component structure (`CatalogView.vue`, grid, modal, drawer) and will replace its mock data layer and hardcoded behaviors with real backend contracts when resumed. No visual redesign is in scope.

## Scope

### In scope

- Frontend: `src/features/catalog/**` (API adapter, store, cart, states, images), route slug synchronization, minimal token/branding neutralization where mock-only.
- Frontend admin (only after backend contracts): product/variant publishing controls, tenant catalog settings surface, public price-list selection UI, stock presentation controls.
- Backend (read-only for this repo; requested via handoff): tenant publication flag, variant publication, public price-list marking/selection, stock presentation model, public API extensions, cart binding, migration/backfill.
- Documentation: backend handoff document (delivered with this proposal).

### Out of scope / non-goals

- WhatsApp bot integration, order creation, or any temporary phone-number workflow. No interim phone workflow is approved: conversion targets the in-development bot and stays deferred.
- Ratings, reviews, or featured labels until a trustworthy source exists.
- Visual redesign of the catalog (the existing `src/features/catalog/` component structure stands).
- Mock or local-only admin controls for any backend-dependent capability.
- Frontend implementation of Capabilities 2–4 before backend contracts are delivered.

## Affected areas

| Area                                                  | Change                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/features/catalog/api/catalog.api.ts`             | Mock → anonymous public HTTP client; add cart validation call                           |
| `src/features/catalog/composables/useCatalogStore.ts` | Slug-driven context, facets, paging, request states                                     |
| `src/features/catalog/composables/useCatalogCart.ts`  | Server-validated cart, WhatsApp handoff from validated response                         |
| `src/app/router/index.ts`                             | Slug param synchronization for `/catalogo/:branchSlug?`                                 |
| `src/features/POS/products/**`                        | Later: variant publication, hidden price, stock presentation controls                   |
| New tenant settings surface                           | Later: catalog publication, public price lists (guarded route, new permission decision) |
| `docs/backend-requests/online-catalog-publishing.md`  | Delivered handoff to backend team (Spanish)                                             |

## Delivered decisions (product-approved)

1. **Conservative opt-in:** existing active tenants are not publicly discoverable until catalog publication is explicitly enabled. Product publication flags may remain, but tenant publication is the effective gate.
2. **Operational stock always wins:** public presentation may hide or abstract stock, but real zero stock blocks cart validation and cannot be overridden into sellable availability.
3. **Variant publication inherits** product publication and stock-presentation policy, with explicit per-variant override; unpublished variants are rejected by public cart validation.
4. **Multi public price lists:** a tenant marks one or more global lists public and chooses one default; private lists are never enumerable or inferable from public APIs.
5. **Product list selection:** each product chooses one or more of the tenant's public lists; variants inherit and may override.
6. **One global selector per visit/cart**; the selected list is a backend-authoritative price context.
7. **No silent fallback:** a product not supporting the selected public list is excluded from that result set.
8. **Cart binding:** validation receives the selected public list context and recalculates all prices; carts cannot mix uncontrolled private contexts.
9. **Bot conversion deferred**; only the future integration boundary is documented.
10. **Frontend waits for backend contracts**; no mock/local-only admin controls. The SDD pauses after this proposal + handoff until the backend responds. The **entire frontend initiative is paused**, including the technically possible real-v1 (Capability 1) slice; only this documentation/handoff is delivered now. Resuming requires an **explicit user instruction** after the backend returns contracts/evidence; a backend response alone does not auto-resume work.

## Risks

| Risk                                                                                                                                                                     | Mitigation                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Product.includeInOnlineCatalog` defaults to `true` (`prisma/schema.prisma:467`) and every active tenant is discoverable — existing inventory can leak public on day one | Conservative tenant opt-in is the hard gate; backfill proposal in the handoff requests publication-safe defaults and migration tests     |
| Public price context could leak private list pricing if fallback or inference is allowed                                                                                 | No-fallback rule, visibility allowlists, non-enumeration invariants, and explicit test matrix in the handoff                             |
| Presentation stock could imply sellability when operational stock is zero                                                                                                | Approved invariant: operational zero stock blocks cart validation unconditionally; requested backend tests cover every presentation mode |
| Shared authenticated Axios client injects bearer tokens and no-cache headers into public requests                                                                        | Capability 1 uses a dedicated anonymous public client                                                                                    |
| Mock-driven UI assumptions (emoji categories, ratings, multi-branch availability, hardcoded phone) disagree with real DTOs                                               | Capability 1 removes mock dependencies and renders only backend-supported fields                                                         |
| Frontend admin UI built before contracts would encode wrong semantics                                                                                                    | Pause gate: no frontend implementation of any capability (1–4) until the user explicitly resumes after backend evidence is returned      |

## Rollback

- Nothing is implemented at pause time: rollback today is simply discarding this proposal and the backend handoff document. When resumed, Capability 1 would be additive frontend integration against stable existing endpoints, revertible to the mock adapter (or behind a feature flag) with no backend dependency.
- Backend changes requested in the handoff are specified with additive migration, conservative backfill (tenant publication off by default, stock presentation = current system status, tenant public list backfilled to the existing default `PUBLICO` list), and a defined rollback-safe behavior for missing/zero selected-list prices. Backend owns the final migration/rollback mechanics.
- Tenant publication is a flag: turning it off immediately removes the tenant from discovery, list, detail, and cart paths.

## Success criteria

1. `/catalogo/:branchSlug?` renders real backend data: branches, products, facets, detail, images; no imports from `mock-catalog.ts` in the runtime path.
2. Cart checkout is enabled only after a successful `POST .../cart/validate` response; invalid/stale carts are blocked with visible states.
3. No temporary phone workflow exists at any point: the frontend does not send carts to any branch phone. WhatsApp conversion targets the in-development bot and remains deferred until the user schedules it.
4. With the backend response delivered: tenant publication, variant publication, public price-list selection, and stock presentation are end-to-end consistent across list, detail, and cart validation (backend evidence matrix returned).
5. No private price list, unpublished variant, unpublished product, or unpublished tenant is reachable through any public endpoint (backend-verified per the handoff acceptance matrix).
6. No frontend admin control exists that the backend cannot persist and enforce.

## Pause gate

Per product decision 10, this SDD change **stops here**. The **entire frontend initiative is paused** — spec, design, tasks, apply, verify, sync, and archive MUST NOT run until the backend team responds to `docs/backend-requests/online-catalog-publishing.md` with contracts, evidence, and the acceptance matrix. Capability 1 (real-data integration against existing endpoints) is **technically available** without backend changes, but it is **not scheduled and not implemented**: it is equally paused. Resume for any slice — Capability 1 included — requires an **explicit user instruction after** the backend has returned contracts/evidence; a backend response alone does not auto-resume work. Only this documentation/handoff is delivered now.
