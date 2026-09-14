# Design: Online Catalog Backoffice

## Outcome and boundaries

Add authenticated catalog settings for the current tenant, advanced catalog fields in the full product editor, and catalog controls for persisted variants. Server responses remain authoritative; publishing is never optimistic.

Authorities are local only: the proposal/spec, `openspec/config.yaml`, the backend consumer guide, and existing notification/product/auth/router/navigation code. No external research or new dependency is required.

Explicit non-goals:

- No edits under `src/features/catalog/**` or to `openspec/changes/online-catalog-publishing/**`.
- No public browse/detail/cart/checkout/order/WhatsApp behavior or public price-context chooser.
- No variant price-list allowlist, super-admin tenant editor, optimistic publication, design-token/global CSS, or infrastructure change.
- No catalog fields in new, pending, or inline variant flows.
- No work on the unrelated POS/reka-ui teardown process-exit blocker.

## Architecture

Create `src/features/system/catalog-settings/` with `interfaces`, `api`, `utils`, `composables`, `components`, `views`, and co-located tests. Follow Vue 3 Composition API with `<script setup lang="ts">`; route views compose state, child components present one concern, and pure mappers own validation/diff logic.

Register `/system/catalog-settings` as `system-catalog-settings`, dashboard layout, with `meta.permission: ['read', 'TenantCatalogSettings']`. Do not set `skipTenantCheck` or `requiresSuperAdmin`. Add a Sistema navigation entry labeled `Catálogo online` with the same read gate.

Reuse the authenticated `http` client, centralized query keys, `ConfirmModal`, `AppBadge`, Nuxt UI controls/skeletons, `userMessageForError`, `mountWithUApp`, the notification-settings structure, and existing product APIs. Add no core shared UI primitive.

## Backend contracts

### Tenant settings

```ts
type OnlineStockPresentationMode =
  | 'SYSTEM_STATUS'
  | 'ABSTRACT_STATUS'
  | 'CUSTOM_QUANTITY'
  | 'HIDDEN'

type CatalogSettingsWarning = 'DEFAULT_CONTEXT_HAS_NO_VALID_PRICES'

interface CatalogPriceContextDto {
  priceListId: string
  name: string
  isCatalogDefault: boolean
}

interface CatalogStockPresentationDefaultDto {
  mode: OnlineStockPresentationMode
  customQuantity: number | null
}

interface CatalogSettingsResponseDto {
  tenantId: string
  catalogPublished: boolean
  effectivePublication: boolean
  priceContexts: CatalogPriceContextDto[]
  stockPresentationDefault: CatalogStockPresentationDefaultDto
  warnings: CatalogSettingsWarning[]
  updatedAt: string
}

interface CatalogSettingsPatchBody {
  catalogPublished?: boolean
  publicPriceListIds?: string[]
  catalogDefaultPriceListId?: string | null
  stockPresentationDefault?: CatalogStockPresentationDefaultDto
}
```

Endpoints and permissions:

| Method | Path | Permission |
|---|---|---|
| GET | `/tenants/:tenantId/catalog-settings` | `read:TenantCatalogSettings` |
| PATCH | `/tenants/:tenantId/catalog-settings` | `update:TenantCatalogSettings` |

GET and PATCH responses use the exact response shape above. PATCH sends changed whitelisted keys only; it never sends `tenantId`, `effectivePublication`, `priceContexts`, `warnings`, or `updatedAt`. An empty body is not sent.

The API boundary parses unknown data with Zod. Required fields and stock constraints are validated; unrelated response keys are stripped. Wire warnings are accepted as strings and filtered to the closed local literal set so future unknown codes do not invalidate an otherwise valid response.

`DEFAULT_CONTEXT_HAS_NO_VALID_PRICES` maps locally to `El contexto de catálogo por defecto no tiene precios válidos`. It is read-only and warn-only: it never blocks Save, creates a fallback price, or renders a server-supplied message. Unknown warning codes are dropped silently.

