# Sales Specification

Domain: `sales` · POS sale-detail and draft-cart rendering of promotion-driven state. This capability covers the union widening of `ApplicablePromotion.type` to include `BUY_X_GET_Y`, percent-aware rendering of the BXGY reward badge on confirmed sale lines based on backend-provided `rewardDiscountPercent`, the `subtotalCents` (NET) rendering rule for confirmed-sale lines, and the unified draft-cart line display contract (`subtotalCents` + `rewardKind` + `rewardDiscountPercent` + tightened unit-strikethrough rules).

## Purpose

When the backend evaluates a `BUY_X_GET_Y` promotion, it now reports per-line metadata (`rewardKind`, `rewardDiscountPercent`, `subtotalCents`) on both confirmed `SaleDetailItem` and draft `SaleItem` payloads. The frontend must accept those fields, render a percent-aware reward badge (`GRATIS` only at 100%; `-N%` for a positive partial discount; no badge for null or <=0), show the backend-provided NET amount without recomputation, and never strike through a unit price that did not actually drop. All copy is neutral Spanish; identifiers remain English.

## Requirements

### REQ-1 Applicable Promotions Include BUY_X_GET_Y
The sales `ApplicablePromotion.type` contract MUST include `'BUY_X_GET_Y'` alongside the existing promotion types, so applicable-promotion responses containing BXGY are accepted and represented without type errors.

#### Scenario: BXGY applicable promotion is accepted
- GIVEN the applicable-promotions response contains `type: 'BUY_X_GET_Y'`
- WHEN the sales flow parses and renders the response
- THEN the promotion is accepted as a valid applicable promotion

### REQ-2 Confirmed Sale Reward Badge

