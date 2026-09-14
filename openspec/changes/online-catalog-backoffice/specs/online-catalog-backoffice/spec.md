# Online Catalog Backoffice Specification

Domain: `online-catalog-backoffice` · Authenticated backoffice configuration of the online catalog — tenant publication policy, public/default price contexts, tenant stock-presentation default, plus product- and existing-variant-level catalog overrides. Out of scope: public storefront (`src/features/catalog/**`), the active `online-catalog-publishing` change, super-admin `/admin/tenants` editing.

## Purpose

Provide tenant operators and product editors a typed, permission-gated configuration surface mirroring the backend contract guide (`houndfe-backend/docs/backend-responses/public-online-catalog-frontend-guide.md`). Publishing is externally visible: every `catalogPublished` rising edge MUST require explicit confirmation; `effectivePublication` and any warning MUST surface read-only so the UI never claims a public consequence the tenant does not actually have. The frontend is configuration only — it MUST NOT enumerate, project, or compute public storefront browse/detail/cart behavior.

## Backend contract (consume only)

| Verb | Path | Perm | Body / Response |
|---|---|---|---|
| GET | `/tenants/:tenantId/catalog-settings` | `read:TenantCatalogSettings` | `{ catalogPublished: boolean, effectivePublication: boolean, priceContexts: Array<{ priceListId: string, name: string, isCatalogDefault: boolean }>, stockPresentationDefault: { mode: "SYSTEM_STATUS" \| "ABSTRACT_STATUS" \| "CUSTOM_QUANTITY" \| "HIDDEN", customQuantity: number \| null }, warnings: "DEFAULT_CONTEXT_HAS_NO_VALID_PRICES"[], updatedAt: string }` |
| PATCH | `/tenants/:tenantId/catalog-settings` | `update:TenantCatalogSettings` | Whitelisted body `{ catalogPublished?: boolean, publicPriceListIds?: string[], catalogDefaultPriceListId?: string \| null, stockPresentationDefault?: { mode, customQuantity: number \| null } }` → returns the GET view shape |
| PATCH | `/products/:productId` | `update:Product` | Flat fields `hidePriceInOnlineCatalog: boolean`, `supportedCatalogPriceListIds: string[]` (explicit `null` invalid; `[]` = all tenant-public contexts), `supportsAllCatalogPriceLists: boolean` (read-only, derived), `onlineStockPresentation: mode \| null`, `onlineStockPresentationCustomQty: number \| null` |
| PATCH | `/products/:productId/variants/:variantId` | `update:Product` | Flat fields `catalogPublishMode: "INHERIT" \| "ON" \| "OFF"`, `onlineStockPresentation: mode \| null`, `onlineStockPresentationCustomQty: number \| null`. PATCH-only |

`effectivePublication` equals `tenant.active && catalogPublished`. `priceContexts` is authoritative; separate `publicPriceListIds` / `catalogDefaultPriceListId` properties are NOT exposed. `warnings` is a closed string-literal array; only `DEFAULT_CONTEXT_HAS_NO_VALID_PRICES` is contracted. The UI MUST map that known code to local Spanish copy and MUST NOT render arbitrary server messages — unknown codes are dropped silently. `DEFAULT_CONTEXT_HAS_NO_VALID_PRICES` is warn-only and MUST NOT block save.

## Requirements

### REQ-1: Catalog permission subject registration
`'TenantCatalogSettings'` and the backend-existing `'GlobalPriceList'` SHALL be members of the `AppSubject` union in `src/features/auth/interfaces/auth.types.ts` and present in the `APP_SUBJECTS` runtime registry in `src/features/auth/authorization/ability.ts`. Documented permission codes SHALL parse into typed tuples, grants SHALL remain subject-specific, and omission SHALL revoke cleanly. Neither subject MAY be auto-granted or hidden through `HIDDEN_SUBJECTS`.

