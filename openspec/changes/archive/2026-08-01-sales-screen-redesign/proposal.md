# Proposal: Sales Screen Redesign (SDD-14)

## Executive Summary

Redesign the POS sales screen to match a v0.dev reference design: switch from 60/40 to a 75/25 product/cart split, expand product cards (3×2 grid, larger images, `#stock` badges), replace the mini cart row with a horizontal compact card with multi-line pricing, and add a more detailed totals breakdown. **No backend work** — every pricing, discount, and reward datum is already on `SaleItem` (`unitPriceCents`, `discountType`/`discountValue`, `discountAmountCents`, `subtotalCents`, `rewardKind`, `rewardDiscountPercent`). Shipped in two apply phases (SDD-14a layout + products; SDD-14b cart items + totals), direct merge to main.

## Current State

`SalesView.vue` mounts a 60/40 split. Left: a wide product grid (2–5 responsive columns) of compact cards; right: an over-wide cart with Venta/Pedido tabs at view level, a `SaleItemRow` mini-card, a totals footer, and a `PromocionesDisponiblesAccordion`. The mini-cart row already has thumb · info · qty · price controls on top and `SaleItemBadges` below (per SDD-3 + `sales-layout-redesign`). The cart is wide enough that the narrow 25% target requires re-fitting every chrome element.

## Proposed Changes

### 1. Layout (`SalesView.vue`)
Change split `lg:w-[60%]` / `lg:w-[40%]` → `lg:w-[75%]` / `lg:w-[25%]`. Wire `Ctrl+K` / `⌘K` to focus the search input. Mobile FAB slideover reflows at the new ratio.

### 2. Product panel (5 files)
- `ProductSearchResults.vue`: responsive cols → `sm:grid-cols-3 xl:grid-cols-3` (fixed 3 columns, larger gap).
- `ProductSearchResultItem.vue`: bigger hero image, stock badge format `{{ stock.quantity }} u` → `#{{ stock.quantity }}` (top-right), cleaner name/brand/price hierarchy.
- `ProductSearchPanel.vue`: wrap category chips in a dedicated dark panel (`bg-coco-neutral-900`) below the search bar; keep existing KBD indicator, refresh styling.
- `useProductSearch.ts`: tune page size for 3-col density (no API change).

### 3. Cart panel (5 files; `SaleItemRow` is the gating item)
- **`SaleItemRow.vue` (complete template rewrite, ~200 lines):** new horizontal compact card — left thumbnail (≥ 48px), center column (name → specs → qty stepper + trash), right column (unit/subtotal, discount lines if any, `Promociones disponibles` link). **Preserve** all props, emits, computed (`lineDisplay`, `showPriceOrigin`, `showDiscountOrigin`, `itemActions`), and `data-testid` attributes. Used by both `ActiveSalePanel` (draft) and `SaleDetailItemsList` (confirmed) — confirmed surface must keep working.
- `ActiveSalePanel.vue`: compact the cart header (Venta/Pedido + trash + price list) for the narrower 25% panel; preserve `data-testid` (`cart-header`, `cart-body`, `cart-footer`).
- `SaleTotalsFooter.vue`: add items/units count line (`N Artic - M Unidad`), separate subtotal/discount lines, larger `TOTAL A COBRAR` in `text-white`, wider Cobrar button. Compute counts from `sale.items` (no backend change).
- `SaleItemBadges.vue`: **no change to file** — discount details move inline in the new `SaleItemRow` right column; badge component is also used in the confirmed-detail surface and must not drift.

### 4. Promotions accordion (deferred)
`PromocionesDisponiblesAccordion.vue` redesign is **deferred to the design phase**. The exploration found the current implementation is already global (order-level). Per the user's pre-confirmation, design specifics land later. Cart-item `Promociones disponibles` link in the new right column opens a future surface (also deferred).

## Explicitly Out of Scope

- Backend changes, new endpoints, or schema migration. `SaleItem` already carries every needed field.
- New Coco design tokens (reuse existing scales from SDD-1).
- `SaleDetailView` / `SaleDetailItemsList` confirmed-sale surface (only verify that the new `SaleItemRow` does not break it).
- Promotions accordion visual design (deferred).
- Spec-level behavior changes (BXGY, NET-line, reward badge, eligibility gates remain as defined in `openspec/specs/sales/spec.md` REQ-1..REQ-11).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None. The change is purely visual/structural; every rendering rule in `openspec/specs/sales/spec.md` (BXGY badge, NET subtotal, eligibility, `unitsNeeded` hint, `rewardDiscountPercent` forwarding) continues to apply inside the new layout.

