# Tasks — Online Catalog Backoffice

No-PR workflow: every work unit is a sequential local reviewable Conventional Commit. No `size:exception`. Each unit gates on its focused Vitest files plus `pnpm build`. `ask-on-risk` is the stop rule if any measured slice approaches or exceeds 400 lines.

## Workload Forecast

| Field | Value |
|-------|-------|
| Per-slice maxima | WU1 ≤ 150; WU2 ≤ 320; WU3A ≤ 360; **WU3B ≤ 380**; WU4 ≤ 320; **WU5 ≤ 380**; WU6 ≤ 360. Aggregate ≈ 2 270; every slice strictly under 380. |
| 400-line risk | Low per slice. Stop rule: any measured slice approaching / exceeding 400 pauses for a delivery decision. |
| Chained PRs | No — user does not use PRs. |
| Split | WU1 → WU2 → WU3A → WU3B → WU4 → WU5 → WU6. Strictly sequential. WU6 reuses `OnlineStockOverrideFields.vue` from WU5. |
| Delivery | `ask-on-risk` (stop rule only). |
| Chain | N/A (sequential local reviewable commits). |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A (sequential local reviewable commits)
400-line budget risk: Low
```

## Dependency Graph

```text
WU1 -> WU2 -> WU3A -> WU3B
WU4 -> WU5 -> WU6
```

WU1 locks typed subject names. WU2 owns settings GET/PATCH transport, mappers, form core, read / mutation composables, and the centralized query key (no candidate enumeration). WU3A creates the routed read-only view and registers route + sidebar. WU3B layers the editable form, publish-confirmation modal, mutation, and `useCatalogPriceListCandidatesQuery`. WU5 introduces `OnlineStockOverrideFields.vue`. WU6 reuses it strictly after WU5.

## Work Units

| # | Slice | Max | Focused command | Runtime scenario | Rollback boundary |
|---|-------|----:|-----------------|------------------|-------------------|
| WU1 | Auth subject registration | ≤150 | `pnpm test:unit --run src/features/auth/authorization/__tests__/ability.test.ts src/features/auth/interfaces/__tests__/auth.types.spec.ts src/features/admin/roles/i18n/__tests__/permissions.spec.ts` | N/A — pure registry change; runtime ships with WU3A. | `git revert` of `auth.types.ts`, `ability.ts`, `permissions.ts`, and the three MOD test files. |
| WU2 | Settings GET/PATCH transport, mappers, form core, query, mutation (no candidate enum) | ≤320 | `pnpm test:unit --run src/features/system/catalog-settings/api/__tests__/catalogSettings.api.spec.ts src/features/system/catalog-settings/utils/__tests__/catalogSettingsMappers.spec.ts src/features/system/catalog-settings/composables/__tests__/useCatalogSettingsQuery.spec.ts src/features/system/catalog-settings/composables/__tests__/useUpdateCatalogSettingsMutation.spec.ts src/core/shared/constants/__tests__/query-keys.test.ts` | N/A — transport boundary; runtime ships with WU3A. | Remove the new catalog-settings module + the single query-key entry; no consumer depends yet. |
| WU3A | Routed read-only view + route + sidebar entry | ≤360 | `pnpm test:unit --run src/features/system/catalog-settings/views/__tests__/TenantCatalogSettingsView.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogSettingsReadView.spec.ts src/app/router/__tests__/router.catalogBackoffice.spec.ts src/app/navigation/__tests__/navigation.catalogBackoffice.spec.ts` | Dev tenant with `read:TenantCatalogSettings`: skeleton → accepted read-only; revoked ⇒ `/403`. | `git revert` of view, `CatalogSettingsReadView`, route entry, sidebar entry, and tests. WU2 stays inert. |
| WU3B | Editable form + confirmation + mutation + candidate composable | ≤380 | `pnpm test:unit --run src/features/system/catalog-settings/composables/__tests__/useCatalogSettingsForm.spec.ts src/features/system/catalog-settings/composables/__tests__/useCatalogPriceListCandidatesQuery.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogSettingsForm.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogPriceContextsField.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogStockPresentationField.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogSettingsReadView.spec.ts src/features/system/catalog-settings/views/__tests__/TenantCatalogSettingsView.spec.ts` | Dev tenant with both perms: `false → true` save opens `ConfirmModal`; Accept rehydrates from `priceContexts`; descending edge saves without modal; missing `read:GlobalPriceList` disables only the contexts field. | `git revert` of editable components, candidate composable, mutation wiring, confirmation, and tests. WU3A remains a routed read-only surface. |
| WU4 | Product / variant typed flat-field round-trip (no view changes) | ≤320 | `pnpm test:unit --run src/features/POS/products/api/__tests__/product.api.test.ts src/features/POS/products/interfaces/__tests__/product.types.test.ts src/features/POS/products/composables/__tests__/useProductForm.payload.test.ts src/features/POS/products/composables/__tests__/useProductForm.helpers.test.ts` | N/A — pure mapping; runtime ships with WU5 / WU6. | `git revert` of new product / variant flat-field types, mapping, and form schema additions. `includeInOnlineCatalog` preserved. |
| WU5 | Advanced "Catálogo online" section in `ProductDetailView` + `OnlineStockOverrideFields.vue` | ≤380 | `pnpm test:unit --run src/features/POS/products/views/__tests__/ProductDetailView.test.ts src/features/POS/products/components/__tests__/ProductCatalogSettingsSection.spec.ts src/features/POS/products/components/__tests__/OnlineStockOverrideFields.spec.ts` | Open `ProductDetailView`: toggle hide-price and save; PATCH body lacks `supportsAllCatalogPriceLists`; only `productQueryKeys.detail` is invalidated. | `git revert` of advanced section, `ProductDetailView` change, `OnlineStockOverrideFields`, and tests. WU6 cannot run until WU5 lands. |
| WU6 | Persisted-variant catalog publication + stock override (reuses `OnlineStockOverrideFields.vue` from WU5) | ≤360 | `pnpm test:unit --run src/features/POS/products/components/__tests__/VariantDetailModal.catalog.spec.ts` | Open `VariantDetailModal` on a persisted variant: toggle publication mode → save → PATCH body only contains the changed flat key; variants key is the only invalidation. | `git revert` of modal changes and tests. Create / inline variants untouched. |

A slice is done when its focused command exits 0 and `pnpm build` (vue-tsc + vite) exits 0. Runtime scenario is concrete or explicit `N/A` per the work-unit commit discipline.

## Shared Rules (apply to every WU)

- **TDD cycle**: RED → GREEN → TRIANGULATE → REFACTOR. **Build verification**: focused command and `pnpm build` both exit 0.
- **Vue 3**: Composition API + `<script setup lang="ts">`; explicit `defineProps` / `defineEmits` / `defineModel`; `computed` for derivations; route views are composition surfaces; single responsibility per child component; co-located `*.spec.ts` next to implementation.
- **SFC tests**: any Nuxt UI primitive (`UTooltip`, `UModal`, `UToast`, `UDropdownMenu`...) mounts via `src/test/mountWithUApp.ts` (`mountWithUApp<T>`), not `mount()`.
- **Mocking**: `vi.mock('axios')` at the top of API test files; `http.{post,get,patch,put,delete}` via `vi.fn()`. CASL tests use a fresh `AbilityBuilder` per scenario; never share across slices.
- **Auth touch points**: `ability.ts` (`APP_SUBJECTS`), `auth.types.ts` (`AppSubject`), `permissions.ts` (Spanish copy, tested by `permissions.spec.ts`), `router/index.ts`, `navigation.registry.ts`.
- **Mutations stay surgical**: settings PATCH invalidates `catalogSettingsQueryKeys.detail` only; product catalog-only PATCH invalidates `productQueryKeys.detail` only; variant PATCH invalidates `productQueryKeys.variants` only. **No broad POS price-list invalidation, no public-catalog invalidation, no optimistic publication write.**
- **Flat backend fields only**: `hidePriceInOnlineCatalog`, `supportedCatalogPriceListIds`, `supportsAllCatalogPriceLists` (response-only, never sent), `onlineStockPresentation`, `onlineStockPresentationCustomQty`, plus variant `catalogPublishMode` and the same stock override pair. No nested `stockPresentationOverride`.
- **Local-only evidence**: `houndfe-backend/docs/backend-responses/public-online-catalog-frontend-guide.md`, `openspec/config.yaml`, existing modules. **No external research.**
- **No storefront edits**: `src/features/catalog/**` and `openspec/changes/online-catalog-publishing/**` are never touched.
- **Reuse**: `ConfirmModal`, `userMessageForError`, `AppBadge`, `StatusDotBadge`, `mountWithUApp`, `productQueryKeys`, `useSafeTenantId`, notifications-pattern (structure only), `product.api.getGlobalPriceLists()`, `OnlineStockOverrideFields.vue` (NEW in WU5, reused by WU6), `VariantDetailModal`, `useProductForm`.
- **Commit discipline**: this file plans; apply materializes each slice as one Conventional Commit. Planning does NOT claim commits.

---

## WU1 — Authorization Subject Registration

**Outcome**: typed `TenantCatalogSettings` AND `GlobalPriceList` registered in `AppSubject`, runtime `APP_SUBJECTS`, and neutral Spanish copy (both labels; actions per backend).
**Dependency**: none — locks typed subject names used by every later unit.

### Files (MOD)
- `src/features/auth/interfaces/auth.types.ts` — `AppSubject` union += both subjects.
- `src/features/auth/authorization/ability.ts` — `APP_SUBJECTS` += both subjects before `'all'`.
- `src/features/admin/roles/i18n/permissions.ts` — Spanish copy for both subjects.
- `src/features/auth/authorization/__tests__/ability.test.ts`
- `src/features/auth/interfaces/__tests__/auth.types.spec.ts`
- `src/features/admin/roles/i18n/__tests__/permissions.spec.ts`

### TDD
- **RED** — extend the three tests for both subjects; assert missing entries fail.
- **GREEN** — register both subjects in union, runtime registry, and Spanish copy.
- **TRIANGULATE** — revocation on omission of `read:GlobalPriceList`; `tenant_catalog_settings:read` malformed-rejected; no cross-subject grant.
- **REFACTOR** — keep `parsePermissionCode` pure; inline-comment the SDD cycle.

### Forbidden
- Router / navigation / query / view import; any route or sidebar edit; any edit under `src/features/system/catalog-settings/**` or `src/features/POS/**`; entry in `HIDDEN_SUBJECTS`.

### Build verification
- [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

### Commit
```text
feat(auth): register TenantCatalogSettings and GlobalPriceList subjects

Adds both subjects to the AppSubject union and APP_SUBJECTS runtime.
Adds neutral Spanish copy in the role-permissions UI for both, exposing
only the actions the backend returns. Extends the existing ability,
auth-types, and permissions tests for typed parse, malformed-code
rejection, revocation on omission, and no cross-subject grant.
```

---

## WU2 — Transport, Mappers, Form Core, Query, Mutation

**Outcome**: read-side contract for `/tenants/:tenantId/catalog-settings` locked in pure TypeScript. **No candidate enumeration** (WU3B territory).
**Dependency**: WU1.

### Files
- **NEW** `interfaces/catalog-settings.types.ts` — `OnlineStockPresentationMode`, `CatalogPublishMode`, `CatalogSettingsWarning`, `CatalogPriceContextDto`, `CatalogStockPresentationDefaultDto`, `CatalogSettingsResponseDto`, `CatalogSettingsDraft`, `CatalogSettingsPatchBody`.
- **NEW** `api/catalogSettings.api.ts` — `get`, `patch` via `core/shared/api/http.ts`; body from `toPatchCatalogSettingsBody`; never sends `tenantId` / `effectivePublication` / `priceContexts` / `warnings` / `updatedAt`.
- **NEW** `utils/catalogSettingsMappers.ts` — `parseCatalogSettingsResponse`, `fromCatalogSettingsResponse` (derives from `priceContexts`), `validateCatalogSettingsDraft` (publish requires non-empty allowlist + selected default), `serializeStockPresentationDefault`, `isCatalogSettingsDirty`, `isPublishRisingEdge`, `toPatchCatalogSettingsBody` (incl. atomic clear-last-public-context triple), `mapCatalogSettingsWarning` (closed set), `mapCatalogSettingsError`.
- **NEW** `composables/useCatalogSettingsQuery.ts` — tenant-scoped key; no 404-as-default fallback; no cross-tenant placeholder.
- **NEW** `composables/useUpdateCatalogSettingsMutation.ts` — invalidates **only** `catalogSettingsQueryKeys.detail(tenantId)`; no optimistic cache write; never pre-flips `catalogPublished`.
- **NEW** co-located `*.spec.ts` for each module above.
- **MOD** `src/core/shared/constants/query-keys.ts` — add `catalogSettingsQueryKeys = { detail: (tenantId) => ['catalog-settings', tenantId] as const }`.
- **MOD** `src/core/shared/constants/__tests__/query-keys.test.ts` — assert the new key.

### TDD
- **RED** — pure-function tests first; assert missing `priceContexts` derivation, missing publish-requires-default validation, missing atomic triple, wrong `isPublishRisingEdge` truth table.
- **GREEN** — implement only what tests demand; `fromCatalogSettingsResponse` reads `priceContexts` in server order; body builder whitelists changed keys and emits the atomic triple when accepted state was published and current draft removes the last context.
- **TRIANGULATE** — empty `priceContexts` ⇒ empty allowlist + `null` default; default not selected rejects publish; mode matrix forces `customQuantity: null` except `CUSTOM_QUANTITY` (non-negative integer, `0` preserved as `"Mostrar 0"`); unknown warning codes map to `null`.
- **REFACTOR** — split mappers by concern; no Vue composable or Nuxt UI imports.

### Forbidden
- Any reference to `router/**`, `navigation/**`, or `views/**`; `useCatalogPriceListCandidatesQuery` and its tests (WU3B); any edit to `src/features/catalog/**`; any new external dependency.

### Build verification
- [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

### Commit
```text
feat(catalog-settings): tenant settings transport, mappers, and query/mutation

Adds the GET / PATCH DTOs, parsers, and pure mappers for the settings
endpoints, including the atomic clear-last-public-context triple and
closed-set warning filtering. Adds catalogSettingsApi.get / patch with
whitelisted bodies. Adds useCatalogSettingsQuery (tenant-scoped key, no
404 default) and useUpdateCatalogSettingsMutation (invalidates only the
catalog-settings key on success; no optimistic publication update).
Registers catalogSettingsQueryKeys.detail in the centralized query-keys
module.
```

---

## WU3A — Routed Read-Only View, Route, Sidebar Entry

**Outcome**: thin route-resolved view renders accepted settings read-only; route + sidebar live with the view because they belong to the same reviewable unit.
**Dependency**: WU2.

### Files
- **NEW** `views/TenantCatalogSettingsView.vue` — composition surface (tenant from `useSafeTenantId`, `read:TenantCatalogSettings` for access, `useCatalogSettingsQuery`, no DTO transformation in template).
- **NEW** `components/CatalogSettingsReadView.vue` — read-only rendering of `catalogPublished`, `effectivePublication`, `priceContexts[]`, `stockPresentationDefault`, `updatedAt`, known warning via closed Spanish copy; empty-state copy when `priceContexts` is empty.
- **NEW** co-located `*.spec.ts` for both SFCs (mountWithUApp).
- **NEW** `src/app/router/__tests__/router.catalogBackoffice.spec.ts`.
- **NEW** `src/app/navigation/__tests__/navigation.catalogBackoffice.spec.ts`.
- **MOD** `src/app/router/index.ts` — add lazy constant and one Sistema entry: `path: '/system/catalog-settings'`, `name: 'system-catalog-settings'`, `layout: 'dashboard'`, `meta.permission: ['read', 'TenantCatalogSettings']`. No `skipTenantCheck`, no `requiresSuperAdmin`.
- **MOD** `src/app/navigation/navigation.registry.ts` — add Sistema entry `"Catálogo online"` gated by `'read': 'TenantCatalogSettings'`.

### TDD
- **RED** — route test expects the tuple (fails: no entry); nav test expects the sidebar entry (fails: no entry); SFC test expects skeleton / retry / known warning (fails: view missing).
- **GREEN** — register route + sidebar; ship view reading from `useCatalogSettingsQuery`; render skeleton on `isLoading`, retry on `isError`, accepted data on success.
- **TRIANGULATE** — accept GET errors of any status (incl. 404) and offer retry without synthetic defaults; render empty `priceContexts` with the locked copy; render `effectivePublication` faithfully even when divergent; drop unknown warning codes silently.
- **REFACTOR** — view composition-only; conditional copy lives in `CatalogSettingsReadView`; reuse `AppBadge` and `USkeleton`; no new Nuxt UI primitive.

### Forbidden
- Editable form components; PATCH mutation wiring; the `ConfirmModal`; any code path issuing `PATCH`; candidate enumeration (WU3B); any edit under `src/features/catalog/**` or `src/features/admin/tenants/**`.

### Build verification
- [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

### Commit
```text
feat(catalog-settings): routed read-only tenant settings view

Registers /system/catalog-settings (name system-catalog-settings, layout
dashboard, permission read:TenantCatalogSettings) without skipTenantCheck
and without requiresSuperAdmin. Adds the Sistema sidebar entry
'Catalogo online' gated by read:TenantCatalogSettings. The view composes
the read query and delegates UI to CatalogSettingsReadView, which
renders accepted publication / effective state, priceContexts, default,
stock default, known warnings, and empty-state copy. Skeleton / error /
retry covered; no synthetic defaults on 404; unknown warning codes
dropped silently.
```

---

## WU3B — Editable Form, Confirmation, Mutation, Candidate Enumeration

**Outcome**: WU3A's read-only surface gains the editable form, publish-confirmation modal, mutation, and candidate composable. Read-only behavior stays intact when only `read:TenantCatalogSettings` is held.
**Dependency**: WU3A.

### Files (all NEW unless noted)
- `composables/useCatalogSettingsForm.ts` — owns `draft` / `pristine` / `accepted` snapshots; computed validation, dirty, rising-edge; actions `acceptResponse`, `requestSave`, `confirmPublish`, `cancelPublish`. Hydrates from `priceContexts` only at controlled boundaries; suppresses refetch overwrite while dirty or pending; rebuilds draft from accepted PATCH; tenant-id change clears snapshots before re-hydration.
- `composables/useCatalogPriceListCandidatesQuery.ts` — reuses `productApi.getGlobalPriceLists()` and `productQueryKeys.globalPriceLists()`; fires **only** when both `update:TenantCatalogSettings` and `read:GlobalPriceList` are granted.
- `composables/__tests__/useCatalogSettingsForm.spec.ts`.
- `composables/__tests__/useCatalogPriceListCandidatesQuery.spec.ts`.
- `components/CatalogSettingsForm.vue` — publish toggle (editable intent), stock field, contexts field, validation summary, save footer; no DTO transformation in template.
- `components/CatalogPriceContextsField.vue` — `canEditContexts = canUpdate && canReadGlobalPriceLists`; without `read:GlobalPriceList`: shows accepted `priceContexts` and default read-only, disables add / remove / default, shows the least-privilege Spanish explanation; preserves selected IDs missing from candidates with neutral unavailable copy.
- `components/CatalogStockPresentationField.vue` — emits normalized `{mode, customQuantity}`; renders `"Mostrar 0"` when `customQuantity === 0`.
- `components/__tests__/CatalogSettingsForm.spec.ts`, `CatalogPriceContextsField.spec.ts`, `CatalogStockPresentationField.spec.ts`.
- `components/__tests__/CatalogSettingsReadView.spec.ts` (NEW — covers the read-only notice added below).
- **MOD** `components/CatalogSettingsReadView.vue` — add `"No tienes permisos para guardar cambios"` notice when `canUpdate === false`. No other behavior change.
- **MOD** `views/TenantCatalogSettingsView.vue` — read-only when `canUpdate === false`; otherwise compose with `CatalogSettingsForm`; success toast `"Configuración de catálogo guardada"`, error toast via `userMessageForError`; wire `ConfirmModal` for rising edge; Cancel ⇒ no PATCH, dirty draft preserved.
- **MOD** `views/__tests__/TenantCatalogSettingsView.spec.ts` (extends existing).

### TDD
- **RED** — form / fields / candidate tests fail: rising-edge detection, atomic triple, default-missing blocks publish, candidate composable fires when permissions missing.
- **GREEN** — implement `useCatalogSettingsForm`, fields consuming `accepted` / `draft` / `pristine`, candidate composable with the dual-permission gate, `ConfirmModal` only on rising edge.
- **TRIANGULATE** — `Mostrar 0`; non-custom modes force `null` quantity in PATCH; Cancel keeps dirty draft editable; descending edge sends only `{catalogPublished: false}`; tenant-id change clears snapshots; missing `read:GlobalPriceList` keeps publication / stock available.
- **REFACTOR** — split mappers from form; `ConfirmModal` opens once per rising-edge attempt; no `setQueryData` before response.

### Forbidden
- Any router / navigation / product / variant edit; any request against `src/features/catalog/**`; any other confirmation strategy than the proposal-locked rising-edge two-button modal (no typed text, no multi-step).

### Build verification
- [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

### Commit
```text
feat(catalog-settings): editable settings, publish confirm, mutation, candidates

Adds useCatalogSettingsForm (draft / pristine / accepted snapshots;
rising-edge detection; dirty-while-pending suppression) and
useCatalogPriceListCandidatesQuery (enabled only when both
update:TenantCatalogSettings and read:GlobalPriceList are granted).
Adds the editable settings form, the contexts field with
least-privilege gating, and the stock default field. ConfirmModal opens
only on the rising edge of catalogPublished (false -> true); descending
edge and the atomic-clear triple save without confirmation. Cancel keeps
the dirty draft editable. Settings PATCH invalidates only the
catalog-settings key on success; no optimistic cache write. Stock '0'
renders as 'Mostrar 0'; non-custom modes serialize null quantity;
explicit null pair clears an existing stock default.
```

---

## WU4 — Product / Variant Typed Flat-Field Round-Trip

**Outcome**: existing product and variant editing pipeline round-trips the new catalog flat fields without altering any view. Compact slideover keeps its existing basic `includeInOnlineCatalog` checkbox as sole publication control.
**Dependency**: WU2.

### Files (all MOD)
- `src/features/POS/products/interfaces/product.types.ts` — add raw / normalized / payload / form types for `hidePriceInOnlineCatalog`, `supportedCatalogPriceListIds`, `supportsAllCatalogPriceLists` (response-only), `onlineStockPresentation`, `onlineStockPresentationCustomQty`, plus variant `catalogPublishMode`, `onlineStockPresentation`, `onlineStockPresentationCustomQty`.
- `src/features/POS/products/api/product.api.ts` — extend `mapProduct` / `mapProductDetail`; `supportsAllCatalogPriceLists` is response-only and never enters the form draft. Add `toVariantPatchCatalogPayload(current, pristine)` (changed flat keys only; clearing stock emits both nulls).
- `src/features/POS/products/composables/useProductForm.ts` — Zod schema extended; null allowlist rejected with Spanish validation copy; `[]` valid ("supports all tenant-public contexts"); `toUpdatePayload` emits each advanced key only when changed; `supportsAllCatalogPriceLists` never sent; clear emits both stock nulls; non-custom modes null quantity; custom `0` preserved; compact-slideover edit path preserves hydrated advanced snapshot and emits no advanced key.
- `src/features/POS/products/api/__tests__/product.api.test.ts`.
- `src/features/POS/products/interfaces/__tests__/product.types.test.ts`.
- `src/features/POS/products/composables/__tests__/useProductForm.payload.test.ts`.
- `src/features/POS/products/composables/__tests__/useProductForm.helpers.test.ts`.

### TDD
- **RED** — payload / mapping tests first: advanced keys missing, null-allowlist reject missing, read-only field present, custom `0` becomes `null`.
- **GREEN** — extend types / mapper / Zod schema / payload builder; lock `supportsAllCatalogPriceLists` never-sent contract.
- **TRIANGULATE** — order-of-fields-independence (emitted key set ⊆ whitelist); no-emit-when-unchanged; clear-stock pair (both null); custom `0` preserved; variant create / inline payloads unchanged.
- **REFACTOR** — payload builders pure; no Vue composable imports in mappers; variant helpers next to existing variant helpers.

### Forbidden
- Any view edit (`ProductDetailView.vue`, `ProductUpsertSlideover.vue`, `VariantDetailModal.vue`); any edit to `src/features/catalog/**`; candidate enumeration.

### Build verification
- [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

### Commit
```text
feat(products): product / variant typed flat-field round-trip

Extends product / variant types, mapping, and form schema to round-trip
hidePriceInOnlineCatalog, supportedCatalogPriceListIds,
supportsAllCatalogPriceLists (response-only), onlineStockPresentation,
and onlineStockPresentationCustomQty, plus variant catalogPublishMode
and the same stock override pair. toUpdatePayload emits each changed
advanced flat key only; supportsAllCatalogPriceLists is never sent.
supportedCatalogPriceListIds=null is rejected with Spanish validation;
[] is valid. Custom '0' preserved; non-custom override modes emit null
quantity; clearing emits both nulls. Compact slideover preserves the
hydrated advanced snapshot and does not emit advanced keys.
```

---

## WU5 — Advanced "Catálogo online" Section

**Outcome**: full product editor exposes the new advanced catalog section. Hide-price and stock override respond to `update:Product`; per-product public-context support selector additionally requires `read:TenantCatalogSettings` and disables with the locked Spanish note when settings-read is missing. `OnlineStockOverrideFields.vue` ships here so WU6 can reuse it.
**Dependency**: WU4.

### Files
- **NEW** `components/ProductCatalogSettingsSection.vue` — full-editor composition surface for hide-price, stock override, per-product public-context support selector, read-only `supportsAll` indicator.
- **NEW** `components/OnlineStockOverrideFields.vue` — shared nullable product / variant stock override (`{mode, customQuantity}`; clear emits both nulls).
- **NEW** `components/__tests__/OnlineStockOverrideFields.spec.ts`.
- **NEW** `components/__tests__/ProductCatalogSettingsSection.spec.ts`.
- **MOD** `views/ProductDetailView.vue` — render advanced section only with `update:Product`; pass `canReadSettings` and `useCatalogSettingsQuery(tenantId, { enabled: canReadSettings })`; PATCH stays `update:Product`-gated; never gated on settings-read; catalog-only mutation invalidates **only** `productQueryKeys.detail(tenantId, productId)`; mixed changes retain pre-existing invalidations but the catalog logic adds none.
- **MOD** `views/__tests__/ProductDetailView.test.ts` — no settings query without read; PATCH body lacks settings-only fields; only `productQueryKeys.detail` invalidated.

### TDD
- **RED** — section / settings-read gate / catalog-only invalidation tests fail.
- **GREEN** — section composition; section gated by `update:Product`; selector gated by `update:Product` AND `read:TenantCatalogSettings`; settings query gated by `canReadSettings`; catalog-only invalidation scoped to `productQueryKeys.detail(tenantId, productId)`.
- **TRIANGULATE** — mixed changes retain broader pre-existing invalidations; without settings-read no `['catalog-settings', tenantId]` is issued; compact slideover remains visually basic.
- **REFACTOR** — `ProductDetailView` stays composition-only; pure derivations in the section.

### Forbidden
- Modify `VariantDetailModal.vue` (WU6 territory); modify `src/features/catalog/**`; modify `useProductForm` mapping or Zod (WU4 territory); auto-grant `read:TenantCatalogSettings`.

### Build verification
- [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

### Commit
```text
feat(products): advanced 'Catalogo online' section and shared stock override field

Adds ProductCatalogSettingsSection (visible only with update:Product) and
the shared OnlineStockOverrideFields (reused by WU6). The per-product
public-context support selector additionally requires
read:TenantCatalogSettings and disables with the locked Spanish note
when settings-read is missing; hide-price and stock override remain
editable. useCatalogSettingsQuery is gated by read:TenantCatalogSettings.
The catalog-only product PATCH invalidates only productQueryKeys.detail.
Product PATCH itself is not gated on settings-read.
```

---

## WU6 — Persisted-Variant Catalog Controls

**Outcome**: `VariantDetailModal` exposes the catalog publication mode and the nullable stock override pair for persisted variants only, reusing `OnlineStockOverrideFields.vue` from WU5. Create / inline / pending variant paths untouched.
**Dependency**: WU5 (REUSE `OnlineStockOverrideFields.vue`).

### Files
- **MOD** `components/VariantDetailModal.vue` — add catalog publication mode selector (`INHERIT` / `ON` / `OFF`, Spanish: `"Heredar"` / `"Publicado"` / `"Oculto"`) and mount WU5's `OnlineStockOverrideFields` instance for the stock override. Controls appear only for persisted variants. New / pending / inline variants keep their existing form.
- **REUSE** `OnlineStockOverrideFields.vue` from WU5 (no copy).
- **NEW** `components/__tests__/VariantDetailModal.catalog.spec.ts` — modes round-trip on persisted variants; stock override round-trip; custom `0` preserved; clear sends both nulls; PATCH only contains changed flat keys; variants key is the only invalidation; create / inline payloads emit no `catalogPublishMode` / `onlineStockPresentation` / `onlineStockPresentationCustomQty`.

### TDD
- **RED** — persisted-variant tests fail because the modal does not yet know the catalog fields; create-path tests fail because the omit-keys assertion cannot yet run.
- **GREEN** — extend the modal to mount the new section only for persisted variants; wire `toVariantPatchCatalogPayload` only along the persisted branch.
- **TRIANGULATE** — clear-after-existing-stock path sends both nulls; mode change without stock change emits no stock keys; variant PATCH invalidates only `productQueryKeys.variants`.
- **REFACTOR** — modal stays composition-only; helpers stay pure.

### Forbidden
- Any product section edit outside the persisted-variant branch; mutating create / inline variant builders; any mutation invalidating POS price lists or any public-catalog key; any new copy of `OnlineStockOverrideFields.vue` (reuse WU5's).

### Build verification
- [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

### Commit
```text
feat(products): persisted-variant catalog controls

Extends VariantDetailModal to expose catalogPublishMode (INHERIT/ON/OFF)
and the nullable stock override pair for persisted variants only,
reusing OnlineStockOverrideFields from WU5. toVariantPatchCatalogPayload
emits changed flat keys only; clearing sends both nulls; custom '0' is
preserved. Create / inline variant payloads do not include
catalogPublishMode or the stock override fields. Variant PATCH
invalidates only productQueryKeys.variants. No broad invalidation.
```

---

## Cross-Slice Verification & Isolation

- [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

- `pnpm test:unit --run` across the full suite. The known unrelated POS / reka-ui teardown process-exit blocker, if it persists, is recorded with passing assertions and the environmental non-clean exit. This change does **not** modify, hide, or repair that issue.
- `pnpm build`: type-check + Vite build; record both exits.
- Audit every REQ in `specs/online-catalog-backoffice/spec.md` with status + evidence `file:line`.
- Add focused mocked authenticated-browser evidence at narrow and wide widths for `TenantCatalogSettingsView` (≥ 375×667 and ≥ 1280×800).
- `src/features/catalog/**` and `openspec/changes/online-catalog-publishing/**` remain untouched.
- Apply-phase never-touches: `src/features/catalog/**`, `src/features/system/notifications/**`, `src/features/admin/tenants/**`, `src/assets/main.css`, `vite.config.ts`, any new `package.json` dependency, `openspec/changes/online-catalog-publishing/**`, `HIDDEN_SUBJECTS`, and any key under `productQueryKeys.globalPriceLists()` / `src/features/catalog/**`.
- Every WU's `git revert` removes exactly its listed files without touching unrelated work. No WU touches a database, environment, dependency, or backend endpoint rollout.