#### Scenario: registered subjects compile and grant independently
- GIVEN both subjects are in `AppSubject` and `APP_SUBJECTS`
- WHEN `updateAbilityFromPermissionCodes(['read:TenantCatalogSettings', 'read:GlobalPriceList'])` runs
- THEN `ability.can('read', 'TenantCatalogSettings')` is true AND `ability.can('read', 'GlobalPriceList')` is true
- AND other actions remain false unless returned explicitly

#### Scenario: revoked on omission
- GIVEN both read permissions were granted in a prior update
- WHEN `updateAbilityFromPermissionCodes` runs again without `read:GlobalPriceList`
- THEN `ability.can('read', 'GlobalPriceList')` is false AND any unrelated granted permission remains granted

### REQ-2: Spanish subject + action copy in role UI
The role-permissions UI SHALL expose `TenantCatalogSettings` under "Catálogo online del tenant" with ONLY `read` and `update` actions, and SHALL render `GlobalPriceList` with only the actions returned by backend. Neither subject SHALL be listed in `HIDDEN_SUBJECTS`; the frontend SHALL NOT synthesize or auto-grant actions.

#### Scenario: role UI preserves backend action boundaries
- GIVEN the role-permissions page receives `read` and `update` for `TenantCatalogSettings` plus `read` for `GlobalPriceList`
- WHEN sections render
- THEN "Catálogo online del tenant" contains exactly `read` and `update`
- AND the global-price-list section contains the returned `read` action
- AND no unreturned action is fabricated

### REQ-3: Sidebar entry visibility
The Sistema sidebar SHALL render a "Catálogo online" entry gated by `read:TenantCatalogSettings`, registered in `src/app/navigation/navigation.registry.ts`. The entry MUST be hidden when the permission is absent.

#### Scenario: visible only when permission granted
- GIVEN a user with `read:TenantCatalogSettings`
- WHEN the sidebar renders the Sistema group
- THEN the "Catálogo online" entry is present
- AND when the permission is absent the entry is not present

### REQ-4: Tenant-scoped route guard
The route `/system/catalog-settings` SHALL be registered under Sistema in `src/app/router/index.ts` with `meta.permission: 'read:TenantCatalogSettings'`. It SHALL NOT set `skipTenantCheck` or `requiresSuperAdmin`. The global `beforeEach` SHALL redirect to `/403` when the permission is missing.

#### Scenario: redirect when permission absent
- GIVEN a user without `read:TenantCatalogSettings`
- WHEN they navigate to `/system/catalog-settings`
- THEN the router redirects to `/403`
- AND when the permission is present `TenantCatalogSettingsView.vue` mounts

### REQ-5: GET response surface (see REQ-12 for error states)
`useCatalogSettingsQuery` SHALL call `GET /tenants/:tenantId/catalog-settings` and SHALL expose `catalogPublished`, `effectivePublication`, `priceContexts[]`, `stockPresentationDefault`, `warnings`, `updatedAt`. The endpoint returns its documented response or an error — there is no 404-as-default fallback; the form MUST NOT hydrate from a synthetic default payload.

### REQ-6: Form derivation from priceContexts
The settings form draft SHALL be initialized and re-hydrated from `priceContexts`: `publicPriceListIds` SHALL equal every `priceListId` in server order; `catalogDefaultPriceListId` SHALL equal the entry where `isCatalogDefault:true` (or `null`); empty `priceContexts` SHALL produce `publicPriceListIds:[]` and `catalogDefaultPriceListId:null`. The form SHALL preserve in-flight local edits while a mutation is pending or the form is dirty, then rebuild from the accepted response. The form MUST NOT compute its own catalog-default or allowlist independently of `priceContexts`.

#### Scenario: derive allowlist + default from priceContexts
- GIVEN `priceContexts = [{priceListId:'pl_a', isCatalogDefault:true}, {priceListId:'pl_b', isCatalogDefault:false}]`
- WHEN the form hydrates
- THEN `publicPriceListIds = ['pl_a','pl_b']` AND `catalogDefaultPriceListId = 'pl_a'`

#### Scenario: empty priceContexts yields empty + null
- GIVEN `priceContexts = []`
- WHEN the form hydrates
- THEN `publicPriceListIds = []` AND `catalogDefaultPriceListId = null`

