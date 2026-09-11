# Exploration: Online Catalog Publishing

## Scope and evidence

This exploration maps the current frontend public catalog, authenticated product/variant controls, pricing and stock models, and the read-only backend public-catalog implementation. It does not define the proposal, design, specifications, tasks, or code changes.

Primary evidence:

- Frontend public catalog: `src/features/catalog/`
- Frontend product management: `src/features/POS/products/`
- Frontend route and HTTP client: `src/app/router/index.ts`, `src/core/shared/api/http.ts`
- Backend public catalog (read-only): `houndfe-backend/src/public-catalog/`
- Backend product and pricing model (read-only): `houndfe-backend/prisma/schema.prisma`, `src/products/`, `src/price-lists/`
- Backend integration guide: `houndfe-backend/docs/backend-responses/public-online-catalog-frontend-guide.md`
- Reference screenshot: `Screenshot_2026-08-31-17-04-15_4520x2520.png`

## Executive summary

The public catalog UI is a structurally complete demo at `/catalogo/:branchSlug?`, but every catalog read is still served by `mock-catalog.ts`; the cart is never validated and its WhatsApp phone is hardcoded. The frontend types already match the backend v1 public DTOs closely, so the smallest safe real-data path is concentrated in the catalog API adapter, store/cart orchestration, route synchronization, and data-state rendering rather than a visual rewrite.

The backend already supports public branch discovery, product list/detail, product-level publication, effective hidden prices, semantic stock, and cart validation. It always uses the single global default price list and exposes only products of type `PRODUCT`. Publication is tenant-scoped plus product-level. There is no variant publication flag, no merchant-selectable public price list, no configurable public stock presentation, and no tenant-level catalog-published switch. `hidePriceInOnlineCatalog` exists in Prisma and affects public output, but authenticated product DTOs/services do not expose it.

This should remain one coherent product initiative but be delivered as dependent reviewable capabilities: (1) real public API integration and authoritative cart validation, (2) tenant/catalog and product publishing settings, (3) variant visibility plus stock-presentation policy, and (4) premium merchandising/brand metadata. Backend-dependent controls must not be simulated in frontend state.

## 1. Current public catalog frontend

### Route and component topology

- `src/app/router/index.ts` registers public route `/catalogo/:branchSlug?` with `meta: { layout: 'catalog', public: true }`.
- `CatalogView.vue` initializes a Pinia store on mount and composes header, category bar, product grid, detail modal, cart drawer, and footer.
- `useCatalogStore.ts` owns branches, selected branch, list/facets, search/category/sort, and selected product detail.
- `useCatalogCart.ts` owns a local, non-persisted cart and locally generated WhatsApp URL.
- The component split is already suitable for an adapter-first integration; no route-level mega-component rewrite is needed.

### Mock and hardcoded inventory

