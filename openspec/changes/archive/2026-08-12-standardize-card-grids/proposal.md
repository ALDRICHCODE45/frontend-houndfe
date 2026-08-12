# Proposal: Standardize Card Grids

## Intent

POS Sales and Quotations tables pass `#mobile-card` slots into `AppDataTable`'s single-column fallback → cards render **one per row** at full width. Products has its own grid but uses hardcoded `bg-coco-neutral-*` instead of theme tokens. Align all three to the EmployeeCard pattern.

## Scope

**In**: Redesign SaleCard/QuotationCard to EmployeeCard layout (article + avatar + chips + dashed divider + 2-col body). Create SaleCardGrid/QuotationCardGrid mirroring EmployeeCardGrid (`sm:2 lg:3 xl:5 2xl:7`). Swap Sales/Quotations views from `#mobile-card` → `#cards`. Align ProductCard tokens (`border-default`, `bg-default`, `hover:border-primary/30`). Bump ProductCardGrid to Employee ladder. Update listed tests.

**Out**: Table view, columns, filters, sort, pagination, view-mode persistence; new card actions; mobile breakpoint; EmployeeCard (reference, unchanged); product images.

## Capabilities

### Modified Capabilities
- `sales` — confirmed-sale rows gain a multi-col card mode via `#cards`, gated by `display-mode="cards"`. Data contract, columns, table mode unchanged.
- `quotations-list` — same.
- `design-tokens` — no token change; consumers adopt `border-default` / `bg-default`.

(No new capabilities — visual/slot alignment only.)

## Approach

| # | File | Change |
|---|------|--------|
| 1 | `SaleCard.vue` | Drop `RouterLink + UCard`. Article: EntityAvatar (seed=sale.id, dot on CONFIRMED), customer + folio lines, chip row (status + delivery + optional debt), dashed divider, 2-col body (Total / Fecha / Cliente / Método). Emit `click`. |
| 2 | `SaleCardGrid.vue` *(new)* | `sm:2 lg:3 xl:5 2xl:7`; skeleton + empty `i-lucide-receipt`; forwards `card-click`. |
| 3 | `SalesListView.vue` | `<template #mobile-card>` (L230) → `<template #cards>` wiring SaleCardGrid + `@card-click="goToSaleDetail"`. |
| 4 | `QuotationCard.vue` | Article + avatar (initials, seed=id, dot on DRAFT/SENT) + customer + truncated id + status chip + divider + 2-col body (Total / Expira). Keep dropdown `Eliminar` gated. Emit `click`; keep `navigate` + `delete`. |
| 5 | `QuotationCardGrid.vue` *(new)* | Same grid as SaleCardGrid, empty `i-lucide-file-text`; forwards `card-click` + `delete`. |
| 6 | `QuotationsListView.vue` | `<template #mobile-card>` (L527) → `<template #cards>`; wire `@card-click="goToDetail"` + `@delete="handleDelete(row)"`. |
| 7 | `ProductCard.vue` | Tokens → `border-default`, `bg-default`, `hover:border-primary/30`; avatar above name. |
| 8 | `ProductCardGrid.vue` | Breakpoints → Employee ladder; skeleton → `border-default` + `bg-elevated`. |
| 9 | Tests | Drop `bg-coco-neutral-*` asserts (SaleCard L79–82); pin `article` shape + chip row + body labels. Mirror for QuotationCard; keep `data-testid="quotation-card"`. Add `<slot name="cards" />` to view stubs. ProductCard/Grid: pin tokens + breakpoints. |

## Affected Areas

| Area | Impact |
|------|--------|
| `POS/sales/components/SaleCard.vue` | Modified |
| `POS/sales/components/SaleCardGrid.vue` | New |
| `POS/sales/views/SalesListView.vue` | Modified (L230) |
| `POS/quotations/components/QuotationCard.vue` | Modified |
| `POS/quotations/components/QuotationCardGrid.vue` | New |
| `POS/quotations/views/QuotationsListView.vue` | Modified (L527) |
| `POS/products/components/ProductCard.vue` | Modified |
| `POS/products/components/ProductCardGrid.vue` | Modified |
| 5 test files (Sale/Quotation/Product cards + view tests) | Modified |

## Risks

| Risk | Mitigation |
|------|------------|
| Click-emit hides the href from DOM | Navigation via view handler; testids preserved. |
| `bg-default` differs from old `bg-coco-neutral-50` | Card-only; matches EmployeeCard design intent. |
| ProductCard at 2xl=7 too dense for product images later | Follow-up SDD; avatar-only today. |
| Single commit exceeds 400-line budget | **Split into 3 commits** (sales, quotations, products). Each is a complete work unit. |
| View stubs don't render `#cards` slot | Add `<slot name="cards" />` to `appDataTableStub`. |

## Rollback

Revert each module's commit independently. `AppDataTable.vue` is **not** changed → dropping `#cards` falls back to the previous `#mobile-card` single-column path.

## Dependencies

Existing shared components (`EntityAvatar`, `DotBadge`, `StatusDotBadge`, `formatCentsMXN`); `AppDataTable.#cards` slot (L202–209). No new shared surfaces.

## Success Criteria

- [ ] Sales, Quotations, Products cards all use `border-default` + `bg-default`.
- [ ] All three card grids match Employee ladder (1 / 2 / 3 / 5 / 7).
- [ ] Cards remain clickable to detail; dropdowns preserved with `@click.stop`.
- [ ] `SaleCard.test.ts` no longer asserts `bg-coco-neutral-*`; pins `article` shape.
- [ ] Each conventional commit under 400 added lines.
- [ ] All view + card tests green.