#### Scenario: in-flight edits preserved during pending mutation
- GIVEN the form is dirty and a PATCH is in flight
- WHEN a refetch returns
- THEN the draft is NOT overwritten until the mutation settles, then rebuilt from the accepted response

### REQ-6A: Global price-list candidates use least privilege
Adding a tenant-public price context SHALL use the existing authenticated global-price-list source only when the user holds both `update:TenantCatalogSettings` and `read:GlobalPriceList`. Without global-list read, the UI SHALL make no candidate request, SHALL continue to display the accepted `priceContexts` and default, and SHALL disable add/remove/default editing with a Spanish explanation. Publication and tenant stock-presentation controls SHALL remain independently available when otherwise valid. Candidate rows SHALL never redefine which contexts are currently public, and the frontend SHALL never auto-grant either permission.

#### Scenario: missing global-list read disables only context editing
- GIVEN a user with `read` and `update` on `TenantCatalogSettings` but without `read:GlobalPriceList`
- WHEN the settings view loads
- THEN no global-price-list request is issued, accepted public contexts/default remain visible, add/remove/default controls are disabled with an explanation, and publication and stock controls remain governed by their own validation

#### Scenario: authorized candidates do not redefine accepted membership
- GIVEN the user holds both required permissions and the global candidate query returns additional lists
- WHEN candidate options render
- THEN current public membership/default still comes only from settings `priceContexts`
- AND candidate data is used only to offer additions

### REQ-7: PATCH body whitelisted
`toPatchCatalogSettingsBody(draft)` SHALL return an object whose keys are a subset of `{catalogPublished, publicPriceListIds, catalogDefaultPriceListId, stockPresentationDefault}` and SHALL include only fields the user changed. The body MUST NOT include `effectivePublication`, `priceContexts`, `warnings`, or `updatedAt`. The mutation SHALL send the whitelisted body to `PATCH /tenants/:tenantId/catalog-settings` and SHALL invalidate `['catalog-settings', tenantId]` after success. No optimistic publication toggle is permitted.

#### Scenario: PATCH sends only changed whitelisted keys
- GIVEN the user only changed `stockPresentationDefault.mode`
- WHEN `toPatchCatalogSettingsBody` runs
- THEN the body contains exactly `stockPresentationDefault` and does NOT contain `catalogPublished`, `publicPriceListIds`, `catalogDefaultPriceListId`, `effectivePublication`, `priceContexts`, `warnings`, or `updatedAt`

#### Scenario: mutation invalidates the catalog-settings key only
- GIVEN a successful PATCH
- WHEN the mutation resolves
- THEN `['catalog-settings', tenantId]` is invalidated AND no unrelated query key is invalidated

### REQ-8: Tenant stock-presentation default constraints
`stockPresentationDefault.mode ∈ {"SYSTEM_STATUS", "ABSTRACT_STATUS", "CUSTOM_QUANTITY", "HIDDEN"}`. When `mode !== "CUSTOM_QUANTITY"`, `customQuantity` SHALL be sent as `null`. When `mode === "CUSTOM_QUANTITY"`, `customQuantity` SHALL be a non-negative integer; `0` SHALL be preserved literally and labeled "Mostrar 0". No separate "Agotado" toggle.

#### Scenario: customQuantity 0 preserved
- GIVEN `mode='CUSTOM_QUANTITY'`, `customQuantity=0`
- WHEN the form serializes the patch
- THEN `stockPresentationDefault = {mode:'CUSTOM_QUANTITY', customQuantity:0}` is sent AND the UI label is "Mostrar 0"

#### Scenario: other modes force null quantity
- GIVEN `mode='SYSTEM_STATUS'`
- WHEN the form serializes the patch
- THEN `stockPresentationDefault = {mode:'SYSTEM_STATUS', customQuantity:null}` is sent

