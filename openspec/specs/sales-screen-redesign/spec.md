# Sales Screen Redesign — Layout & Structure Specification

Domain: `sales-screen-redesign` · Visual/structural layout of the POS sales surface.
This capability covers the responsive product/cart split, the product card grid
density, the search bar shortcut, the horizontal cart item card, the totals
breakdown, and the cart header compaction. Behavioral rules in
`openspec/specs/sales/spec.md` (REQ-1..REQ-11) and token rules in
`openspec/specs/sales-view-coco-redesign/spec.md` (REQ-1..REQ-7) continue to
apply and are not duplicated here.

## Purpose

Align the sales view to a v0.dev reference design: rebalance the product/cart
split for laptop widths, expand product card density with stock badges, replace
the vertical mini cart row with a horizontal compact card, add a multi-line
totals breakdown, and strip non-essential actions from the cart header. All
changes are visual/structural — every pricing, discount, and reward datum is
already on `SaleItem` (no backend change).

## Requirements

### REQ-1: Two-Phase Responsive Product/Cart Split

The product and cart panels MUST use a two-phase responsive split: at the `lg`
breakpoint (≥1024px) the product panel is **67%** and the cart panel is
**33%**; at the `xl` breakpoint (≥1280px) the product panel is **75%** and
the cart panel is **25%**.

The product panel is rendered with `lg:w-[67%] xl:w-[75%]` and the cart panel
with `lg:w-[33%] xl:w-[25%]`. Below the `lg` breakpoint the cart collapses
into a mobile slideover FAB.

#### Scenario: 67/33 split at laptop widths
- GIVEN viewport width between 1024px and 1279px
- WHEN the sales view mounts
- THEN product panel renders at 67% width and cart panel at 33% width

#### Scenario: 75/25 split at desktop widths
- GIVEN viewport width ≥ 1280px
- WHEN the sales view mounts
- THEN product panel renders at 75% width and cart panel at 25% width

### REQ-2: Cart Header Structure

The cart header MUST contain only the `UTabs` (Venta/Pedido) and the
`PriceListSelector`. Trash and ellipsis buttons MUST NOT appear in the header;
they live in a kebab `UDropdownMenu` in the cart footer toolbar. The "Pedido"
tab remains disabled.

#### Scenario: Header has only tabs and price list
- GIVEN an active sale
- WHEN the cart renders
- THEN the header contains `UTabs` + `PriceListSelector` only (no trash, no ellipsis)

### REQ-3: Product Grid — 4 Columns on md+

The product results grid MUST be 4 columns on `md` and `xl` viewports, 3
columns on `sm`, and 2 columns by default. The grid uses
`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4` with `gap-4`. Each
card image area MUST be `aspect-[4/3]`.

#### Scenario: 4-col product grid at md+
- GIVEN search results at the `md` (≥768px) or `xl` (≥1280px) breakpoint
- WHEN the grid renders
- THEN 4 columns with `aspect-[4/3]` hero images render

### REQ-4: Horizontal Cart Item Card

Cart items MUST render as horizontal compact cards. The card has three
columns: left thumbnail (≥48px), center column (name → specs → qty stepper +
trash), right column (unit price, discount line if any, subtotal). Sales
REQ-3 and REQ-11 (NET display, reward forwarding) MUST remain functional. All
`data-testid` attrs from the prior `SaleItemRow` MUST persist. The card
renders identically on draft and confirmed-sale surfaces.

#### Scenario: Horizontal card with multi-line pricing
- GIVEN a cart item with quantity, unit price, and discount
- WHEN the cart renders
- THEN the item shows thumbnail left, info+qty center, pricing stack right
- AND it renders identically on draft and confirmed-sale surfaces

### REQ-5: Totals Breakdown

The cart footer MUST show an items/units count line (`N Artic · M Unidad`),
separate subtotal and discount rows, the `TOTAL A COBRAR` label in white, and
a `w-full` Cobrar button.

#### Scenario: Count + separate lines + white total
- GIVEN a sale with 3 items, 5 units, and a discount
- WHEN the footer renders
- THEN "3 Artic · 5 Unidad", subtotal, discount, and white total appear in order

