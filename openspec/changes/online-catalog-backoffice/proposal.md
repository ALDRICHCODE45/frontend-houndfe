# Proposal: Online Catalog Backoffice

## Intent

Backend now exposes the full authenticated catalog-configuration surface (`GET/PATCH /tenants/:tenantId/catalog-settings`, advanced fields on `PATCH /products/:id`, and `catalogPublishMode` + nullable stock override on `PATCH /products/:productId/variants/:variantId`). The frontend has every primitive it needs — Vue Query, Axios, Zod, CASL, route/navigation registry, settings precedent — but no catalog-specific DTOs, query keys, CASL subject, route, sidebar entry, or product/variant advanced field. The basic `includeInOnlineCatalog` checkbox is the only existing control and is now the most incomplete one in the catalog pipeline.

Wire the authenticated backoffice configuration without touching the public storefront contract: tenant publication + tenant stock default + public price contexts; product-level hide-price, per-product public-context support, and stock override; existing-variant catalog publication mode and stock override. The active `online-catalog-publishing` change remains untouched — this proposal does not modify its artifacts. Do not claim, ship, or stub any public-catalog browse/detail/cart behavior — those stay explicitly deferred and out of scope. No external research is performed or required.

## Why

Three operational gaps that block catalog adoption today:

1. **Tenant operators cannot configure which price lists are public, the default public context, or the tenant stock-presentation default.** Without those knobs, the public catalog is either over-shared or has no consistent stock copy. Backend support is present; the front end has no route, no sidebar entry, and no CASL subject.
2. **Product editors can flip `includeInOnlineCatalog` but cannot hide prices, restrict which tenant-public contexts a product supports, or override stock presentation per product.** Tenant-public contexts are explicitly bound by the settings configuration; the frontend gap is the inability to configure per-product support for those contexts, not proof of private-list exposure.
3. **Existing-variant catalog publication has no UI.** `catalogPublishMode` (`INHERIT | ON | OFF`) and nullable stock overrides are PATCH-only; the only currently editable variant fields are the legacy inline ones. Without these, even published products whose variants should be hidden appear in the public catalog with default stock copy.

The change also creates a publishing safety surface: `catalogPublished=true` is externally visible. The session strategy is `ask-on-risk`, so the settings view must require explicit confirmation on the rising edge from private to published and display `effectivePublication` and any warning faithfully as read-only state.

## Scope

### In Scope