### REQ-9: Atomic clear-last-public-context-while-published
When the user clears the last remaining public context while `catalogPublished === true` (so `publicPriceListIds` becomes `[]`), the form SHALL send ONE PATCH body containing `catalogPublished:false`, `publicPriceListIds:[]`, AND `catalogDefaultPriceListId:null` together; it MUST NOT split into multiple requests, and it does NOT require the publish-confirmation modal (descending-edge intent).

Ordinary unpublish (`catalogPublished: true → false`) with the configured public lists still intact (any non-empty allowlist and any default) is a SEPARATE valid descending-edge action: the form SHALL send only `{catalogPublished:false}` (or the union of changed whitelisted keys per REQ-7) and save without modal.

#### Scenario: atomic clear sends all three keys together
- GIVEN `catalogPublished=true`, `publicPriceListIds=['pl_a']`, `catalogDefaultPriceListId='pl_a'`
- WHEN the user clears the only public context and saves
- THEN a single PATCH is sent with `{catalogPublished:false, publicPriceListIds:[], catalogDefaultPriceListId:null}` and no publish-confirmation modal is shown

#### Scenario: ordinary unpublish may leave allowlist intact
- GIVEN `catalogPublished=true`, `publicPriceListIds=['pl_a','pl_b']`, `catalogDefaultPriceListId='pl_a'`
- WHEN the user toggles `catalogPublished` to `false` only and saves
- THEN a PATCH is sent with `{catalogPublished:false}` (allowlist/default remain server-side) and no atomic-clear triple is sent

### REQ-10: Publish confirmation on the rising edge
The settings view SHALL display an explicit confirmation modal ONLY when the local draft transitions `catalogPublished` from `false` to `true`. The modal SHALL be a clear two-button modal (accept/cancel) — no typed text, no multi-step form. Other settings changes (descending edge, the atomic-clear triple, stock default, allowlist/default edits without publish flip) SHALL save without confirmation. No optimistic publication update is permitted; the visible `catalogPublished` SHALL only flip after the PATCH response is accepted.

On Cancel: no PATCH is sent, the accepted/server state is unchanged, and the editable draft MAY remain dirty so the operator can revise and re-submit. Cancel MUST NOT silently revert the editable draft to `catalogPublished:false`.

#### Scenario: rising-edge modal; descending edge saves without modal; cancel keeps dirty draft
- GIVEN `catalogPublished=false` in the draft and the user toggles to `true` and clicks Save
- THEN a two-button confirmation modal appears (no typed text)
- AND on accept the PATCH is sent and only the accepted response may flip the visible `catalogPublished`
- AND on cancel no PATCH is sent, the accepted/server state is unchanged, and the editable draft remains dirty with `catalogPublished=true`
- GIVEN `catalogPublished=true` and the user toggles to `false`
- THEN the PATCH saves without a confirmation modal

### REQ-11: effectivePublication + closed-set warnings read-only
The view SHALL render `effectivePublication` and the `warnings` array as read-only state using a closed code→Spanish map maintained in the frontend. The view MUST NOT derive an effective publication different from the server value, MUST NOT compute a price fallback in response to `DEFAULT_CONTEXT_HAS_NO_VALID_PRICES`, and MUST NOT block Save when warnings are present. The known code `DEFAULT_CONTEXT_HAS_NO_VALID_PRICES` maps to "El contexto de catálogo por defecto no tiene precios válidos"; any code not in the closed map SHALL be dropped silently.

#### Scenario: known warning shown read-only
- GIVEN `warnings=['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES']`
- WHEN the view renders
- THEN the warning is shown read-only with the local Spanish copy AND Save is enabled

#### Scenario: unknown warning code is dropped
- GIVEN `warnings=['SOME_FUTURE_CODE']` (not in the closed map)
- WHEN the view renders
- THEN no message is rendered for that code AND Save is enabled

#### Scenario: effectivePublication reads as-is
- GIVEN `catalogPublished=true` but `effectivePublication=false`
- WHEN the view renders
- THEN `effectivePublication` displays as `false` (no client-side override) AND no toast or banner claims a public consequence

