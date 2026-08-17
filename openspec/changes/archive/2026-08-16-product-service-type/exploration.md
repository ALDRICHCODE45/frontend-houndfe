# Exploration: product-service-type

> Phase: `explore` — read-only investigation. Source of truth for the feature:
> `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/docs/product-service-type-frontend.md`
> All file paths below are relative to the frontend repo root `frontend-houndfe/`.

---

## Executive summary

The frontend already knows `type: 'PRODUCT' | 'SERVICE'` end-to-end in the *detail* surface (`ProductDetail.type`, `productFormSchema.type`, a type radio group, and a watch that forces SERVICE defaults), but the behavior is partial and partly WRONG for the new backend rules: the existing watch forces `hasVariants=false` for SERVICE, which contradicts the handoff (services must support variants — dog-walk durations). The list surface drops `type` entirely (`Product` has no `type` field, `mapProduct` discards it) and has no `type` filter. The slideover (`ProductUpsertSlideover.vue`) has **no type selector and no unit selector** — it always creates `PRODUCT` with default state, so it needs a type selector (or SERVICE-aware visibility) plus unit filtering. `UNIT_OPTIONS` (8 values) lives in `useProductForm.ts` and is consumed only by `ProductDetailView`; no `UnitOfMeasure` enum exists anywhere else. The variant forms exist in three places (variant modal, pending-variant detail modal, and `VariantDetailModal`) and all render sku/barcode/quantity/minQuantity fields that must hide for SERVICE variants. The reusable server-side filter pattern is Promotions' `PromotionFilters`/`PromotionTableParams` + local refs spread into `useServerTable`'s query key and query fn. `AppBadge` is the badge component with prior art in Sales list tables (`getPaymentStatusBadge`/`getDeliveryStatusBadge`).

## 1. Form surfaces (create/edit product)

| Surface | File | Mode | Shared state? |
|---|---|---|---|
| Full page editor | `src/features/POS/products/views/ProductDetailView.vue` (3067 lines) | create (`/pos/products/new`) + edit (`/pos/products/:id`) | NO — has its own `getDefaultFormState()` (line 79), its own `formState = reactive<ProductFormInput>(...)` (line 108). It imports `productFormSchema`, `productToFormInput`, `toCreatePayload`, `toUpdatePayload`, `UNIT_OPTIONS`, `centsToDecimalInput`, `decimalInputToCents` from `useProductForm.ts` but does NOT call `useProductForm()`. |
| Slideover | `src/features/POS/products/components/ProductUpsertSlideover.vue` (300 lines) | create + edit, instantiated twice in `ProductsView.vue` (lines 500-525) | YES — calls `useProductForm()` (line 55) and gets `{ schema, state, resetForm, setState }`. |
| Variant add/edit modal | inside `ProductDetailView.vue` template (lines 2979-3065), `variantSchema` + `variantState` | create (local pending) + edit (API) | Its own `variantState` reactive + `variantSchema` (lines 138-152). |
| Variant "Más Datos" modal (edit mode) | `src/features/POS/products/components/VariantDetailModal.vue` | edit only | Its own `formState` (sku/barcode/quantity/minQuantity/purchaseCost) — receives `useStock` prop. |
| Pending-variant "Más Datos" modal (create mode) | `ProductDetailView.vue` template (lines 2596-2724), `pendingVariantDetailState` | create only | Its own reactive state (sku/barcode/quantity/minQuantity/purchaseCost/prices). |

**Rendering structure (full page):** NOT tabs — a vertical stack of `UCard` sections inside one `UForm` (`product-detail-form`): Datos del producto → Precio de Compra → Impuestos → Inventario (`v-if="showInventoryCard"`) → Variantes (`v-if="showVariantsSection"`) → Lotes (`v-if="showLotsSection"`) → Listas de Precios (create) / `PriceListSection` (edit) → `ProductImageGallery` (edit). Right sidebar = preview panel.