| Location                                  | Current behavior                                                                                                                       | Real-data impact                                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/catalog.api.ts`                      | `getBranches`, `getProducts`, and `getProductDetail` return mock data; list filtering, sorting, facets, and pagination run in-browser. | Replace adapter bodies with public HTTP calls; remove duplicate client-side business logic.                                                          |
| `composables/useCatalogStore.ts`          | Imports `MOCK_CATEGORIES`; defaults tenant slug to `centro`; no loading/error/page state.                                              | Facets must drive categories; invalid/missing slugs and request states need explicit handling.                                                       |
| `data/mock-catalog.ts`                    | Defines three branches, six emoji categories, 20 products, ratings, featured labels, per-branch stock, prices, and placeholder colors. | Ratings/labels and multi-branch availability are demo-only. Placeholder color utility can remain as presentation fallback, but not as product truth. |
| `composables/useCatalogCart.ts`           | Hardcodes `WHATSAPP_PHONE = '+5215512345678'`, `Sucursal Centro`, local prices/totals, and never validates cart.                       | Selected branch phone and backend validation response must drive handoff; stale local state cannot authorize checkout.                               |
| `CatalogHeader.vue` / `CatalogFooter.vue` | Brand is hardcoded as `Coco`; footer states branch count; branch selection does not update the route.                                  | Tenant identity is not available beyond branch name/address/phone; slug must be reflected in navigation.                                             |
| `CatalogProductCard.vue`                  | Conditionally renders mock rating/featured label but always renders a package placeholder, ignoring `product.image`.                   | Backend returns rating/label as `null`; real main image is currently unused.                                                                         |
| `CatalogProductModal.vue`                 | Renders rating/featured and a multi-branch availability panel; does not consume product or variant image URLs.                         | v1 returns one availability entry; image galleries need to use existing DTO fields.                                                                  |
| `CatalogCategoryBar.vue`                  | Uses a fixed emoji map keyed by mock category IDs.                                                                                     | Real category UUIDs will not match; use a neutral/icon fallback or configurable category presentation.                                               |
| `CatalogProductGrid.vue`                  | Empty state only; no loading, error, retry, or pagination UI.                                                                          | Backend defaults to 20 items, so catalogs over 20 products would otherwise be truncated.                                                             |

The reference screenshot confirms the demo assumptions: Coco branding, three-branch selector, emoji categories, ratings, featured badges, and pastel placeholders. These are not supported as merchant data by the backend v1 contract.

### Smallest safe adapter path

1. Keep `catalog.types.ts` as the boundary because it already mirrors backend v1 list/detail/cart DTOs.
2. Convert `catalog.api.ts` into an anonymous public client for the four backend routes and add `validateCart`. Reusing the authenticated `http` instance unmodified is undesirable because it injects any stored bearer token and forces no-cache headers on GET, defeating the public cache policy.
3. Make the selected `tenantSlug` the catalog context; synchronize branch selection to `/catalogo/:slug`, then fetch list/detail with that slug.
4. Replace static categories with response facets, add page/limit state, and model loading/error/404/429 states.
5. Validate the cart before enabling WhatsApp handoff, replace local items/prices/statuses from the response, and block on `valid: false`. Use the selected branch phone only after normalizing it for `wa.me`; if absent, disable handoff with a clear state.
6. Render backend images and treat rating/featured as absent until real backend capabilities exist.

A response parser (for example Zod at the API boundary) would harden the public unauthenticated surface, but whether to add it belongs in design.

## 2. Authenticated product and variant controls

### Product DTO and forms

`src/features/POS/products/interfaces/product.types.ts` and `useProductForm.ts` currently expose:

- Product publication: `includeInOnlineCatalog` in `Product`, backend response, form input, create/update payload, schema, initial state, and mapping.
- Description: product-level `description`, max 2000 characters in the form schema.
- Prescription: product-level `requiresPrescription`; it is included in create/update payloads.
- Stock: product-level `useStock`, `quantity`, `minQuantity`, `useLotsAndExpirations`, and `hasVariants`.
- Price: a form `price` mapped to `priceCents`; product/global price-list APIs and tier prices are modeled separately.
- Images: product/variant image resources support upload, main image, sorting metadata, and variant association.
- Hidden public price: **not exposed** in frontend product types, form input, payload, or UI.

`ProductUpsertSlideover.vue` includes checkboxes for `useStock`, `sellInPos`, and `includeInOnlineCatalog`. `ProductDetailView.vue` initializes and persists the same product-level flag and contains richer variant, price-list, stock, and image management. Existing publication UI is therefore product-level only.

### Variant DTO and forms

`ProductVariant`, `ProductVariantBackendResponse`, `CreateVariantPayload`, `UpdateVariantPayload`, and pending-variant forms expose:

- Name, option/value, SKU/barcode
- Quantity and minimum quantity
- Purchase cost
- Per-price-list and tier prices
- Variant-associated images through separate image endpoints

They do **not** expose:

- `includeInOnlineCatalog`
- `hidePriceInOnlineCatalog`
- A public stock presentation mode/status/custom quantity
- A variant-level public description or merchandising label

### Hidden-price gap

Backend Prisma has `Product.hidePriceInOnlineCatalog`, and the public mapper enforces:

`effective hidden = hidePriceInOnlineCatalog OR requiresPrescription`

However, backend `CreateProductDto`/`UpdateProductDto`, `ProductsService` create/update mapping, and authenticated product responses do not expose `hidePriceInOnlineCatalog`. The frontend cannot safely add this control until the authenticated backend contract can read and write it.

### Permissions and navigation

- Existing product routes use `read:create:update:Product` as appropriate.
- Existing product and variant mutation endpoints use `update:Product`.
- Product/variant publishing controls can reuse `update:Product`; no new CASL subject is inherently required.
- A tenant-wide public catalog settings surface would be a distinct administrative concern. The proposal round should decide whether it reuses a tenant-management permission or introduces a narrowly scoped catalog-settings subject. The public route itself remains unguarded.
- The existing product detail route is the natural first location for item publishing controls. A tenant-wide settings page would require a new guarded route and navigation entry; this is not needed for the public storefront route.

## 3. Backend public contracts that exist today

All routes are public and tenant-isolated by `:tenantSlug` through `PublicTenantGuard`.

| Method and route                                      | Current contract                                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /public/catalog/branches`                        | Active tenants as `{ id, name, slug, address, phone }[]`; cache 300s.                                             |
| `GET /public/catalog/:tenantSlug/products`            | Product cards, category facets, paging, search, category filter, and sort; cache 60s.                             |
| `GET /public/catalog/:tenantSlug/products/:productId` | Product detail, product images, variants, variant image, price, and one-entry `availabilityByBranch`; cache 60s.  |
| `POST /public/catalog/:tenantSlug/cart/validate`      | Stateless revalidation of existence, publication, variant, price, stock, warnings, and total; `no-store`, 20/min. |