### REQ-12: Loading, error, and read-only states
The view SHALL render `USkeleton` while `isLoading` is true and SHALL disable all controls. On GET error (any non-2xx or network failure) the view SHALL render an error state with an explicit Retry action that re-runs the query — there is NO 404-as-default fallback and the form MUST NOT hydrate from a synthetic default payload or auto-fire a toast on the 404. When the user holds `read:TenantCatalogSettings` but NOT `update:TenantCatalogSettings`, the form SHALL render read-only with a Spanish notice ("No tienes permisos para guardar cambios"); Save SHALL be disabled. Successful save SHALL show a Spanish success toast; failed save SHALL show a Spanish error toast via `userMessageForError`.

#### Scenario: loading skeleton with controls disabled
- GIVEN `isLoading=true`
- WHEN the view renders
- THEN `USkeleton` is present AND no control is enabled

#### Scenario: GET error offers retry, no synthetic defaults
- GIVEN GET fails (any error, including 404)
- WHEN the error state renders
- THEN a Retry control re-runs the query AND the form MUST NOT render synthetic defaults AND no toast is auto-fired

#### Scenario: read-only when only read perm granted
- GIVEN user lacks `update:TenantCatalogSettings`
- WHEN the form renders
- THEN all controls are disabled AND "No tienes permisos para guardar cambios" is shown AND Save is disabled

### REQ-13: Product advanced catalog fields round-trip
Product create/update payloads SHALL round-trip via `useProductForm.ts` and `product.api.ts` the flat fields `hidePriceInOnlineCatalog: boolean`, `supportedCatalogPriceListIds: string[]` (explicit `null` invalid; empty = all tenant-public contexts), `supportsAllCatalogPriceLists: boolean` (read-only, derived; MUST NOT be sent), `onlineStockPresentation: mode | null`, `onlineStockPresentationCustomQty: number | null`. The existing `includeInOnlineCatalog` checkbox MUST remain the only basic product-publication control on the compact slideover. The PATCH body MUST include each flat catalog key only when the user changed it.

#### Scenario: flat fields round-trip with customQuantity:0
- GIVEN the form sets `hidePriceInOnlineCatalog=true`, `supportedCatalogPriceListIds=['pl_a']`, `onlineStockPresentation='CUSTOM_QUANTITY'`, `onlineStockPresentationCustomQty=0`
- WHEN `toUpdatePayload` runs
- THEN the payload includes exactly those four keys AND `onlineStockPresentationCustomQty:0` is preserved literally AND `supportsAllCatalogPriceLists` is NOT sent

#### Scenario: null allowlist rejected
- GIVEN the form sets `supportedCatalogPriceListIds=null`
- WHEN the user attempts to save
- THEN save blocks with a Spanish validation message AND the payload is NOT sent

#### Scenario: empty allowlist means all tenant-public contexts
- GIVEN `supportedCatalogPriceListIds=[]`
- WHEN `toUpdatePayload` runs
- THEN the payload includes `supportedCatalogPriceListIds:[]` AND the UI helper renders "Soporta todos los contextos públicos del tenant"

#### Scenario: compact slideover keeps only basic inclusion
- GIVEN `ProductUpsertSlideover.vue` renders
- THEN `includeInOnlineCatalog` is the only catalog field visible AND no advanced controls are rendered

### REQ-14: Product advanced section in the full editor
`ProductDetailView.vue` SHALL render an advanced "Catálogo online" section exposing `hidePriceInOnlineCatalog`, `onlineStockPresentation`, `onlineStockPresentationCustomQty`, and (per REQ-15) `supportedCatalogPriceListIds`. The section SHALL be visible only when `update:Product` is held. The hide-price toggle and stock-presentation controls SHALL be editable whenever `update:Product` is granted, regardless of `read:TenantCatalogSettings`. `supportsAllCatalogPriceLists` SHALL be displayed read-only when the server returns `true`.

#### Scenario: section gated by update:Product
- GIVEN a user without `update:Product`
- WHEN the view renders
- THEN the advanced "Catálogo online" section is not rendered
- GIVEN a user with `update:Product` and without `read:TenantCatalogSettings`
- WHEN the view renders
- THEN the section is rendered AND the hide-price and stock-presentation controls are editable AND only the `supportedCatalogPriceListIds` selector is gated per REQ-15