The confirmed-sale reward badge label MUST be driven by the reward's `getDiscountPercent` (exposed as the optional field `rewardDiscountPercent`), never hardcoded. Four cases:
- `rewardKind !== 'buy_x_get_y'` → no reward badge.
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent === 100` → badge label `"GRATIS"`.
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent != null` AND `!== 100` → badge label `"-{pct}%"` (e.g. `50` → `"-50%"`).
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent == null` (pre-deploy) → no reward badge (defensive).

When rendered, the badge keeps the existing green `success` tone, `i-lucide-gift` icon, and `data-testid="sale-item-reward-badge"`; only the label text changes.
The line MUST still render its backend-provided NET `subtotalCents` verbatim (client MUST NOT recompute).

(Previously: badge always rendered hardcoded `"GRATIS"` whenever `rewardKind === 'buy_x_get_y'`.)

#### Scenario: confirmed BXGY reward at 100% renders GRATIS badge
- GIVEN a confirmed-sale detail line has `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 100`
- WHEN the detail line renders
- THEN a reward badge labeled `GRATIS` with `data-testid="sale-item-reward-badge"` is visible
- AND the line uses its provided `subtotalCents`

#### Scenario: confirmed BXGY reward at partial percent renders `-N%` badge
- GIVEN a confirmed-sale detail line has `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 50`
- WHEN the detail line renders
- THEN a reward badge labeled `"-50%"` is visible
- AND no badge labeled `GRATIS` is visible

#### Scenario: confirmed BXGY reward with null percent renders no reward badge (defensive)
- GIVEN a confirmed-sale detail line has `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: null` (pre-deploy payload)
- WHEN the detail line renders
- THEN no `GRATIS` badge and no `-50%` badge is visible
- AND the line renders without throwing

#### Scenario: non-reward line has no reward badge
- GIVEN a confirmed-sale detail line has `rewardKind: null` (or omitted)
- WHEN the detail line renders
- THEN no BXGY reward badge is visible

#### Scenario: NET subtotal is rendered without client calculation
- GIVEN the backend provides a line `subtotalCents` already reflecting the BXGY reward
- WHEN the confirmed-sale detail renders
- THEN the displayed line subtotal equals the provided `subtotalCents`
- AND no client-side discount calculation changes it

### REQ-3 Draft Cart Line NET Display + Reward Badge + Strikethrough Fix

The draft cart row (`SaleItemRow`) MUST render the line total and the unit-price strikethrough using a single, unified contract that works for BXGY promotions, cashier line discounts, and no-discount lines. `SaleItem` MUST accept `subtotalCents?: number | null`, `rewardKind?: 'buy_x_get_y' | null`, AND `rewardDiscountPercent?: number | null` — all optional + nullable for backward compat with pre-deploy draft responses.

The display rules are:
- `grossPerUnit = item.prePriceCentsBeforeDiscount ?? item.unitPriceCents`
- `grossLine = lineCents(grossPerUnit, item.quantity)`
- `netLine = item.subtotalCents ?? grossLine` — backend NET wins; fall back to gross for pre-deploy drafts.
- The bold line total renders `netLine`.
- The struck-through gross line renders `grossLine` ONLY when `netLine < grossLine`. It MUST NOT render when they are equal.
- The unit-price strikethrough (`showPriceOrigin` / `showDiscountOrigin`) MUST tighten so a strikethrough only appears when the unit price ACTUALLY dropped:
  - `showPriceOrigin`: require `originalPriceCents != null && unitPriceCents < originalPriceCents` (plus the existing `priceSource ∈ {price_list, custom}` check).
  - `showDiscountOrigin`: require `discountType != null && prePriceCentsBeforeDiscount != null && unitPriceCents < prePriceCentsBeforeDiscount`.
- `rewardKind` AND `rewardDiscountPercent` MUST be forwarded to `SaleItemBadges` so the percent-aware reward badge appears on draft cart lines that are BXGY rewards; the rendered label MUST match the confirmed-detail surface for the same `(rewardKind, rewardDiscountPercent)` pair.

(Previously: only `rewardKind` was forwarded and the badge label was hardcoded `GRATIS`; `rewardDiscountPercent` was not part of the `SaleItem` contract.)

#### Scenario: BXGY draft line at 100% renders NET + struck gross + GRATIS badge, NO unit strikethrough
- GIVEN a draft line with `unitPriceCents: 20000`, `quantity: 2`, `prePriceCentsBeforeDiscount: 20000`, `discountAmountCents: 20000`, `subtotalCents: 20000`, `rewardKind: 'buy_x_get_y'`, `rewardDiscountPercent: 100`
- WHEN the draft cart row renders
- THEN the bold line total displays `$200.00`
- AND a struck-through gross line displays `$400.00`
- AND no unit-price strikethrough appears
- AND the `GRATIS` reward badge is visible via `SaleItemBadges`

#### Scenario: cashier line discount renders NET + struck gross + unit-price strikethrough
- GIVEN a draft line with `unitPriceCents: 8000`, `prePriceCentsBeforeDiscount: 9600`, `quantity: 1`, `discountType: 'percentage'`, `subtotalCents: 8000`
- WHEN the draft cart row renders
- THEN the bold line total displays `$80.00`
- AND a struck-through gross line displays `$96.00`
- AND the pre-discount unit price strikethrough is visible

#### Scenario: no-discount line renders NET with no struck line and no unit strikethrough
- GIVEN a draft line with `unitPriceCents: 5000`, `quantity: 2`, `subtotalCents: 10000`, no `prePriceCentsBeforeDiscount`, no `originalPriceCents`
- WHEN the draft cart row renders
- THEN the bold line total displays `$100.00`
- AND no struck-through gross line is shown
- AND no unit-price strikethrough is shown

#### Scenario: pre-deploy draft falls back to gross when subtotalCents is absent
- GIVEN a draft line with `subtotalCents` absent and no discounts
- WHEN the draft cart row renders
- THEN the bold line total displays `unitPriceCents × quantity` (the gross fallback)
- AND no struck-through gross line is shown
- AND `rewardKind` is treated as absent (no reward badge)

#### Scenario: unit-price strikethrough is suppressed when the unit price did not drop
- GIVEN a line with `unitPriceCents === prePriceCentsBeforeDiscount` (BXGY shape, reward is line-level)
- WHEN the draft cart row renders
- THEN `showDiscountOrigin` is `false`
- AND no pre-discount unit-price strikethrough is rendered

### REQ-4 ApplicablePromotion Eligibility Fields Are Optional + Nullable

`ApplicablePromotion` MUST accept five OPTIONAL + nullable fields: `eligible?: boolean`, `buyQuantity?: number | null`, `getQuantity?: number | null`, `unitsNeeded?: number`, `method?: 'MANUAL'`. Fixtures omitting all five MUST still type-check.

#### Scenario: all eligibility fields accept concrete values
- GIVEN `eligible: true, buyQuantity: 2, getQuantity: 1, unitsNeeded: 1, method: 'MANUAL'`
- WHEN the literal is type-checked
- THEN the literal is accepted

#### Scenario: `buyQuantity` and `getQuantity` accept null
- GIVEN `buyQuantity: null, getQuantity: null`
- WHEN the literal is type-checked
- THEN the literal is accepted

#### Scenario: eligibility fields are omittable for legacy fixtures
- GIVEN all five fields are omitted
- WHEN the literal is type-checked
- THEN the literal is accepted

### REQ-5 Aplicar Button Honors Generic `eligible` Gate

The accordion MUST bind `:disabled="promo.eligible === false"` on the `Aplicar` `UButton` (testid `promo-apply-${id}`). The STRICT `=== false` comparison is required so that only an explicit `false` disables the button; `undefined` (legacy rows omitting `eligible`) and `true` MUST remain enabled — a loose `!eligible` would wrongly disable legacy rows. When `eligible === false`, the button renders disabled and clicking MUST NOT emit `apply`. When `eligible === true` or `undefined`, the button MUST remain enabled. The gate is GENERIC on `eligible`; it MUST NOT branch on `promo.type`.

#### Scenario: `eligible: false` disables Aplicar
- GIVEN a row has `eligible: false`
- WHEN the accordion renders the row
- THEN `promo-apply-${id}` is rendered with `disabled` and clicking does not emit `apply`

#### Scenario: `eligible: true` keeps Aplicar enabled
- GIVEN a row has `eligible: true`
- WHEN the accordion renders the row
- THEN `promo-apply-${id}` is enabled and clicking emits `apply`

#### Scenario: legacy fixture without `eligible` keeps Aplicar enabled
- GIVEN a row omits `eligible`
- WHEN the accordion renders the row
- THEN `promo-apply-${id}` is enabled (undefined is treated as eligible)

### REQ-6 `unitsNeeded` Renders Localized Hint With Singular/Plural

When a row carries `unitsNeeded != null`, the accordion MUST render a hint under the title with testid `promo-hint-${id}` and text `"2x1 · requiere N unidad(es) más"`. The noun MUST agree with `N`: `N === 1` → `"2x1 · requiere 1 unidad más"`; `N >= 2` → `"2x1 · requiere N unidades más"`. When `unitsNeeded` is absent or null, the hint MUST NOT render.

#### Scenario: N=1 renders singular hint
- GIVEN a row has `unitsNeeded: 1`
- WHEN the accordion renders the row
- THEN `promo-hint-${id}` contains `2x1 · requiere 1 unidad más`

#### Scenario: N=2 renders plural hint
- GIVEN a row has `unitsNeeded: 2`
- WHEN the accordion renders the row
- THEN `promo-hint-${id}` contains `2x1 · requiere 2 unidades más`

#### Scenario: no `unitsNeeded` renders no hint
- GIVEN a row has `unitsNeeded` absent or null
- WHEN the accordion renders the row
- THEN no element with testid `promo-hint-${id}` is rendered

### REQ-7 SaleDetailItem Carries Optional `promotionId`

`SaleDetailItem` MUST accept `promotionId?: string | null`. Fixtures omitting the field MUST still type-check.

#### Scenario: `promotionId` accepts a string value
- GIVEN `promotionId: 'promo-abc'`
- WHEN the literal is type-checked
- THEN the literal is accepted

#### Scenario: `promotionId` accepts null
- GIVEN `promotionId: null`
- WHEN the literal is type-checked
- THEN the literal is accepted

#### Scenario: `promotionId` is omittable for legacy fixtures
- GIVEN `promotionId` is omitted
- WHEN the literal is type-checked
- THEN the literal is accepted

### REQ-8 Confirmed-Sale List Forwards `promotionId` to Item Badges

`SaleDetailItemsList` MUST forward each item's `promotionId` to `SaleItemBadges` via `:promotion-id`. The promo chip is gated on `promotionId != null` (the existing `SaleItemBadges` `hasPromotion` gate): when a promotion is present the chip renders the promotion title from `discountTitle`, and when `discountTitle` is empty or null it renders a defensive `"Promoción"` fallback label. In a confirmed sale the backend always supplies `discountTitle`, so the fallback is defensive-only in practice. The confirmed-sale surface MUST NOT render the `sale-item-remove-promo` button (it never sets `removable`). `SaleItemBadges.vue` MUST NOT be modified.

#### Scenario: promotionId + non-empty discountTitle renders promo-name chip
- GIVEN a confirmed-sale item with `promotionId: 'promo-abc'` and `discountTitle: 'Black Friday 2x1'`
- WHEN `SaleDetailItemsList` renders the row
- THEN `SaleItemBadges` receives `promotion-id="promo-abc"`
- AND the `sale-item-promo-badge` chip with that title is visible
- AND no `sale-item-remove-promo` button renders

#### Scenario: promotionId with empty discountTitle renders defensive fallback chip
- GIVEN a confirmed-sale item with `promotionId: 'promo-abc'` and `discountTitle: ''` or null
- WHEN `SaleDetailItemsList` renders the row
- THEN `SaleItemBadges` receives `promotion-id="promo-abc"`
- AND the `sale-item-promo-badge` chip renders with the `"Promoción"` fallback label
- AND no `sale-item-remove-promo` button renders

### REQ-9 SaleItem + SaleDetailItem Accept Optional `rewardDiscountPercent`

`SaleItem` (draft line) and `SaleDetailItem` (confirmed line) MUST both accept
`rewardDiscountPercent?: number | null` — optional + nullable, mirroring the
existing `rewardKind?: 'buy_x_get_y' | null` shape. Field values: 0..100;
`100` = true free, partial numbers = partial discount, `null` or omitted =
defensive no-badge. The two interfaces MUST stay in lock-step (mirrored change)
so the surfaces never drift.

#### Scenario: SaleItem accepts a concrete percent
- GIVEN `rewardDiscountPercent: 50` on a `SaleItem` literal
- WHEN the literal is type-checked
- THEN it is accepted

#### Scenario: SaleItem accepts null `rewardDiscountPercent`
- GIVEN `rewardDiscountPercent: null` on a `SaleItem` literal
- WHEN the literal is type-checked
- THEN it is accepted

#### Scenario: SaleItem `rewardDiscountPercent` is omittable for legacy fixtures
- GIVEN a `SaleItem` literal omits `rewardDiscountPercent`
- WHEN the literal is type-checked
- THEN it is accepted

#### Scenario: SaleDetailItem accepts a concrete percent
- GIVEN `rewardDiscountPercent: 50` on a `SaleDetailItem` literal
- WHEN the literal is type-checked
- THEN it is accepted

#### Scenario: SaleDetailItem accepts null `rewardDiscountPercent`
- GIVEN `rewardDiscountPercent: null` on a `SaleDetailItem` literal
- WHEN the literal is type-checked
- THEN it is accepted

#### Scenario: SaleDetailItem `rewardDiscountPercent` is omittable for legacy fixtures
- GIVEN a `SaleDetailItem` literal omits `rewardDiscountPercent`
- WHEN the literal is type-checked
- THEN it is accepted

### REQ-10 SaleItemBadges Renders Percent-Aware Reward Label

`SaleItemBadges` MUST compute the reward badge label via a pure,
unit-testable helper (extracted in-module — no global, no composable). The
helper returns `null` when the badge MUST NOT render, or a string label.

The rule:
- `rewardKind !== 'buy_x_get_y'` → `null`.
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent === 100` → `"GRATIS"`.
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent != null` AND `!== 100` → `"-{pct}%"` where `pct === rewardDiscountPercent`.
- `rewardKind === 'buy_x_get_y'` AND `rewardDiscountPercent == null` → `null` (pre-deploy defensive; never assume free).

When the helper returns a non-null label, the badge renders with the existing
green `success` tone + `i-lucide-gift` icon + `data-testid="sale-item-reward-badge"`.
Only the label text changes across rendering cases.

#### Scenario: non-reward kind returns null label (no badge)
- GIVEN `rewardKind: 'other_kind'` and `rewardDiscountPercent: 100`
- WHEN the helper is invoked
- THEN it returns `null`
- AND no `data-testid="sale-item-reward-badge"` element renders

#### Scenario: rewardKind null or absent returns null label
- GIVEN `rewardKind: null` (or omitted) and any `rewardDiscountPercent`
- WHEN the helper is invoked
- THEN it returns `null`

#### Scenario: BXGY with 100 returns `"GRATIS"`
- GIVEN `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 100`
- WHEN the helper is invoked
- THEN it returns `"GRATIS"`

#### Scenario: BXGY with partial percent returns `"-N%"`
- GIVEN `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 50`
- WHEN the helper is invoked
- THEN it returns `"-50%"`

#### Scenario: BXGY with partial percent MUST NOT render GRATIS
- GIVEN `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 50`
- WHEN the badge renders
- THEN the visible label is `"-50%"`
- AND the visible label is NOT `"GRATIS"`

#### Scenario: BXGY with null percent returns null label (defensive)
- GIVEN `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: null`
- WHEN the helper is invoked
- THEN it returns `null`
- AND no `GRATIS` badge is rendered

#### Scenario: tone and icon parity between GRATIS and partial
- GIVEN `rewardKind: 'buy_x_get_y'` rendered twice — once with `rewardDiscountPercent: 100`, once with `rewardDiscountPercent: 50`
- WHEN both render
- THEN both badges use the green `success` tone
- AND both display the `i-lucide-gift` icon
- AND only the label string differs

### REQ-11 SaleItemRow + SaleDetailItemsList Forward `rewardDiscountPercent`

Both surfaces MUST forward `rewardDiscountPercent` to `SaleItemBadges`. The
draft cart (`SaleItemRow`) MUST forward `item.rewardDiscountPercent`; the
confirmed detail (`SaleDetailItemsList`) MUST forward the same field on the
corresponding confirmed item. The label result MUST be identical between the
two surfaces for the same `(rewardKind, rewardDiscountPercent)` payload. When
`rewardDiscountPercent` is absent (pre-deploy), neither surface MUST throw and
NEITHER MUST fall back to the legacy hardcoded `"GRATIS"`.

#### Scenario: draft cart forwards rewardDiscountPercent on reward line
- GIVEN a draft cart item with `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 50`
- WHEN `SaleItemRow` renders the item
- THEN `SaleItemBadges` is invoked with `reward-discount-percent="50"`

#### Scenario: confirmed detail forwards rewardDiscountPercent on reward line
- GIVEN a confirmed-sale item with `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent: 50`
- WHEN `SaleDetailItemsList` renders the item
- THEN `SaleItemBadges` is invoked with `reward-discount-percent="50"`

#### Scenario: cart and detail render identical labels for the same payload
- GIVEN identical `{ rewardKind: 'buy_x_get_y', rewardDiscountPercent: 50 }` payloads on a draft row and a confirmed-detail row
- WHEN both surfaces render
- THEN the reward badge label is `"-50%"` on BOTH surfaces (parity)

#### Scenario: pre-deploy draft (field absent) does not break the view
- GIVEN a draft cart item with `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent` absent
- WHEN `SaleItemRow` renders the item
- THEN the view renders without throwing
- AND no `GRATIS` and no `-50%` badge is rendered

#### Scenario: pre-deploy confirmed sale (field absent) does not break the view
- GIVEN a confirmed-sale item with `rewardKind: 'buy_x_get_y'` and `rewardDiscountPercent` absent
- WHEN `SaleDetailItemsList` renders the item
- THEN the view renders without throwing
- AND no `GRATIS` and no `-50%` badge is rendered

### REQ-12 Multi-column card mode via `#cards`