- New feature module `src/features/system/catalog-settings/` mirroring `src/features/system/notifications/` (api/, composables/, components/, interfaces/, utils/, views/, co-located tests).
- New tenant-scoped route `/system/catalog-settings` under the existing Sistema group, guarded by `meta.permission: 'read:TenantCatalogSettings'`; no `skipTenantCheck`, no `requiresSuperAdmin`. Registered in the same work unit that creates the view that resolves it, so every work unit builds independently.
- New sidebar entry in the Sistema group (`src/app/navigation/navigation.registry.ts`), gated by `read:TenantCatalogSettings`. Registered in the same work unit that creates the view.
- New CASL subject `TenantCatalogSettings` registered in `src/features/auth/authorization/ability.ts` and `src/features/auth/interfaces/auth.types.ts`; Spanish subject/action copy in `src/features/admin/roles/i18n/permissions.ts`; expose only documented `read` / `update` actions in the role UI.
- `GET /tenants/:tenantId/catalog-settings` and `PATCH /tenants/:tenantId/catalog-settings` via `src/core/shared/api/http.ts`; new tenant-scoped query key in `src/core/shared/constants/query-keys.ts` (e.g. `['catalog-settings', tenantId]`); GET and PATCH composables; pure request/response mappers with Zod parsing.
- `TenantCatalogSettingsView.vue` (thin view) + focused form/mode-quantity/allowlist components. Loading skeletons, GET error/retry, read-only behavior when only `read` is granted, save success/error feedback, explicit publish-confirmation modal on the rising edge from private to published, faithful read-only display of `effectivePublication` and any warning.
- Product advanced catalog fields round-trip through `useProductForm.ts` and `product.api.ts` (`PATCH /products/:id`): `hidePriceInOnlineCatalog`, `supportedCatalogPriceListIds` (with `[]` = "supports all tenant-public contexts", explicit `null` invalid), stock override `{ mode, customQuantity }` (modes `SYSTEM_STATUS | ABSTRACT_STATUS | CUSTOM_QUANTITY | HIDDEN`, `CUSTOM_QUANTITY` non-negative integer, `0` preserved as literal "Mostrar 0", clearing with explicit `null` pair).
- `ProductDetailView.vue` advanced "Catálogo online" section, gated by `update:Product`. Hide-price toggle, stock-override selector, and per-product public-context support selector are independent controls within that section. The per-product public-context support selector is shown only when the current user holds both `update:Product` AND `read:TenantCatalogSettings`; without settings-read it is disabled with an explanatory note ("Configura los contextos públicos del tenant en Sistema > Catálogo online para habilitar esta selección") while the other advanced product controls remain editable.
- The compact `ProductUpsertSlideover.vue` retains only the basic `includeInOnlineCatalog` checkbox — no duplicate advanced controls.
- Existing-variant catalog fields in `VariantDetailModal.vue`: `catalogPublishMode` (`INHERIT | ON | OFF`) and nullable stock override pair, PATCH-only, gated by `update:Product`. New/inline variants remain untouched.
- Mutation lifecycle: invalidate `['catalog-settings', tenantId]` after settings PATCH; invalidate `productQueryKeys.detail(tenantId, productId)` and `productQueryKeys.variants(tenantId, productId)` after their respective PATCHes. No broad invalidation of unrelated POS price-list caches.
- Hydrate and re-hydrate the settings draft from the authoritative response: derive `publicPriceListIds` from `priceContexts[].priceListId` and derive `catalogDefaultPriceListId` from the entry where `isCatalogDefault` is true. Preserve in-flight local edits until the mutation/refetch settles, then rebuild the draft from the accepted server response. No optimistic publication toggle.
- Tests: authorization (typed subject, parse, revoke, no cross-grant), router/navigation (route guard + visibility), settings API (exact URLs + whitelisted body), settings form/mappers (allowlist/default validation, mode/quantity constraints, `0` preservation, null clearing, warning/effective-publication presentation), settings view (loading/error/read-only/save/confirm), product mapping/form (round-trip new fields, `[] = all`, no null allowlist, hidden-price boolean, null clears, custom `0`), product full editor (advanced section respects `update:Product`; per-product public-context support selector disables with explanation when settings-read is missing while other advanced controls stay editable), variant modal (`INHERIT`/`ON`/`OFF`, PATCH-only, custom `0` preservation, explicit null clear, key invalidation).
- Mocked authenticated-browser coverage at narrow and wide widths for the settings view (responsive verification deferred to the verify phase).

### Out of Scope

- Public storefront browse, product detail, cart, checkout, order creation, WhatsApp flows, branding, merchandising, and product services on the public catalog.
- Public enumeration or visitor selection of multiple price contexts.
- Variant-level price-list allowlists (backend contract does not expose them).
- Modifying the active `online-catalog-publishing` change or its artifacts.
- Optimistic publication updates.
- Super-admin `/admin/tenants` editing of catalog settings (this is global branch administration, not current-tenant policy).
- External research of any kind (no third-party docs, services, or web lookups).
- New design tokens, `main.css` / `vite.config.ts` changes, business-logic / prop / emit / validation changes outside the listed files, new shared primitives, navigation/route changes beyond catalog-settings registration.
- `src/features/catalog/` customer-facing public catalog styling (separate brand surface).

## Capabilities

### New Capabilities

- `online-catalog-backoffice` — tenant operators configure `catalogPublished`, public price contexts (allowlist + default), and the tenant stock-presentation default via a tenant-scoped Sistema route. Product editors configure per-product hide-price, per-product public-context support, and per-product stock override from the full product editor. Operators of existing variants configure `catalogPublishMode` and per-variant stock override from the variant detail modal. The basic `includeInOnlineCatalog` checkbox remains the only product-level publication control on the compact slideover. Publishing changes are guarded by explicit confirmation on the rising edge from private to published and surface `effectivePublication` + warnings read-only. The per-product public-context support selector requires both `update:Product` and `read:TenantCatalogSettings` and is disabled with an explanation when settings-read is missing; other authorized advanced product controls remain editable.

