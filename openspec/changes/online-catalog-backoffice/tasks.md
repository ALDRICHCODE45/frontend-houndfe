# Tasks — Online Catalog Backoffice

No-PR workflow; sequential local reviewable Conventional Commits; no `size:exception`. Each unit gates on its focused Vitest files plus `pnpm build`. `ask-on-risk` is the stop rule only when a measured slice approaches or exceeds 400 lines. WU2 was split into WU2A / WU2B / WU2C per the user's `ask-on-risk` decision rather than invoking `size:exception`.

## Workload Forecast

| Field | Value |
|-------|-------|
| Per-slice maxima | WU1 ≤ 150; WU2A ≤ 320; WU2B ≤ 380; WU2C ≤ 360; WU3A ≤ 360; **WU3B ≤ 380**; WU4 ≤ 320; **WU5 ≤ 380**; WU6 ≤ 360. Every slice strictly under 380. |
| 400-line risk | Low per slice. Stop rule: any measured slice approaching / exceeding 400 pauses for a delivery decision. |
| Chained PRs | No — user does not use PRs. |
| Split | WU1 → WU2A → WU2B → WU2C → WU3A → WU3B; WU4 → WU5 → WU6. |
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
WU1 -> WU2A -> WU2B -> WU2C -> WU3A -> WU3B
WU4 -> WU5 -> WU6
```

WU1 locks typed subject names. WU2A ships DTOs, whitelisted-body GET/PATCH API, and the centralized tenant-scoped query key. WU2B ships pure catalog-settings mappers — table-driven during apply to fit ≤ 380 without dropping normative coverage. WU2C ships read / mutation composables with surgical invalidation and no optimistic publication update. WU3A creates the routed read-only view and registers route + sidebar. WU3B layers the editable form, publish-confirmation modal, mutation lifecycle, and `useCatalogPriceListCandidatesQuery`. WU5 introduces `OnlineStockOverrideFields.vue`; WU6 reuses it strictly after WU5.

## Work Units

| # | Slice | Max | Runtime scenario | Rollback boundary |
|---|-------|----:|------------------|-------------------|
| WU1 | Auth subject registration | ≤150 | N/A — pure registry; runtime ships with WU3A. | `git revert` `auth.types.ts`, `ability.ts`, `permissions.ts`, and the three MOD test files. |
| WU2A | Settings types + GET/PATCH API + query key | ≤320 | N/A — transport boundary; runtime ships with WU3A. | Remove new types / API / query-key files; no consumer depends yet. |
| WU2B | Pure catalog-settings mappers (table-driven) | ≤380 | N/A — pure mapper; runtime ships with WU3A. | Remove the mapper file + its test. |
| WU2C | Settings query + mutation composables | ≤360 | N/A — transport composables; runtime ships with WU3B. | Remove the two composable files + their tests. |
| WU3A | Routed read-only view + route + sidebar entry | ≤360 | Dev tenant with `read:TenantCatalogSettings`: skeleton → accepted read-only; revoked ⇒ `/403`. | `git revert` view, read view, route, sidebar, tests. WU2 chain stays inert. |
| WU3B | Editable form + confirmation + mutation + candidate composable | ≤380 | Dev tenant with both perms: `false → true` save opens `ConfirmModal`; Accept rehydrates from `priceContexts`; descending edge saves without modal; missing `read:GlobalPriceList` disables only the contexts field. | `git revert` editable components, candidate composable, mutation wiring, confirmation, tests. WU3A remains routed read-only. |
| WU4 | Product / variant typed flat-field round-trip (no view changes) | ≤320 | N/A — pure mapping; runtime ships with WU5 / WU6. | `git revert` new product / variant flat-field types, mapping, form schema additions. `includeInOnlineCatalog` preserved. |
| WU5 | Advanced "Catálogo online" section in `ProductDetailView` + `OnlineStockOverrideFields.vue` | ≤380 | Open `ProductDetailView`: toggle hide-price + save; PATCH body lacks `supportsAllCatalogPriceLists`; only `productQueryKeys.detail` invalidated. | `git revert` advanced section, `ProductDetailView` change, `OnlineStockOverrideFields`, tests. WU6 cannot run until WU5 lands. |
| WU6 | Persisted-variant catalog publication + stock override (reuses `OnlineStockOverrideFields.vue` from WU5) | ≤360 | Open `VariantDetailModal` on persisted variant: toggle publication mode → save → PATCH body only contains the changed flat key; variants key is the only invalidation. | `git revert` modal changes and tests. Create / inline variants untouched. |

A slice is done when its focused command exits 0 and `pnpm build` (vue-tsc + vite) exits 0. Runtime is concrete or explicit `N/A` per the work-unit commit discipline. Focused commands are in the per-WU sections.

## Shared Rules (apply to every WU)

- **TDD**: RED → GREEN → TRIANGULATE → REFACTOR. **Build verification**: focused command and `pnpm build` both exit 0.
- **Vue 3**: Composition API + `<script setup lang="ts">`; explicit `defineProps` / `defineEmits` / `defineModel`; `computed` for derivations; route views are composition surfaces; single responsibility per child component; co-located `*.spec.ts` next to implementation.
- **SFC tests**: any Nuxt UI primitive mounts via `src/test/mountWithUApp.ts` (`mountWithUApp<T>`), not `mount()`.
- **Mocking**: `vi.mock('axios')` at the top of API test files; `http.{post,get,patch,put,delete}` via `vi.fn()`. CASL tests use a fresh `AbilityBuilder` per scenario; never share across slices.
- **Auth touch points**: `ability.ts` (`APP_SUBJECTS`), `auth.types.ts` (`AppSubject`), `permissions.ts` (Spanish copy, tested by `permissions.spec.ts`), `router/index.ts`, `navigation.registry.ts`.
- **Mutations stay surgical**: settings PATCH invalidates `catalogSettingsQueryKeys.detail` only; product catalog-only PATCH invalidates `productQueryKeys.detail` only; variant PATCH invalidates `productQueryKeys.variants` only. **No broad POS price-list invalidation, no public-catalog invalidation, no optimistic publication write.**
- **Flat backend fields only**: `hidePriceInOnlineCatalog`, `supportedCatalogPriceListIds`, `supportsAllCatalogPriceLists` (response-only, never sent), `onlineStockPresentation`, `onlineStockPresentationCustomQty`, plus variant `catalogPublishMode` and the same stock override pair. No nested `stockPresentationOverride`.
- **Local-only evidence**: backend guide, `openspec/config.yaml`, existing modules. **No external research.**
- **No storefront edits**: `src/features/catalog/**` and `openspec/changes/online-catalog-publishing/**` are never touched.
- **Reuse**: `ConfirmModal`, `userMessageForError`, `AppBadge`, `StatusDotBadge`, `mountWithUApp`, `productQueryKeys`, `useSafeTenantId`, notifications-pattern (structure only), `product.api.getGlobalPriceLists()`, `OnlineStockOverrideFields.vue` (NEW in WU5, reused by WU6), `VariantDetailModal`, `useProductForm`.
- **Commit discipline**: this file plans; apply materializes each slice as one Conventional Commit. Planning does NOT claim commits.

---

## WU1 — Authorization Subject Registration

**Outcome**: typed `TenantCatalogSettings` AND `GlobalPriceList` registered in `AppSubject`, runtime `APP_SUBJECTS`, and neutral Spanish copy (both labels; actions per backend). **Dependency**: none — locks typed subject names. **Max**: ≤150. **Runtime / focused cmd**: N/A — pure registry. `pnpm test:unit --run src/features/auth/authorization/__tests__/ability.test.ts src/features/auth/interfaces/__tests__/auth.types.spec.ts src/features/admin/roles/i18n/__tests__/permissions.spec.ts`.

**Files (MOD)**: `src/features/auth/interfaces/auth.types.ts` (`AppSubject` union += both subjects); `src/features/auth/authorization/ability.ts` (`APP_SUBJECTS` += both before `'all'`); `src/features/admin/roles/i18n/permissions.ts` (Spanish copy for both); `src/features/auth/authorization/__tests__/ability.test.ts`; `src/features/auth/interfaces/__tests__/auth.types.spec.ts`; `src/features/admin/roles/i18n/__tests__/permissions.spec.ts`.

**TDD**: RED — extend the three tests for both subjects; missing entries fail. GREEN — register both subjects in union, runtime registry, Spanish copy. TRIANGULATE — revocation on omission of `read:GlobalPriceList`; `tenant_catalog_settings:read` malformed-rejected; no cross-subject grant. REFACTOR — keep `parsePermissionCode` pure; inline-comment the SDD cycle.

**Forbidden**: router / navigation / query / view import; any route or sidebar edit; any edit under `src/features/system/catalog-settings/**` or `src/features/POS/**`; entry in `HIDDEN_SUBJECTS`.

**Build verification**: [x] Implement and verify the behavior. <!-- sdd-owner: implementation -->

**Commit**:
```text
feat(auth): register TenantCatalogSettings and GlobalPriceList subjects

Adds both subjects to AppSubject union and APP_SUBJECTS runtime.
Adds neutral Spanish copy in the role-permissions UI for both,
exposing only the actions the backend returns. Extends the existing
ability, auth-types, and permissions tests for typed parse,
malformed-code rejection, revocation on omission, and no cross-subject
grant.
```

---

## WU2A — Types, GET/PATCH API, and Tenant-Scoped Query Key

**Outcome**: typed DTOs (response, draft, patch body, literal unions), whitelisted-body `get` / `patch`, and the centralized tenant-scoped query key all live behind Zod validation with no consumer coupling. **Dependency**: WU1. **Max**: ≤320. **Runtime / focused cmd**: N/A — transport boundary; runtime ships with WU3A. `pnpm test:unit --run src/features/system/catalog-settings/api/__tests__/catalogSettings.api.spec.ts src/core/shared/constants/__tests__/query-keys.test.ts`.

**Files**: `src/features/system/catalog-settings/interfaces/catalog-settings.types.ts` (NEW — `OnlineStockPresentationMode`, `CatalogPublishMode`, `CatalogSettingsWarning`, `CatalogPriceContextDto`, `CatalogStockPresentationDefaultDto`, `CatalogSettingsResponseDto`, `CatalogSettingsDraft`, `CatalogSettingsPatchBody`; Zod response schema including `tenantId`, closed-set `warnings` filter, integer `customQuantity`, ISO `updatedAt`); `src/features/system/catalog-settings/api/catalogSettings.api.ts` (NEW — `getCatalogSettings` / `patchCatalogSettings` via `core/shared/api/http.ts`; exact URLs `GET /tenants/:tenantId/catalog-settings` and `PATCH /tenants/:tenantId/catalog-settings`; whitelisted body keys `catalogPublished` | `publicPriceListIds` | `catalogDefaultPriceListId` | `stockPresentationDefault`; never sends `tenantId`, `effectivePublication`, `priceContexts`, `warnings`, `updatedAt`); `src/features/system/catalog-settings/api/__tests__/catalogSettings.api.spec.ts` (NEW); `src/core/shared/constants/query-keys.ts` (MOD — add `catalogSettingsQueryKeys = { detail: (tenantId: string) => ['catalog-settings', tenantId] as const }`); `src/core/shared/constants/__tests__/query-keys.test.ts` (MOD).

**TDD**: RED — type / API / key tests fail (missing types, wrong URL, no whitelist, key not registered). GREEN — implement Zod response schema, whitelisted API, query-key entry. TRIANGULATE — unknown response fields rejected; body never includes forbidden response keys; tenant ID is the only path parameter; PATCH emits exactly the changed whitelisted keys. REFACTOR — types module pure; no Vue / Nuxt UI imports; co-locate spec.

**Forbidden**: any reference to `router/**`, `navigation/**`, or `views/**`; the candidate composable (WU2C / WU3B own it); any edit to `src/features/catalog/**`; any new external dependency; mapper / compose logic (WU2B / WU2C own those).

**Build verification**: [x] Implement and verify the behavior. <!-- sdd-owner: implementation -->

**Commit**:
```text
feat(catalog-settings): tenant settings types, API, and query key

Adds the documented DTOs (mode / publish / warning literals; response
and draft shapes; patch body type) with a Zod response schema that
strips unknown fields. Adds catalogSettingsApi.get / patch with exact
URLs and a whitelisted body that never includes tenantId /
effectivePublication / priceContexts / warnings / updatedAt. Registers
catalogSettingsQueryKeys.detail in the centralized query-keys module.
```

---

## WU2B — Pure Catalog-Settings Mappers (table-driven)

**Outcome**: pure functions for response parse, draft derivation from `priceContexts`, validation, stock normalization, dirty diff, atomic clear-last-public-context triple, rising-edge detection, closed-set warning map, and error mapper — table-driven so source + tests fit ≤ 380 without dropping normative coverage. **Dependency**: WU2A. **Max**: ≤380. **Runtime / focused cmd**: N/A — pure mapper; runtime ships with WU3A. `pnpm test:unit --run src/features/system/catalog-settings/utils/__tests__/catalogSettingsMappers.spec.ts`.

**Files**: `src/features/system/catalog-settings/utils/catalogSettingsMappers.ts` (NEW — `parseCatalogSettingsResponse`, `fromCatalogSettingsResponse` (derives `publicPriceListIds` from `priceContexts` in server order, `catalogDefaultPriceListId` from `isCatalogDefault`), `validateCatalogSettingsDraft` (publish requires non-empty allowlist + selected default), `serializeStockPresentationDefault`, `isCatalogSettingsDirty`, `isPublishRisingEdge`, `toPatchCatalogSettingsBody` (includes atomic triple on clear-last-public-context-while-published), `mapCatalogSettingsWarning` (closed set), `mapCatalogSettingsError`; source MUST be table-driven for body rules and warning codes so duplication is removed during apply); `src/features/system/catalog-settings/utils/__tests__/catalogSettingsMappers.spec.ts` (NEW — derives allowlist / default from `priceContexts` in server order; empty ⇒ `[]` allowlist, `null` default; mode matrix; `customQuantity: 0` preserved as `"Mostrar 0"`; non-custom ⇒ `customQuantity: null`; invalid publish rejected when allowlist empty OR default missing; changed-key diff; ordinary unpublish emits only `{catalogPublished: false}`; clear-last-public-context-while-published emits `{catalogPublished:false, publicPriceListIds:[], catalogDefaultPriceListId:null}`; rising-edge `prev=false & current=true`; `DEFAULT_CONTEXT_HAS_NO_VALID_PRICES` maps to Spanish copy; unknown codes map to `null`).

**TDD**: RED — table-driven fixtures cover each rule; missing derivation, missing publish-requires-default, missing atomic triple, wrong `isPublishRisingEdge` all fail. GREEN — implement mappers reading fixtures from the table; no copy-pasted per-code `if` ladders. TRIANGULATE — empty `priceContexts`; default not selected; closed-set warnings drop unknown codes; non-`CUSTOM_QUANTITY` carries non-negative integer when not null. REFACTOR — verify the table covers every documented scenario; no mapper imports Vue / Nuxt UI.

**Forbidden**: any reference to `router/**`, `navigation/**`, or `views/**`; the candidate composable (WU3B owns it); any edit to `src/features/catalog/**`; any new external dependency; HTTP / query-key composition (WU2A / WU2C own those).

**Build verification**: [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

**Commit**:
```text
feat(catalog-settings): pure catalog-settings mappers

Adds table-driven pure functions: parseResponse, fromResponse
(deriving publicPriceListIds from priceContexts in server order and
catalogDefaultPriceListId from the isCatalogDefault entry), validate,
serializeStockPresentationDefault, dirty, publishRisingEdge,
toPatchCatalogSettingsBody (incl. atomic clear-last-public-context
triple), and closed-set warning / error mappers. Custom '0' preserved
as 'Mostrar 0'; publish requires non-empty allowlist and selected
default; unknown warning codes map to null.
```

---

## WU2C — Settings Query and Mutation Composables

**Outcome**: tenant-scoped read query and PATCH mutation composables that wire the WU2A API + WU2B mappers, with surgical key invalidation, no cross-tenant placeholder, no 404-as-default fallback, no optimistic publication update. **Dependency**: WU2A, WU2B. **Max**: ≤360. **Runtime / focused cmd**: N/A — transport composables; runtime ships with WU3B. `pnpm test:unit --run src/features/system/catalog-settings/composables/__tests__/useCatalogSettingsQuery.spec.ts src/features/system/catalog-settings/composables/__tests__/useUpdateCatalogSettingsMutation.spec.ts`.

**Files**: `src/features/system/catalog-settings/composables/useCatalogSettingsQuery.ts` (NEW — `useQuery` over `getCatalogSettings`; tenant-scoped key; reactive tenant id; no 404-as-default fallback; tenant-id switch clears cached data; no `placeholderData` from another tenant); `src/features/system/catalog-settings/composables/useUpdateCatalogSettingsMutation.ts` (NEW — accepts `{ tenantId, body }` from the WU2B builder; parses the response via the WU2A Zod schema; on success invalidates **only** `catalogSettingsQueryKeys.detail(tenantId)`; never pre-flips `catalogPublished`; no `setQueryData` before response); `src/features/system/catalog-settings/composables/__tests__/useCatalogSettingsQuery.spec.ts` (NEW); `src/features/system/catalog-settings/composables/__tests__/useUpdateCatalogSettingsMutation.spec.ts` (NEW).

**TDD**: RED — query key / invalidation tests fail; tenant leakage across reactive ids fails; mutation pre-flip fails. GREEN — implement composables wiring WU2A API + WU2B mapper. TRIANGULATE — switching tenant id does NOT carry over data; mutation failure keeps the form dirty; PATCH and refetch race keeps accepted data only after settle. REFACTOR — composables keep state minimal; no `onMutate`, no `setQueryData` before response, no optimistic publication toggle anywhere.

**Forbidden**: any reference to `router/**`, `navigation/**`, or `views/**`; the candidate composable (WU3B owns it); any edit to `src/features/catalog/**`; any new external dependency; any broader invalidation key (`productQueryKeys.globalPriceLists()`, public-catalog keys, POS price-list keys).

**Build verification**: [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

**Commit**:
```text
feat(catalog-settings): settings query and mutation composables

Adds useCatalogSettingsQuery (tenant-scoped key; no 404-as-default
fallback; tenant-id switch clears cached data) and
useUpdateCatalogSettingsMutation (wires the WU2B whitelisted body and
invalidates only catalogSettingsQueryKeys.detail on success; no
optimistic publication update; no setQueryData before response).
```

---

## WU3A — Routed Read-Only View, Route, Sidebar Entry

**Outcome**: thin route-resolved view renders accepted settings read-only; route + sidebar live with the view because they belong to the same reviewable unit. **Dependency**: WU2C. **Max**: ≤360. **Runtime / focused cmd**: dev tenant with `read:TenantCatalogSettings` ⇒ skeleton → accepted read-only; revoked ⇒ `/403`. `pnpm test:unit --run src/features/system/catalog-settings/views/__tests__/TenantCatalogSettingsView.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogSettingsReadView.spec.ts src/app/router/__tests__/router.catalogBackoffice.spec.ts src/app/navigation/__tests__/navigation.catalogBackoffice.spec.ts`.

**Files**: `views/TenantCatalogSettingsView.vue` (NEW — composition surface; tenant from `useSafeTenantId`; `read:TenantCatalogSettings` for access; `useCatalogSettingsQuery` from WU2C; no DTO transformation in template); `components/CatalogSettingsReadView.vue` (NEW — read-only `catalogPublished` / `effectivePublication` / `priceContexts[]` / `stockPresentationDefault` / `updatedAt` / known warning via closed Spanish copy; empty-state copy when `priceContexts` is empty); co-located `*.spec.ts` for both SFCs (`mountWithUApp`); `src/app/router/__tests__/router.catalogBackoffice.spec.ts` (NEW); `src/app/navigation/__tests__/navigation.catalogBackoffice.spec.ts` (NEW); `src/app/router/index.ts` (MOD — one Sistema entry: `path:'/system/catalog-settings'`, `name:'system-catalog-settings'`, `layout:'dashboard'`, `meta.permission:['read','TenantCatalogSettings']`; no `skipTenantCheck`, no `requiresSuperAdmin`); `src/app/navigation/navigation.registry.ts` (MOD — Sistema entry `"Catálogo online"` gated by `'read':'TenantCatalogSettings'`).

**TDD**: RED — route test expects tuple (fails: no entry); nav test expects sidebar entry (fails: no entry); SFC test expects skeleton / retry / known warning (fails: view missing). GREEN — register route + sidebar; ship view reading from the WU2C query. TRIANGULATE — accept any GET status (incl. 404) with retry without synthetic defaults; render empty `priceContexts` with locked copy; render `effectivePublication` faithfully even when divergent; drop unknown warning codes silently. REFACTOR — view composition-only; conditional copy lives in `CatalogSettingsReadView`; reuse `AppBadge` and `USkeleton`; no new Nuxt UI primitive.

**Forbidden**: editable form components; PATCH mutation wiring; `ConfirmModal`; any code path issuing `PATCH`; candidate enumeration (WU3B); any edit under `src/features/catalog/**` or `src/features/admin/tenants/**`.

**Build verification**: [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

**Commit**:
```text
feat(catalog-settings): routed read-only tenant settings view

Registers /system/catalog-settings (system-catalog-settings, dashboard
layout, read:TenantCatalogSettings) without skipTenantCheck or
requiresSuperAdmin. Adds the Sistema sidebar entry 'Catalogo online'
gated by read:TenantCatalogSettings. The view composes the read query
and delegates UI to CatalogSettingsReadView (publication / effective /
priceContexts / default / stock / known warnings / empty-state copy).
Skeleton / error / retry covered; no synthetic defaults on 404;
unknown warning codes dropped silently.
```

---

## WU3B — Editable Form, Confirmation, Mutation, Candidate Enumeration

**Outcome**: WU3A's read-only surface gains the editable form, publish-confirmation modal, mutation, and candidate composable. Read-only behavior stays intact when only `read:TenantCatalogSettings` is held. **Dependency**: WU3A. **Max**: ≤380. **Runtime / focused cmd**: dev tenant with both perms: `false → true` save opens `ConfirmModal`; Accept rehydrates from `priceContexts`; descending edge saves without modal; missing `read:GlobalPriceList` disables only the contexts field. `pnpm test:unit --run src/features/system/catalog-settings/composables/__tests__/useCatalogSettingsForm.spec.ts src/features/system/catalog-settings/composables/__tests__/useCatalogPriceListCandidatesQuery.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogSettingsForm.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogPriceContextsField.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogStockPresentationField.spec.ts src/features/system/catalog-settings/components/__tests__/CatalogSettingsReadView.spec.ts src/features/system/catalog-settings/views/__tests__/TenantCatalogSettingsView.spec.ts`.

**Files (all NEW unless noted)**: `composables/useCatalogSettingsForm.ts` (owns `draft` / `pristine` / `accepted`; actions `acceptResponse`, `requestSave`, `confirmPublish`, `cancelPublish`; hydrates from `priceContexts` only at controlled boundaries; suppresses refetch overwrite while dirty or pending; rebuilds draft from accepted PATCH; tenant-id change clears snapshots); `composables/useCatalogPriceListCandidatesQuery.ts` (reuses `productApi.getGlobalPriceLists()` and `productQueryKeys.globalPriceLists()`; fires **only** when both `update:TenantCatalogSettings` and `read:GlobalPriceList` are granted) plus their co-located `*.spec.ts`; `components/CatalogSettingsForm.vue`, `CatalogPriceContextsField.vue`, `CatalogStockPresentationField.vue` (publish toggle / stock field / contexts field / validation summary / save footer; `canEditContexts = canUpdate && canReadGlobalPriceLists`; least-privilege explanation; preserves missing candidate IDs) plus their co-located `*.spec.ts`; `components/__tests__/CatalogSettingsReadView.spec.ts` (NEW); **MOD** `components/CatalogSettingsReadView.vue` (add the `"No tienes permisos para guardar cambios"` notice when `canUpdate === false`; no other behavior change); **MOD** `views/TenantCatalogSettingsView.vue` (read-only when `canUpdate === false`; otherwise compose with the form; success toast; error toast via `userMessageForError`; wire `ConfirmModal` for rising edge; Cancel ⇒ no PATCH, dirty draft preserved); **MOD** `views/__tests__/TenantCatalogSettingsView.spec.ts`.

**TDD**: RED — form / fields / candidate tests fail: rising-edge detection, atomic triple, default-missing blocks publish, candidate composable fires when permissions missing. GREEN — implement `useCatalogSettingsForm`, fields, candidate composable, `ConfirmModal` only on rising edge. TRIANGULATE — `Mostrar 0`; non-custom `null` quantity; Cancel keeps dirty draft editable; descending edge sends only `{catalogPublished: false}`; tenant-id change clears snapshots; missing `read:GlobalPriceList` keeps publication / stock available. REFACTOR — `ConfirmModal` opens once per rising-edge attempt; no `setQueryData` before response.

**Forbidden**: any router / navigation / product / variant edit; any request against `src/features/catalog/**`; any other confirmation strategy than the proposal-locked rising-edge two-button modal.

**Build verification**: [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

**Commit**:
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

**Outcome**: existing product and variant editing pipeline round-trips the new catalog flat fields without altering any view. Compact slideover keeps its existing basic `includeInOnlineCatalog` checkbox as sole publication control. **Dependency**: WU2 (catalog vocabulary). **Max**: ≤320. **Runtime / focused cmd**: N/A — pure mapping; runtime ships with WU5 / WU6. `pnpm test:unit --run src/features/POS/products/api/__tests__/product.api.test.ts src/features/POS/products/interfaces/__tests__/product.types.test.ts src/features/POS/products/composables/__tests__/useProductForm.payload.test.ts src/features/POS/products/composables/__tests__/useProductForm.helpers.test.ts`.

**Files (all MOD)**: `src/features/POS/products/interfaces/product.types.ts` (raw / normalized / payload / form types for `hidePriceInOnlineCatalog`, `supportedCatalogPriceListIds`, `supportsAllCatalogPriceLists` (response-only), `onlineStockPresentation`, `onlineStockPresentationCustomQty`, plus variant `catalogPublishMode`, `onlineStockPresentation`, `onlineStockPresentationCustomQty`); `src/features/POS/products/api/product.api.ts` (extend mappers; `supportsAllCatalogPriceLists` is response-only and never enters the form draft; add `toVariantPatchCatalogPayload(current, pristine)` — changed flat keys only, clearing stock emits both nulls); `src/features/POS/products/composables/useProductForm.ts` (Zod schema extended; null allowlist rejected with Spanish copy; `[]` valid; `toUpdatePayload` emits each advanced key only when changed; `supportsAllCatalogPriceLists` never sent; clear emits both stock nulls; non-custom modes null quantity; custom `0` preserved; compact-slideover edit path preserves hydrated advanced snapshot and emits no advanced key) plus the four co-located `*.test.ts` / `*.spec.ts` files.

**TDD**: RED — payload / mapping tests first: advanced keys missing, null-allowlist reject missing, read-only field present, custom `0` becomes `null`. GREEN — extend types / mapper / Zod schema / payload builder; lock `supportsAllCatalogPriceLists` never-sent contract. TRIANGULATE — order-of-fields-independence (emitted key set ⊆ whitelist); no-emit-when-unchanged; clear-stock pair (both null); custom `0` preserved; variant create / inline payloads unchanged. REFACTOR — payload builders pure; no Vue composable imports in mappers.

**Forbidden**: any view edit (`ProductDetailView.vue`, `ProductUpsertSlideover.vue`, `VariantDetailModal.vue`); any edit to `src/features/catalog/**`; candidate enumeration.

**Build verification**: [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

**Commit**:
```text
feat(products): product / variant typed flat-field round-trip

Extends product / variant types, mapping, and form schema to round-trip
hidePriceInOnlineCatalog, supportedCatalogPriceListIds,
supportsAllCatalogPriceLists (response-only), onlineStockPresentation,
onlineStockPresentationCustomQty, plus variant catalogPublishMode and
the same stock override pair. toUpdatePayload emits each changed
advanced flat key only; supportsAllCatalogPriceLists is never sent.
supportedCatalogPriceListIds=null is rejected with Spanish validation;
[] is valid. Custom '0' preserved; non-custom override modes emit null
quantity; clearing emits both nulls. Compact slideover preserves the
hydrated advanced snapshot and does not emit advanced keys.
```

---

## WU5 — Advanced "Catálogo online" Section

**Outcome**: full product editor exposes the new advanced catalog section. Hide-price and stock override respond to `update:Product`; per-product public-context support selector additionally requires `read:TenantCatalogSettings` and disables with the locked Spanish note when settings-read is missing. `OnlineStockOverrideFields.vue` ships here so WU6 can reuse it. **Dependency**: WU4. **Max**: ≤380. **Runtime / focused cmd**: open `ProductDetailView` ⇒ toggle hide-price + save; PATCH body lacks `supportsAllCatalogPriceLists`; only `productQueryKeys.detail` invalidated. `pnpm test:unit --run src/features/POS/products/views/__tests__/ProductDetailView.test.ts src/features/POS/products/components/__tests__/ProductCatalogSettingsSection.spec.ts src/features/POS/products/components/__tests__/OnlineStockOverrideFields.spec.ts`.

**Files**: `components/ProductCatalogSettingsSection.vue` (NEW — full-editor composition surface for hide-price, stock override, per-product public-context support selector, read-only `supportsAll` indicator) + `components/__tests__/ProductCatalogSettingsSection.spec.ts` (NEW); `components/OnlineStockOverrideFields.vue` (NEW — shared nullable product / variant stock override `{mode, customQuantity}`; clear emits both nulls) + `components/__tests__/OnlineStockOverrideFields.spec.ts` (NEW); `views/ProductDetailView.vue` (MOD — render advanced section only with `update:Product`; pass `canReadSettings` and `useCatalogSettingsQuery(tenantId, { enabled: canReadSettings })`; PATCH stays `update:Product`-gated; never gated on settings-read; catalog-only mutation invalidates **only** `productQueryKeys.detail(tenantId, productId)`; mixed changes retain pre-existing invalidations but the catalog logic adds none); `views/__tests__/ProductDetailView.test.ts` (MOD — no settings query without read; PATCH body lacks settings-only fields; only `productQueryKeys.detail` invalidated).

**TDD**: RED — section / settings-read gate / catalog-only invalidation tests fail. GREEN — section composition; section gated by `update:Product`; selector gated by `update:Product` AND `read:TenantCatalogSettings`; settings query gated by `canReadSettings`; catalog-only invalidation scoped to `productQueryKeys.detail(tenantId, productId)`. TRIANGULATE — mixed changes retain broader pre-existing invalidations; without settings-read no `['catalog-settings', tenantId]` is issued; compact slideover remains visually basic. REFACTOR — `ProductDetailView` stays composition-only; pure derivations in the section.

**Forbidden**: modify `VariantDetailModal.vue` (WU6 territory); modify `src/features/catalog/**`; modify `useProductForm` mapping or Zod (WU4 territory); auto-grant `read:TenantCatalogSettings`.

**Build verification**: [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

**Commit**:
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

**Outcome**: `VariantDetailModal` exposes the catalog publication mode and the nullable stock override pair for persisted variants only, reusing `OnlineStockOverrideFields.vue` from WU5. Create / inline / pending variant paths untouched. **Dependency**: WU5 (REUSE `OnlineStockOverrideFields.vue`). **Max**: ≤360. **Runtime / focused cmd**: open `VariantDetailModal` on a persisted variant ⇒ toggle publication mode → save → PATCH body only contains the changed flat key; variants key is the only invalidation. `pnpm test:unit --run src/features/POS/products/components/__tests__/VariantDetailModal.catalog.spec.ts`.

**Files**: `components/VariantDetailModal.vue` (MOD — add catalog publication mode selector `INHERIT` / `ON` / `OFF`, Spanish: `"Heredar"` / `"Publicado"` / `"Oculto"`, and mount WU5's `OnlineStockOverrideFields` instance for the stock override; controls appear only for persisted variants; new / pending / inline variants keep their existing form); **REUSE** `OnlineStockOverrideFields.vue` from WU5 (no copy); `components/__tests__/VariantDetailModal.catalog.spec.ts` (NEW — modes round-trip on persisted variants; stock override round-trip; custom `0` preserved; clear sends both nulls; PATCH only contains changed flat keys; variants key is the only invalidation; create / inline payloads emit no `catalogPublishMode` / `onlineStockPresentation` / `onlineStockPresentationCustomQty`).

**TDD**: RED — persisted-variant tests fail because the modal does not yet know the catalog fields; create-path tests fail because the omit-keys assertion cannot yet run. GREEN — extend the modal to mount the new section only for persisted variants; wire `toVariantPatchCatalogPayload` only along the persisted branch. TRIANGULATE — clear-after-existing-stock path sends both nulls; mode change without stock change emits no stock keys; variant PATCH invalidates only `productQueryKeys.variants`. REFACTOR — modal stays composition-only; helpers stay pure.

**Forbidden**: any product section edit outside the persisted-variant branch; mutating create / inline variant builders; any mutation invalidating POS price lists or any public-catalog key; any new copy of `OnlineStockOverrideFields.vue` (reuse WU5's).

**Build verification**: [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->

**Commit**:
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

`pnpm test:unit --run` across the full suite. The known unrelated POS / reka-ui teardown process-exit blocker, if it persists, is recorded with passing assertions and the environmental non-clean exit. This change does **not** modify, hide, or repair that issue. `pnpm build`: type-check + Vite build; record both exits. Audit every REQ in `specs/online-catalog-backoffice/spec.md` with status + evidence `file:line`. Add focused mocked authenticated-browser evidence at narrow and wide widths for `TenantCatalogSettingsView` (≥ 375×667 and ≥ 1280×800). `src/features/catalog/**` and `openspec/changes/online-catalog-publishing/**` remain untouched.

Apply-phase never-touches: `src/features/catalog/**`, `src/features/system/notifications/**`, `src/features/admin/tenants/**`, `src/assets/main.css`, `vite.config.ts`, any new `package.json` dependency, `openspec/changes/online-catalog-publishing/**`, `HIDDEN_SUBJECTS`, and any key under `productQueryKeys.globalPriceLists()` / `src/features/catalog/**`. WU2 split: WU2A owns types / API / query-key; WU2B owns pure mappers (table-driven to fit ≤ 380); WU2C owns composables; each slice is independently revertible. Every WU's `git revert` removes exactly its listed files without touching unrelated work. No WU touches a database, environment, dependency, or backend endpoint rollout.
