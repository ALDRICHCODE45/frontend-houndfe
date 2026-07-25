# Proposal: Sales Layout Redesign

## Why

1. **Tab strip is misplaced.** `<SalesTabsStrip />` lives inside the cart card, competing with `Venta/Pedido` and `PUBLICO`.
2. **No region discipline.** Tabs + segmented control + items + chips + totals jostle for the same space. No header / body / footer.
3. **Item rows collapse when busy.** With discount + promo + reward badges, the single-line row becomes unreadable.

## What Changes

1. **Tab strip → view level.** Sibling of `ProductSearchPanel` and `ActiveSalePanel` inside `SalesView.vue`.
2. **Cart card → header / body / footer.** Header: `Venta/Pedido` + `PUBLICO` + papelera. Body: item rows. Footer: cliente → promociones → subtotal → descuentos → TOTAL → Cobrar.
3. **Item row → mini-card.** Thumbnail · info · qty/price controls · X close. Badges on their own line below. No new props, emits, or `SaleItem` fields.

## Scope

Single work-unit commit. **< 400 lines** across five files.

- `views/SalesView.vue` — mount `SalesTabsStrip` once at view level.
- `components/ActiveSalePanel.vue` — remove `SalesTabsStrip`; explicit header / body / footer with `data-testid`.
- `components/SalesTabsStrip.vue` — drop cart-internal radius / border.
- `components/SaleItemRow.vue` — mini-card: top row (thumb + info + controls + close) + bottom row (badges).
- `components/__tests__/SaleItemRow.test.ts` — update selectors.

## Non-Goals

No color changes (Coco palette from SDD-1 / SDD-3 stays; `UDashboardPanel` body bg stays `#16121a` / `#f5f4f6`). No logic changes. No multi-venta UX. No new dependencies. No spec delta.

## Approach

Mount `SalesTabsStrip` once in `SalesView.vue` above the two-panel split; strip its cart-internal radius / border. Partition `ActiveSalePanel.vue` into three `<section>` wrappers with `data-testid` (`cart-header`, `cart-body`, `cart-footer`). In `SaleItemRow.vue`, replace the single-row flexbox with a vertical mini-card (top: thumb · info · controls · close; bottom: `SaleItemBadges`). Same props, same emits, same `SaleItem` payload. Verify with `pnpm build`.

## Affected Specs

**None.** No requirement in `openspec/specs/sales/spec.md` (REQ-1 through REQ-11) describes the placement of the tabs strip or the visual shape of the cart card or item row. New capabilities: None. Modified: None.

## Risks

- **Mobile FAB / slideover coupling breaks (Low).** Strip is presentational; only mount point changes.
- **`SaleItemRow` test selectors break (Med).** Update selectors; keep behavior assertions intact.
- **Light / dark "doble fondo" regression (Low).** Apply SDD-3 rule: cart content transparent, relies on `UDashboardPanel` body bg.

## Rollback Plan

`git revert` the merge commit. Structural, not behavioral: undoing restores the prior layout with no API or data-shape changes.

## Dependencies

None. Nuxt UI 4 + TanStack Query + Vue 3.5 stack unchanged.

## Success Criteria

- [ ] Tab strip at view level (desktop + mobile).
- [ ] Cart card has distinct header / body / footer.
- [ ] Item rows read as mini-cards; chips on their own line.
- [ ] `pnpm build` clean; light / dark parity preserved (no `doble fondo`); `SaleItemRow.test.ts` passes; no new Coco color tokens.
