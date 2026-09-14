# Exploration: Online Catalog Backoffice

## Scope and evidence

This exploration covers authenticated catalog configuration only. It maps the tenant settings, product, and existing-variant surfaces required by the confirmed initial scope. It does not implement product code, modify the preserved `online-catalog-publishing` change, claim a deployed target was tested, or plan public storefront browse/detail/cart work.

Read-only authorities:

- Backend consumer contract: `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/docs/backend-responses/public-online-catalog-frontend-guide.md`
- SDD conventions: `openspec/config.yaml`
- Existing product editor: `src/features/POS/products/`
- Existing tenant-admin and settings patterns: `src/features/admin/tenants/`, `src/features/system/notifications/`
- Authorization and routing: `src/features/auth/`, `src/app/router/index.ts`, `src/app/navigation/navigation.registry.ts`

No external research, commands, tests, build, lint, deployment probe, or backend modification was performed.

## Executive summary

The backend contract now supports the entire requested authenticated configuration set: tenant publication and default stock presentation, public/default price contexts, product publication/hidden-price/context allowlist/stock override, and existing-variant publication/stock override. The frontend has a reusable Vue Query, Axios, Zod, CASL, route, navigation, and settings-screen foundation, but lacks every catalog-specific authenticated DTO, API adapter, query key, CASL subject, tenant settings route, and advanced product/variant field.

The existing `includeInOnlineCatalog` control already round-trips through list, slideover, full product editor, schema, payload builders, and product API mapper. It must remain the sole basic product-publication control. The full `ProductDetailView` is the appropriate location for the remaining product catalog controls; the compact `ProductUpsertSlideover` should retain only that basic inclusion toggle rather than duplicating advanced configuration. Existing variants are PATCHed through `VariantDetailModal`, making that modal the natural location for variant `catalogPublishMode` and stock override fields. New/inline variants must remain untouched because the contract makes these catalog fields PATCH-only and initializes them as `INHERIT` with null stock overrides.

The safest tenant settings placement is a tenant-scoped dashboard route under Sistema, beside notification configuration, guarded by the contract-confirmed `read:TenantCatalogSettings` and `update:TenantCatalogSettings` permissions. This requires normal CASL registration, role-permission copy, sidebar entry, route metadata, and tenant-scoped query keys. The existing super-admin `/admin/tenants` editor is global branch administration and is not an appropriate owner for a current-tenant catalog policy.

## Contract map

| Concern | Authenticated backend contract | Frontend obligation |
| --- | --- | --- |
| Tenant settings | `GET`/`PATCH /tenants/:tenantId/catalog-settings` | Fetch and persist `catalogPublished`, `publicPriceListIds`, nullable default ID, and stock-presentation default; treat `effectivePublication`, warnings, and `updatedAt` as read-only response data. |
| Tenant publication | `catalogPublished`; `effectivePublication = active tenant AND catalogPublished` | Make the public consequence clear and do not claim that `true` is effective when the tenant is inactive. A publish action is externally visible and needs an explicit confirmation design. |
| Public price contexts | Response `priceContexts: { priceListId, name, isCatalogDefault }[]` | Configure the tenant allowlist/default only. Do not add public visitor enumeration or selection of multiple contexts in this change. |
| Tenant stock default | `{ mode, customQuantity }` with four modes | Enforce `CUSTOM_QUANTITY` as a non-negative integer, preserve `0`, and clear quantity for other modes. |
| Product basics | Existing `includeInOnlineCatalog` | Preserve the current checkbox and payload path. Do not create another product publication switch. |
| Product advanced fields | `hidePriceInOnlineCatalog`, `supportedCatalogPriceListIds`, computed `supportsAllCatalogPriceLists`, stock override mode/quantity | Add authenticated DTO mapping, form/payload representation, and full-editor controls. `[]` means all tenant-public contexts; explicit `null` allowlists are invalid. |
| Variant fields | `catalogPublishMode: INHERIT | ON | OFF`; nullable stock override pair, PATCH-only | Add these only to the existing-variant PATCH path. `INHERIT`, not null, expresses publication inheritance. |
| Variant price allowlists | Not exposed by backend | Explicitly deferred. No field, UI, local state, or speculative payload. |
| Public/storefront behavior | Separate `/public/catalog/...` contract | Explicitly deferred, including public context chooser/enumeration and cart work. |

