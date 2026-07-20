# Tasks: POS Price List Tier Selection

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~430 (180 code + 250 tests) |
| 400-line budget risk | Medium |
| Chained commits recommended | Yes (work-unit commits, no PRs) |
| Delivery strategy | single-pr (solo dev, single `feat/pos-price-list-tiers` branch) |
| Chain strategy | N/A (single branch, work-unit commits only) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Type + API + composable (foundation) | N/A (commit) | `pnpm test:unit -- src/features/POS/sales/api/__tests__/sale.api.test.ts src/features/POS/sales/composables/__tests__/useSalesDrafts.test.ts` | `pnpm build` (type-check) | Revert sale.types.ts + sale.api.ts + useSalesDrafts.ts changes; no component code depends yet |
| 2 | PriceListSelector component + ActiveSalePanel wiring | N/A (commit) | `pnpm test:unit -- src/features/POS/sales/components/__tests__/PriceListSelector.test.ts` | N/A (no runtime without SalesView wiring) | Delete PriceListSelector.vue + revert ActiveSalePanel changes; API layer stays intact |
| 3 | SalesView wiring + build verification | N/A (commit) | `pnpm test:unit && pnpm build` | `pnpm dev` — open POS, assign price list, verify pricing | Revert SalesView changes; component stays, just unwired |

---

## Phase 1: Foundation (Type + API + Composable)

### Task 1: Add `globalPriceListId` to `Sale` type
- **Files**: `src/features/POS/sales/interfaces/sale.types.ts`
- **Depends on**: none
- **Test**: `pnpm build` — TypeScript must not error on existing fixtures that omit the field
- **Implementation**: Add `globalPriceListId?: string | null` after `updatedAt` (line 417) in the `Sale` interface
- **Verify**: `pnpm build` (type-check passes; existing tests compile)
- **Commit message**: `feat(sales): add globalPriceListId to Sale interface`

### Task 2: Add `setPriceList` API method
- **Files**: `src/features/POS/sales/api/sale.api.ts`, `src/features/POS/sales/api/__tests__/sale.api.test.ts`
- **Depends on**: Task 1 (type must exist)
- **Test**: Write RED test in `sale.api.test.ts` — mock `http.put` to verify: (a) calls `PUT /sales/drafts/:id/price-list` with `{ globalPriceListId }`, (b) returns the `Sale` from `response.data`, (c) handles `null` payload for clearing. Follow existing `describe('createDraft', ...)` pattern.
- **Implementation**: Add `setPriceList(saleId, payload)` method after `chargeDraft` (line 186) using `http.put<Sale>()`. Returns `Promise<Sale>`.
- **Verify**: `pnpm test:unit -- src/features/POS/sales/api/__tests__/sale.api.test.ts`
- **Commit message**: `feat(sales): add setPriceList API method`

### Task 3: Add `setPriceListMutation` to `useSalesDrafts`
- **Files**: `src/features/POS/sales/composables/useSalesDrafts.ts`, `src/features/POS/sales/composables/__tests__/useSalesDrafts.test.ts`
- **Depends on**: Task 2 (API method must exist)
- **Test**: Write RED test in `useSalesDrafts.test.ts` using `setupWithSpy` helper: (a) mutation replaces sale in cache via `replaceSaleInCache`, (b) invalidates applicable promotions, (c) `isMutating` includes `setPriceListMutation.isPending`, (d) error does not update cache. Follow existing `addItemMutation` test pattern.
- **Implementation**: Add `setPriceListMutation` (useMutation) following `addItemMutation` pattern — `replaceSaleInCache` + `invalidateApplicablePromotions` on success. Add `setPriceList()` async method using `mutateAsync`. Add to `isMutating` computed and return object.
- **Verify**: `pnpm test:unit -- src/features/POS/sales/composables/__tests__/useSalesDrafts.test.ts`
- **Commit message**: `feat(sales): add setPriceList mutation to useSalesDrafts`

---

## Phase 2: Presentation (Component)