### Modified Capabilities

- None. No existing `openspec/specs/products/spec.md` requirement covers advanced catalog fields or variant publication mode, and no existing settings capability exists.

## Locked product decisions

These decisions are resolved for this change. They are not open and do not require further user input during the design phase.

1. **No external research.** All evidence is local: backend contract guide under `houndfe-backend/docs/backend-responses/public-online-catalog-frontend-guide.md`, `openspec/config.yaml`, and the existing frontend modules (`src/features/system/notifications/`, `src/features/POS/products/`, `src/features/auth/`, `src/app/router`, `src/app/navigation`).
2. **Per-product public-context support selector requires `update:Product` AND `read:TenantCatalogSettings`.** When the current user is missing settings-read, only that selector is hidden or disabled with an explanatory note. Hide-price and stock-override controls within the same advanced section remain available. The frontend NEVER auto-grants settings-read.
3. **Publish-confirmation UX** — confirms only the rising edge from `catalogPublished=false` to `true`. Implemented as a clear modal with explicit accept/cancel actions (no typed text input, no two-step form). The descending edge from `true` to `false` and other settings mutations save without confirmation.
4. **Atomic "clear last public context while published" PATCH** — implemented as one confirmed PATCH body containing `catalogPublished: false`, `publicPriceListIds: []`, and `catalogDefaultPriceListId: null` together. The settings form treats this as a single intentional action; it does NOT split it into multiple requests.
5. **Stock `0` copy** — `customQuantity: 0` is preserved literally. The UI label is "Mostrar 0" (contract-faithful copy). No separate semantic toggle such as "Agotado".
6. **`DEFAULT_CONTEXT_HAS_NO_VALID_PRICES` is warn-only.** The warning is shown read-only when present; save is allowed. No save blocking.

## Approach

Mirror the notifications tenant-settings precedent (settings DTOs, API module, query/mutation composables, mappers, view, co-located tests) for the tenant settings surface. Reuse `useProductForm.ts` + `product.api.ts` for the product advanced fields; reuse `VariantDetailModal.vue` for the variant catalog fields. Keep new UI under the existing `ProductDetailView` and variant modal — do not split new views.

### Backend contract (locked)

- `GET /tenants/:tenantId/catalog-settings` and `PATCH /tenants/:tenantId/catalog-settings` share the same response shape.
- Response fields: `catalogPublished`, `effectivePublication`, `priceContexts[]`, `stockPresentationDefault`, `warnings[]`, `updatedAt`.
- PATCH request fields: `catalogPublished`, `publicPriceListIds`, `catalogDefaultPriceListId`, `stockPresentationDefault`.
- The response does not expose separate `publicPriceListIds` or `catalogDefaultPriceListId` properties. The form reconstructs both request fields from authoritative `priceContexts[]`: all `priceListId` values form the public allowlist, and the entry with `isCatalogDefault: true` supplies the nullable default. After a successful PATCH, rebuild the draft from the returned `priceContexts` rather than assuming the submitted request was accepted unchanged.
- Tenant-public contexts are explicitly bound by `priceContexts` and are not inferred from any global price-list API.
- `effectivePublication = tenant.active && catalogPublished`. The form never treats `true` as effective when the tenant is inactive.

### Vertical work units (each independently buildable, all under the 400-line review budget)