`SalesListView` SHALL supply a `#cards` slot (replacing `#mobile-card`) rendering `SaleCardGrid`, gated by `display-mode="cards"`. `SaleCardGrid` SHALL use the Employee ladder grid `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`. Cards SHALL emit `click`; the view owns navigation via `goToSaleDetail(id)`. View-test stubs SHALL expose `<slot name="cards" />`.

#### Scenario: card mode renders multi-column grid

- GIVEN `display-mode="cards"` and confirmed-sale rows exist
- WHEN the `#cards` slot renders
- THEN a 1/2/3/5/7 responsive grid shows one `SaleCard` per row

#### Scenario: card click navigates through the view

- GIVEN a card is clicked
- WHEN `card-click` emits the sale
- THEN the view routes to `/pos/ventas/{sale.id}` via `goToSaleDetail`

#### Scenario: table mode unchanged

- GIVEN `display-mode="table"` (or `auto` on desktop)
- WHEN the list renders
- THEN table rows render and the `#cards` slot is not used

### REQ-13 SaleCard uses EmployeeCard layout and emits `click`

`SaleCard` SHALL render an `article` root styled like EmployeeCard: `border-default`/`bg-default` surface, `EntityAvatar` (seed=`sale.id`, status dot when CONFIRMED), customer + folio lines, chip row (status + delivery + optional debt), dashed divider, and 2-column body (Total / Fecha / Cliente / Método). It SHALL emit `click` with the sale instead of wrapping content in a `RouterLink`. Testids `sale-card-debt` and `sale-card-due-date` MUST remain. The card MUST NOT use `bg-coco-neutral-*` tokens. Tests SHALL pin the `article` shape and MUST NOT assert `bg-coco-neutral-*`.