Existing response semantics:

- List and facets include only `includeInOnlineCatalog = true` and `type = PRODUCT`.
- Detail returns 404 if the product is absent or not published.
- `rating` and `featuredLabel` are always `null`.
- Product slugs are always `null`.
- Raw quantity/minimum quantity are never public.
- Public price is always sourced from the `GlobalPriceList` where `isDefault = true`.
- Product `fromPriceCents` is the minimum default-list variant price when available.
- Hidden price returns null numeric fields.
- Products with `useStock = false` are always `available`.
- Variant availability is derived from variant quantity/minimum quantity.
- Cart validation blocks `NOT_FOUND`, `NOT_IN_CATALOG`, `VARIANT_NOT_FOUND`, and `OUT_OF_STOCK`; low stock and hidden price remain non-blocking.

Notable current contract caveat: `ValidateCartBodyDto` documents an optional customer/global price list for future use, but `ValidatePublicCartUseCase` only consumes `items`; v1 public pricing remains the default list.

## 4. Current publication, price, and stock model

### Publication scope

- **Tenant:** Every active `Tenant` is returned by branch discovery. There is no separate `catalogPublished` flag.
- **Product:** `Product.includeInOnlineCatalog` is tenant-scoped and gates list/detail/cart.
- **Variant:** No publication field exists; every variant under a published product is returned.
- **Branch:** Tenant equals branch in v1. A product belongs to one tenant, so product publication is effectively per branch/tenant. There is no multi-branch inventory entity inside a tenant.
- **Product type:** Repository queries explicitly exclude `SERVICE`, even if `includeInOnlineCatalog` is true.

The current Prisma default for `includeInOnlineCatalog` is `true`, so historical/new products can become public as soon as the tenant is active. This is a migration and safety decision, not merely a UI default.

### Price lists

- `GlobalPriceList` is the shared list catalog and has a single `isDefault` marker; the default list is protected from rename/delete and is conventionally `PUBLICO`.
- Each tenant/product has a `PriceList` row keyed by `(tenantId, productId, globalPriceListId)`.
- Each variant has `VariantPrice` keyed by its product-specific `PriceList` row.
- Creating a global list backfills zero-price rows for products/variants.
- Public list/detail/cart repository queries hardcode `globalPriceList.isDefault = true`.
- There is no tenant setting selecting a public list and no public endpoint parameter that chooses one.

Backend-authoritative price invariants:

1. The server selects the effective public price list and validates that it applies to the tenant/product/variant.
2. Cart totals and prices are recomputed server-side; the browser never authorizes stale prices.
3. Hidden-price logic overrides all numeric price display.
4. Missing or zero prices need an explicit backend-defined publication/display rule; the frontend must not invent fallback prices.
5. Tier-price behavior, if ever public, must be quantity-resolved by backend logic rather than duplicated in the catalog client.

### Stock

Current backend status mapping is exact:

- `quantity <= 0` -> `out_of_stock`
- otherwise `quantity <= minQuantity` -> `low_stock`
- otherwise -> `available`
- `useStock = false` -> `available`
- Variant products aggregate to available if any variant is available, otherwise low if any is low, otherwise out.