`effectivePublication` is displayed exactly as returned (`tenant.active && catalogPublished`) and is never recomputed by the client.

### Product fields

Authenticated product reads/create/PATCH support these flat fields:

```ts
includeInOnlineCatalog: boolean
hidePriceInOnlineCatalog: boolean
supportedCatalogPriceListIds: string[]
supportsAllCatalogPriceLists: boolean // response-only
onlineStockPresentation: OnlineStockPresentationMode | null
onlineStockPresentationCustomQty: number | null
```

`[]` means all tenant-public contexts. Explicit `null` for `supportedCatalogPriceListIds` is invalid and blocks submission with Spanish validation. `supportsAllCatalogPriceLists` is displayed read-only and never sent.

The compact `ProductUpsertSlideover.vue` keeps only `includeInOnlineCatalog`; unseen advanced values are preserved and unchanged advanced keys are omitted. The full create builder may carry backend-supported advanced values from the full form.

### Variant fields

Persisted variant reads/PATCH support:

```ts
type CatalogPublishMode = 'INHERIT' | 'ON' | 'OFF'

catalogPublishMode: CatalogPublishMode
onlineStockPresentation: OnlineStockPresentationMode | null
onlineStockPresentationCustomQty: number | null
```

`INHERIT` is distinct from `OFF`. These fields are PATCH-only: create, pending, and inline variant payloads omit them.

### Stock normalization

- `CUSTOM_QUANTITY` requires a non-negative integer; `0` is preserved and labeled `Mostrar 0`.
- Other explicit modes serialize quantity as `null`.
- Tenant default mode is never null.
- Product/variant overrides may be cleared only by sending both flat stock fields as `null`.
- Presentation copy never claims operational inventory or fulfillment availability.

## Mapping contracts

```ts
parseCatalogSettingsResponse(raw): CatalogSettingsResponseDto
fromCatalogSettingsResponse(response): CatalogSettingsDraft
toPatchCatalogSettingsBody(draft, pristine): CatalogSettingsPatchBody
isCatalogSettingsDirty(draft, pristine): boolean
isPublishRisingEdge(pristine, draft): boolean
serializeStockPresentationDefault(value): CatalogStockPresentationDefaultDto
mapCatalogSettingsWarning(code): string | null
mapCatalogSettingsError(error): { field?: CatalogSettingsField; toast: string }

fromProductRawAdvancedCatalog(raw): ProductAdvancedCatalogForm
toProductPatchAdvancedCatalogPayload(current, pristine): ProductPatchSubset
fromVariantRawCatalog(raw): VariantCatalogForm
toVariantPatchCatalogPayload(current, pristine): VariantPatchSubset
```

Settings hydration derives `publicPriceListIds` from every `priceContexts[].priceListId` in server order and derives `catalogDefaultPriceListId` from the `isCatalogDefault: true` entry, or `null`. Empty contexts produce `[]` and `null`.

Settings validation requires unique non-empty IDs, any non-null default to belong to the selected IDs, and publication to have at least one context plus a selected default. Product/variant mappers emit changed flat keys only and preserve custom zero.

## Permissions

Add `TenantCatalogSettings` to `AppSubject` and `APP_SUBJECTS`, with role UI copy for exactly backend-documented `read` and `update`. Register the existing backend `GlobalPriceList` subject in both typed/runtime registries if still absent so its read gate cannot be silently dropped. Neither subject belongs in `HIDDEN_SUBJECTS`.