#### Scenario: article root renders the EmployeeCard pattern

- GIVEN a confirmed sale
- WHEN `SaleCard` renders
- THEN an `article` with avatar, chips, dashed divider, and 2-col body renders on `border-default`/`bg-default`

#### Scenario: click replaces RouterLink navigation

- GIVEN the card renders
- WHEN the user clicks the card
- THEN `click` emits the sale and no `RouterLink` href is rendered

#### Scenario: debt testids survive

- GIVEN a sale with `debtCents > 0`
- WHEN the card renders
- THEN `sale-card-debt` resolves (and `sale-card-due-date` when a due date exists)

### REQ-14 SaleCardGrid provides skeleton + empty states

`SaleCardGrid` SHALL render pulse skeletons (`border-default` + `bg-elevated`) while loading and an empty state with `i-lucide-receipt` when there are no rows. It SHALL forward each card's `click` as `card-click`.

#### Scenario: loading shows skeleton

- GIVEN the grid is loading
- WHEN it renders
- THEN pulse skeletons render inside the ladder grid

#### Scenario: empty state

- GIVEN zero confirmed-sale rows
- WHEN the grid renders
- THEN the `i-lucide-receipt` empty state renders instead of cards

### REQ-15 Confirmed Sales List Surfaces Request Errors