| Unit | Goal and dependency | Scope | Estimate |
|------|---------------------|-------|----------|
| WU1 | Authorization subject registration only. No route, no sidebar, no view imports. Depends on no prior work unit. | `AppSubject` + `APP_SUBJECTS` add `TenantCatalogSettings`; Spanish subject + action copy in `src/features/admin/roles/i18n/permissions.ts`; ability tests (typed subject, valid `read`/`update` parse, malformed code rejection, revocation on omission, no cross-subject grant). No `src/app/router`, `src/app/navigation`, or view references are introduced in this unit. | 80–150 |
| WU2 | Tenant settings transport + server-state boundary. Depends on WU1 only for subject-name stability. | Catalog-settings response/request DTOs/parser/mappers; API module (`GET`/`PATCH`); centralized query key `['catalog-settings', tenantId]`; GET/PATCH composables; API + composable tests. Still no route/navigation/view references. | 220–320 |
| WU3 | Tenant settings view, publish-confirmation UX, and access wiring. Depends on WU2. | Thin `TenantCatalogSettingsView.vue` + form/mode-quantity/allowlist components + publish-confirmation modal (rising edge only) + the route registration in `src/app/router/index.ts` + the sidebar entry in `src/app/navigation/navigation.registry.ts` + ability/router/navigation tests for the route/visibility + SFC tests. This unit registers the route and sidebar entry because it is the unit that creates the view that resolves them. | 280–380 |
| WU4 | Authenticated product catalog fields round-trip. Independent after WU2 contracts. | Product raw/normalized/payload/form types + mapping; product API tests; pure form/payload tests; preserve `includeInOnlineCatalog`. No view changes. | 220–320 |
| WU5 | Advanced product controls in the full editor. Depends on WU4. | `ProductDetailView` advanced "Catálogo online" section: hide-price, stock override, per-product public-context support selector; per-product public-context support selector gated by `update:Product` AND `read:TenantCatalogSettings` with explanatory disabled state; other advanced controls remain editable; mutation/invalidation wiring; editor tests. | 260–380 |
| WU6 | Existing-variant catalog configuration. Depends on WU4 for stock types; can run after WU5 or independently once contracts are shared. | Variant raw/payload mapping; `VariantDetailModal` catalog section + PATCH behavior; modal/API tests. | 240–360 |

Dependency graph:

```text
WU1 -> WU2 -> WU3
         \-> WU4 -> WU5
                  \-> WU6
```

`ask-on-risk` applies at the implementation-design gate only for the rising-edge publish flip (the only externally-visible publishing action). Clearing the last public context while published is one atomic PATCH with `catalogPublished:false`, `publicPriceListIds:[]`, and `catalogDefaultPriceListId:null`. `size:exception` is not invoked; every work unit fits under 400 lines.

## Affected Areas

| Area | Impact | Work unit |
|------|--------|-----------|
| `src/features/system/catalog-settings/**` | New module (api, composables, components, interfaces, utils, views, tests). | WU2, WU3 |
| `src/features/system/notifications/**` | Untouched. Used only as a structural precedent. | — |
| `src/features/POS/products/interfaces/product.types.ts` | Add raw/normalized/payload types for `hidePriceInOnlineCatalog`, `supportedCatalogPriceListIds`, stock override, variant `catalogPublishMode` + stock override. | WU4 |
| `src/features/POS/products/api/product.api.ts` | Extend existing PATCH mappers; no new endpoints. | WU4 |
| `src/features/POS/products/composables/useProductForm.ts` | Extend Zod schema, GET-to-form mapper, payload builders; preserve `includeInOnlineCatalog`. | WU4 |
| `src/features/POS/products/views/ProductDetailView.vue` | Add advanced "Catálogo online" section. | WU5 |
| `src/features/POS/products/components/ProductUpsertSlideover.vue` | No new fields; keep the basic inclusion checkbox only. | — |
| `src/features/POS/products/components/VariantDetailModal.vue` | Add catalog publication mode + stock override section, gated by `update:Product`. | WU6 |
| `src/features/auth/authorization/ability.ts` | Register `TenantCatalogSettings` subject. | WU1 |
| `src/features/auth/interfaces/auth.types.ts` | Extend `AppSubject` union. | WU1 |
| `src/features/admin/roles/i18n/permissions.ts` | Add Spanish subject + action copy. | WU1 |
| `src/app/router/index.ts` | Register guarded tenant-scoped route. | WU3 |
| `src/app/navigation/navigation.registry.ts` | Add Sistema entry. | WU3 |
| `src/core/shared/api/http.ts` | Reuse existing authenticated client; no changes. | — |
| `src/core/shared/constants/query-keys.ts` | Add `['catalog-settings', tenantId]`. | WU2 |
| `src/features/catalog/**` (public) | Untouched. | — |

