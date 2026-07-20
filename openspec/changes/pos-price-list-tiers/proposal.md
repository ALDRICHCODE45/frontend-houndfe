# Proposal: POS Price List Tier Selection

## Intent

The backend now supports tier-aware pricing for POS drafts — every mutation re-prices line items based on the active price list and quantity. Cashiers need a way to select a price list on the draft to unlock tier-based pricing (wholesale, volume discounts). Today, there is NO price list selector in the POS UI; the backend's tier-pricing pipeline is unreachable from the frontend.

## Scope

### In Scope
- Price list dropdown selector in the ActiveSalePanel actions bar (alongside the Venta/Pedido toggle)
- Calling `PUT /sales/drafts/:id/price-list` on selection change
- Confirmation dialog when changing the price list on a sale that already has items
- Displaying the active price list name in the ActiveSalePanel
- Adding `globalPriceListId?: string | null` to the `Sale` type
- Adding `setPriceList()` API method and `setPriceListMutation` to `useSalesDrafts`

### Out of Scope
- Tier indicators per line item (badges showing "wholesale tier 5+")
- Quantity threshold warnings ("add 3 more for the next tier")
- Changes to `SaleItemBadges`, `SaleItemRow`, or `PriceOverrideModal` — existing infrastructure already handles pricing display automatically
- Modifying the `assignCustomer` endpoint — backend confirmed `PUT /sales/drafts/:id/customer` already auto-assigns the customer's `globalPriceListId`

## Current State

- **No price list selector exists in the POS**. Cashiers can assign customers, override prices, and apply discounts, but there is no way to select a price list for a draft.
- **`Sale` type lacks `globalPriceListId`**. Draft responses from `GET /sales/drafts` and `GET /sales/drafts/:id` already include this field from the backend (branch `feat/pos-price-list-tiers`), but the frontend type doesn't accept it.
- **`assignCustomer` already works**. Backend confirmed it auto-assigns the customer's `globalPriceListId` when the cashier hasn't explicitly chosen one. No FE endpoint change needed.
- **The rendering infrastructure is ready**. `SaleItemBadges`, `SaleItemRow` strikethrough logic, and `priceSource`/`originalPriceCents` fields are already in place and will render tier-adjusted prices correctly without changes.

## Target State

- A `UInputMenu` (or similar dropdown) in the ActiveSalePanel actions bar shows/hides the active price list name
- Changing the price list calls `PUT /sales/drafts/:id/price-list`, the backend reprices all non-sticky lines, and the UI re-renders from the response
- If the sale has items, a confirmation dialog warns: "Esto va a recalcular los precios de todos los ítems"
- The active price list name is visible inline (e.g., "Lista: Mayorista")
- Unsetting the list (null) clears tier pricing — items revert to default (PUBLICO)

## Approach

1. **Type**: Add `globalPriceListId?: string | null` to `Sale` interface in `sale.types.ts`
2. **API**: Add `setPriceList(saleId, { globalPriceListId })` → `PUT /sales/drafts/:id/price-list` in `sale.api.ts`
3. **Composable**: Add `setPriceListMutation` to `useSalesDrafts.ts`, following the existing mutation pattern with `replaceSaleInCache` on success
4. **Component**: New `PriceListSelector.vue` component using `productApi.getGlobalPriceLists()` (already exists) to populate options, wired into ActiveSalePanel's actions bar
5. **Confirmation**: Reuse existing `ConfirmModal` pattern from ActiveSalePanel (already used for trash clear) to guard the price list change when `items.length > 0`
6. **Wiring**: Pass `globalPriceListId` from `activeDraft` down to the selector, emit the mutation call up through SalesView

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `sale.types.ts` | Modified | Add `globalPriceListId` to `Sale` interface |
| `sale.api.ts` | Modified | Add `setPriceList()` method |
| `useSalesDrafts.ts` | Modified | Add `setPriceListMutation` |
| `PriceListSelector.vue` | New | Dropdown component for selecting price list |
| `ActiveSalePanel.vue` | Modified | Integrate selector in actions bar + confirmation dialog |
| `SalesView.vue` | Modified | Wire `setPriceList` mutation through props/emits |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Price list API not cached — `productApi.getGlobalPriceLists()` is a plain async call, not TanStack Query | Low | Wrap in `useQuery` with `staleTime: 5min` to avoid re-fetching on every render |
| Race condition: changing price list while `addItem` is in-flight | Low | Disable the selector when `isMutating` is true (existing pattern in ActiveSalePanel) |
| Backend branch not merged yet — testing requires `feat/pos-price-list-tiers` branch | Medium | Document the backend branch dependency; FE can be merged first with no-op (selector hidden if endpoint 404s) |
| `ConfirmModal` misuse — might lack loading state during the mutation | Low | Match the existing `trashConfirmOpen` pattern; disable buttons during `isMutating` |

## Rollback Plan

- Remove `PriceListSelector.vue` and revert its integration in `ActiveSalePanel.vue`
- Remove `globalPriceListId` from `Sale` type
- Remove `setPriceList` API method and `setPriceListMutation`
- UI reverts to no-selector state; backend tier pricing remains unreachable from FE

## Dependencies

- Backend branch `feat/pos-price-list-tiers` merged to main (or FE merged separately with graceful degradation)
- `productApi.getGlobalPriceLists()` (already exists in `product.api.ts`)
- `GlobalPriceList` type (already exists in `product.types.ts`)

## Success Criteria

- [ ] Cashier can select a price list from the actions bar dropdown
- [ ] Changing the price list on a sale WITH items shows confirmation dialog
- [ ] Changing the price list on an EMPTY sale applies immediately (no dialog)
- [ ] Active price list name is displayed inline in the action bar
- [ ] `pnpm test:unit` passes all new and existing tests
- [ ] `pnpm build` succeeds with no type errors
- [ ] Tier-adjusted prices from the backend response render correctly (via existing badge/strikethrough infrastructure, no new code needed)

## Capabilities

### New Capabilities
- `pos-price-list-selection`: Price list dropdown selector in the POS draft cart, enabling cashiers to assign tier-based pricing lists to sales

### Modified Capabilities
- `sales`: Sale type extended with `globalPriceListId` field; draft cart accepts price list selection state