`SalesListView` SHALL pass `useConfirmedSales`'s `isError`/`error` as `AppDataTable` `:error`/`:error-message`. When `isError`, `AppDataTable` SHALL render its error block (`table-error-state`/`mobile-error-state`) with retry (`table-error-retry`/`mobile-error-retry`) wired to `refresh`; the "No hay ventas todavía" empty state MUST NOT show.

#### Scenario: error block replaces the empty state
- GIVEN `/sales/confirmed` failed (`isError: true`)
- WHEN the list renders
- THEN `table-error-state` shows the message with retry
- AND "No hay ventas todavía" is NOT rendered

#### Scenario: retry refetches
- GIVEN the error block is visible
- WHEN the retry is clicked
- THEN `refresh` fires and `useConfirmedSales` refetches

### REQ-16 Sortable Column Headers

The 9 columns `venta`, `confirmedAt`, `customer`, `paymentStatus`, `totalCents`, `debtCents`, `deliveryStatus`, `cashier`, `seller` SHALL declare `enableSorting: true` and render `SortableHeader`; `paymentMethods`, `dueDate`, `channel`, `invoice` SHALL declare `enableSorting: false` (no sort control). Header clicks SHALL flow through the sorting → backend `sortBy` mapping; the `USelect` shortcut SHALL remain.