**Existing type-aware logic (full page):**
- `showInventoryCard = computed(() => formState.type === 'PRODUCT')` (line 412) — inventory card already hidden for SERVICE. ✓
- `watch(formState.type, ...)` (lines 567-585): for SERVICE forces `useStock=false`, `useLotsAndExpirations=false`, `hasVariants=false`, `quantity=0`, `minQuantity=0`, and in create mode clears `pendingVariants/pendingLots/pendingPriceLists`.
  - ⚠️ **CONFLICT**: forcing `hasVariants=false` + clearing variants contradicts handoff §3 (services MUST support variants; dog-walk durations are the MVP). Proposal must change this watch.
- Other watches: `useStock=false` → force lots off/qty 0 (588-597); `hasVariants=true` → force lots off/qty 0 (600-609); lots on → qty 0 (612-619).
- Type radio group exists in "Datos del producto" card (lines 1713-1731) with labels Producto/Servicio.
- Preview sidebar already renders a type pill (line 2453) and `previewStockTotal` returns null for SERVICE (line 450).

**Slideover fields today:** Nombre, SKU, Código de barras, Categoría, Marca, Precio de venta, Stock, Stock mínimo, Descripción, Ubicación, SAT Key, checkboxes (Usar stock / Vender en POS / Catálogo online / Cobrar impuestos) + "Más Opciones" box pointing to full editor. **No `type` selector, no `unit`, no `location` label logic, no inventory section** — sku/barcode/stock/minStock are always shown, so editing a SERVICE in the slideover currently exposes fields the backend rejects (if filled) or forces (stock fields).

**Where field-visibility logic should live:** The two surfaces share types + `useProductForm.ts` helpers but NOT state. To avoid duplication, the visibility matrix + unit-option filtering should be extracted into `useProductForm.ts` (or a new `useProductTypeVisibility.ts` composable) as pure helpers/computed (e.g. `isService(type)`, `unitOptionsFor(type)`, `serviceUnitOptions`, `locationLabelFor(type)`), consumed by BOTH surfaces. The watch-based state normalization (SERVICE → force stock defaults) should also move into the composable or a shared helper so slideover + full page behave identically. Slideover and full page will still need separate template `v-if`s (they render different field sets).

## 2. Types (`src/features/POS/products/interfaces/product.types.ts`, 492 lines)

- `Product` (list row): id, name, sku, barcode, categoryId, categoryName, brandId, brandName, priceCents, quantity, minQuantity, useStock, hasVariants, useLotsAndExpirations, sellInPos, includeInOnlineCatalog, requiresPrescription, chargeProductTaxes, variantStockTotal, variantCount, status (`'active'|'inactive'|'out_of_stock'`), createdAt, updatedAt. **No `type` field** ← must add for the list badge.
- `ProductDetail extends Product`: + description, location, satKey, **`type: 'PRODUCT' | 'SERVICE'`** (already exists), unit, ivaRate, iepsRate, purchaseCostMode, purchaseNetCostCents, purchaseGrossCostCents. **No `serviceDetail`** ← must add: `serviceDetail: { capacity: number | null; notes: string | null } | null`.
- `ProductBackendResponse`: already has optional `type?: 'PRODUCT' | 'SERVICE'` and `unit?: string`. **No `serviceDetail`** ← add `serviceDetail?: { capacity?: number | null; notes?: string | null } | null`. Backend list/detail responses per handoff now include `serviceDetail` (null for PRODUCT).
- `CreateProductPayload`: has `type?: 'PRODUCT' | 'SERVICE'`, `sku?`, `barcode?`, `brandId?: string | null`, `unit?`, `useStock`, `useLotsAndExpirations?`, `hasVariants?`, `quantity`, `minQuantity`, `purchaseCost?`, `variants?: CreateVariantInline[]`, `lots?`, `priceLists?`, `images?`. **No `serviceDetail`** ← add `serviceDetail?: { capacity?: number | null; notes?: string | null }`. Note `variants?: CreateVariantInline[]` and `lots?: CreateLotInline[]` already exist for inline creation.
- `CreateVariantInline`: option?, value?, name?, sku?, barcode?, quantity?, minQuantity?, purchaseNetCostCents? — matches handoff variant payload; SERVICE variants must omit sku/barcode/quantity/minQuantity (backend ignores/forces).
- `ProductVariant`: full row incl. sku, barcode, priceCents, quantity, minQuantity, purchaseNetCostCents, variantPrices, createdAt, updatedAt.
- `PendingVariant`: _localId, option, value, sku, barcode, quantity, minQuantity, purchaseNetCostCents, publicPriceCents, variantPrices — create-mode local state.
- `ProductFormInput`: flat fields incl. `type: 'PRODUCT' | 'SERVICE'`, `unit: string`, price/purchaseCost as decimal strings. **Where serviceDetail slots in:** either two new flat fields (`serviceCapacity: number | null`, `serviceNotes: string`) or a nested `serviceDetail` object. Flat is more consistent with the existing shape; both `getInitialState()` (composable) and `getDefaultFormState()` (view) must be updated — they are duplicated today (two copies of the same defaults).
- `UpdateProductPayload = Partial<CreateProductPayload>` — type change PATCH flows through here.
- Mappers (`product.api.ts`, see §3): `mapProduct` (drops `type`), `mapProductDetail` (reads `item.type`, `item.unit`), `mapVariant`, `mapLot`.

