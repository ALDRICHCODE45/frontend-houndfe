# Exploration: POS Price List Tiers — Frontend Integration

> Date: 2026-07-19
> Backend branch: `feat/pos-price-list-tiers` (5 commits, NOT yet merged to main)
> Backend doc: `houndfe-backend/docs/pos-price-list-tiers-frontend.md`

## Executive Summary

The backend has implemented tier-aware pricing for POS drafts. Every mutation (`addItem`, `updateItemQuantity`, `assignCustomer`, price-list change) now triggers a repricing pipeline that re-resolves each line's `unitPriceCents` based on the active price list and the current quantity. **The FE is a passive consumer** — it just renders the response. The main work is: (1) adding a price list selector to the POS UI, (2) calling the new `PUT .../price-list` endpoint, (3) adding `globalPriceListId` to the `Sale` type, and (4) displaying the active price list name. The infrastructure for tier pricing display (`priceSource`, badges, `originalPriceCents`) already exists.

---

## 1. API Surface Audit

### 1.1 Existing Frontend API (`src/features/POS/sales/api/sale.api.ts`)

| Frontend Method | HTTP Call | Backend Doc Matches? | Notes |
|---|---|---|---|
| `createDraft()` | `POST /sales/drafts` | ✅ | Returns `Sale` |
| `listDrafts()` | `GET /sales/drafts` | ✅ | Returns `Sale[]` |
| `addItem(saleId, payload)` | `POST /sales/drafts/:id/items` | ✅ | Backend now returns tier-adjusted prices |
| `updateItemQty(saleId, itemId, payload)` | `PATCH /sales/drafts/:id/items/:itemId` | ✅ | Backend now re-prices all non-sticky lines |
| `getAvailablePrices(saleId, itemId)` | `GET /sales/drafts/:id/items/:itemId/available-prices` | ✅ | Used by PriceOverrideModal |
| `updateItemPrice(saleId, itemId, payload)` | `PATCH /sales/drafts/:id/items/:itemId/price` | ✅ | Override price (sticky = never repriced) |
| `applyItemDiscount(...)` | `PATCH /sales/drafts/:id/items/:itemId/discount` | ✅ | |
| `removeItemDiscount(...)` | `DELETE /sales/drafts/:id/items/:itemId/discount` | ✅ | |
| `removeItem(...)` | `DELETE /sales/drafts/:id/items/:itemId` | ✅ | |
| `clearItems(...)` | `DELETE /sales/drafts/:id/items` | ✅ | |
| `closeDraft(...)` | `DELETE /sales/drafts/:id` | ✅ | |
| `assignCustomer(saleId, payload)` | `PUT /sales/drafts/:id/customer` | ⚠️ **MISMATCH** | Backend doc says `POST .../assign-customer` |
| `unassignCustomer(...)` | `DELETE /sales/drafts/:id/customer` | ✅ | |
| `assignShippingAddress(...)` | `PUT /sales/drafts/:id/shipping-address` | ✅ | |
| `chargeDraft(...)` | `POST /sales/drafts/:id/charge` | ✅ | |
| `applyGlobalDiscount(...)` | `PATCH /sales/drafts/:id/discount` | ✅ | |
| `getById(...)` | `GET /sales/:id` | ✅ | Returns `SaleDetail` |
| **MISSING** | `PUT /sales/drafts/:id/price-list` | ❌ **GAP** | New endpoint — needs frontend call |

### 1.2 Endpoint with Behavior Change

| Endpoint | What Changed | FE Impact |
|---|---|---|
| `POST .../items` | `unitPriceCents` now tier-aware; response includes full draft | **None** — FE already replaces draft in cache |
| `PATCH .../items/:itemId/quantity` | Dispatches repricing of ALL non-sticky lines | **None** — FE already renders response |
| `POST .../assign-customer` | May auto-assign customer's `globalPriceListId` | **⚠️ NEEDS VERIFICATION** — FE currently calls `PUT /sales/drafts/:id/customer`, NOT `POST .../assign-customer`. Verify with backend whether these are the same route or different. |
| `GET /sales/drafts/:id` | Now includes `globalPriceListId` | **Type gap** — `Sale` type needs new field |
| `GET /sales/drafts` | Each draft now includes `globalPriceListId` | **Type gap** — `Sale` type needs new field |