#### Scenario: clicking a sortable header sorts
- GIVEN sortable headers render
- WHEN the `Total` header is clicked
- THEN sorting updates to `totalCents` and a sorted request fires

#### Scenario: non-sortable columns have no sort control
- WHEN a `paymentMethods`, `dueDate`, `channel`, or `invoice` header is inspected
- THEN no sort control renders and clicking does not change sorting

#### Scenario: dropdown shortcut stays in sync
- GIVEN sorting via the `USelect` dropdown
- WHEN the matching header is inspected
- THEN the header reflects the same sort state

### REQ-17 View Mode Persistence

`useSalesViewMode` SHALL wrap `useViewMode('pos-sales-view-mode', ['table','card'], 'table')`, exposing `viewMode`, `setMode`, `toggleViewMode`, `isSalesViewMode`. `SalesListView` SHALL render `ViewToggle` (`aria-label="Seleccionar vista de ventas"`) in `#actions` and bind `AppDataTable` `:display-mode` to the persisted mode (`'card'` → `'cards'`). The persisted mode SHALL apply at every viewport, including mobile.

#### Scenario: toggled mode persists across reloads
- GIVEN the user selects "Tarjetas" in `ViewToggle`
- WHEN the page reloads
- THEN `localStorage["pos-sales-view-mode"]` holds `card` and card rendering is restored