### Stock configuration semantics to preserve

- Modes are `SYSTEM_STATUS`, `ABSTRACT_STATUS`, `CUSTOM_QUANTITY`, and `HIDDEN`.
- Tenant default is always explicit. Product and variant fields are overrides and can be explicitly cleared with null mode and null quantity.
- A custom quantity of `0` is meaningful and must not be treated as an empty value.
- Product/variant presentation settings are only public-display policy. They must never be described as operational stock or fulfillment availability.
- `DEFAULT_CONTEXT_HAS_NO_VALID_PRICES` is a warning, not permission to invent a price fallback or a default context.

## Existing frontend topology and reuse

### Tenant settings and navigation

- `src/features/system/notifications/` is the closest tenant-scoped settings precedent: a thin view, query composable, form-state composable, mutation composable, API module, interfaces, pure mappers, and co-located tests.
- `NotificationConfigView.vue` uses loading skeletons, permission-derived read-only/save states, cards, inline feedback, and a mutation that invalidates the tenant-scoped query. Catalog settings should reuse this shape rather than extend the unrelated global tenant table.
- `src/features/admin/tenants/` is super-admin-only, uses `/admin/tenants`, `skipTenantCheck`, and global navigation. It is evidence for table/form conventions but not the owner of `GET/PATCH /tenants/:tenantId/catalog-settings`.
- `src/app/navigation/navigation.registry.ts` has the Sistema group with the notification entry. A catalog-settings entry belongs there, gated by `read:TenantCatalogSettings`.
- `src/app/router/index.ts` guards every protected route through `meta.permission`; the catalog-settings route should be tenant-scoped and must not set `skipTenantCheck` or `requiresSuperAdmin`.

### Product and variant surfaces

- `src/features/POS/products/interfaces/product.types.ts` owns product/variant raw responses, normalized entities, product form input, create/update payload types, global price-list types, and variant payload types.
- `src/features/POS/products/api/product.api.ts` maps authenticated product and variant responses and owns `PATCH /products/:id` plus `PATCH /products/:productId/variants/:variantId`.
- `src/features/POS/products/composables/useProductForm.ts` owns the Zod schema, initial state, GET-to-form mapper, and create/update payload builders. It already carries `includeInOnlineCatalog` end-to-end.
- `ProductUpsertSlideover.vue` contains the compact basic `Catálogo online` checkbox. Retain it as the existing basic control only.
- `ProductDetailView.vue` is the full editor with product-level settings, `useQuery` data loading, mutation lifecycle, price-list access, variant list/modals, and `canUpdateProduct = userCan('update', 'Product')`. It is the correct composition surface for an advanced catalog section.
- `VariantDetailModal.vue` already derives PATCH changes and invalidates `productQueryKeys.variants(tenantId, productId)`. It is the correct existing-variant override surface.
- `PriceListSection.vue` and `productApi.getGlobalPriceLists()` establish a pre-existing authenticated global-price-list source, but they do not establish which lists are tenant-public for the catalog.

### Shared infrastructure

- `src/core/shared/api/http.ts` is the authenticated Axios client and is appropriate for the new authenticated settings calls. It adds bearer credentials and no-cache GET headers.
- `src/core/shared/constants/query-keys.ts` is the mandatory centralized query-key location. Add a tenant-scoped catalog-settings key there rather than define keys locally.
- `src/core/shared/utils/error.utils.ts` provides defensive Axios/Nest error normalization. Catalog-specific validation code mapping, if needed, should be a narrow feature mapper rather than raw error-body rendering.
- `@tanstack/vue-query`, `zod`, `@nuxt/ui`, and `@casl/*` are already installed; no new dependency is indicated.
- `src/test/mountWithUApp.ts` is required for Nuxt UI provider-dependent SFC tests. Existing API tests mock `http`; composable tests either mock `useQuery` or mount a local `QueryClient`/`VueQueryPlugin` harness.

## Authorization model

The backend authority confirms `read:TenantCatalogSettings` and `update:TenantCatalogSettings` as separate from `Product` permissions. The frontend currently has no `TenantCatalogSettings` member in `AppSubject` or `APP_SUBJECTS`.