## 3. API layer (`src/features/POS/products/api/product.api.ts`, 568 lines)

- `productApi.getPaginated(params: ServerTableParams)`: GET `/products` sending ONLY `search`/`q` when `globalFilter` is set (lines 262-275). **Backend whitelist rejects page/limit/sortBy/sortOrder with HTTP 400** (documented in code + tests) — so no pagination/sort params are sent; the client normalizes three response shapes (bare array | `{data}` | `{data,meta}`), applies local text filter (only when server didn't filter), always sorts locally, and slices locally. `serverPagination` branch is dead code reserved for future backend support.
  - **`type` integration:** add a `ProductFilters { type?: 'PRODUCT' | 'SERVICE' }` + `ProductTableParams = ServerTableParams & ProductFilters` (mirror of `PromotionFilters`/`PromotionTableParams` in `promotion.api.ts` lines 25-33) and spread `...(params.type ? { type: params.type } : {})` into the request params. `type` is newly whitelisted per handoff §5 (ignored if invalid). Must add to the existing test "does NOT send sortBy, sortOrder, page, or limit".
- `getById` → `mapProductDetail`.
- `create` → POST, maps via `mapProductDetail`, keeps `_raw` for post-create variant price updates. `update` → PATCH, same mapper. `remove` → DELETE.
- `mapProduct` (lines 67-93): **drops `type`** — must map `type: item.type ?? 'PRODUCT'` once `Product` gains the field.
- `mapProductDetail` (101-115): already `type: item.type ?? 'PRODUCT'`, `unit: item.unit ?? 'UNIDAD'`; add `serviceDetail: item.serviceDetail ?? null` (normalize capacity/notes to `| null`).
- `mapStatus` (52-65): for SERVICE (`useStock=false`) returns `'active'` — sensible default already.
- Variants/lots/price-lists/images endpoints: standard; `createVariant`/`updateVariant` post to `/products/:id/variants` (SERVICE allowed; sku/barcode/quantity/minQuantity forced null/0 server-side).
- `mapArrayResponse` normalizes array vs `{data}` envelopes.
- `ProductBackendListResponse` = `{ data: ProductBackendResponse[]; meta: {page,limit,total,totalPages} }` (defined in `product.types.ts`).

## 4. List view + filters

- View: `src/features/POS/products/views/ProductsView.vue` (775 lines). Data via `useServerTable<Product>` with `queryKey: () => productQueryKeys.paginated(tenantId.value)` and `queryFn: (params) => productApi.getPaginated(params)` (lines 59-84). `persistKey: 'pos-products'`, default sorting by name, right-pinned actions.
- **No DataTableFilters v2** in Products today (only Sales/Quotations lists use `useDataTableFilters` + `useFiltersUrlAdapter`). Only global search (server-side via search/q) + column visibility + sort. Two display modes: table (`useProductColumns`) and cards (`ProductCardGrid`/`ProductCard`).
- **Recommended type-filter approach (promotions pattern — prior art):** local `filterType = ref<'' | 'PRODUCT' | 'SERVICE'>('')`; spread `{ type: filterType.value }` into the `useServerTable` `queryKey` closure (forces refetch on change) AND into `queryFn` params; `watch` filter refs → reset pagination to 0 (promotions lines 198-202); UI = the promotions-style lightweight dropdown selector (`isTypeSelectorOpen` + `UDropdownMenu` + `active-filter-count` badge in the toolbar) rather than the full DataTableFilters v2 machinery — cheaper and consistent with sibling feature. (DataTableFilters v2 with `filter.enum({ id:'type', param:'type', options:[PRODUCT,SERVICE] })` + URL adapter is a viable alternative, used by Sales/Quotations, but heavier.)
- **Type badge in table:** `useProductColumns.ts` currently returns 9 columns (select, name, sku, categoryName, brandName, priceCents, quantity, status, actions). Adding a `type` column means: add `type` to `Product` (interface + `mapProduct`), add column, add `#type-header`/`#type-cell` slots rendering `AppBadge` (e.g. `tone="info"` "Servicio" / `tone="neutral"` "Producto"). `ProductsView` already imports `DotBadge`/`StatusDotBadge`; `AppBadge` is imported by `ProductDetailView` and heavily used in Sales components (e.g. `SaleItemBadges.vue`, `SaleItemRow.vue`).
- ⚠️ **Regression guard**: `composables/__tests__/productsListColumns.regression.test.ts` pins EXACTLY 9 columns in order (R-201 guard) and ProductsView.test.ts asserts `data-column-count` === 9 — both must be updated when the type column lands.
- **Cards mode:** `ProductCard.vue` shows name, category, DotBadge stock, StatusDotBadge status — no type indicator. Adding a type badge to cards is optional polish; the handoff requires a badge "en listados" (table). Card data is `Product` so it would come free once `Product.type` exists.
- **POS catalog:** `PosCatalogItem`/`PosProductDetail` (`sales/interfaces/sale.types.ts`) have `useStock` and `unit` but no `type`/`serviceDetail` fields. Handoff §9 says POS needs NO changes (useStock=false already skips inventory deduction). Adding `type` to POS types is optional and out of scope unless a POS badge is desired.

## 5. Variant form (three render points)

1. **Variant add/edit modal** (`ProductDetailView.vue` 2979-3065): `variantSchema` (lines 138-152) validates option, value, sku, barcode, quantity, minQuantity, purchaseCost. Template always renders SKU / Código de barras / Existencias / Existencias mínimas / Costo fields.
2. **Pending-variant "Más Datos" modal** (create mode, 2596-2724): `pendingVariantDetailState` with sku/barcode/quantity/minQuantity/purchaseCost + prices table. Always renders SKU, barcode, Existencias card.
3. **`VariantDetailModal.vue`** (edit mode): own `formState` (sku, barcode, quantity, minQuantity, purchaseCost), receives `useStock: boolean` prop already (used to gate quantity editing). Template (lines 121-345, partially read) renders General (SKU/Barcode/Costo) + Existencias (Cantidad/Cantidad mínima) cards.

**SERVICE restriction placement:** for a SERVICE product, hide sku/barcode/quantity/minQuantity in all three, keep option/value/purchaseCost. All three components know the product type either directly (`ProductDetailView` has `formState.type`) or via a new prop (`VariantDetailModal` can take a `productType`/`isService` prop next to `useStock`). `handleSubmitVariant`/`savePendingVariantDetailModal`/`VariantDetailModal` payload builders should also omit sku/barcode/quantity/minQuantity for SERVICE (defensive; backend forces anyway). `variantSchema` may need per-type refinement (or keep it and just clear fields).

## 6. Unit handling

- `UNIT_OPTIONS` (8: UNIDAD, CAJA, BOLSA, METRO, CENTIMETRO, KILOGRAMO, GRAMO, LITRO) is exported from `composables/useProductForm.ts` and consumed ONLY by `ProductDetailView.vue` (line 1776, mapped to uppercase labels). The slideover does not render `unit` at all.
- No `UnitOfMeasure` TS enum anywhere; `productFormSchema.unit` is a free `z.string().trim()`. `mapProductDetail` defaults `unit: 'UNIDAD'`.
- `'UNIDAD'` appears only in tests of the sales feature and product test fixtures — sales never renders/validates unit values, so **adding 6 new values (HORA, SESION, DIA, CONSULTA, CURSO, PAQUETE) has zero impact outside the product form**.
- Proposal: add `SERVICE_UNIT_OPTIONS` (6) + `unitOptionsFor(type)` (or a computed) in `useProductForm.ts`; consume in `ProductDetailView` and (if a unit field is added to the slideover, which it currently lacks) in the slideover.

## 7. Existing tests

| File | Coverage | Pattern |
|---|---|---|
| `api/__tests__/product.api.test.ts` (235 lines) | `uploadProductImage`/`uploadVariantImage` (FormData contract); `getPaginated`: does NOT send sortBy/sortOrder/page/limit; sends search+q when globalFilter; local sort on flat array; `{data}` envelope local sort+paginate. | Pure-function tests with `vi.mock('@/core/shared/api/http')`. `buildProductBackendRow` factory for backend rows. |
| `composables/__tests__/productsListColumns.regression.test.ts` (71 lines) | Pins exactly 9 columns in order; select/actions non-hideable; no `defaultColumnVisibility` export; currencyFormatter contract. | Pure-function snapshot of `useProductColumns()` — no mount. |
| `views/__tests__/ProductsView.test.ts` (244 lines) | Cards/table mode switch with same server data; card click routing; 9-column contract; coco surface class (SDD-7). | `shallowMount` + heavy stubs (AppDataTable stub counts columns). |
| `views/__tests__/ProductDetailView.test.ts` (248 lines) | Variant image modal open/props; coco token assertions. | `mountWithUApp` helper + VueQueryPlugin + mocked productApi; U* component stubs. |
| `views/__tests__/ProductsView.satKeyError.test.ts` | SAT_KEY error surfacing. | mount-based. |
| `interfaces/__tests__/product.types.test.ts` | ProductImage.fileId / MIME tuple / max size. | Type-level smoke tests. |
| `components/__tests__/` (ProductCardGrid, ProductCard, ProductImageGallery, SatKeySelect, VariantImagePickerModal) | component behavior. | mount-based. |

**No tests exist for `useProductForm` composable, `productToFormInput`, `toCreatePayload`, `toUpdatePayload`, `mapProduct`/`mapProductDetail` behavior, or the type watch.** strict_tdd implications: new pure helpers (`unitOptionsFor`, SERVICE payload sanitation, serviceDetail mapping, `mapProduct.type`) should get co-located `__tests__` in the composable/api `__tests__` folders; visibility matrix is template-level (component tests via existing stub pattern); test runner `pnpm test:unit`, gate `pnpm build`.

## 8. Patterns to reuse

- **(a) Badges in tables**: `AppBadge.vue` (`src/core/shared/components/AppBadge.vue`; label/value/tone/icon/variant, defaults subtle) + `badge.utils.ts` tones; Sales list precedent `SalesListView.vue` lines 302/325 (`getPaymentStatusBadge`/`getDeliveryStatusBadge` returning `{color/label}` → `AppBadge`); `DotBadge`/`StatusDotBadge` already used in Products list.
- **(b) Server-side filter params on getPaginated**: `PromotionFilters` + `PromotionTableParams = ServerTableParams & PromotionFilters` (`promotion.api.ts` 25-33) spread into GET params; PromotionsView local filter refs spread into `useServerTable` queryKey closure + queryFn; `watch` reset pagination; lightweight UDropdownMenu selector with `active-filter-count`. (DataTableFilters v2 + `createSalesFiltersSchema` + `useFiltersUrlAdapter` + `backendParams` exists in Sales/Quotations as the heavier alternative.)
- **(c) Conditional field visibility**: existing `showInventoryCard`/`showManualStockFields`/`showLotsCheckbox`/`showVariantsSection`/`showLotsSection` computeds + `v-if` in ProductDetailView; `VariantDetailModal` `useStock` prop precedent for passing product-level flags into child modals.
- **(d) Toast warnings on destructive transitions**: `useToast` (global stub declared in views, e.g. ProductDetailView lines 50-56) used everywhere; `ConfirmModal` pattern (`confirmState` + `openConfirm(description, onConfirm)`) is the existing "are you sure" mechanism — a type-change warning could either be a ConfirmModal gate or a toast on successful transition; handoff asks for a toast/warning when `SERVICE → PRODUCT` (admin must add stock) and a block-awareness for `PRODUCT → SERVICE` (backend 400 `PRODUCT_TYPE_CHANGE_BLOCKED` already surfaces through `mapDomainError` toast path).
- Error mapping for new 400 codes: `ProductsView.mapDomainError` and `ProductDetailView.mapDomainError` already funnel `response.error` codes (ENTITY_ALREADY_EXISTS / INVALID_ARGUMENT / SAT_KEY_NOT_FOUND) into field errors + toasts — `PRODUCT_TYPE_CHANGE_BLOCKED` / `LOTS_NOT_ALLOWED_ON_SERVICE` / SERVICE-field 400s should be added there (or fall through to generic message).

## Key implications for the proposal

1. **Type-awareness is half-done** in the full editor (inventory card hidden; watch forces defaults) but the watch must be corrected: keep `hasVariants` available for SERVICE and don't wipe variants; only inventory/lots/purchaseCost-related fields force to SERVICE defaults.
2. **Slideover is the bigger gap**: no type selector, no unit selector, no location-label logic, no inventory section, and no type change warnings. Decide: add a type selector + serviceDetail there (scope growth) vs. keep slideover PRODUCT-only and route SERVICE creation to the full editor (smaller; but editing an existing SERVICE in the slideover must still hide sku/barcode/stock fields and filter payload).
3. **Two duplicated default-state factories** (`getInitialState` in composable, `getDefaultFormState` in view) — adding serviceDetail touches both; consider consolidating.
4. **List surface**: add `type` to `Product` + `mapProduct`; new column + `AppBadge` cell; promotions-style `type` filter ref + param; update the 9-column regression tests.
5. **Payload sanitation** in `toCreatePayload` (and `buildFullCreatePayload` variants/lots mapping): when `type === 'SERVICE'`, omit sku/barcode, force brandId null, omit purchaseCost, force quantity/minQuantity 0, `useStock=false`, `useLotsAndExpirations=false`, omit `lots`, include `serviceDetail` only when populated. Backend is defensive but the matrix says the frontend should hide + not send.
6. **`serviceDetail`** touches: `ProductBackendResponse`, `ProductDetail`, `CreateProductPayload`, `ProductFormInput`, `mapProductDetail`, both initial-state factories, new UI card (capacity number + notes textarea ≤500), and the preview checklist/sidebar (optional).
7. **Unit**: add `SERVICE_UNIT_OPTIONS` + type-filtered options computed; consumed by the full editor (and slideover only if a unit selector is added there). No other unit consumers exist.
8. **Variant restriction** applies at three render points (§5) — a shared `isService`-driven conditional or a `productType` prop for `VariantDetailModal`.
9. **Size risk**: `ProductDetailView.vue` is 3067 lines; edits are surgical but the change as a whole (types + api + 2 form surfaces + list + 3 variant surfaces + tests) will likely exceed the 400-line review budget → chained-PR slicing or size-exception approval per the session's single-pr strategy.

## Risks

| Severity | Risk |
|---|---|
| High | Watch conflict: existing `type` watch forces `hasVariants=false` for SERVICE; relaxing it correctly without regressing PRODUCT invariants (lots/qty coupling watches) is subtle. |
| Med | `productsListColumns.regression.test.ts` + `ProductsView.test.ts` pin the 9-column contract; adding a type column breaks them — must be updated deliberately (guards exist to catch accidental change). |
| Med | Slideover has no type/unit fields; full SERVICE support there is scope growth vs. minimal "hide fields when editing SERVICE" path. |
| Med | Backend `type` whitelist: the products endpoint previously 400'd on unknown params; `type` is now accepted per handoff — verify in dev before relying on server filtering. |
| Med | Three variant forms need SERVICE field hiding — easy to miss one (create modal vs pending modal vs VariantDetailModal). |
| Low | POS catalog types lack `type`/`serviceDetail` fields; handoff says no POS changes needed, but a POS badge would require type additions there (out of scope). |
| Low | `serviceDetail` normalization (backend may return `null` or `{capacity:null,notes:null}`) must be defensive in `mapProductDetail`. |
