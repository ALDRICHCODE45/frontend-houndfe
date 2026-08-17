# Design: product-service-type

## Technical Approach

Centralize the type matrix as pure helpers in `useProductForm.ts` (consumed by both form surfaces + all three variant render points). Payload sanitation lives in the existing builders; the `watch(formState.type)` is narrowed; the list mirrors promotions' `?type=` filter with idempotent local fallback; mappers add `type`/`serviceDetail` gracefully.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Pure helpers vs composable | Testable + importable everywhere; composable adds unused reactivity | Pure helpers in `useProductForm.ts` |
| `serviceDetail` nested vs flat | Nested = 1:1 with payload/API; flat needs join/split in 3 places | Nested |
| SERVICE `purchaseCost` omit vs zeroed | Backend forces `NET/0` regardless | Omit key |
| Local fallback conditional vs always | Server-filtered ⊆ local pass → idempotent | Always when `params.type` set |
| Toggle `USelect` vs dropdown vs v2 | 3 options, zero state | `USelect` in `#actions` |
| One `variantSchema` vs per-type | Hidden fields stay `''`/`0` | Keep one; hide via template |

```
ProductsView ─ filterType ─▶ useServerTable ─▶ getPaginated ─▶ ?type= + applyLocalTypeFilter ─▶ badge
DetailView/Slideover ─ formState.type ─▶ helpers ─▶ v-if + payload builders
```

## File Changes

| File | Action | Description |
|---|---|---|
| `interfaces/product.types.ts` | Modify | `ProductType`, `ServiceDetail`, `Product.type`, `serviceDetail` on Detail/BackendResponse/CreatePayload/FormInput |
| `composables/useProductForm.ts` | Modify | Helpers, `SERVICE_UNIT_OPTIONS`, serviceDetail schema/state/mapper, payload type-branches |
| `api/product.api.ts` | Modify | `ProductFilters`/`ProductTableParams`, `type` param + fallback, mapper additions |
| `views/ProductDetailView.vue` | Modify | Watch correction, serviceDetail card, transition guard/toast, variant hiding + payload omission |
| `components/ProductUpsertSlideover.vue` | Modify | D1 hiding for SERVICE; `locationLabelFor` |
| `views/ProductsView.vue` | Modify | `filterType` + queryKey/queryFn + reset watcher, `#type-cell`, `USelect` |
| `composables/useProductColumns.ts` | Modify | Non-hideable `type` column (9→10) |
| `components/VariantDetailModal.vue` | Modify | `productType` prop, SERVICE keys `['purchaseCost']` |
| `utils/productStatusConfig.utils.ts` | Modify | `getProductTypeBadge(type)` |
| 2 test files | Modify | Intentional 9→10 + new tests |

## Interfaces / Contracts

```ts
export type ProductType = 'PRODUCT' | 'SERVICE'
export interface ServiceDetail { capacity: number | null; notes: string | null }
// Product += type; Detail/BackendResponse/CreatePayload += serviceDetail?; FormInput += serviceDetail { capacity: number | null; notes: string }

export const SERVICE_UNIT_OPTIONS = [/* HORA SESION DIA CONSULTA CURSO PAQUETE */] as const
export function isService(type: ProductType): boolean
export function unitOptionsFor(type: ProductType): readonly { label: string; value: string }[]
export function locationLabelFor(type: ProductType): 'Zona de servicio' | 'Ubicación en almacén'
export function inventoryFieldsVisible(type: ProductType): boolean  // type === 'PRODUCT'; gates 3 variant forms
export function serviceDetailPopulated(sd): boolean  // capacity != null || notes.trim() !== ''

export interface ProductFilters { type?: 'PRODUCT' | 'SERVICE' }
export type ProductTableParams = ServerTableParams & ProductFilters
function normalizeServiceDetail(raw): ServiceDetail | null
// null→null; capacity: integer ≥1 else null; notes: trimmed or null
function applyLocalTypeFilter(rows: Product[], type?): Product[]
```

**Payloads** (`toCreatePayload`; `toUpdatePayload` delegates): when `type==='SERVICE'` return the PRODUCT field set minus sku/barcode/brandId/purchaseCost/lots, with `useStock:false, useLotsAndExpirations:false, quantity:0, minQuantity:0`, `serviceDetail` included only when `serviceDetailPopulated`. PRODUCT branch unchanged.

**`getPaginated`**: params `{ ...(globalFilter ? {search,q} : {}), ...(params.type ? { type: params.type } : {}) }`; after `mapProduct`, `if (params.type) rows = applyLocalTypeFilter(rows, params.type)` (unconditional, idempotent).

**Type watch** (567–585): remove `hasVariants=false` + `pendingVariants`/`pendingPriceLists` clears; keep `useStock=false, useLotsAndExpirations=false, quantity=0, minQuantity=0`, clear `pendingLots` only. PRODUCT→SERVICE (edit, stock/lots) → `openConfirm` via computed radio proxy; SERVICE→PRODUCT → `useStock=true` + warning toast. `mapDomainError` adds `PRODUCT_TYPE_CHANGE_BLOCKED` → Spanish message. Coupling watches (588–619) untouched.

**Variants**: `inventoryFieldsVisible(formState.type)` guards sku/barcode/quantity/minQuantity in the variant modal (3007–3021) and pending modal (2608–2646); `VariantDetailModal` gains `productType: ProductType`, guards General/Existencias cards, SERVICE save keys `['purchaseCost']`. `handleSubmitVariant` + `buildFullCreatePayload.variants` omit those fields for SERVICE.

**Badge**: `getProductTypeBadge(type)` returns `{ tone: 'info'|'neutral'; label: 'Servicio'|'Producto' }`; `#type-cell` renders `<AppBadge>`; column `{ id: 'type', header: createSimpleHeader('Tipo'), enableHiding: false, enableSorting: false }`.

## Testing Strategy (strict_tdd — RED first)

| Layer | RED test | Spec scenario |
|---|---|---|
| Unit `useProductForm` | `unitOptionsFor` 8/6; `locationLabelFor`; `inventoryFieldsVisible`; SERVICE payload omits/forces; serviceDetail populated-only | products REQ-2/3/5 |
| Unit `product.api` | `mapProduct.type` default; `normalizeServiceDetail` null/both-null/valid; `type` param conditional; fallback filters mixed rows | products-list REQ-1/2 |
| Unit utils | `getProductTypeBadge` | products-list REQ-4 |
| Component `ProductDetailView` | SERVICE keeps variants; coupling watches intact; confirm/toast | products REQ-6/7 |
| Component `ProductsView` | toggle → refetch + reset; badge; 10 cols | products-list REQ-3/4 |
| Regression | 9→10 pins updated intentionally (R-201) | products-list REQ-4 |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

None. Additive; revert restores prior behavior. Verify backend `?type=` whitelist in dev — fallback guarantees correctness either way.

## Open Questions

- None blocking. (Card-mode type badge: out of scope; free later once `Product.type` exists.)