Backend-authoritative stock invariants:

1. Operational stock remains private and authoritative for fulfillment/cart validation.
2. A customized public quantity must be presentation-only unless the backend explicitly defines reservation/fulfillment semantics.
3. Hidden stock must not imply unlimited fulfillment; cart validation still checks operational stock.
4. Abstract availability must not leak raw inventory and must have a deterministic mapping to cart eligibility.
5. Product and variant policies need a documented inheritance/override rule.

## 5. Requested controls missing today

| Requested capability                     | Current state                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Product online visibility                | Supported end-to-end through `includeInOnlineCatalog`; UI already has a checkbox.                               |
| Variant online visibility                | Missing from Prisma, DTOs, services, public queries, and frontend.                                              |
| Merchant-selected public price list      | Missing; public backend always uses the global default list.                                                    |
| Explicit hidden-price control            | Prisma/public read exists, but authenticated read/write DTOs and frontend control are missing.                  |
| Real stock presentation                  | Existing semantic status derives from operational stock.                                                        |
| Abstract availability chosen by merchant | Missing.                                                                                                        |
| Customized public quantity               | Missing.                                                                                                        |
| Hidden stock presentation                | Missing as a distinct mode.                                                                                     |
| Tenant-level catalog publication         | Missing; all active tenants are discoverable.                                                                   |
| Catalog branding/contact configuration   | Only tenant name/address/phone exist; Coco brand, logo, theme, hours, policies, and social metadata are absent. |

## 6. Safe frontend-only slice while backend work is pending

The following can ship against existing backend contracts without pretending unsupported controls exist:

- Replace mock branches/list/detail with real public endpoints.
- Synchronize `:branchSlug`, facets, filters, sort, and pagination.
- Render real product and variant images with placeholders as fallback.
- Add loading, empty, 404, 429, and retry states.
- Add cart validation, warning mapping, server-price reconciliation, and checkout blocking.
- Generate WhatsApp text only from the validated response and selected branch phone.
- Preserve the existing product-level `includeInOnlineCatalog` control under `update:Product`.
- Hide rating/featured UI when null and remove assumptions that category UUIDs map to demo emojis.

Do not ship frontend-only variant visibility, public-list selection, hidden-price setting, or custom stock policies. Local-only controls would disagree with list/detail/cart and create unsafe publication or fulfillment semantics.

## 7. Backend-team handoff inventory

The following describes required capabilities and contracts for the backend team; it intentionally does not prescribe implementation files.

### Data model

- Add an explicit tenant catalog publication state so active operational tenants are not automatically discoverable.
- Add a tenant-scoped selection of the public global price list, with a well-defined default/fallback.
- Add variant-level publication state and define whether it inherits the product value at creation.
- Expose product hidden-price state through authenticated product contracts; decide whether variant-level hidden price is required.
- Model public stock presentation modes (`SYSTEM_STATUS`, `ABSTRACT_STATUS`, `CUSTOM_QUANTITY`, `HIDDEN` or equivalent) and whether variants override the product policy.
- Keep custom public quantity separate from operational quantity.
- Consider tenant catalog metadata: display name/logo, WhatsApp/contact phone, hours, fulfillment methods, policies, SEO/share image, and theme tokens.

### Endpoints and response contracts

- Authenticated GET/PATCH contract for tenant catalog settings, including publication, public price list, contact, and presentation defaults.
- Authenticated product GET/PATCH must round-trip hidden price and stock-presentation fields.
- Authenticated variant GET/PATCH must round-trip publication and any variant override fields.
- Public branch discovery must filter by explicit catalog publication, not only operational tenant activity.
- Public list/detail/cart must use the selected public price list consistently.
- Public list/detail should return effective presentation output, not internal configuration or raw stock unless custom quantity explicitly permits it.
- Cart validation must remain authoritative and return enough effective stock/presentation data to reconcile the UI.
- If services should be publishable, explicitly extend public repository/type contracts; current public queries exclude them.

### Validation and invariants