## Risks and Unknowns

| Risk or unknown | Impact | Required resolution |
|-----------------|--------|---------------------|
| `ProductDetailView` and `VariantDetailModal` are large and complex. | Combined DTO + form + UI + variant changes risk exceeding 400-line budget per unit. | Isolate WU4 (mapping) from WU5 (view) and WU6 (variant); each work unit stays reviewable. |
| Reconstructing `publicPriceListIds` and `catalogDefaultPriceListId` from `priceContexts[]` while a save/refetch is in flight. | A late response could overwrite pending edits, or the UI could keep values the server did not accept. | Initialize and re-hydrate the draft from `priceContexts` only at controlled query/mutation boundaries; preserve local edits while dirty or pending, then rebuild from the accepted response. |
| Variant catalog fields are PATCH-only; backend initializes them as `INHERIT` + null stock override. | Adding them to create/inline variant forms would violate the contract. | Keep new/inline variants unchanged; expose controls only for persisted variants. |
| Hidden-price and stock-presentation copy could be read as stock/price authority. | Misleading labels. | Use contract-specific copy ("Mostrar 0" for `customQuantity: 0`); never compute effective public stock or price fallback in the client. |
| Backoffice responsive coverage is not part of the catalog discovery responsive suite. | A user-visible settings UI could ship without confirmed narrow/wide behavior. | Add focused mocked authenticated-browser evidence at narrow and wide widths during the verify phase for `TenantCatalogSettingsView`. |

## First Slice Scope

**WU1 — Authorization subject registration only.** Register `TenantCatalogSettings` in `AppSubject` and `APP_SUBJECTS`; add Spanish subject + action copy in `src/features/admin/roles/i18n/permissions.ts`; add ability tests. No route, no sidebar entry, no view imports, no navigation references — those land in WU3 alongside the view that resolves them. Estimated 80–150 lines. Depends on no prior SDD work unit.

This slice is the smallest reviewable work unit and unblocks WU2 by fixing the subject name. It is independently buildable: it touches only authorization files and adds no broken imports.

## Rollback Plan

Per work unit: `git revert <commit>` (or `git reset` for unmerged local branches). Each work unit is independently revertible because the contract is additive and the affected files per unit are narrow:

- WU1 revert: drop the new ability subject and role copy; existing ability tests and role UI stay green.
- WU2 revert: drop the new API module, query key, composables, and types; no other module consumes the key yet.
- WU3 revert: remove the new view, components, the route registration in `src/app/router/index.ts`, the sidebar entry in `src/app/navigation/navigation.registry.ts`, and their tests.
- WU4 revert: drop the new product types, mapping, and form schema additions; `includeInOnlineCatalog` is preserved.
- WU5 revert: remove the advanced "Catálogo online" section from `ProductDetailView`.
- WU6 revert: remove the catalog section from `VariantDetailModal`.

Backend endpoints remain available across reverts — no server rollback is required. The active `online-catalog-publishing` change and its artifacts are not touched by any work unit and remain intact.

## Dependencies

- Backend contract: `houndfe-backend/docs/backend-responses/public-online-catalog-frontend-guide.md` — authoritative for DTOs, warnings, permission codes, and stock semantics.
- Existing infrastructure (no new dependency): `@tanstack/vue-query`, `axios`, `zod`, `@casl/ability` + `@casl/vue`, `@nuxt/ui`, `vue-router`, `pinia`. Shared primitives reused: `ConfirmModal`, `AppButton`, `AppBadge`, `userMessageForError`, `mountWithUApp`.
- Pattern precedents: `src/features/system/notifications/` (settings shape), `src/features/POS/products/composables/useProductForm.ts` (product form), `src/features/POS/products/components/VariantDetailModal.vue` (variant PATCH).
- Authorization registration points documented in `openspec/config.yaml` (`conventions.routing_and_authorization`).

## Success Criteria