#### Scenario: mobile respects persisted table mode
- GIVEN `localStorage["pos-sales-view-mode"]` holds `table` on a mobile viewport
- WHEN the list renders
- THEN the table renders, not cards

#### Scenario: invalid value falls back to table
- GIVEN the stored view mode is invalid
- WHEN the list renders
- THEN view mode is `table`

### REQ-18 Consolidated Toolbar

The list SHALL render one toolbar row (search, `Filtros`, refresh, `Columnas`, "Nueva Venta", `ViewToggle` last) inside `AppDataTable`, with `DataTableFilters` in `#filters` above `SalesListTabs`. "Nueva Venta" SHALL render via `show-add-button` (`canCreateSale`) + `add-button-text="Nueva Venta"`, emitting `@add`; the `#actions` `UButton` SHALL be removed. "Limpiar" SHALL be a `UButton variant="link"` resetting only the slideover filter state.

#### Scenario: toolbar is a single row, add last
- GIVEN the list route renders
- WHEN the toolbar is inspected
- THEN search, `Filtros`, refresh, `Columnas`, "Nueva Venta", and `ViewToggle` render in one row, in that order

#### Scenario: add button navigates to new sale
- GIVEN "Nueva Venta" renders via `show-add-button`
- WHEN clicked
- THEN `@add` fires and the view navigates to `/pos/ventas/nueva`

#### Scenario: Limpiar clears only slideover filters
- GIVEN filters, a sort, and a search are set
- WHEN "Limpiar" is clicked
- THEN slideover filter values reset
- AND sorting, search text, and view mode are unchanged

### REQ-19 Preserved Sales List Invariants

`SalesListTabs` (Todas/No Entregadas), `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema` (11 fields, 4 sections), and every `#<id>-cell` slot SHALL remain unchanged.

#### Scenario: domain pieces keep current behavior
- GIVEN tabs, cards, and payment pills render
- WHEN the schema, cell templates, and component testids are inspected
- THEN `salesFiltersSchema` still defines 11 fields across 4 sections and all components and cell slots match current behavior

## UI Copy (neutral Spanish, examples)

- Reward badge label: `GRATIS`
- Partial-discount reward badge label: `-N%` (e.g. `-50%`)
- BXGY units-needed hint: `2x1 · requiere N unidad(es) más` (N=1 → `"2x1 · requiere 1 unidad más"`; N≥2 → `"2x1 · requiere N unidades más"`)
- Defensive promo fallback label: `Promoción`