- Reject public price-list IDs that are invalid or unavailable for the tenant; define behavior when a product/variant lacks a usable price.
- A hidden effective price must always null numeric public fields and totals consistently.
- A variant cannot be effectively public when its parent product or tenant catalog is unpublished.
- Validate custom public quantity as a nonnegative presentation value and never mutate operational stock from it.
- Define whether abstract `unavailable` blocks cart and whether abstract `available` can ever override real out-of-stock (recommended safe invariant: it cannot).
- Preserve tenant isolation for every authenticated and public query.
- Normalize and validate WhatsApp/contact phones server-side or return a canonical handoff value.

### Migration and backfill

- Decide whether existing active tenants/products remain public or require explicit opt-in; document and audit the current `includeInOnlineCatalog = true` default.
- Backfill variant publication from the parent product or to a conservative unpublished state, according to the approved policy.
- Backfill tenant public price list to the existing default `PUBLICO` list where valid.
- Backfill stock presentation to current semantic system status to preserve behavior.
- Define rollback-safe handling for missing/zero selected-list prices.

### Permissions

- Continue to protect product and variant publishing mutations with `update:Product` unless product policy requires a narrower permission.
- Introduce or reuse an administrative permission for tenant-wide catalog settings; do not grant it implicitly to every product editor without a product decision.
- Keep public reads unauthenticated and rate-limited; authenticated settings endpoints retain tenant guards and auditability.

### Tests and evidence requested

- Tenant isolation and unpublished-tenant discovery tests.
- Product/variant effective publication matrix tests.
- Selected-price-list list/detail/cart consistency tests, including missing and zero price rows.
- Hidden-price plus prescription precedence tests.
- All stock presentation modes, inheritance, and real-out-of-stock safety tests.
- Migration/backfill tests against existing tenants/products/variants.
- Permission tests for product versus tenant catalog settings.
- Public cache-control, rate-limit, 404 non-enumeration, and cart blocking tests.
- Contract snapshots or an updated frontend guide for every changed public/authenticated DTO.

## 8. Premium catalog capability recommendations

Highest-value additions after safe publication controls:

1. Merchant identity and trust: tenant logo/name, verified contact, opening hours, pickup/delivery methods, location, and clear policies.
2. Merchandising: curated featured/new/bestseller flags, category ordering, publish scheduling, draft preview, and completeness warnings for missing image/description/price.
3. Discoverability: stable product/category slugs, canonical metadata, Open Graph images, share links, and crawl/index controls per tenant.
4. Conversion: validated WhatsApp handoff analytics, abandoned-cart events, promotion display sourced from backend, and an eventual order/reservation endpoint.
5. Product quality: real image galleries, richer descriptions/attributes, prescription messaging, related products, and accessible empty/error states.

Ratings should not be prioritized until a trustworthy review source, moderation policy, and aggregate contract exist.

## 9. Recommended initiative slicing

Keep one SDD change and multiple dependent capabilities/review units:

1. **Public catalog runtime integration** — anonymous API adapter, slug/facets/paging, images, states, and cart validation using existing backend.
2. **Catalog and product publication settings** — tenant publication, public price-list selection, hidden price, authenticated contracts, and existing product control alignment.
3. **Variant publication and stock presentation** — backend model/contracts first, then product/variant editor controls and public effective output.
4. **Premium merchant and merchandising metadata** — branding, contact/hours, slugs/SEO, curation, and preview/completeness.

Slices 2–4 depend on backend delivery and contract evidence. Slice 1 can proceed independently and should not wait for unsupported admin controls.

## 10. Interactive proposal questions

1. Should existing active tenants/products remain publicly discoverable after release, or should catalog publication become explicit opt-in with a conservative backfill?
2. Is one public price list selected per tenant sufficient, and what should happen when a published product or variant has no positive price in that list: hide price, block publication, or mark incomplete?
3. For stock presentation, may a merchant-declared abstract/custom availability ever show available when real stock is zero, or must operational out-of-stock always win and block cart validation?
4. Should variant settings inherit product publication/stock policy by default with optional overrides, and what should happen to a cart item when a variant is unpublished?
5. Is the first conversion target validated WhatsApp inquiry only, and which phone/fulfillment identity should own it when tenant equals branch today?

## 11. Risks and unknowns