### REQ-15: Per-product public-context support selector (frontend data-access gate)
The `supportedCatalogPriceListIds` selector SHALL render only when the user holds BOTH `update:Product` AND `read:TenantCatalogSettings`. With `update:Product` only, the selector SHALL be disabled with the explanatory Spanish note ("Configura los contextos públicos del tenant en Sistema > Catálogo online para habilitar esta selección"); the hide-price and stock-presentation controls SHALL remain editable.

This dual-permission gate is purely a frontend data-access / UI presentation rule. The product PATCH itself MUST NOT require `read:TenantCatalogSettings` and MUST NOT 403 because of settings-read missing; the frontend never sends a settings-only payload and never asserts product-PATCH authorization from settings-read. The frontend MUST NEVER auto-grant `read:TenantCatalogSettings`.

#### Scenario: selector disabled with explanatory note
- GIVEN a user with `update:Product` only
- WHEN the advanced section renders
- THEN the selector is rendered but disabled AND the Spanish explanatory note is shown AND the hide-price and stock-presentation controls remain editable

#### Scenario: no auto-grant of settings-read
- GIVEN the frontend cannot grant permissions
- WHEN the product mutation runs
- THEN no internal grant of `read:TenantCatalogSettings` is performed AND the product PATCH payload MUST NOT carry settings-only fields AND a product PATCH MUST NOT be blocked or assumed-to-403 based on missing settings-read

### REQ-16: Variant catalog fields (PATCH-only, flat)
`VariantDetailModal.vue` SHALL expose `catalogPublishMode: "INHERIT" | "ON" | "OFF"`, `onlineStockPresentation: mode | null`, and `onlineStockPresentationCustomQty: number | null` for persisted variants only. The fields SHALL be PATCH-only — the modal MUST NOT send them on inline create or new-variant flows. The PATCH body MUST include each flat key only when the user changed it. `onlineStockPresentationCustomQty:0` SHALL be preserved literally and labeled "Mostrar 0". Clearing the stock presentation SHALL send BOTH flat stock fields as `null` (not as omitted keys). The mutation SHALL invalidate `productQueryKeys.variants(tenantId, productId)` after success.

#### Scenario: INHERIT/ON/OFF round-trip on persisted variant
- GIVEN a persisted variant with `catalogPublishMode='INHERIT'`, `onlineStockPresentation=null`, `onlineStockPresentationCustomQty=null`
- WHEN the user picks `'OFF'` and saves
- THEN the PATCH body contains `catalogPublishMode:'OFF'` AND no stock-presentation keys are sent

#### Scenario: customQuantity 0 preserved
- GIVEN `onlineStockPresentation='CUSTOM_QUANTITY'`, `onlineStockPresentationCustomQty=0`
- WHEN the modal saves
- THEN the PATCH body preserves `onlineStockPresentationCustomQty:0` AND the UI label is "Mostrar 0"

#### Scenario: clearing sends both flat stock fields as null
- GIVEN the user clears the existing stock presentation on a persisted variant
- WHEN the modal saves
- THEN the PATCH body contains `onlineStockPresentation: null` AND `onlineStockPresentationCustomQty: null` (keys NOT omitted)

### REQ-17: New/inline variants unchanged
The new-variant and inline-variant flows in `VariantDetailModal.vue` SHALL NOT add `catalogPublishMode`, `onlineStockPresentation`, or `onlineStockPresentationCustomQty` controls. New variants default server-side to `catalogPublishMode='INHERIT'` and stock-presentation fields `null`; the frontend MUST NOT send any of these fields on create.

#### Scenario: create flow omits variant catalog fields
- GIVEN the user creates a new variant via the modal
- WHEN the create payload is built
- THEN it MUST NOT contain `catalogPublishMode`, `onlineStockPresentation`, or `onlineStockPresentationCustomQty` AND no create-side validation references those keys

