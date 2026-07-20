# Design: POS Price List Tier Selection

## Technical Approach

Backend-authoritative design — the FE is a passive consumer. A new `PriceListSelector` dropdown (UInputMenu) plugs into `ActiveSalePanel`'s actions bar between the Venta/Pedido toggle and action buttons. On selection, it calls `PUT /sales/drafts/:id/price-list`, the backend reprices all non-sticky lines, and `replaceSaleInCache` updates the draft cache on success. Confirmation dialog (reusing `ConfirmModal`) guards against accidental repricing when the sale has items. The existing badge/strikethrough infrastructure renders tier-adjusted prices without changes.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Inline vs. component | Inline is simpler but couples the panel to selection logic | **Dedicated `PriceListSelector.vue`** — testable, reusable |
| Plain async vs. useQuery for lists | Plain async is lighter but fetches on every mount | **`useQuery` with `staleTime: 5min`** — avoids re-fetch on tab switches |
| Confirm always vs. only with items | Always is simpler but annoying for empty sales | **Confirm only when `items.length > 0`** — matches spec requirement |

## Data Flow

```
activeDraft.globalPriceListId (from cache)
  ↓ prop
PriceListSelector (UInputMenu)
  → user selects → pendingValue set
  → if items.length > 0: emit('request-confirm')
  → ActiveSalePanel shows ConfirmModal
    → on confirm: emit('change-price-list', { saleId, globalPriceListId })
      → SalesView calls setPriceList(saleId, globalPriceListId)
        → useSalesDrafts.setPriceListMutation.mutateAsync()
          → saleApi.setPriceList() → PUT /sales/drafts/:id/price-list
            → onSuccess: replaceSaleInCache(currentDrafts, updatedSale)
              → activeDraft recomputes → PriceListSelector re-renders
  → if items.length === 0: emit directly, no dialog
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/features/POS/sales/interfaces/sale.types.ts` | Modify | Add `globalPriceListId?: string \| null` to `Sale` (after `updatedAt`) |
| `src/features/POS/sales/api/sale.api.ts` | Modify | Add `setPriceList(saleId, { globalPriceListId }): Promise<Sale>` using `http.put` |
| `src/features/POS/sales/composables/useSalesDrafts.ts` | Modify | Add `setPriceListMutation`, `setPriceList()` async method, include in `isMutating` computed |
| `src/features/POS/sales/components/PriceListSelector.vue` | **Create** | Dropdown with pending-value/confirm flow |
| `src/features/POS/sales/components/ActiveSalePanel.vue` | Modify | Integrate selector in actions bar, add confirm dialog, new emits |
| `src/features/POS/sales/views/SalesView.vue` | Modify | Wire `setPriceList` mutation through to ActiveSalePanel |

## Type Design

```typescript
// sale.types.ts — Sale interface, add after `updatedAt` (line 417)
export interface Sale {
  // ... existing fields ...
  updatedAt: string
  globalPriceListId?: string | null   // ← NEW
  subtotalCents?: number
  // ...
}
```

No new types needed. `GlobalPriceList` from `product.types.ts:401-407` reused as-is.

## API Layer

```typescript
// sale.api.ts — add after line 185 (chargeDraft):
async setPriceList(saleId: string, payload: { globalPriceListId: string | null }): Promise<Sale> {
  const { data } = await http.put<Sale>(`/sales/drafts/${saleId}/price-list`, payload)
  return data
}
```

Returns `Sale` (200). Errors: 400 PRICE_LIST_NOT_FOUND, 403, 404, 409 — handled generically via Axios interceptor + toast.

## Composable Design

```typescript
// useSalesDrafts.ts — new mutation, following addItemMutation pattern:
const setPriceListMutation = useMutation({
  mutationFn: ({ saleId, globalPriceListId }: { saleId: string; globalPriceListId: string | null }) =>
    saleApi.setPriceList(saleId, { globalPriceListId }),
  onSuccess: (updatedSale) => {
    const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
    queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
    invalidateApplicablePromotions(updatedSale.id)
  },
  onError: () => {
    // Error toast handled in SalesView; cache reverted naturally (no optimistic update)
  },
})

// Add to isMutating computed:
|| setPriceListMutation.isPending.value

// Public method:
const setPriceList = async (saleId: string, globalPriceListId: string | null): Promise<Sale> => {
  return await setPriceListMutation.mutateAsync({ saleId, globalPriceListId })
}

// Add to return object: setPriceList
```

## Component: PriceListSelector.vue

**Props**: `activeDraft: Sale | null`, `isMutating: boolean`

**Emits**: `change-price-list: [globalPriceListId: string | null]`, `request-confirm: [globalPriceListId: string | null]`

**Internal state**:
- `pendingValue: string | null` — held during confirmation; null = "Sin lista"
- `priceListsQuery` via `useQuery({ queryKey: productQueryKeys.globalPriceLists(), queryFn: productApi.getGlobalPriceLists, staleTime: 5 * 60 * 1000 })`

**Template**: `UInputMenu` with items from `priceListsQuery.data` plus a "Sin lista" (`null`) option. Shows a `i-lucide-tags` icon + list name label when a list is active. Disabled when `isMutating` or query is loading. Selected value driven by `activeDraft.globalPriceListId`.

**Confirmation flow**: on selection, if `activeDraft.items.length > 0`, emit `request-confirm(pendingValue)`. If empty, emit `change-price-list(pendingValue)` directly.

## Component: ActiveSalePanel.vue Changes

**New emit**: `change-price-list: [globalPriceListId: string | null]`

**New props**: `onChangePriceList: (globalPriceListId: string | null) => Promise<unknown>`

**New state**: `priceListConfirmOpen: ref(false)`, `pendingPriceListId: ref<string | null>(null)`

**Template placement** — in actions bar (after Venta/Pedido toggle, before action buttons):
```html
<PriceListSelector
  :active-draft="activeDraft"
  :is-mutating="isMutating"
  @change-price-list="emit('change-price-list', $event)"
  @request-confirm="pendingPriceListId = $event; priceListConfirmOpen = true"
/>
```

**ConfirmModal** (below existing trash modal):
```html
<ConfirmModal
  v-model:open="priceListConfirmOpen"
  title="Cambiar lista de precios"
  description="Esto va a recalcular los precios de todos los ítems."
  @confirm="emit('change-price-list', pendingPriceListId); pendingPriceListId = null"
/>
```

## Component: SalesView.vue Changes

Wire through props/emits for `setPriceList`. No template changes — ActiveSalePanel integration is self-contained.

In `handleChangePriceList`:
```typescript
async function handleChangePriceList(globalPriceListId: string | null) {
  try {
    await setPriceList(activeDraftId.value, globalPriceListId)
  } catch {
    toast.add({ title: 'Error', description: 'No se pudo cambiar la lista de precios', color: 'error' })
  }
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit — PriceListSelector | Renders active name, placeholder for null, disabled state, emits | Vue Test Utils + Vitest |
| Unit — API | `setPriceList` calls correct URL with payload | Mock `http.put`, verify return type |
| Unit — Composable | `setPriceListMutation` updates cache, `isMutating` includes it | `queryClient.setQueryData` spy, `setupWithSpy` helper |
| Integration — ActiveSalePanel | Confirm appears only with items, cancel reverts, confirm calls emit | Mount with mock drafts, verify emit chain |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Open Questions

- [ ] Backend branch `feat/pos-price-list-tiers` merge status — FE can deploy first with graceful degradation (selector hidden if endpoint 404s)