### 1.3 Axios HTTP Client

Confirmed: `@/core/shared/api/http.ts` exports an axios instance with:
- `baseURL`: `VITE_API_BASE_URL` env var (defaults to `http://localhost:3000`)
- JWT interceptor (Bearer token on every request)
- Refresh-token interceptor (transparent 401 → refresh → retry)
- No-cache headers on GETs

---

## 2. Type Gap Analysis

### 2.1 `Sale` Interface (`sale.types.ts:409-426`)

**MISSING FIELD: `globalPriceListId`**

```typescript
export interface Sale {
  id: string
  userId: string
  status: SaleStatus
  items: SaleItem[]
  customer?: SaleDraftCustomer | null
  shippingAddress?: CustomerAddress | null
  createdAt: string
  updatedAt: string
  subtotalCents?: number
  discountCents?: number
  totalCents?: number
  appliedOrderPromotion?: AppliedOrderPromotion | null
  // ❌ MISSING: globalPriceListId?: string | null
}
```

### 2.2 `PriceSource` Type (`sale.types.ts:25`)

**ALREADY CORRECT** — no changes needed.

```typescript
export type PriceSource = 'default' | 'price_list' | 'custom'
```

The backend doc confirms `priceSource` values are:
- `"price_list"` — price came from a list (sale-level or override)
- `"custom"` — cashier overrode the price manually
- `"default"` — using the product's base/default price

### 2.3 `SaleItem` Interface (`sale.types.ts:314-349`)

**NO STRUCTURAL GAPS** — all traceability fields already exist:

| Field | Already Exists? | Notes |
|---|---|---|
| `id`, `productId`, `variantId`, `productName`, `variantName` | ✅ | |
| `quantity`, `unitPriceCents`, `unitPriceCurrency` | ✅ | |
| `originalPriceCents` | ✅ `originalPriceCents?: number \| null` | Used by badge logic |
| `priceSource` | ✅ `priceSource?: PriceSource \| null` | Drives "PRECIO LISTA" / "PRECIO MANUAL" badges |
| `appliedPriceListId` | ✅ `appliedPriceListId?: string \| null` | Item-level price list override |
| `customPriceCents` | ✅ |
| `discountType`, `discountValue`, `discountAmountCents`, `discountTitle` | ✅ |
| `promotionId`, `rewardKind`, `rewardDiscountPercent` | ✅ |
| `subtotalCents` | ✅ |

### 2.4 `SaleDetailItem` Interface (`sale.types.ts:94-126`)