- Current defaults (`Tenant.isActive`, `Product.includeInOnlineCatalog = true`) can unintentionally publish existing inventory.
- The shared authenticated Axios client conflicts with public caching and anonymous-request expectations.
- No current public contract supplies tenant branding or a guaranteed WhatsApp-ready phone.
- Price sorting is within each fetched page after database pagination, so it is not globally correct for large catalogs.
- The list response page limit will hide products unless frontend pagination is added.
- Variant-level and custom-stock UI cannot be correct until list/detail/cart share backend-defined effective semantics.
- `GlobalPriceList` appears globally named while product price rows are tenant-scoped; tenant ownership/eligibility of selectable lists needs explicit confirmation.
- Current public search matches product/brand/variant fields, while facet search behavior is narrower; counts may not align for variant-only searches and should be verified with backend.

---

## Current reconciliation — 2026-09 (backend-completion re-exploration)

### Outcome

The historical exploration above is retained as pre-backend context. The backend is now documented as complete, so the frontend can be planned as small, user-visible deliveries rather than waiting for new backend model work. This reconciliation does **not** approve implementation, mutate the proposal, or supersede the human review gate.

The corrected roadmap is recorded in [delivery-map.md](./delivery-map.md). Its first delivery is deliberately limited to anonymous branch discovery, selection, and an honest selected-branch landing state; it makes **no** product-list request and excludes browse, detail, cart, backoffice changes, and all phone/order flows.

### Reconciled contract facts

| Topic | Current planning rule | Evidence / authority |
| --- | --- | --- |
| Public context | Send no initial `priceListId`; retain the response-resolved ID and use it for subsequent list/detail/cart calls. There is no customer-facing price-list selector. | Backend guide `:37-39`, `:47`, `:54`; explicit backend clarification overrides the historical proposal.
| Price and sorting | Format public amounts as MXN. Do **not** expose or send price sorting: backend clarification says price ordering is post-pagination base-price ordering, so it is not a sound catalog sort. | Existing MXN formatter is already used in catalog cards/cart (`src/features/catalog/components/CatalogProductCard.vue:2`, `CatalogCartDrawer.vue:2`); guide sort text at `:248-251`, `:782-800` is superseded for this frontend plan.
| Stock presentation | Treat browse `availability` as nullable and render `HIDDEN` neutrally. A nullable `CUSTOM_QUANTITY` status, including custom quantity `0`, is not out-of-stock; only cart validation decides sellability from operational stock. | Backend guide `:52-57`, `:733-763`; explicit backend clarification.
| Cart boundary | The public cart endpoint only reconciles a local cart; it creates neither an order nor WhatsApp/telephone handoff. There is no temporary phone flow. | Backend guide `:539-541`, `:638`; explicit backend clarification.
| Settings and permissions | Tenant catalog settings are authenticated `GET/PATCH /tenants/:tenantId/catalog-settings`, gated by confirmed `read:TenantCatalogSettings` and `update:TenantCatalogSettings`, distinct from `Product`. Product catalog fields use product mutation; variant catalog configuration uses the existing variant `PATCH` boundary. | Backend guide `:86-159`; existing variant patch boundary at `src/features/POS/products/api/product.api.ts:436-446`; parent-provided permission authority and explicit backend clarification.
| Existing UI | Preserve the catalog’s layout/component topology and responsive shell, but remove or suppress mock-only claims/controls until their backing behavior ships. Do not represent hardcoded Coco identity, price sorting, detail, cart, or WhatsApp as live backend capability. | Public route `src/app/router/index.ts:358-361`; demo API/mock import `src/features/catalog/api/catalog.api.ts:1-16`; hardcoded phone `src/features/catalog/composables/useCatalogCart.ts:9,104-122`.

### Fresh frontend evidence

