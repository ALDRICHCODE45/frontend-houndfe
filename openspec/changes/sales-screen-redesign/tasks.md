# Tasks: Sales Screen Redesign (SDD-14)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Phase 14a — changed lines | ~150–220 (5 src + 1 test) |
| Phase 14b — changed lines | ~250–350 (5 src + 4 test, −1 removed) |
| Files per phase | 14a: 6 · 14b: 9 (incl. new + deleted) |
| Work-unit commits | 14a: 3 · 14b: 3 |
| 400-line budget risk | Low (14a) · Medium (14b) |
| Chained PRs recommended | No (direct merge to main, solo dev) |
| Delivery strategy | single-pr (per phase, direct-to-main) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Work-Unit Table

| Unit | Goal | Commit | Focused test | Runtime harness | Rollback boundary |
|------|------|--------|--------------|-----------------|-------------------|
| 14a.1 | 75/25 split + Ctrl+K | `feat(sales): 75/25 split + Ctrl+K search` | `pnpm test:unit --run SalesView` | Hound.dev sales view at ≥1024px | Revert restores 60/40 split + no shortcut |
| 14a.2 | 3-col grid + image-first card + #N badge | `feat(sales): product grid 3-col + #N badge` | `pnpm test:unit --run ProductSearchResultItem ProductSearchResults` | Sales view results panel | Revert restores 5-col grid + `N u` badge |
| 14a.3 | Dark category panel + page size tune | `feat(sales): dark category panel + page size` | `pnpm test:unit --run ProductSearchPanel useProductSearch` | Sales view top filter strip | Revert restores light chips + old limits |
| 14b.1 | SaleItemRow horizontal rewrite (GATING) | `feat(sales): SaleItemRow horizontal card` | `pnpm test:unit --run SaleItemRow SaleDetailItemsList` | Draft cart + confirmed-sale view | Revert restores vertical mini-card |
| 14b.2 | PromocionesFlatList + accordion removal | `feat(sales): flat promo list (replaces accordion)` | `pnpm test:unit --run PromocionesFlatList ActiveSalePanel` | Draft cart promos section | Revert restores accordion (file pre-exists) |
| 14b.3 | Totals breakdown + header compaction + Cobrar | `feat(sales): totals breakdown + wider Cobrar` | `pnpm test:unit --run SaleTotalsFooter ActiveSalePanel` | Draft cart footer + header | Revert restores single-line footer + old header |

## Phase 14a — Layout + Product Panel

### Group 14a.1 — Layout Proportion & Keyboard Shortcut (covers R1, R6)
- [ ] 14a.1.1 RED: `__tests__/SalesView.test.ts` — assert product panel has `lg:w-[75%]` and cart panel has `lg:w-[25%]` at ≥1024px
- [ ] 14a.1.2 RED: `__tests__/SalesView.test.ts` — assert `Ctrl+K` and `⌘K` invoke `searchInputRef.value?.focus()` (covers R6 shortcut half)
- [ ] 14a.1.3 GREEN: `SalesView.vue` — change `lg:w-[60%]` / `lg:w-[40%]` → `lg:w-[75%]` / `lg:w-[25%]`; add `onMounted`/`onUnmounted` keyboard listener for `Ctrl+K` / `⌘K` (preserves `isMac` computed)
- [ ] 14a.1.4 REFACTOR: extract keyboard handler to `useSearchShortcut.ts` composable if `SalesView.vue` net add > 20 LOC

### Group 14a.2 — Product Grid & Card Redesign (covers R3, R7)
- [ ] 14a.2.1 RED: `__tests__/ProductSearchResultItem.test.ts` — assert badge text is `#{{ stock.quantity }}` (not `{{ stock.quantity }} u`) (covers R7)
- [ ] 14a.2.2 RED: `__tests__/ProductSearchResults.test.ts` — assert grid class `sm:grid-cols-3 xl:grid-cols-3` (covers R3)
- [ ] 14a.2.3 GREEN: `ProductSearchResultItem.vue` — larger hero image (`aspect-square h-full`), #N badge as absolute top-right with `bg-default/80` backdrop, trim unit suffix, tighten brand/name/price hierarchy
- [ ] 14a.2.4 GREEN: `ProductSearchResults.vue` — grid class `sm:grid-cols-3 xl:grid-cols-3`, gap `gap-4`
- [ ] 14a.2.5 REFACTOR: consolidate stock badge into a single `<span>` helper if JSX inline > 10 LOC

### Group 14a.3 — Dark Category Panel + Page Size Tune (covers R6)
- [ ] 14a.3.1 RED: `__tests__/ProductSearchPanel.test.ts` — assert category chips wrapper contains `bg-coco-neutral-900` (covers R6 panel half)
- [ ] 14a.3.2 RED: `__tests__/useProductSearch.test.ts` — assert query params `limit: 36` (unqueried) / `limit: 42` (queried)
- [ ] 14a.3.3 GREEN: `ProductSearchPanel.vue` — wrap category chips in `<div class="bg-coco-neutral-900 rounded-xl p-2">`; refresh KBD indicator styling
- [ ] 14a.3.4 GREEN: `useProductSearch.ts` — bump `limit: 24 → 36` (unqueried) and `limit: 30 → 42` (queried)
- [ ] 14a.3.5 REFACTOR: extract category chip list to `CategoryChipList.vue` if wrapper inline > 15 LOC