## Phase Breakdown

| Phase | Scope | Files | Approx. lines |
|-------|-------|-------|---------------|
| **SDD-14a — Layout + Product Panel** | Proportion change, Ctrl+K handler, product grid → 3 cols, card redesign, dark category panel wrapper, page-size tune | `SalesView.vue`, `ProductSearchPanel.vue`, `ProductSearchResults.vue`, `ProductSearchResultItem.vue`, `useProductSearch.ts` | ~150–220 |
| **SDD-14b — Cart Items + Totals** | `SaleItemRow` template rewrite (preserved logic), `ActiveSalePanel` header compacting, `SaleTotalsFooter` enhanced breakdown + total styling + wider Cobrar | `SaleItemRow.vue`, `ActiveSalePanel.vue`, `SaleTotalsFooter.vue`, `__tests__/SaleItemRow.test.ts`, `__tests__/SaleTotalsFooter.test.ts` | ~250–350 |

Both phases ship direct-to-main (solo dev, no PR). 14b is the higher-risk phase — the `SaleItemRow` template rewrite is the gating task and must keep all `data-testid` attributes and confirmed-surface behavior intact.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/POS/sales/views/SalesView.vue` | Modified | 75/25 split, Ctrl+K |
| `src/features/POS/sales/components/ProductSearch*.vue` (×3) | Modified | Grid, card, dark category panel |
| `src/features/POS/sales/components/SaleItemRow.vue` | Modified (template rewrite) | Horizontal compact card |
| `src/features/POS/sales/components/ActiveSalePanel.vue` | Modified | Header compacting |
| `src/features/POS/sales/components/SaleTotalsFooter.vue` | Modified | Items/units count, wider Cobrar, prominent total |
| `src/features/POS/sales/composables/useProductSearch.ts` | Modified | Page-size tune |
| `__tests__/SaleItemRow.test.ts` | Modified | Selector updates for new layout |
| `__tests__/SaleTotalsFooter.test.ts` | Modified | New breakdown assertions |
| `__tests__/ProductSearchResultItem.test.ts` | Modified | Stock badge format |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `SaleItemRow` rewrite breaks confirmed-sale surface (`SaleDetailItemsList`) | Med | Verify `SaleItemRow` is consumed by both surfaces; preserve all props/emits/computed; run both `SaleItemRow.test.ts` and `SaleDetailItemsList` tests after change |
| Test selector churn in 14b exceeds 400-line budget | Med | Slice 14b into 2 commits: `SaleItemRow` rewrite (with selector updates), then `SaleTotalsFooter` enhancement |
| New 3-col grid feels sparse on ultrawide | Low | Tune `useProductSearch.ts` page size and gap; revisit only after real-world usage |
| Dark category panel clashes with Coco token system | Low | Reuse existing `bg-coco-neutral-900` token; verify both light + dark parity |
| Cart header overflow at narrow widths (laptop 1024–1366px) | Med | Use the existing 3-group header fix pattern from prior cart-header bugfix; verify at min panel width |

## Rollback Plan

Each phase is a single direct-to-main commit. Revert the merge commit; both phases are structural-only, not behavioral — undoing restores the prior layout with no API or data-shape changes. 14a's revert is independent of 14b (separate commits).

## Dependencies

None. Nuxt UI 4 + TanStack Query + Vue 3.5 stack unchanged. No new packages.

## Success Criteria

- [ ] `SalesView` split is 75/25 on desktop, reflows correctly on mobile slideover.
- [ ] Product grid is fixed 3 columns at `sm` and up; cards show larger hero image and `#stock` top-right badge.
- [ ] Category filters sit inside a dark panel below the search bar.
- [ ] `Ctrl+K` / `⌘K` focuses the search input.
- [ ] `SaleItemRow` renders the new horizontal compact card with thumbnail, multi-line right column, qty stepper, trash, and `Promociones disponibles` link.
- [ ] `SaleItemRow` keeps all `data-testid` attributes, all props/emits, and remains compatible with `SaleDetailItemsList` (confirmed-sale surface unchanged).
- [ ] `SaleTotalsFooter` shows items/units count, separate subtotal/discount lines, prominent `TOTAL A COBRAR` in white, wider Cobrar button.
- [ ] `pnpm build` clean; all unit tests pass (existing + updated selectors); light/dark parity preserved.
- [ ] No new backend calls; no new design tokens; no spec delta.