### REQ-18: Surgical mutation invalidation
Mutation invalidations SHALL be surgical: settings PATCH SHALL invalidate `['catalog-settings', tenantId]` only; product PATCH SHALL invalidate `productQueryKeys.detail(tenantId, productId)`; variant PATCH SHALL invalidate `productQueryKeys.variants(tenantId, productId)`. No broad invalidation of unrelated POS price-list caches or any public-catalog cache is permitted.

#### Scenario: no broad invalidation
- GIVEN a successful product PATCH
- WHEN the mutation resolves
- THEN only `productQueryKeys.detail(tenantId, productId)` is invalidated AND POS price-list caches and any public-catalog key remain untouched

### REQ-19: Public-side isolation
The change MUST NOT introduce any new endpoint, query key, route, component, or feature under `src/features/catalog/**`. The active `online-catalog-publishing` change and its artifacts MUST remain untouched. The super-admin `/admin/tenants` editor MUST NOT add catalog-settings editing.

#### Scenario: public module untouched
- GIVEN the change is fully applied
- WHEN the public catalog module is inspected
- THEN `src/features/catalog/**` contains no new files AND no existing public-catalog key is invalidated

### REQ-20: Responsive verification scope
The verify phase SHALL add focused mocked authenticated-browser evidence at narrow and wide widths for `TenantCatalogSettingsView`. The existing catalog-discovery responsive suite does NOT satisfy this requirement.

#### Scenario: settings view has narrow + wide evidence
- GIVEN the verify phase runs
- WHEN responsive evidence is produced
- THEN a narrow-width and a wide-width authenticated-browser evidence artifact is recorded for `TenantCatalogSettingsView`

## Mappers (pure, test-first)

| Function | Input → Output | Notes |
|---|---|---|
| `fromCatalogSettingsResponse(view)` | Derives `publicPriceListIds` from every `priceContexts[].priceListId`; `catalogDefaultPriceListId` from the entry where `isCatalogDefault:true` (or `null`). Identity for `catalogPublished`, `stockPresentationDefault`. `effectivePublication`, `warnings`, `updatedAt` are read-only response data, NOT part of the form draft. | Empty `priceContexts` ⇒ `publicPriceListIds:[]` and `catalogDefaultPriceListId:null` |
| `toPatchCatalogSettingsBody(draft)` | Whitelisted subset of `{catalogPublished, publicPriceListIds, catalogDefaultPriceListId, stockPresentationDefault}`; only fields the user changed. MUST NOT include `effectivePublication`, `priceContexts`, `warnings`, `updatedAt`. | Atomic clear-last-public-context sends `{catalogPublished:false, publicPriceListIds:[], catalogDefaultPriceListId:null}` together |
| `isCatalogSettingsDirty`, `isPublishRisingEdge` | Dirty: deep snapshot diff → boolean. Rising edge: true iff `prevDraft.catalogPublished === false` ∧ `currentDraft.catalogPublished === true`. | Drives REQ-10 confirmation; in-flight mutations do not auto-overwrite dirty drafts |
| `serializeStockPresentationDefault(value)` | `{mode, customQuantity: number \| null}` — null when `mode !== 'CUSTOM_QUANTITY'`; `0` preserved literally | UI label: "Mostrar 0" when `customQuantity === 0` |
| `mapCatalogSettingsWarning(code)` | `'DEFAULT_CONTEXT_HAS_NO_VALID_PRICES' → "El contexto de catálogo por defecto no tiene precios válidos"`; any other code → `null` (dropped silently) | Closed-set map; no server-message rendering |
| `mapCatalogSettingsError(code)` | code → `{ field?, toast? }` with Spanish fallback for 400/401/403 | Pure function |
| `fromProductRawAdvancedCatalog(raw)` | Maps raw flat fields `hidePriceInOnlineCatalog`, `supportedCatalogPriceListIds`, `supportsAllCatalogPriceLists` (read-only), `onlineStockPresentation`, `onlineStockPresentationCustomQty` to the normalized form shape | `[]` ⇒ "supports all tenant-public contexts"; explicit `null` allowlist rejected |
| `toProductPatchAdvancedCatalogPayload(form)` | Each flat key ONLY when the user changed it; `supportsAllCatalogPriceLists` MUST NOT be sent | Preserves `onlineStockPresentationCustomQty:0` literally |
| `fromVariantRawCatalog`, `toVariantPatchCatalogPayload` | Maps `catalogPublishMode`, `onlineStockPresentation`, `onlineStockPresentationCustomQty`; clearing sends BOTH `onlineStockPresentation: null` AND `onlineStockPresentationCustomQty: null` (not omitted) | Distinguishes `INHERIT` from explicit `OFF`; PATCH-only — create flow MUST NOT include these keys |