## Phase 14b — Cart Items + Totals

### Group 14b.1 — SaleItemRow Horizontal Rewrite (GATING, covers R4, R8)
- [ ] 14b.1.1 RED: `__tests__/SaleItemRow.test.ts` — assert horizontal layout order: `img → name/specs/qty-column → pricing-stack` (covers R4)
- [ ] 14b.1.2 RED: `__tests__/SaleItemRow.test.ts` — assert right column shows unit price, discount line (from `discountType`/`discountValue`), subtotal (covers R8)
- [ ] 14b.1.3 RED: `__tests__/SaleDetailItemsList.test.ts` — re-assert all preserved `data-testid` attrs still resolve on confirmed-sale surface
- [ ] 14b.1.4 GREEN: `SaleItemRow.vue` — full `<template>` rewrite to horizontal card (≥48px thumb left · name→specs→qty+trash center · unit/discount/subtotal right); preserve `<script>` props/emits/computed (`lineDisplay`, `showPriceOrigin`, `showDiscountOrigin`, `itemActions`); preserve all `data-testid`; render promo/discount info INLINE (not via `SaleItemBadges`) for draft surface; `SaleItemBadges.vue` untouched
- [ ] 14b.1.5 REFACTOR: extract right-column pricing to `PricingStack.vue` if template > 200 LOC

### Group 14b.2 — PromocionesFlatList (Replace Accordion)
- [ ] 14b.2.1 RED: `__tests__/PromocionesFlatList.test.ts` — assert card title, apply button, applied-green-border, X remove, empty `v-if`, loading skeleton (3x) per design §Promos Redesign
- [ ] 14b.2.2 RED: `__tests__/ActiveSalePanel.spec.ts` — assert `promociones-flat-list` testid replaces `promociones-disponibles-accordion`
- [ ] 14b.2.3 GREEN: `PromocionesFlatList.vue` — create with identical props (`promotions`, `loading`, `appliedIds`) + emits (`apply`, `remove`) per design contract
- [ ] 14b.2.4 GREEN: `ActiveSalePanel.vue` — swap import: `PromocionesDisponiblesAccordion` → `PromocionesFlatList`, update testid
- [ ] 14b.2.5 GREEN: delete `PromocionesDisponiblesAccordion.vue` + `__tests__/PromocionesDisponiblesAccordion.test.ts`
- [ ] 14b.2.6 REFACTOR: extract single promo card to `PromoCard.vue` if list rendering > 60 LOC

### Group 14b.3 — Cart Header Compaction + Totals Breakdown (covers R2, R5, R9, R10)
- [ ] 14b.3.1 RED: `__tests__/ActiveSalePanel.spec.ts` — assert header contains only `cart-header-tabs` + `cart-header-price-list`; trash/ellipsis MUST NOT appear (covers R2, R10)
- [ ] 14b.3.2 RED: `__tests__/SaleTotalsFooter.test.ts` — assert count line `N Artic · M Unidad`, separate subtotal/discount rows, `TOTAL A COBRAR` has `text-white`, Cobrar button is `w-full` (covers R5, R9)
- [ ] 14b.3.3 GREEN: `ActiveSalePanel.vue` — strip trash + ellipsis from cart header; add kebab `UDropdownMenu` in footer toolbar (global discount, clear items, close tab); preserve `cart-header`/`cart-body`/`cart-footer` testids
- [ ] 14b.3.4 GREEN: `SaleTotalsFooter.vue` — add `itemCount`/`unitCount` computed from `sale.items`; render count line, separate subtotal/discount rows; restyle total to `text-2xl font-extrabold text-white tabular-nums`; widen Cobrar button to `block w-full rounded-xl`
- [ ] 14b.3.5 REFACTOR: extract totals math to `useTotalsBreakdown.ts` if footer template > 100 LOC

## Verification Plan

| Check | Command | Expected |
|-------|---------|----------|
| Unit tests (all) | `pnpm test:unit --run` | 0 failures |
| Type check | `pnpm type-check` | 0 errors |
| Build | `pnpm build` | 0 errors |
| Per-group focused | per Work-Unit table | per group |
| Confirmed-sale surface | `pnpm test:unit --run SaleDetailItemsList` | 0 regressions after 14b.1 |
| Light/dark parity | manual: toggle theme on sales view | no token clashes |

## Rollback Strategy

| Phase | Revert command | Restored state |
|-------|----------------|----------------|
| 14a (whole) | `git revert <14a-head>` | 60/40 split, 5-col grid, light chips, limits 24/30 |
| 14b.1 only | `git revert <14b.1-commit>` | vertical mini-card `SaleItemRow` |
| 14b.2 only | `git revert <14b.2-commit>` | `PromocionesDisponiblesAccordion` restored (file in HEAD pre-commit) |
| 14b.3 only | `git revert <14b.3-commit>` | single-line footer + old cart header |

14a is fully independent of 14b. 14b groups revert independently. `SaleItemBadges.vue` MUST NOT be touched (shared with confirmed-sale surface).