- [ ] `TenantCatalogSettings` registered in `AppSubject` and `APP_SUBJECTS`; ability tests cover typed subject, valid `read`/`update` parse, malformed code rejection, revocation on omission, and no cross-subject grant. (WU1)
- [ ] Spanish subject + action copy added to `src/features/admin/roles/i18n/permissions.ts`; role UI exposes only the documented `read` / `update` actions. (WU1)
- [ ] No route, sidebar entry, or view import introduced in WU1; WU1 is independently buildable. (WU1)
- [ ] `GET /tenants/:tenantId/catalog-settings` returns `catalogPublished`, `effectivePublication`, `priceContexts[]`, `stockPresentationDefault`, `warnings[]`, `updatedAt`; the form derives `publicPriceListIds` from all returned context IDs and `catalogDefaultPriceListId` from `isCatalogDefault`, including the empty/null case. (WU2)
- [ ] `PATCH /tenants/:tenantId/catalog-settings` accepts a whitelisted body with `catalogPublished`, `publicPriceListIds`, `catalogDefaultPriceListId`, `stockPresentationDefault`. UI send shape: no `customQuantity` for `mode ∈ {SYSTEM_STATUS, ABSTRACT_STATUS, HIDDEN}`; only `CUSTOM_QUANTITY` carries a non-negative integer quantity; `0` preserved as literal "Mostrar 0"; clearing uses explicit `null` pair. (WU2/WU3)
- [ ] Clearing the last public context while published is one atomic PATCH body with `catalogPublished:false`, `publicPriceListIds:[]`, `catalogDefaultPriceListId:null`. (WU3)
- [ ] Tenant-scoped route `/system/catalog-settings` registered under Sistema with `meta.permission: 'read:TenantCatalogSettings'`, no `skipTenantCheck`, no `requiresSuperAdmin`. (WU3)
- [ ] Sidebar entry visible only to users granted `read:TenantCatalogSettings`; hidden when revoked. (WU3)
- [ ] Settings view shows `effectivePublication` read-only; shows warnings read-only; saves only after explicit publish confirmation on the rising edge from `false` to `true` via a clear modal (no typed text); loading/error/retry/read-only paths covered by SFC tests. (WU3)
- [ ] `DEFAULT_CONTEXT_HAS_NO_VALID_PRICES` is warn-only; save is allowed when present. (WU3)
- [ ] Product editor advanced fields round-trip through `useProductForm.ts` and `product.api.ts`: `hidePriceInOnlineCatalog`, `supportedCatalogPriceListIds` (`[]` = all tenant-public contexts, explicit `null` rejected), stock override. Existing `includeInOnlineCatalog` checkbox preserved as the only compact-slideover publication control. (WU4)
- [ ] `ProductDetailView.vue` advanced "Catálogo online" section: hide-price and stock-override controls respect `update:Product`; the per-product public-context support selector additionally requires `read:TenantCatalogSettings` and is hidden/disabled with an explanatory note when missing, while other advanced product controls remain editable. The frontend never auto-grants settings-read. (WU5)
- [ ] `VariantDetailModal.vue` adds `catalogPublishMode` (`INHERIT`/`ON`/`OFF`) and nullable stock override pair; PATCH-only; new/inline variants unchanged; preserves `customQuantity: 0` (literal "Mostrar 0"); clears overrides with explicit `null` pair. (WU6)
- [ ] Mutation invalidations are surgical: settings PATCH invalidates `['catalog-settings', tenantId]`; product PATCH invalidates `productQueryKeys.detail`; variant PATCH invalidates `productQueryKeys.variants`. No broad POS price-list invalidation.
- [ ] No new public-side call, key, or feature; `src/features/catalog/**` untouched.
- [ ] The active `online-catalog-publishing` change and its artifacts remain untouched by every work unit.
- [ ] No external research; evidence is local-only (backend contract guide, project config, existing modules).
- [ ] Each work unit ≤ 400 lines; no `size:exception` invoked.
- [ ] `pnpm test:unit --run` and `pnpm build` clean per work unit; verify phase adds focused mocked authenticated-browser evidence at narrow and wide widths for `TenantCatalogSettingsView`.