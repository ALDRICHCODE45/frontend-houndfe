# Tasks: product-service-type

## Review Workload Forecast

- Estimated changed lines: 700–820
- 400-line budget risk: High
- Chained PRs recommended: No (single-pr → `size:exception` required)
- Decision needed before apply: Yes

```text
Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: High
```

### Work Units → commits (single PR)

- WU-A `product.types.ts`, `useProductForm.ts` → `pnpm test:unit -- useProductForm`
- WU-B `product.api.ts` → `pnpm test:unit -- product.api`
- WU-C `useProductForm.ts` (payload) → `pnpm test:unit -- useProductForm`
- WU-D `ProductDetailView.vue`, `VariantDetailModal.vue` → `pnpm test:unit -- ProductDetailView VariantDetailModal`
- WU-E `ProductUpsertSlideover.vue` → `pnpm test:unit -- ProductUpsertSlideover`
- WU-F `useProductColumns.ts`, `productStatusConfig.utils.ts`, `ProductsView.vue` → `pnpm test:unit -- ProductsView productsListColumns productStatusConfig`

Rollback: each WU reverts only its files.

## Phase 1 — Shared matrix (WU-A) — products REQ-1/2/3/4

- [x] 1.1 Add `ProductType`, `ServiceDetail`; extend `Product`/`ProductDetail`/`ProductBackendResponse`/`CreateProductPayload`/`ProductFormInput`.
- [x] 1.2 Add `SERVICE_UNIT_OPTIONS`, `isService`, `unitOptionsFor`, `locationLabelFor`, `inventoryFieldsVisible`, `serviceDetailPopulated`; wire `serviceDetail` into schema + initial state.
- [x] 1.3 RED `useProductForm.helpers.test.ts`: unitOptionsFor 8/6; locationLabelFor; inventoryFieldsVisible; serviceDetailPopulated; productToFormInput maps serviceDetail.

## Phase 2 — API + payloads (WU-B, WU-C) — products-list REQ-1/2, products REQ-5/8

- [x] 2.1 Add `ProductFilters`/`ProductTableParams`; `mapProduct.type`; `mapProductDetail.serviceDetail`; `applyLocalTypeFilter`; spread `params.type` in `getPaginated` + idempotent local fallback.
- [x] 2.2 RED extend `product.api.test.ts`: mapProduct type/default; type param conditional; local fallback filters mixed rows.
- [x] 2.3 SERVICE branch in `toCreatePayload` (omit sku/barcode/brandId/lots, force stock/lots=false qty=0, include serviceDetail only when populated); `toUpdatePayload` delegates.
- [x] 2.4 RED extend `useProductForm.helpers.test.ts`: SERVICE payload omits forbidden; serviceDetail only when populated.

## Phase 3 — Detail + variants (WU-D) — products REQ-1/4/6/7

- [x] 3.1 Narrow `watch(formState.type)`: keep stock/lots/qty defaults + clear `pendingLots` only; drop `hasVariants=false` + pendingVariants/pendingPriceLists clears.
- [x] 3.2 SERVICE→PRODUCT toast; PRODUCT→SERVICE `openConfirm` proxy; map `PRODUCT_TYPE_CHANGE_BLOCKED` in `mapDomainError`.
- [x] 3.3 Render serviceDetail card (capacity int≥1, notes ≤500) + dynamic `location` label; gate sku/barcode/brandId/purchaseCost/stock/lots/inventory via `inventoryFieldsVisible`.
- [x] 3.4 Use `unitOptionsFor(formState.type)` for unit select.
- [x] 3.5 Gate pending-variant modal (2608–2646) + `handleSubmitVariant` + `buildFullCreatePayload.variants` payload omission for SERVICE.
- [x] 3.6 Add `productType` prop to `VariantDetailModal.vue`; hide Existencias card; SERVICE save keys `['purchaseCost']`.
- [x] 3.7 RED extend `ProductDetailView.test.ts`: SERVICE keeps variants; type-watch clears pendingLots only; SERVICE→PRODUCT toast.

## Phase 4 — Slideover (WU-E) — products REQ-8

- [x] 4.1 Hide sku/barcode/stock/minStock/purchaseCost when editing SERVICE; dynamic `location` label; no type/unit selectors.
- [x] 4.2 RED `ProductUpsertSlideover.test.ts`: editing SERVICE hides inputs; payload omits sku/barcode/stock via shared builder.

## Phase 5 — List (WU-F) — products-list REQ-3/4

- [x] 5.1 Add `getProductTypeBadge(type)` to `productStatusConfig.utils.ts`.
- [x] 5.2 Insert non-hideable `type` column after `select` in `useProductColumns.ts` (9→10).
- [x] 5.3 Update `productsListColumns.regression.test.ts` to expect 10 cols with `type` second; record intent (R-201).
- [x] 5.4 Add `filterType` ref + `queryKey`/`queryFn` + reset watcher + `USelect` toolbar toggle + `#type-cell` `AppBadge` in `ProductsView.vue`.
- [x] 5.5 RED extend `ProductsView.test.ts`: SERVICIO refetches with `type=SERVICE` + resets pagination + clears selection; 10-col count; type-cell badge for SERVICE/PRODUCT.

## Phase 6 — Gate

- [x] 6.1 `pnpm test:unit` green; `pnpm build` clean.