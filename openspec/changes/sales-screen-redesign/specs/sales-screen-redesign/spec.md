# Delta: Sales Screen Redesign — Layout & Structure

## Scope
Visual/structural POS sales screen redesign. No behavioral changes — existing
`sales` spec (REQ-1..REQ-11: BXGY, NET-line, reward badge, etc.) and
`sales-view-coco-redesign` spec (REQ-1..REQ-7: Coco tokens) continue to apply.

## MODIFIED Requirements

### R1 — Layout Proportion (Phase 14a)
Product/cart split MUST be 75/25 (`lg:w-[75%]` / `lg:w-[25%]`).

#### Scenario: 75/25 at desktop
- GIVEN viewport ≥ 1024px
- WHEN sales view mounts
- THEN product panel is 75%, cart panel 25%

### R2 — Cart Header Structure (Phase 14b)
Cart header MUST contain only UTabs (Venta/Pedido) and PriceListSelector. Trash and
ellipsis buttons SHALL move out. "Pedido" tab stays disabled.

#### Scenario: Header has only tabs and price list
- GIVEN an active sale
- WHEN cart renders
- THEN header contains UTabs + PriceListSelector only (no trash, no ellipsis)

### R3 — Product Card Layout (Phase 14a)
Grid MUST be 3 fixed columns (`sm:grid-cols-3 xl:grid-cols-3`). Cards MUST show
larger hero image, stock badge top-right, cleaner name/brand/price hierarchy.

#### Scenario: Fixed 3-column grid
- GIVEN search results at ≥ sm breakpoint
- THEN 3 columns with enlarged hero images render

### R4 — Cart Item Display (Phase 14b)
Cart items MUST render as horizontal cards: left thumbnail (≥48px), center
(name → specs → qty stepper + trash), right (unit price, discount lines, subtotal).
Sales REQ-3 and REQ-11 (NET display, reward forwarding) MUST remain functional.
All `data-testid` attrs from prior `SaleItemRow` MUST persist.

#### Scenario: Horizontal card with multi-line pricing
- GIVEN a cart item with quantity, unit price, and discount
- WHEN the cart renders
- THEN the item shows thumbnail left, info+qty center, pricing stack right
- AND it renders identically on draft and confirmed-sale surfaces

### R5 — Totals Breakdown (Phase 14b)
Footer MUST show items/units count, separate subtotal and discount lines,
`TOTAL A COBRAR` in white, and wider Cobrar button.

#### Scenario: Count + separate lines + white total
- GIVEN a sale with 3 items, 5 units, and a discount
- WHEN the footer renders
- THEN "3 Artic - 5 Unidad", subtotal, discount, and white total appear in order

### R6 — Search Bar Design (Phase 14a)
`Ctrl+K` / `⌘K` MUST focus the search input. Category filters SHALL sit inside
a dark panel (`bg-coco-neutral-900`) below the search bar.

#### Scenario: Shortcut and dark category panel
- GIVEN the sales view is open
- WHEN user presses Ctrl+K / ⌘K
- THEN search input focuses AND categories render in `bg-coco-neutral-900`

## ADDED Requirements

### R7 — Stock Indicator Badge (Phase 14a)
Product cards MUST show a `#N` badge top-right (e.g., `#11`), from
`posCatalogItem.stock.quantity`.

#### Scenario: #N badge on product card
- GIVEN stock.quantity = 11
- WHEN the card renders
- THEN `#11` appears top-right

### R8 — Multi-line Pricing Display (Phase 14b)
Cart items MUST render pricing in a right-column stack: unit price, discount
lines (from `discountType`/`discountValue`/`discountAmountCents`), subtotal.

#### Scenario: Unit, discount, subtotal stack
- GIVEN `unitPriceCents: 9600`, 25% discount, `subtotalCents: 7200`
- WHEN the cart item renders
- THEN right column shows unit price, discount line, and subtotal

### R9 — Items/Units Count (Phase 14b)
`SaleTotalsFooter` MUST compute and display `itemCount` + `unitCount` from
`sale.items` (no backend change).

#### Scenario: Computed item/unit count
- GIVEN 2 items with quantities 1 and 3
- WHEN the footer renders
- THEN count reads "2 Artic - 4 Unidad"

## REMOVED Requirements

### R10 — Cart Header Action Buttons (Phase 14b)
Trash and ellipsis buttons MUST NOT appear in the cart header.
(Reason: 25% panel compaction. Migration: trash → per-item row; ellipsis → TBD.)