### Task 4: Create `PriceListSelector.vue` component
- **Files**: `src/features/POS/sales/components/PriceListSelector.vue` (new), `src/features/POS/sales/components/__tests__/PriceListSelector.test.ts` (new)
- **Depends on**: Task 1 (Sale type), `productApi.getGlobalPriceLists()` (already exists)
- **Test**: Write RED component test: (a) renders active list name from `activeDraft.globalPriceListId`, (b) renders placeholder when `null`, (c) `disabled` attribute when `isMutating: true`, (d) emits `change-price-list` directly when `items.length === 0`, (e) emits `request-confirm` when `items.length > 0`, (f) "Sin lista" option in dropdown. Use `mount` + stubs (`UInputMenu`, `UIcon`, `USkeleton`).
- **Implementation**: `<script setup lang="ts">` — `defineProps<{ activeDraft: Sale | null; isMutating: boolean }>()`, `defineEmits<{ 'change-price-list': [string | null]; 'request-confirm': [string | null] }>()`. Internal: `useQuery` for `productQueryKeys.globalPriceLists()` → `productApi.getGlobalPriceLists` with `staleTime: 5min`. `UInputMenu` with items from query + `{ label: 'Sin lista', id: '__none__' }` option. "Lista: [Nombre]" label display with `i-lucide-tags` icon when active.
- **Verify**: `pnpm test:unit -- src/features/POS/sales/components/__tests__/PriceListSelector.test.ts`
- **Commit message**: `feat(sales): add PriceListSelector component`

---

## Phase 3: Integration

### Task 5: Wire PriceListSelector into ActiveSalePanel
- **Files**: `src/features/POS/sales/components/ActiveSalePanel.vue`, `src/features/POS/sales/components/__tests__/ActiveSalePanel.spec.ts`
- **Depends on**: Task 4 (component must exist)
- **Test**: Write RED integration test: (a) PriceListSelector renders in actions bar between Venta/Pedido toggle and action buttons, (b) confirm dialog appears when `request-confirm` emitted on sale with items, (c) confirm emits `change-price-list`, (d) cancel reverts selector. Use existing mock draft fixtures.
- **Implementation**: Import `PriceListSelector`. Add `priceListConfirmOpen: ref(false)` and `pendingPriceListId: ref<string | null>(null)`. Add new emit `'change-price-list': [string | null]`. Place `<PriceListSelector>` in template between `UTabs` and the `<div class="flex-1">` spacer (line 180-181 area). Add `<ConfirmModal>` for price list change below existing confirm modals.
- **Verify**: `pnpm test:unit -- src/features/POS/sales/components/__tests__/ActiveSalePanel.spec.ts`
- **Commit message**: `feat(sales): wire PriceListSelector into ActiveSalePanel`

### Task 6: Wire `setPriceList` through SalesView
- **Files**: `src/features/POS/sales/views/SalesView.vue`, `src/features/POS/sales/views/__tests__/SalesView.test.ts`
- **Depends on**: Task 3 (composable), Task 5 (ActiveSalePanel emit)
- **Test**: Write RED integration test: verify that on `change-price-list` emit from ActiveSalePanel, `setPriceList` is called with correct args and error toast fires on failure.
- **Implementation**: Destructure `setPriceList` from `useSalesDrafts()`. Wire `@change-price-list` on `<ActiveSalePanel>` to `handleChangePriceList(globalPriceListId)`: calls `setPriceList(activeDraftId, globalPriceListId)`, catches errors with `toast.add({ title: 'Error', description: 'No se pudo cambiar la lista de precios', color: 'error' })`.
- **Verify**: `pnpm test:unit -- src/features/POS/sales/views/__tests__/SalesView.test.ts`
- **Commit message**: `feat(sales): wire setPriceList mutation through SalesView`

---

## Phase 4: Build Verification

### Task 7: Full test suite + build verification
- **Files**: none (verification only)
- **Depends on**: Tasks 1–6
- **Test**: Run full test suite and type-check build
- **Implementation**: No code changes — confirm `pnpm test:unit` passes all tests, `pnpm build` succeeds with zero type errors, `pnpm dev` loads POS without console errors.
- **Verify**: `pnpm test:unit && pnpm build`
- **Commit message**: N/A (verification, no code changes)