## UI Copy (neutral Spanish, examples)

- Settings route label: "Catálogo online" · Subject label (role UI): "Catálogo online del tenant"
- Publication toggle: "Publicar catálogo" · Publish confirm title: "Publicar catálogo online"
- Publish confirm body: "El catálogo será visible para clientes públicos. ¿Continuar?"
- Effective-publication helper: "La publicación efectiva también depende del estado del tenant."
- Allowlist helper: "Listas de precios visibles para clientes públicos"
- Default-context helper: "Lista de precios predeterminada para el catálogo"
- Stock default helper (custom `0`): "Mostrar 0"
- Per-product allowlist disabled note: "Configura los contextos públicos del tenant en Sistema > Catálogo online para habilitar esta selección"
- Per-product allowlist empty helper: "Soporta todos los contextos públicos del tenant"
- `DEFAULT_CONTEXT_HAS_NO_VALID_PRICES` warning: "El contexto de catálogo por defecto no tiene precios válidos"
- Update-perm missing (settings): "No tienes permisos para guardar cambios"
- Save success toast: "Configuración de catálogo guardada"
- Variant publication mode labels: "Heredar", "Publicado", "Oculto"
- Empty-allowlist note: "Sin listas públicas: la configuración no se mostrará públicamente"

## Test surfaces

- Authorization: ability tests for `TenantCatalogSettings` and `GlobalPriceList` (typed subjects, valid permission parsing, malformed code rejection, revocation on omission, no cross-subject grant or auto-grant).
- Router/navigation: route carries `read:TenantCatalogSettings`; sidebar entry visible only to the permitted user.
- Settings API: exact GET/PATCH URLs + tenant ID + whitelisted body + response shape + invalidation of `['catalog-settings', tenantId]`; closed-set `warnings: "DEFAULT_CONTEXT_HAS_NO_VALID_PRICES"[]` (no `{code,message}[]`); global candidate request runs only with settings-update plus `read:GlobalPriceList`.
- Settings form/mappers: allowlist/default derivation from `priceContexts`, atomic clear-last-public-context body, mode/quantity constraints, `0` preservation, ordinary unpublish may leave allowlist intact, `DEFAULT_CONTEXT_HAS_NO_VALID_PRICES` warn-only with Spanish copy, unknown warning codes dropped silently, no optimistic publication update, no 404-as-default fallback.
- Settings view: loading skeleton, GET error/retry (including 404) without synthetic defaults or auto-toast, read-only when only `read` granted, save success/error, publish confirmation on rising edge only with cancel keeping the dirty draft editable, no confirmation on descending edge or atomic-clear.
- Product mapping/form: flat `hidePriceInOnlineCatalog` + `supportedCatalogPriceListIds` (round-trip, `[]` = all, null rejected) + `supportsAllCatalogPriceLists` (read-only, never sent) + `onlineStockPresentation` + `onlineStockPresentationCustomQty` (null clears, custom `0` preserved, never invent a nested `stockPresentationOverride` object).
- Product full editor: advanced section respects `update:Product`; per-product public-context support selector disables with explanatory note when settings-read is missing while other advanced controls stay editable; product PATCH MUST NOT depend on settings-read.
- Variant modal: flat `catalogPublishMode` + `onlineStockPresentation` + `onlineStockPresentationCustomQty` round-trip, PATCH-only behavior, custom `0` preservation, clearing sends BOTH flat stock fields as null, surgical key invalidation; create flow omits the keys.