1. The public route remains `/catalogo/:branchSlug?` and bypasses authenticated tenant checks (`src/app/router/index.ts:358-361`, `:378-417`). `CatalogView` only initializes once on mount, so branch/route changes need an explicit synchronization design (`src/features/catalog/views/CatalogView.vue:17-22`).
2. The catalog API is entirely mock-backed and currently implements local category/search/sort/pagination (`src/features/catalog/api/catalog.api.ts:16-108`). The store also defaults to `centro`, hardcodes mock categories, has no request state, and exposes price sorts (`src/features/catalog/composables/useCatalogStore.ts:5-7`, `:31-64`, `:70-133`).
3. The authenticated `http` client injects a bearer token and disables GET caching (`src/core/shared/api/http.ts:18-39`), whereas the public contract has cache/rate-limit semantics. A dedicated anonymous public client starts with D1’s branch-discovery behavior and is extended by D2’s browse behavior, not shipped as a standalone infrastructure delivery.
4. Current cards/modal assume non-null availability and fabricate a zero price fallback (`src/features/catalog/components/CatalogProductCard.vue:14-20`, `:34`, `:93-111`); the modal turns missing availability into out-of-stock and includes add-to-cart behavior (`CatalogProductModal.vue:37-49`, `:377`). These assumptions must be removed before real F3 responses are rendered.
5. Product configuration currently only round-trips `includeInOnlineCatalog` (`src/features/POS/products/interfaces/product.types.ts:28-46`, `:154-165`; `composables/useProductForm.ts:124-137`, `:257-273`) and exposes it in the product editor (`views/ProductDetailView.vue:1846-1854`). Variant configuration currently saves through `PATCH /products/:productId/variants/:variantId` (`api/product.api.ts:436-446`; `components/VariantDetailModal.vue:129-202`).
6. There is no catalog-settings frontend surface. Existing tenant administration is a super-admin `/admin/tenants` surface (`src/features/admin/tenants/api/tenants.api.ts:68-109`; `views/AdminTenantsView.vue:175-178`), while the current permission union has no catalog-settings subject (`src/features/auth/interfaces/auth.types.ts:49-86`). The exact permissions are confirmed as `read:TenantCatalogSettings` and `update:TenantCatalogSettings`; only the authenticated navigation owner/placement remains a frontend design choice.
7. Tests can be added using Vitest/jsdom (`vitest.config.ts:7-13`) and the existing Playwright responsive harness (`package.json:10-13`, `playwright.responsive.config.ts:24-43`). There are no catalog tests today; the existing branch/list/store hotspots are `catalog.api.ts:1-111`, `catalog.types.ts:1-157`, and `useCatalogStore.ts:1-168`, while visible changes concentrate in `CatalogHeader.vue:1-109`, `CatalogProductGrid.vue:1-37`, and `CatalogView.vue:1-41`. These sizes justify splitting discovery from browse and keeping every estimate provisional. No catalog tests, builds, or runtime harnesses were run in this exploration.

### Stale proposal assumptions deliberately not carried forward

- The proposal’s visitor-controlled global price-list selector and multi-list browse filtering are obsolete; the resolved default context is retained internally without a selector.
- The proposal’s price-sort capability is excluded despite the guide’s historical sort enumeration; backend clarification is authoritative because sorting after pagination is not globally valid.
- The proposal’s blanket pause predates the completed backend guide. It is replaced only by this **planning** recommendation: implementation remains paused until the user reviews and explicitly authorizes a delivery.
- The proposal’s no-temporary-phone/no-order boundary remains valid and is strengthened: cart validation must never be portrayed as checkout.

### Evidence classifications and open risks

**Confirmed backend behavior:** published-tenant discovery; resolved default price context; authenticated settings/product/variant fields; nullable public price and stock projections; stateless cart validation; no order/WhatsApp endpoint; and the stock presentation invariants above. These are contract evidence, not a claim that a target environment is deployed (guide `:1-7`, `:1015-1019`).

**Frontend fixture assumptions:** unit and responsive fixtures should model documented 200/201, empty, generic 404, 400, 429, and 5xx payloads. They must not use a real tenant, assume a deployed backend, infer a phone/branding value, or treat fixture data as production availability.

**Unresolved risks requiring review before a later slice:**

1. The catalog-settings permission code/actions are confirmed as `read:TenantCatalogSettings` and `update:TenantCatalogSettings`; the intended authenticated navigation owner/placement is not present in this frontend repository. Do not reuse `Product` permission by convenience.
2. The public contract guide still advertises price sort strings, while the supplied backend clarification forbids frontend price sorting; a contract-guide correction should be requested separately, not implemented around.
3. Responsive harness coverage currently targets other features, so each catalog delivery needs an explicit mocked public-API scenario and screenshots/assertions at narrow and wide breakpoints.
4. Price/context response parsing and unknown error-body mapping need a design decision in the implementation phase; `zod` is installed (`package.json:40`) but no parser choice is approved here.