**NO GAPS** — same traceability fields as `SaleItem`. Confirmed sale detail view does NOT need `globalPriceListId` (it's a snapshot, not an editable draft).

### 2.5 Pre-existing Global Price List Types

**Already in `product.types.ts:401-407`**:

```typescript
export interface GlobalPriceList {
  id: string
  name: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}
```

Also: `productApi.getGlobalPriceLists()` → `GET /price-lists` — **reusable as-is**.

### 2.6 Customer Types Already Have `globalPriceListId`

`CustomerBackendResponse.globalPriceListId` and `CustomerBackendResponse.globalPriceList?: { id, name }` already exist. The customer form already handles selecting a price list for the customer.

---

## 3. UI Component Map

### 3.1 POS View Hierarchy

```
SalesView.vue (main 60/40 split layout)
├── ProductSearchPanel (left 60% — product catalog)
│   └── ProductSearchResults → ProductSearchResultItem
├── ActiveSalePanel (right 40% — active cart)
│   ├── SalesTabsStrip (draft tab bar)
│   ├── [Actions row: type toggle, trash, 3-dot menu]
│   ├── [Items list]
│   │   └── SaleItemRow (per item)
│   │       ├── SaleItemBadges (priceSource, promo, discount badges)
│   │       ├── PriceOverrideModal
│   │       ├── ItemDiscountModal
│   │       └── ProductDetailModal
│   ├── PromocionesDisponiblesAccordion
│   └── SaleTotalsFooter (totals + charge button)
├── PaymentModal
├── PaymentSuccessModal
├── AssignCustomerSlideover
└── ConfirmModal (veto promo + other confirms)
```

### 3.2 Where Price List Info Would Be Displayed

**ActiveSalePanel.vue** — The **customer slot** (lines 251-301) is the natural place:

```html
<!-- Current: customer slot -->
<div class="border-t border-default px-4 py-2 ...">
  <!-- Customer info (or "Sin asignar") -->
</div>
```

This section already shows customer info and could be extended to show the active price list name. Alternatively, a dedicated price-list selector could be added **between the actions row and the items list**, or **within the actions row** (line 171-208).

### 3.3 Where the Price List Selector Would Plug In

**Best location: Actions row in `ActiveSalePanel.vue`** (line 171-208), between the "Venta/Pedido" toggle and the action buttons. This is where sale-level metadata controls live.

Alternative: **Customer slot** (line 251-301), displayed alongside customer info since the price list is often customer-driven.

### 3.4 Component That Renders Price Origin

**`SaleItemBadges.vue`** already handles `priceSource === 'price_list'`:
- Renders "PRECIO LISTA" badge with `i-lucide-tags` icon (tone: `info`)
- Shows only when `originalPriceCents != null && originalPriceCents !== unitPriceCents`
- **No changes needed** — this is future-proof for the new backend behavior

### 3.5 Component That Renders Strikethrough Prices

**`SaleItemRow.vue:104-115`** — `showPriceOrigin` computed:
```typescript
const showPriceOrigin = computed(
  () =>
    ['price_list', 'custom'].includes(props.item.priceSource ?? '') &&
    props.item.originalPriceCents != null &&
    props.item.originalPriceCents > props.item.unitPriceCents,
)
```

This already renders the struck-through original price when the tier-adjusted price is lower. **No changes needed**.

---

## 4. Integration Points

### 4.1 New API Method Needed

**File**: `src/features/POS/sales/api/sale.api.ts`

Add after `chargeDraft`:
```typescript
async setPriceList(saleId: string, payload: { globalPriceListId: string | null }): Promise<Sale> {
  const { data } = await http.put<Sale>(`/sales/drafts/${saleId}/price-list`, payload)
  return data
}
```

### 4.2 New Mutation in useSalesDrafts

**File**: `src/features/POS/sales/composables/useSalesDrafts.ts`

Add `setPriceListMutation` following the existing mutation pattern:
```typescript
const setPriceListMutation = useMutation({
  mutationFn: ({ saleId, globalPriceListId }: { saleId: string; globalPriceListId: string | null }) =>
    saleApi.setPriceList(saleId, { globalPriceListId }),
  onSuccess: (updatedSale) => {
    const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
    queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
    invalidateApplicablePromotions(updatedSale.id)
  },
})
```

### 4.3 New Price List Selector Component

**New file (recommended)**: `src/features/POS/sales/components/PriceListSelector.vue`

A dropdown/select in the ActiveSalePanel's actions row that:
1. Fetches global price lists using `productApi.getGlobalPriceLists()` (already exists)
2. Shows the currently selected price list name
3. On change, calls the `setPriceList` mutation
4. Has a "Sin lista" (clear/null) option

Alternatively, could be implemented inline in ActiveSalePanel if the component is simple enough.

### 4.4 Type Changes

**File**: `src/features/POS/sales/interfaces/sale.types.ts`

Add to `Sale` interface:
```typescript
globalPriceListId?: string | null
```

### 4.5 assignCustomer Endpoint Verification

The backend doc mentions `POST /sales/drafts/:id/assign-customer` as the endpoint that may auto-assign the customer's price list. The frontend currently calls `PUT /sales/drafts/:id/customer`. These could be:
- **Same endpoint (route aliasing)**: No change needed
- **Different endpoints**: Frontend needs to switch to `POST .../assign-customer` to get the auto-assignment behavior

**ACTION**: Verify with backend team before implementing.

### 4.6 Data Flow Sketch

```
PriceListSelector (dropdown)
  → calls setPriceList(saleId, globalPriceListId)
    → saleApi.setPriceList() → PUT /sales/drafts/:id/price-list
      → backend re-prices all lines and returns Sale
        → useSalesDrafts.setPriceListMutation.onSuccess
          → replaceSaleInCache (updates draft + items)
            → ActiveSalePanel re-renders with new prices
              → SaleItemRow shows adjusted unitPriceCents
              → SaleItemBadges shows "PRECIO LISTA" if price changed
```

---

## 5. Pre-existing Infrastructure (No Changes Needed)

| Component | What It Already Does |
|---|---|
| `SaleItemBadges.vue` | Renders "PRECIO LISTA" badge for `priceSource === 'price_list'` |
| `SaleItemRow.vue` | Shows struck-through original price when tier-adjusted |
| `ProductSearchPanel.vue` / `SalesView.vue:handleAddProduct` | Calls `addItem()` → backend already returns tier-adjusted price |
| `SalesView.vue:handleUpdateQty` | Calls `updateQty()` → backend already reprices on qty change |
| `productApi.getGlobalPriceLists()` | Fetches all price lists — reusable |
| `GlobalPriceList` type | Already defined in `product.types.ts` |
| `SaleItem.priceSource`, `.originalPriceCents`, `.appliedPriceListId` | Already defined in `sale.types.ts` |
| `PriceOverrideModal.vue` | Uses `getAvailablePrices()` — no change (override = sticky = never repriced) |
| `useDraftCustomerAssignment` | Handles customer assignment — no change needed (backend auto-assigns list) |

---

## 6. Effort Estimate

| Area | Files | Lines (approx) | Complexity |
|---|---|---|---|
| **Type changes** (`Sale.globalPriceListId`) | 1 | +2 | Trivial |
| **API method** (`setPriceList`) | 1 | +5 | Trivial |
| **Mutation** (`useSalesDrafts`) | 1 | +20 | Low |
| **Price list selector** (component or inline) | 1 (new) or 1 (edit) | +80-120 | Medium |
| **ActiveSalePanel integration** | 1 | +10 | Low |
| **SalesView wiring** (props/emits passthrough) | 1 | +15 | Low |
| **AssignCustomer endpoint alignment** | 1 (if needed) | +5 | Trivial |
| **Tests** (unit + integration) | 3-4 | +200-300 | Medium |
| **TOTAL** | ~7 files | ~350-480 lines | |

### Breakdown by Work Type

- **New code**: ~150 lines (component + API + mutation)
- **Wiring/integration**: ~30 lines (props + emits + template)
- **Type changes**: ~3 lines
- **Tests**: ~250 lines (component test, composable test, API test, integration in SalesView)

---

## 7. Risks

1. **`assignCustomer` endpoint mismatch**: Frontend calls `PUT /sales/drafts/:id/customer` but backend doc mentions `POST .../assign-customer`. If these are different endpoints, the auto-assignment won't work until the FE switches.
2. **`globalPriceListId` on confirmed sales**: The `SaleDetail` type doesn't need it (confirmed sales are immutable snapshots), but `GET /sales/drafts` in list view might return it. The current `GET /sales/drafts` is used only for the tab list — the list view for confirmed sales uses `GET /sales` with `SaleDetail` responses.
3. **No price list API caching**: `productApi.getGlobalPriceLists()` doesn't use TanStack Query — it's a plain async call. The price list selector would need to either use `useQuery` or call it on mount. **Recommend using `useQuery` with appropriate `staleTime`**.
4. **Race condition**: Changing price list while `addItem` is in-flight could cause inconsistent cache state. The existing `isMutating` computed already gates UI interactions, but the price list selector should also be disabled during mutations.

---

## 8. Ready for Proposal

**Yes** — the exploration is complete. The FE changes are well-scoped (primarily additive) and the existing infrastructure already handles the core tier-pricing display. The only unknown is the `assignCustomer` endpoint alignment. The price list selector is the main new UI piece.

### Summary of What Needs to Happen

1. Add `globalPriceListId` to `Sale` type
2. Add `setPriceList()` API method
3. Add `setPriceListMutation` to `useSalesDrafts` composable
4. Create a price list selector dropdown (new component or in ActiveSalePanel)
5. Wire it through SalesView → ActiveSalePanel
6. Verify `assignCustomer` endpoint with backend
7. Write tests
8. Build verification (`pnpm build`)