### REQ-6: Search Shortcut + Light Category Chips

`Ctrl+K` / `⌘K` MUST focus the search input. Category filters MUST render as
light elevated chips (`bg-elevated/50`) below the search bar — they MUST NOT
render inside a dark `bg-coco-neutral-900` panel.

#### Scenario: Shortcut focuses search input
- GIVEN the sales view is open
- WHEN the user presses `Ctrl+K` or `⌘K`
- THEN the search input receives focus

#### Scenario: Light elevated category chips
- GIVEN categories are loaded
- WHEN the search panel renders
- THEN category chips render with `bg-elevated/50` (light) styling
- AND no wrapper uses `bg-coco-neutral-900`

### REQ-7: Stock Indicator Badge

Product cards MUST show a `#N` badge top-right (e.g., `#11`), sourced from
`posCatalogItem.stock.quantity`. The badge is gated on `useStock && stock != null`
and uses a danger tone when stock is low.

#### Scenario: #N badge on product card
- GIVEN `stock.quantity = 11`
- WHEN the card renders
- THEN `#11` appears top-right
- AND the badge does not render when `stock` is null

### REQ-8: Multi-line Pricing Display

Cart items MUST render pricing in a right-column stack: unit price, discount
lines (from `discountType` / `discountValue` / `discountAmountCents`), and
subtotal. When a unit price is overridden by a discount, the original gross
price is shown with strike-through above the subtotal.

#### Scenario: Unit, discount, subtotal stack
- GIVEN `unitPriceCents: 9600`, a 25% discount, and `subtotalCents: 7200`
- WHEN the cart item renders
- THEN the right column shows unit price, discount line, and subtotal in that order
- AND the gross unit price is rendered with strike-through when overridden

### REQ-9: Items/Units Count

`SaleTotalsFooter` MUST compute and display `itemCount` + `unitCount` from
`sale.items` (no backend change). `itemCount` is `items.length`; `unitCount`
is the sum of every item's `quantity`. The count line uses the format
`N Artic · M Unidad`.

#### Scenario: Computed item/unit count
- GIVEN 2 items with quantities 1 and 3
- WHEN the footer renders
- THEN the count line reads "2 Artic · 4 Unidad"

### REQ-10: Cart Header Action Buttons Removed

Trash and ellipsis buttons MUST NOT appear in the cart header. (Reason: 25%
panel compaction. Migration: trash → per-item row; ellipsis → kebab
`UDropdownMenu` in cart footer toolbar.)

#### Scenario: No header action buttons
- GIVEN an active sale
- WHEN the cart header renders
- THEN no trash button and no ellipsis button appear in the header

## Verification

- `pnpm type-check`: 0 errors (`vue-tsc --build` clean)
- `pnpm build`: 0 errors, exits 0
- `pnpm test:unit --run src/features/POS/sales/`: 810 tests pass across 64 suites
- Visual: light and dark mode parity preserved; category chips use light `bg-elevated/50`
- Manual: `Ctrl+K` / `⌘K` focuses the search input on both platforms

## Notes on Final Design

Three requirements (REQ-1, REQ-3, REQ-6) were intentionally revised from
their original delta spec wording during implementation, based on user
feedback during the apply phase:

| Req | Original delta | Final implementation | Reason |
|-----|----------------|---------------------|--------|
| REQ-1 | Fixed 75/25 at lg (≥1024px) | Two-phase: 67/33 at lg, 75/25 at xl | Fixed 75/25 was too tight at tablet/laptop widths |
| REQ-3 | Fixed 3-col grid (`sm:grid-cols-3 xl:grid-cols-3`) | 4-col grid on md+ (`md:grid-cols-4 xl:grid-cols-4`) | 4 per row shows more products on common laptop screens |
| REQ-6 | Dark category panel (`bg-coco-neutral-900`) | Light elevated chips (`bg-elevated/50`) | Dark panel created visual weight imbalance |

These revisions were captured in the verify report and are reflected here as
the authoritative source of truth.