| Action | Guard | Intended surface |
| --- | --- | --- |
| Read tenant catalog policy | `read:TenantCatalogSettings` | Sidebar/route visibility and GET settings query. |
| Change tenant catalog policy | `update:TenantCatalogSettings` | Settings form controls and PATCH save. |
| Change product catalog policy | `update:Product` | Existing basic switch plus full-editor advanced product controls. |
| Change existing variant catalog policy | `update:Product` | Existing `VariantDetailModal` PATCH controls. |

Required registration touch points:

1. Add `TenantCatalogSettings` to `src/features/auth/interfaces/auth.types.ts` and `src/features/auth/authorization/ability.ts`.
2. Add Spanish subject/action copy in `src/features/admin/roles/i18n/permissions.ts`; expose only the documented read/update actions in the role UI when returned by backend.
3. Add silent-drop/revocation and type-union coverage in `src/features/auth/authorization/__tests__/ability.test.ts`.
4. Add a guarded route and corresponding sidebar entry, then route/navigation tests.

## Candidate API and state design

Proposed feature module: `src/features/system/catalog-settings/` with `api/`, `composables/`, `components/`, `interfaces/`, `utils/`, `views/`, and co-located tests. This is a candidate boundary, not an implementation decision.

```ts
GET   /tenants/:tenantId/catalog-settings
PATCH /tenants/:tenantId/catalog-settings
PATCH /products/:productId
PATCH /products/:productId/variants/:variantId
```

Candidate model boundaries:

- Keep raw response/request DTO types and a Zod parser or narrow mapper in the catalog-settings module.
- Keep a form model separate from the server DTO so it can represent inherited product/variant stock policy explicitly and build a whitelisted PATCH body.
- Use a query key that contains `tenantId`, for example `['catalog-settings', tenantId]`; invalidate that exact key after success.
- Invalidate product `detail` and `variants` keys after their respective catalog mutations. Do not broadly invalidate unrelated POS price-list caches.
- Use the server PATCH response to re-hydrate settings/form state. Avoid optimistic publication changes because publication is externally observable and effective state also depends on tenant activity.
- Do not use the public catalog client or its cache key for any backoffice request.

## Test surfaces

| Area | Existing pattern | Planned evidence |
| --- | --- | --- |
| CASL | `src/features/auth/authorization/__tests__/ability.test.ts` | Typed subject, valid read/update parse, malformed code rejection, revoke on omission, no cross-subject grant. |
| Route/navigation | `src/app/router/__tests__/router.spec.ts`, `src/app/navigation/__tests__/navigation.access.spec.ts` | Route carries `read:TenantCatalogSettings`; visible only to the permitted user. |
| Settings API | `notificationConfig.api.spec.ts` | Exact GET/PATCH URLs, tenant ID, whitelisted request shape, response return. |
| Settings form/mappers | notification pure mappers/form tests | Context allowlist/default validation, mode/quantity constraints, explicit null clearing, custom `0`, warning/effective-publication presentation state. |
| Settings view | `NotificationConfigView.spec.ts` style | Loading, GET error/retry, no-update read-only behavior, save success/error, publication confirmation. |
| Product mapping/form | `useProductForm.payload.test.ts`, `product.api.test.ts` | Round-trip new fields, `[] = all`, no null allowlist, hidden-price boolean, stock null clears, custom `0`. |
| Product full editor | `ProductDetailView.test.ts` | Existing inclusion switch remains singular; advanced fields respect `update:Product`; unavailable context data produces a safe non-editable explanation rather than invalid IDs. |
| Existing variant modal | `VariantDetailModal` behavior tests to add | `INHERIT`/`ON`/`OFF`, PATCH-only payload, no value loss for custom `0`, clear override with explicit null pair, key invalidation. |

Responsive browser coverage is a later verification decision. If user-visible settings UI ships, add focused mocked authenticated-browser evidence at narrow and wide widths; do not claim the current catalog discovery responsive suite covers backoffice configuration.

## Risks and unknowns

