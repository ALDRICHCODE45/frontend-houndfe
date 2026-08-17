# Proposal: product-service-type

## Intent

Make `SERVICE` a first-class product type with differential form, payload, list
behavior per `houndfe-backend/docs/product-service-type-frontend.md`. MVP =
dog-walk duration variants. Today: slideover exposes backend-rejected fields
(`sku`/`barcode`/`brandId`/`lots`); detail-view type watcher forces
`hasVariants=false` for SERVICE, blocking the dog-walk MVP.

## Scope

**In**: type-keyed field visibility in `ProductDetailView` (hide
`sku`/`barcode`/`brandId`/`purchaseCost`/`useStock`/`useLotsAndExpirations`/
`quantity`/`minQuantity`/`lots`/inventory card for SERVICE; show
`serviceDetail` card = capacity + notes); unit filter (8 PRODUCT vs 6
SERVICE: HORA, SESION, DIA, CONSULTA, CURSO, PAQUETE); dynamic `location`
label ("Zona de servicio" for SERVICE); type-aware `toCreatePayload`/
`toUpdatePayload` (omit SERVICE-forbidden, force stock/lots defaults,
include `serviceDetail` only when populated — defensive, backend also
enforces); variant forms hide `sku`/`barcode`/`quantity`/`minQuantity` in
all 3 render points; type-change warnings in edit mode (toast on
`SERVICE→PRODUCT`; confirm on dirty `PRODUCT→SERVICE`; let backend
`PRODUCT_TYPE_CHANGE_BLOCKED` surface via existing error mapper); list:
`Product.type` + `?type=` filter + PRODUCTO/SERVICIO/TODOS toolbar toggle
+ type-badge column.

**Out**: `deliveryMode`, staff/booking, capacity oversell, spa/vet units,
`hidePriceInOnlineCatalog`, POS catalog (handoff §9), full SERVICE create
in slideover (D1).

## Confirmed Decisions

- **D1** Slideover = SERVICE-hides-forbidden-fields-only when editing
  existing SERVICE; no type/unit selectors; full SERVICE create stays in
  `ProductDetailView`.
- **D2** Variants ENABLED for SERVICE; `watch(formState.type)` forcing
  `hasVariants=false` and clearing variants MUST be corrected.
- **D3** `serviceDetail` = `capacity` + `notes` both shown; capacity
  informational (future guardería).
- **D4** List filter = PRODUCTO/SERVICIO/TODOS toolbar toggle +
  always-visible type badge (mirrors promotions pattern).

## Capabilities

**New**: `products` (type-aware create/edit — visibility, unit filter,
`location` label, `serviceDetail`, type-aware payload, SERVICE variants,
type-change warnings; owns full editor + slideover SERVICE-hiding) and
`products-list` (`Product.type`, `?type=` filter, toolbar toggle, badge
col).

**Modified**: none. Prior `products-catalog-coco` never archived a
`products` home spec; we author new home specs directly.

## Approach

Extend `composables/useProductForm.ts` with `isService`, `unitOptionsFor`,
`SERVICE_UNIT_OPTIONS`, `locationLabelFor` + serviceDetail in initial state/
mapper + type branches in create/update payload — both surfaces consume the
same matrix. `ProductDetailView` type watch: replace `hasVariants=false`
with narrower rule (only inventory/lots/purchaseCost force SERVICE defaults).
List filter mirrors Promotions (filterType ref → queryKey + queryFn;
pagination-reset watcher; `UDropdownMenu` toolbar). Variant restriction via
one shared `inventoryFieldsVisible(type)` across 3 templates + 3 payload
builders; `VariantDetailModal` gains `productType` prop. strict_tdd:
pure-helper tests first, then components.

## Affected Areas

- `interfases/product.types.ts` — Mod: `Product.type`; `serviceDetail` on
  Product/Detail/BackendResp/CreatePayload.
- `api/product.api.ts` — Mod: `mapProduct.type`; `mapProductDetail.
  serviceDetail` (null-safe); new `ProductFilters`/`ProductTableParams`;
  `getPaginated` spreads `type`.
- `composables/useProductForm.ts` — Mod: `SERVICE_UNIT_OPTIONS`,
  `unitOptionsFor`, `locationLabelFor`; serviceDetail in initial state/
  mapper; type branches in create/update payload.
- `views/ProductDetailView.vue` — Mod: type-watch correction;
  serviceDetail card; transition warnings; variant modal hides inventory
  for SERVICE.
- `components/ProductUpsertSlideover.vue` — Mod: hide sku/barcode/stock/
  purchase editing SERVICE (D1).
- `views/ProductsView.vue` — Mod: `filterType` ref + pagination reset +
  toolbar toggle (D4).
- `composables/useProductColumns.ts` — Mod: new `type` col (9→10).
- `components/VariantDetailModal.vue` — Mod: `productType` prop; hide
  inventory for SERVICE.
- Pending-variant inline modal (`ProductDetailView`) — Mod: mirror
  inventory-hide for SERVICE.
- `ProductsView.test.ts`, `productsListColumns.regression.test.ts` — Mod:
  intentional 9→10; new pure-helper tests.
- `specs/products/spec.md`, `specs/products-list/spec.md` — New.

## Risks

- **High**: type-watch correction regresses PRODUCT lots/qty coupling.
  Mit: RED first; PRODUCT keeps `hasVariants=true`; coupling watches
  unchanged; pure-helper tests.
- **Med**: 9-col regression breaks on type-col add. Mit: intentional
  update + R-201 note.
- **Med**: backend `?type=` whitelist unverified. Mit: verify in dev;
  client local-filter fallback.
- **Med**: slideover scope creep. Mit: D1 locked; any creep = new change.
- **Med**: miss one of 3 variant render points. Mit: one shared
  `inventoryFieldsVisible(type)` across all 3.
- **Low**: `Product.type` ripples (`ProductCard`/chips). Mit: typecheck +
  view tests.
- **High**: scope > 400-line budget. Mit: session `single-pr` +
  `size:exception`; `sdd-tasks` forecasts.

## Rollback

Revert commit. SERVICE was already in enum with broken UI; revert restores
prior behavior. `?type=` filter additive (ignored on absence). `type`/
`serviceDetail` additive in responses; client mappers default `PRODUCT`/
`null` for graceful degradation. If type-watch regresses, narrow it
independently (smallest diff) and ship hotfix.

## Dependencies

Backend contract `houndfe-backend/docs/product-service-type-frontend.md`
(deployed in dev). Prior art: `promotions/PromotionsView` (server-side
filter + toolbar dropdown), `sales` (table badge helpers).

## Success Criteria

- Create/edit SERVICE in `ProductDetailView` w/ duration variants,
  serviceDetail (capacity+notes), 6-unit filter, dynamic `location`
  label; backend accepts payload zero 400s.
- Slideover editing SERVICE hides sku/barcode/stock/purchase; payload
  omits them.
- List shows Producto/Servicio badge every row; toolbar toggle filters
  via `?type=` + resets pagination.
- 3 variant render points hide inventory for SERVICE; payload omits.
- Pure-helper tests cover `unitOptionsFor`, type-aware payload,
  `mapProduct.type`, serviceDetail mapping; existing green; 9→10 col
  test intent-recorded.
- `vue-tsc` clean; `pnpm build` and `pnpm test:unit` green.
