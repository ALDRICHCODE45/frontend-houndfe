# Tasks: Standardize Card Grids

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180 total (3 commits, ~60/commit) |
| 400-line budget risk | Low |
| Delivery strategy | structured commits on main |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Test cmd | Harness | Rollback |
|------|------|----------|---------|----------|
| T1 | Sales card + grid + view | `pnpm vitest run POS/sales` | `/pos/ventas` cards mode | Revert T1; stub restored; `AppDataTable.vue` untouched → falls back to `#mobile-card` |
| T2 | Quotations card + grid + view | `pnpm vitest run POS/quotations` | `/pos/cotizaciones` cards mode | Revert T2; ConfirmModal flow unchanged |
| T3 | Products tokens + ladder | `pnpm vitest run POS/products` | `/pos/productos` card view | Revert T3 only |

## Phase 1: Sales Work Unit (T1, one commit)

- [x] 1.1 Redesign `SaleCard.vue`: drop `RouterLink+UCard` → `<article>` with EmployeeCard classes (`border-default`/`bg-default`); `EntityAvatar` (seed=sale.id, dot on CONFIRMED); customer + folio; chip row (2× `StatusDotBadge` + optional debt); dashed divider; 2-col body (Total/Fecha/Cliente/Método); debt row spans both cols with `mt-2`. Emit `click`. Keep testids `sale-card-debt` + `sale-card-due-date`.
- [x] 1.2 Create `SaleCardGrid.vue`: props `{ sales, loading, empty }`, emits `card-click`. Employee ladder. 8 pulse skeletons (`border-default bg-elevated`). Empty icon `i-lucide-receipt`.
- [x] 1.3 Modify `SalesListView.vue` L230: swap `#mobile-card` → `#cards="{ data, loading, empty }"`, wire `SaleCardGrid` + `@card-click="(sale) => goToSaleDetail(sale.id)"`.
- [x] 1.4 Update `SaleCard.test.ts`: drop RouterLink test (L61-64), drop `bg-coco-neutral-*` + `data-slot="body"` asserts (L69-82). Pin `article` root, both StatusDotBadges, debt testid survives, click emits sale.
- [x] 1.5 Add `<slot name="cards" />` to `appDataTableStub` in sales view test.
- [x] 1.6 Commit `feat(sales): redesign SaleCard to EmployeeCard pattern + multi-col grid`. Verify < 400 added lines.

## Phase 2: Quotations Work Unit (T2, one commit)

- [x] 2.1 Redesign `QuotationCard.vue`: drop RouterLink → `<article data-testid="quotation-card">`, EntityAvatar (seed=id, dot on DRAFT/SENT), customer + truncated id, status chip, dropdown top-right `@click.stop`, dashed divider, 2-col body (Total/Expira). Emit `click`; keep `navigate` + `delete`.
- [x] 2.2 Create `QuotationCardGrid.vue`: props `{ quotations, loading, empty }`, emits `card-click` + `delete`. Employee ladder. Empty icon `i-lucide-file-text`.
- [x] 2.3 Modify `QuotationsListView.vue` L527: swap `#mobile-card` → `#cards`, wire `@card-click="goToDetail"` + `@delete="handleDelete(row)"`.
- [x] 2.4 Update `QuotationCard.test.ts`: drop `quotation-card-link` href test (L154-157); add click-emit test; pin `article[data-testid="quotation-card"]`; keep delete/navigate + REQ-13 status gate.
- [x] 2.5 Add `<slot name="cards" />` to `appDataTableStub` in quotations view test.
- [x] 2.6 Commit `feat(quotations): redesign QuotationCard to EmployeeCard pattern + multi-col grid`. Verify < 400 added lines.

## Phase 3: Products Work Unit (T3, one commit)

- [x] 3.1 Modify `ProductCard.vue`: `bg-coco-neutral-50`→`bg-default`, `border-coco-neutral-200`→`border-default`, `hover:border-coco-gold-500/30`→`hover:border-primary/30`.
- [x] 3.2 Modify `ProductCardGrid.vue`: breakpoints → Employee ladder; skeleton `border-default` + `bg-elevated`.
- [x] 3.3 Update `ProductCard.test.ts` L115-127: pin new tokens.
- [x] 3.4 Update `ProductCardGrid.test.ts` L67-74: pin Employee ladder + skeleton tokens.
- [x] 3.5 Commit `feat(products): align card tokens + grid to EmployeeCard ladder`. Verify < 400 added lines.