| Risk or unknown | Impact | Required resolution |
| --- | --- | --- |
| Product editor needs names/IDs of tenant-public price contexts, but the documented product response only has IDs and the settings GET is separately permission-gated. | A user with `update:Product` but without `read:TenantCatalogSettings` cannot safely choose an allowlist from contract data. | Decide whether product editors are also granted settings read, whether the backend supplies a product-safe selectable context projection, or whether this advanced control is deliberately unavailable without both permissions. Do not use global price lists as a substitute without confirmation. |
| The backend guide describes settings PATCH fields but does not specify whether an empty `publicPriceListIds` requires `catalogDefaultPriceListId: null` in the same request. | Invalid saves or unclear UX for removing the last public context. | Capture response examples or validation semantics before implementation design. |
| `catalogPublished=true` changes public discoverability and is a publishing action. | Accidental inventory exposure. | Apply the session's `ask-on-risk` strategy at the implementation-design gate: require an explicit confirmation UX and disclose effective-publication/warning state. |
| `effectivePublication` can be false while `catalogPublished` is true due to inactive tenant state. | UI could falsely promise public availability. | Display this as a non-editable effective-status condition with no local workaround. |
| Existing global price list APIs may enumerate more lists than are public for the current tenant. | Allowlist UI could present invalid/private choices. | Treat catalog settings `priceContexts` as authoritative only for current public contexts; do not infer tenant-public eligibility from generic list APIs. |
| The full product editor and its current tests are large. | A combined DTO, form, UI, and variant update can exceed review budget or create broad fixture churn. | Isolate mapping/form work from view work and variant work; preserve under-400-line work units. |
| Variant catalog fields are PATCH-only. | Adding them to create/inline variant form payloads violates the contract. | Keep new/inline variant behavior unchanged and expose controls only for persisted variants. |
| Hidden price and stock presentation are public-display policy, not stock/price authority. | Misleading labels could imply operational availability or price fallback. | Use contract-specific copy and no client-derived effective public result. |

## Explicit deferrals

- Public enumeration or visitor selection of multiple price contexts.
- Variant-level price-list allowlists.
- Public catalog product list/detail/cart integration, checkout, order creation, WhatsApp flows, branding, and merchandising.
- Product services in the public catalog.
- Changes to the historical `online-catalog-publishing` artifacts or any preserved untracked files.

## Candidate vertical work units

All estimates are provisional authored changed lines and remain below the session review budget of 400. No PR workflow is proposed; each unit is a reviewable local commit/work unit after later authorization.

| Unit | Goal and dependency | Likely scope | Estimate |
| --- | --- | --- | --- |
| WU1 | Register authorization and access points. No feature UI. | AppSubject/runtime registry, role copy, navigation entry, guarded route, authorization/router/navigation tests. | 180-250 |
| WU2 | Establish typed tenant settings transport and server-state boundary. Depends on WU1 only for final subject names. | Catalog-settings DTOs/parser/mappers, API module, centralized query keys, GET/PATCH query/mutation composables, focused API/composable tests. | 220-320 |
| WU3 | Deliver tenant catalog-settings form and publishing safety UX. Depends on WU2. | Thin view plus focused settings components, loading/error/read-only/save/warning states, explicit publication confirmation, SFC tests. | 280-380 |
| WU4 | Make authenticated product catalog fields round-trip without changing compact UI ownership. Independent after WU2 contract types are reusable. | Product raw/normalized/payload/form types and mapping, API tests, pure form/payload tests; preserve existing inclusion field. | 220-320 |
| WU5 | Add advanced product controls to the full editor only. Depends on WU4 and a resolved context-option authorization decision. | Full-editor catalog section, product mutation/invalidation wiring, targeted editor tests. | 260-380 |
| WU6 | Configure persisted variants only. Depends on WU4 for stock types and can run after WU5 or independently once contracts are shared. | Variant raw/payload mapping, `VariantDetailModal` catalog section and PATCH behavior, targeted modal/API tests. | 240-360 |

Dependency graph:

```text
WU1 -> WU2 -> WU3
             \-> WU4 -> WU5
                      \-> WU6
```

## Recommended next phase

Proceed to proposal only after resolving the product-context visibility/permission question and recording the publish-confirmation requirement. The proposal should retain the confirmed scope, declare the settings route placement, and keep public context selection and variant context allowlists explicitly out of scope.