| Surface/action | Required CASL grants | Missing-grant behavior |
|---|---|---|
| Sidebar, route, settings GET | `read:TenantCatalogSettings` | Entry hidden; direct route redirects to `/403`. |
| Publication and tenant stock edits | `update:TenantCatalogSettings` | Controls and Save disabled; show `No tienes permisos para guardar cambios`. |
| Enumerate global candidates | `update:TenantCatalogSettings` + `read:GlobalPriceList` | Issue no candidate request. |
| Add/remove contexts or change default | `update:TenantCatalogSettings` + `read:GlobalPriceList` | Preserve/display accepted contexts/default read-only and explain that global-list read is required; publication/stock remain independently available when valid. |
| Product advanced section | `update:Product` | Section absent without it. |
| Product hide-price/stock override | `update:Product` | Independent of settings/global-list read. |
| Product context selector | `update:Product` + `read:TenantCatalogSettings` | Disabled with the locked explanatory note when settings-read is missing; other product controls remain editable. |
| Product PATCH | `update:Product` | Never additionally gated by settings/global-list read. |
| Persisted variant controls | `update:Product` | Disabled without it. |

No permission implies another, and the frontend never mutates or auto-grants CASL rules. The product selector uses settings `priceContexts`; it does not require or query `read:GlobalPriceList`.

## Candidate and query boundaries

```ts
catalogSettingsQueryKeys.detail(tenantId) // ['catalog-settings', tenantId]
productQueryKeys.globalPriceLists()       // candidates only
productQueryKeys.detail(tenantId, productId)
productQueryKeys.variants(tenantId, productId)
```

`useCatalogSettingsQuery` takes reactive tenant ID/enabled inputs, uses no cross-tenant placeholder, and treats every non-2xx response including 404 as an error; it never fabricates defaults.

`useCatalogPriceListCandidatesQuery` reuses `productApi.getGlobalPriceLists()` and its existing key. It is enabled only with settings-update plus `read:GlobalPriceList`. Returned lists are add candidates only: current public membership/default always comes from `priceContexts`, and candidate presence never proves public or write eligibility.

The product editor enables the settings query only with `read:TenantCatalogSettings`. Missing permission causes no settings request.

## Settings state and mutation lifecycle

`useCatalogSettingsForm` owns:

- `draft`: editable intent.
- `pristine`: last accepted editable snapshot.
- `accepted`: server `catalogPublished`, `effectivePublication`, `priceContexts`, filtered warnings, stock default, and `updatedAt`.
- computed validation, dirty, rising-edge, and save gates.

Lifecycle:

1. Initial valid GET sets accepted/pristine/draft together from `priceContexts`.
2. Dirty or mutation-pending state defers query re-hydration instead of overwriting local intent.
3. Successful PATCH is accepted directly; draft/pristine are rebuilt from its response, not the submitted body.
4. Then invalidate only `catalogSettingsQueryKeys.detail(tenantId)` and accept the newest refetch only if no newer local edit exists.
5. Tenant change clears all snapshots before new hydration.
6. Failure keeps the dirty draft and surfaces safe local Spanish error copy.
7. No `onMutate`, pre-response cache write, or optimistic publication status is allowed.

Editable publication intent and accepted publication/effective badges are separate. The switch may show pending intent, but accepted status changes only after the server response.

### Save and confirmation

```text
Save
 -> invalid, pristine, read-only, or pending: no request
 -> descending edge or non-publication edit: PATCH directly
 -> accepted false and draft true: open ConfirmModal, no PATCH yet
    -> Cancel: close modal; keep dirty draft; accepted state unchanged
    -> Confirm: send one whitelisted PATCH
```

Use the unchanged two-button `ConfirmModal` with title `Publicar catálogo online` and body `El catálogo será visible para clientes públicos. ¿Continuar?`. No typed text or multi-step flow.

If an accepted published configuration loses its last public context, clear the default and publication intent and send one atomic PATCH:

```ts
{
  catalogPublished: false,
  publicPriceListIds: [],
  catalogDefaultPriceListId: null,
}
```

Never split this action into multiple requests or show the rising-edge modal. Ordinary unpublish preserves configured contexts/default and sends only changed keys.

## Product and variant mutation lifecycle

`productToFormInput`/API mappers retain all product fields. Advanced product payloads diff against a pristine advanced snapshot, remain flat, omit `supportsAllCatalogPriceLists`, reject a null allowlist, send explicit null stock clears, and preserve zero.

A catalog-only product PATCH invalidates only `productQueryKeys.detail(tenantId, productId)`. A mixed save may retain existing invalidations needed by changed non-catalog fields, but catalog logic adds no global-price-list, variants, or public-catalog invalidation.

`VariantDetailModal.vue` adds `Heredar`/`Publicado`/`Oculto` and the nullable stock override only for a persisted variant. Its changed-only PATCH invalidates only `productQueryKeys.variants(tenantId, productId)`.

## Components and states

| Component | Responsibility |
|---|---|
| `TenantCatalogSettingsView.vue` | Thin query/auth/retry/toast/confirmation composition. |
| `CatalogSettingsReadView.vue` | Accepted publication/effective status, contexts/default, stock default, warnings, timestamp, and empty state. |
| `CatalogSettingsForm.vue` | Editable publication, contexts, stock, validation, and Save composition. |
| `CatalogPriceContextsField.vue` | Candidate-backed context/default editing with independent global-list permission/error gates. |
| `CatalogStockPresentationField.vue` | Required tenant mode and conditional quantity. |
| `ProductCatalogSettingsSection.vue` | Full-editor hide-price, supported contexts, read-only supports-all, and stock override. |
| `OnlineStockOverrideFields.vue` | Reusable nullable product/variant override pair. |
| `VariantDetailModal.vue` | Existing persisted-variant PATCH owner. |

Settings view states:

- Loading: `USkeleton`; no enabled controls or synthetic values.
- GET error: safe inline message and `Reintentar`; no hydrated form.
- Read-only: accepted values visible and mutation controls disabled.
- Missing global-list read/candidate error: contexts/default remain visible; context editing disabled; publication/stock remain available; authorized candidate failures offer retry.
- Empty contexts: `Sin listas públicas: la configuración no se mostrará públicamente`.
- Pending: controls/retry/modal dismissal disabled; accepted status unchanged.
- Success: accepted-response hydration and `Configuración de catálogo guardada`.
- Failure: draft retained and safe error toast.
- Effective false while catalog flag true: show both faithfully and explain tenant status also controls effective publication.

Product context query loading/error affects only its selector. Empty supported IDs show `Soporta todos los contextos públicos del tenant`. Missing settings-read shows `Configura los contextos públicos del tenant en Sistema > Catálogo online para habilitar esta selección` while hide-price/stock remain editable.

## Work units and delivery

Delivery is strictly sequential. WU4 starts after WU3B; WU6 reuses the component introduced by WU5.

```text
WU1 -> WU2 -> WU3A -> WU3B
WU4 -> WU5 -> WU6
```

| Unit | Binding boundary | Maximum |
|---|---|---:|
| WU1 | Typed/runtime subjects and role copy only. | 150 |
| WU2 | Settings DTO/parser/mappers/API/query/mutation/key; no candidates or route. | 320 |
| WU3A | Routed read-only view plus route/navigation. | 360 |
| WU3B | Editable form, candidate gate, mutation UI, confirmation, atomic clear. | 380 |
| WU4 | Product/variant flat types, mapping, validation, payload helpers; no views. | 320 |
| WU5 | Full product advanced section and shared override component. | 380 |
| WU6 | Persisted-variant controls reusing WU5; create/inline untouched. | 360 |

Each unit follows RED -> GREEN -> TRIANGULATE -> REFACTOR and gates on its focused Vitest files plus `pnpm build` (vue-tsc and Vite). Actual line accounting controls; `ask-on-risk` pauses before any unit reaches 400, with no inferred chain strategy or `size:exception`.

Final verification reruns the full unit suite and reports exact outcomes. If the known unrelated POS/reka-ui teardown non-clean exit remains after passing assertions, report it honestly without modifying this change to absorb it. Verify also records mocked authenticated narrow (at least 375x667) and wide (at least 1280x800) settings evidence, including read-only, editable, missing-global-list-read, and publish-confirmation states.

No implementation, test, build, browser run, commit, deployment, or backend change is performed by this design artifact.
