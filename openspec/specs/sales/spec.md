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

`SalesListTabs` (Todas / Pagos Pendientes / No Entregadas), `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema` (11 fields, 4 sections), and every `#<id>-cell` slot SHALL remain unchanged. "Pagos Pendientes" is an additive slot filtering `paymentStatus=PARTIAL,CREDIT` and surfacing `counts.pendingPayments` (badge per REQ-NEW-8).

#### Scenario: domain pieces keep current behavior
- GIVEN tabs, cards, and payment pills render
- WHEN the schema, cell templates, and component testids are inspected
- THEN `salesFiltersSchema` still defines 11 fields across 4 sections and all components and cell slots match current behavior

#### Scenario: three tabs render in order
- GIVEN the listing mounts
- WHEN `SalesListTabs` renders
- THEN three tabs render in order: Todas, Pagos Pendientes, No Entregadas
- AND `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema`, and every `#<id>-cell` slot match prior behavior (unchanged)

### REQ-NEW-1: Reference-edit endpoint

`saleApi.updatePaymentReference` SHALL expose `PATCH /sales/:saleId/payments/:paymentId/reference` with `{ reference: string | null }` and NO `Idempotency-Key`.

#### Scenario: PATCH fires with body and no Idempotency-Key
- GIVEN a `paymentId` and a non-empty reference
- WHEN the mutation is invoked
- THEN the PATCH fires with the body and no `Idempotency-Key` header

#### Scenario: null reference persists
- GIVEN `reference: null`
- WHEN the PATCH fires
- THEN the backend persists `null`

### REQ-NEW-2: useUpdatePaymentReference composable

On success invalidate `getById(saleId)`. On 404 `ENTITY_NOT_FOUND` toast "El pago ya no existe" AND re-fetch `getById`.

#### Scenario: success invalidates detail
- GIVEN a successful PATCH
- WHEN the mutation resolves
- THEN `getById(saleId)` is invalidated

#### Scenario: 404 toasts and re-fetches
- GIVEN a 404 response
- WHEN the mutation rejects
- THEN a toast shows "El pago ya no existe" AND `getById` re-fetches

### REQ-NEW-3: PaymentsListSection component

`PaymentsListSection.vue` SHALL render every `SaleDetail.payments[]` entry under the "Pagos y deuda" totals card in `SaleDetailView` (one row per payment).

#### Scenario: one row per payment
- GIVEN `payments.length === 3`
- WHEN `SaleDetailView` renders
- THEN exactly 3 rows render

### REQ-NEW-4: Edit affordance on non-CASH non-CREDIT rows

Rows with `method` in the whitelist `{CARD_DEBIT, CARD_CREDIT, TRANSFER}` AND `paymentId` present SHALL expose "Editar referencia" opening a slideover pre-filled with `reference`. Cash and credit sales have no per-payment reference by definition; the edit affordance would be misleading. The whitelist `{CARD_DEBIT, CARD_CREDIT, TRANSFER}` is intentional and matches the contract doc §3.2 which excludes `'credit'` from the `payments[]` array. Always render (backend RBAC enforces; FE toasts on 403).

#### Scenario: non-CASH non-CREDIT row shows edit affordance
- GIVEN `method: 'CARD_DEBIT'` or `'CARD_CREDIT'` or `'TRANSFER'`
- WHEN the row renders
- THEN "Editar referencia" is visible and the slideover opens pre-filled

#### Scenario: CASH row hides edit affordance
- GIVEN `method: 'CASH'`
- WHEN the row renders
- THEN no "Editar referencia" is visible

#### Scenario: CREDIT row hides edit affordance (whitelist excludes CREDIT)
- GIVEN `method: 'CREDIT'`
- WHEN the row renders
- THEN no "Editar referencia" is visible (whitelist excludes CREDIT by design — see contract §3.2)

### REQ-NEW-5: Slideover submit semantics

Accept string OR null/"". Empty normalized to null before transport.

#### Scenario: clear submits null reference
- GIVEN the slideover open with current reference pre-filled
- WHEN the cashier clears the input and submits
- THEN the PATCH fires with `reference: null`

### REQ-NEW-6: SaleDetailPayment.paymentId required

`SaleDetailPayment` SHALL include `paymentId: string` (required, non-null).

#### Scenario: omitting paymentId is a type error
- GIVEN a `SaleDetailPayment` literal
- WHEN type-checked
- THEN omitting `paymentId` is a type error

### REQ-NEW-7: Reference-edit error handling

404 → toast + re-fetch (REQ-NEW-2). 403 → permission toast. Network → backoff retry.

#### Scenario: 403 toasts permission denial
- GIVEN a 403 response
- WHEN the mutation rejects
- THEN a permission toast shows

#### Scenario: transient network failure retries
- GIVEN a transient network failure
- WHEN the mutation rejects
- THEN the composable retries with exponential backoff (TanStack default, retry: 3, skipping `ReferenceUpdateError`)

### REQ-NEW-8: Pending-payments badge conditional

The "Pagos Pendientes" tab SHALL show the badge only when `counts.pendingPayments > 0`; tab remains selectable at `0`.

#### Scenario: count > 0 shows badge
- GIVEN `counts.pendingPayments === 8`
- WHEN the listing renders
- THEN the badge shows `8`

#### Scenario: count = 0 hides badge but tab selectable
- GIVEN `counts.pendingPayments === 0`
- WHEN the listing renders
- THEN the tab renders without a badge AND clicking it shows the empty table

### REQ-NEW-9: PaymentModal reference optional

`PaymentModal.validate()` SHALL NOT require `reference` for non-CASH entries.

#### Scenario: non-CASH entry without reference submits
- GIVEN a non-CASH entry with no `reference`
- WHEN submitted
- THEN the payload omits `reference` and the backend returns 200 OK

### REQ-NEW-10: DebtPaymentModal reference optional

`DebtPaymentModal.validateEntry` SHALL NOT require `reference`.

#### Scenario: non-CASH debt entry without reference submits
- GIVEN a non-CASH debt entry with no `reference`
- WHEN submitted
- THEN the payload omits `reference` and the backend returns 200 OK

### REQ-NEW-11: ChargeDomainErrorCode does NOT enumerate REFERENCE_REQUIRED

`ChargeDomainErrorCode` SHALL NOT enumerate `REFERENCE_REQUIRED`.

#### Scenario: REFERENCE_REQUIRED literal is a type error
- GIVEN a `ChargeDomainErrorCode` literal
- WHEN the value `'REFERENCE_REQUIRED'` is used
- THEN it is a type error

### REQ-NEW-12: ChargeDomainErrorCode includes PAYMENT_AMOUNT_INSUFFICIENT

`ChargeDomainErrorCode` SHALL include `PAYMENT_AMOUNT_INSUFFICIENT` with action `"Agregá un pago en efectivo o ajustá los montos para cubrir el total"`.

#### Scenario: PAYMENT_AMOUNT_INSUFFICIENT renders action text
- GIVEN the backend returns `PAYMENT_AMOUNT_INSUFFICIENT`
- WHEN a multi-method charge under-covers the total
- THEN a toast displays the action text

### REQ-NEW-13: SaleDueDateErrorCode enumerates SALE_FULLY_PAID (not SALE_ALREADY_PAID)

`SaleDueDateErrorCode` SHALL enumerate `SALE_FULLY_PAID` (not `SALE_ALREADY_PAID`); `DueDateEditModal` mapping updated in lock-step.

#### Scenario: SALE_FULLY_PAID rejects with mapped message
- GIVEN a backend 4xx with `code: 'SALE_FULLY_PAID'`
- WHEN `useSaleDueDate` rejects
- THEN `DueDateEditModal` shows the "sale is already fully paid" message

### REQ-NEW-14: SellerAssignmentErrorCode does NOT enumerate SELLER_NOT_ASSIGNABLE

`SellerAssignmentErrorCode` SHALL NOT enumerate `SELLER_NOT_ASSIGNABLE` (backend only emits `SELLER_NOT_FOUND`).

#### Scenario: AssignSellerSlideover does not branch on SELLER_NOT_ASSIGNABLE
- GIVEN `AssignSellerSlideover` error mapping
- WHEN inspected
- THEN it does NOT branch on `SELLER_NOT_ASSIGNABLE`

### REQ-NEW-15: Dead code MAY be removed

MAY delete (WU-E): `SaleDetailHeader.vue`, `components/payments/PaymentEntryCard.vue`, `PaymentMethodTileGrid.vue`, `PaymentTotalsRow.vue`, `paymentMethod.config.ts` (+ `__tests__`) — zero non-test imports.

#### Scenario: dead code removed with no broken imports
- GIVEN the listed files are deleted
- WHEN `pnpm build` runs
- THEN the build succeeds with no broken imports

### REQ-LAYOUT-001 Flat Two-Column Shell

`SaleDetailView` SHALL render a flat two-column grid replacing the `UTabs` workbench. The left column SHALL stack `SaleDetailItemsList` (PRODUCTOS), `SaleDetailSalesDataCard` (DATOS DE LA VENTA), and `SaleDetailHistoryCard` (HISTORIAL) in that order. The right column SHALL stack `SaleDetailTotalsCard` (TOTALES) and `PaymentsListSection` (PAGOS REGISTRADOS) in that order. The grid SHALL be implemented as `grid gap-6 lg:grid-cols-[1fr_360px]` and the root container SHALL carry `data-testid="sale-detail-layout-body"`. The `UTabs` workbench, the `tabItems` computed, the four `#slot` templates (`#productos`, `#pagos`, `#datos`, `#comentarios`), and `data-testid="sale-detail-tabs"` SHALL be removed.

#### Scenario: flat layout renders both columns at lg+

- GIVEN a confirmed sale with items, totals, payments, and timeline
- WHEN the view renders at viewport `lg`
- THEN `[data-testid="sale-detail-layout-body"]` renders with `items-table` + `sidebar-data-reflow` + the HISTORIAL card on the left
- AND `totals-total-value` + at least one `payment-row-*` on the right

#### Scenario: UTabs workbench is removed

- GIVEN the redesigned view
- WHEN the DOM is inspected
- THEN no element with `data-testid="sale-detail-tabs"` exists
- AND the four body stubs (`items`, `totals`, `timeline`, `comment-input`) coexist in the flat grid

### REQ-LAYOUT-002 Unified HISTORIAL Card

`SaleDetailHistoryCard` SHALL render a single `UCard` titled "HISTORIAL" that mounts `SaleDetailTimeline` in the card body and `SaleCommentInput` in the card footer. The HISTORIAL card MUST subsume the previous `UTabs` `#comentarios` panel content. `sale.timeline` already interleaves COMMENT events, so no data-shape change is needed.

#### Scenario: HISTORIAL card composes timeline + composer

- GIVEN a sale with ≥1 timeline event
- WHEN the HISTORIAL card renders
- THEN `timeline-event` testids render in the card body
- AND `sale-comment-input` renders in the card footer
- AND no separate HISTORIAL/COMENTARIOS section exists outside the card

#### Scenario: HISTORIAL renders without throwing when timeline is empty

- GIVEN a confirmed sale with `timeline.length === 0`
- WHEN the view renders
- THEN the empty-state affordance renders in the card body
- AND `SaleCommentInput` still renders in the footer

### REQ-LAYOUT-003 Comprobante Trigger

The PDF dropdown trigger in the sticky header SHALL render as a `UButton` labeled `"Comprobante"` (with `i-lucide-file-text` icon and chevron) when `sale.status !== 'DRAFT'` AND `hasAnyAction === true`. When `hasAnyAction === false` (e.g. CANCELED sales), the trigger SHALL fall back to the icon-only affordance, identical to today's behavior. The DRAFT-status `UTooltip` that disables the trigger MUST remain in effect. The trigger `aria-label` MAY change from `"Más acciones"` to `"Comprobante"` (released per MODIFIED HST-REQ-008 once `sales-history-coco` archives); all other trigger attributes (`UDropdownMenu`, `actionItems`) remain unchanged.

#### Scenario: confirmed sale with actions renders Comprobante label

- GIVEN `sale.status === 'CONFIRMED'` with ≥1 PDF-eligible action
- WHEN the sticky header renders
- THEN the trigger shows visible `"Comprobante"` text + `i-lucide-file-text` icon
- AND the dropdown opens on click

#### Scenario: canceled sale falls back to icon-only

- GIVEN `sale.status === 'CANCELED'` (no PDF actions)
- WHEN the sticky header renders
- THEN the trigger renders icon-only
- AND no `"Comprobante"` text renders

#### Scenario: DRAFT sale keeps disabled tooltip behavior

- GIVEN `sale.status === 'DRAFT'`
- WHEN the sticky header renders
- THEN the trigger is disabled
- AND the existing DRAFT `UTooltip` text renders on hover

### REQ-LAYOUT-004 Mobile Stacking Order

Below the `lg` breakpoint, the flat grid SHALL collapse to a single column. In single-column mode, the right column (TOTALES → PAGOS REGISTRADOS) SHALL render BEFORE the left column (PRODUCTOS → DATOS DE LA VENTA → HISTORIAL) in DOM order. At `lg` and above, the layout SHALL snap back to two columns with the left column first and the right column second. The right column root SHALL carry `order-1 lg:order-2` and the left column root SHALL carry `order-2 lg:order-1`.

#### Scenario: mobile viewport stacks right column first

- GIVEN viewport width < `lg`
- WHEN the view renders
- THEN the right column (TOTALES, PAGOS) renders above the left column (PRODUCTOS, DATOS, HISTORIAL) in DOM order
- AND both columns render at full width

#### Scenario: lg viewport restores two-column layout

- GIVEN viewport width ≥ `lg`
- WHEN the view renders
- THEN the left column renders first AND the right column renders second in DOM order
- AND the grid renders as `1fr_360px`

### REQ-LAYOUT-005 Data-testid Parity

The redesign MUST preserve verbatim: header anchors (`sale-detail-layout`, `sale-detail-skeleton`, `sale-detail-header`, `header-folio`, `header-date`, `badge`, `register-payment-header`); datos anchors (`sidebar-data-reflow`, `reflow-cajero`, `reflow-vendedor`, `reflow-cliente`, `reflow-price-list`, `reflow-payment-methods`); payments anchor (`sale-detail-payments-list` attribute on `PaymentsListSection`). The `sale-detail-tabs` testid MUST be removed (no test or e2e consumer references it). The redesign MUST add `data-testid="sale-detail-layout-body"` on the flat grid container. No other testids are renamed or removed.

#### Scenario: preserved testids render on the new structure

- GIVEN the redesigned view mounted with a valid sale
- WHEN the DOM is inspected
- THEN every preserved testid above renders exactly once
- AND `[data-testid="sale-detail-layout-body"]` renders on the grid root
- AND no `[data-testid="sale-detail-tabs"]` exists

#### Scenario: existing test assertions continue to pass

- GIVEN `SaleDetailView.test.ts` updated to assert the new selectors
- WHEN the suite runs (`pnpm test:unit --run`)
- THEN Coco-token class assertions on the header + reflow cards (HST-REQ-002) pass
- AND `register-payment-header` Cobrar-gold class assertions pass (HST-REQ-003)

### REQ-LAYOUT-006 DATOS Extraction Into `SaleDetailSalesDataCard`

The "DATOS DE LA VENTA" block SHALL be extracted into `SaleDetailSalesDataCard.vue`. The card SHALL own the `productApi.getGlobalPriceLists()` `onMounted` fetch (moved out of `SaleDetailView`), the `priceListName` computed, and the `uniquePaymentMethods` computed. The card SHALL emit `assign-seller` upward when the seller field's edit action fires. After extraction, `SaleDetailView` MUST NOT import `productApi`. The card root SHALL carry `data-testid="sidebar-data-reflow"`; each inner card SHALL retain its existing `reflow-*` testid (HST-REQ-002).

#### Scenario: extracted card owns price-list fetch and computeds

- GIVEN `SaleDetailView` mounted with a sale whose `globalPriceListId` resolves to a known price list
- WHEN `SaleDetailSalesDataCard` mounts
- THEN `productApi.getGlobalPriceLists()` is invoked exactly once
- AND `[data-testid="reflow-price-list"]` displays the resolved `priceListName`

#### Scenario: view drops the productApi import

- GIVEN the extraction is complete
- WHEN `SaleDetailView.vue` is type-checked (`pnpm tsc --noEmit`)
- THEN no `import { productApi }` or `import productApi` line exists in the view
- AND the build succeeds

#### Scenario: assign-seller event flows upward

- GIVEN the seller field's edit action is clicked inside `SaleDetailSalesDataCard`
- WHEN the click emits
- THEN the view receives the `assign-seller` event AND opens `AssignSellerSlideover`

### REQ-LAYOUT-007 HISTORIAL Extraction Into `SaleDetailHistoryCard`

The HISTORIAL card SHALL be implemented as `SaleDetailHistoryCard.vue`, a thin `UCard` wrapper that mounts `SaleDetailTimeline` (body) and `SaleCommentInput` (footer). The card's title SHALL be "HISTORIAL". No new props/emits are introduced beyond the child components' existing contracts. Existing `timeline-*` and `comment-*` testids MUST remain on the child components (HST-REQ-007).

#### Scenario: wrapper card composes the existing children

- GIVEN a sale with timeline events
- WHEN `SaleDetailHistoryCard` renders
- THEN `SaleDetailTimeline` mounts in the card body
- AND `SaleCommentInput` mounts in the card footer
- AND the `UCard` title is `"HISTORIAL"`

#### Scenario: composer in card footer is keyboard-operable

- GIVEN the HISTORIAL card renders
- WHEN the cashier tabs through the card
- THEN the footer composer is reachable via keyboard
- AND focus order matches body-then-footer DOM order

### REQ-LAYOUT-008 No Mobile Header Total Duplicate

`SaleDetailView` SHALL NOT render the mobile-only header total (`sm:hidden` block). The right column's `SaleDetailTotalsCard` SHALL own the TOTAL at all viewport sizes. The desktop header total (`hidden sm:block`) MAY remain for visual continuity; the proposal removes only the `sm:hidden` duplicate.

#### Scenario: no mobile header total renders

- GIVEN viewport width < `sm`
- WHEN the sticky header renders
- THEN no `sm:hidden` total element renders
- AND the right column's `[data-testid="totals-total-value"]` is the only TOTAL on screen

#### Scenario: lg viewport still shows the right-column TOTAL

- GIVEN viewport width ≥ `lg`
- WHEN the view renders
- THEN the right column's `SaleDetailTotalsCard` continues to render `totals-total-value`
- AND the totals card stays focusable / keyboard-operable per HST-REQ-008

---
*Delta REQ-NEW-1..15 + REQ-19 MODIFIED applied from `sales-pos-charge` change (HEAD `fa62b450`).*
*Delta REQ-LAYOUT-001..008 applied from `sale-detail-redesign` change (HEAD `cf0e263`). MODIFIED HST-REQ-008 carve-out deferred until `sales-history-coco` archives (HST-REQ-001..008 not yet in canonical).*
*Delta REQ-DLV-1..12 applied from `pos-sale-delivery` change (HEAD `08d1bd5`..`046932e`). ADDED-only — no MODIFIED/REMOVED/RENAMED; 12 requirements / 41 scenarios. NOTE: the requirement statement in REQ-DLV-12 parenthetically lists `PENDING` (warning) and `DELIVERED` ("Entregada", success) for visual semantics; the pre-existing badge map values (`PENDING` → 'No Entregados'/error, `DELIVERED` → 'Entregados'/success) are preserved per design §2/Q2 — scenario-level assertions still hold (every value resolves to a non-"Desconocido" config).*

### REQ-DLV-1: Charge Payload Carries Optional `delivery` on Both Branches

The charge request payload types (`LegacyChargePayload` and `MultiPaymentChargePayload`, the two branches of `ChargeSalePayload`) MUST accept an OPTIONAL field `delivery?: boolean`. When the field is omitted OR explicitly `false`, the charge MUST behave exactly as it does today (legacy charges stay byte-identical to pre-change behavior). When the field is `true`, the confirmed sale MUST be born with `deliveryStatus: 'PENDING'` (route-eligible). The `ChargeSalePayload` union shape itself MUST NOT change beyond this addition.

#### Scenario: legacy branch accepts `delivery: true`

- GIVEN a charge with the legacy single-payment shape (`{ method, amountCents, … }`)
- WHEN the cashier submits the charge with `delivery: true`
- THEN the request body sent to `POST /sales/drafts/:id/charge` includes the literal `delivery: true`
- AND the legacy payload shape otherwise matches its existing contract

#### Scenario: multi-payment branch accepts `delivery: true`

- GIVEN a charge with the multi-payment shape (`{ payments: […] }`)
- WHEN the cashier submits the charge with `delivery: true`
- THEN the request body includes `delivery: true` alongside the `payments` array
- AND no payment entry shape changes

#### Scenario: payload omits `delivery` when toggle is off

- GIVEN the "Entrega a domicilio" toggle is OFF
- WHEN the cashier submits a charge
- THEN the request body MUST NOT carry a `delivery` key (omission only — never an explicit `false`)
- AND legacy charges stay byte-identical to pre-change behavior

#### Scenario: confirmed sale shows `PENDING` after toggle-on charge

- GIVEN the charge was submitted with `delivery: true` against a draft that has a shipping address
- WHEN the cashier retrieves the confirmed sale from `GET /sales/:id` or `GET /sales`
- THEN `deliveryStatus === 'PENDING'`

### REQ-DLV-2: PaymentModal Toggle Emits `delivery` Only When On

The charge step (`PaymentModal`) MUST expose an "Entrega a domicilio" toggle. When the toggle is ON, the built payload MUST spread `delivery: true` into BOTH the legacy branch and the multi-payment branch of the payload returned by `buildPayload()`. When the toggle is OFF, the payload MUST NOT contain a `delivery` key. The toggle MUST reset to OFF every time the modal opens (alongside the existing per-open reset behavior).

#### Scenario: toggle ON emits `delivery: true` on the legacy branch

- GIVEN the toggle is ON and the cashier uses the legacy single-payment shape
- WHEN `buildPayload()` returns the legacy payload
- THEN the returned object includes `delivery: true`
- AND no other field of the legacy payload changes

#### Scenario: toggle ON emits `delivery: true` on the multi-payment branch

- GIVEN the toggle is ON and the cashier uses the multi-payment shape
- WHEN `buildPayload()` returns the multi-payment payload
- THEN the returned object includes `delivery: true` alongside `payments`
- AND no payment entry shape changes

#### Scenario: toggle OFF omits `delivery`

- GIVEN the toggle is OFF
- WHEN `buildPayload()` returns either branch
- THEN the returned object MUST NOT carry a `delivery` key

#### Scenario: modal open resets the toggle to OFF

- GIVEN the toggle was ON at modal close
- WHEN the cashier opens `PaymentModal` again
- THEN the toggle MUST be OFF
- AND the built payload MUST NOT carry a `delivery` key on first render

### REQ-DLV-3: Toggle Gated on Shipping-Address Presence

The "Entrega a domicilio" toggle MUST be DISABLED whenever the draft has no shipping address assigned (`shippingAddress == null`). When disabled, an inline hint MUST be visible with the copy "asigná cliente y dirección primero" so the cashier understands the constraint and is not left wondering why the toggle will not move. The toggle MUST be enabled (interactive) whenever `shippingAddress != null`. The disabled/enabled state MUST recompute reactively so that clearing the shipping address (e.g. when the customer is reassigned, since backend rules clear the address on customer change) immediately disables the toggle again without a manual refresh.

#### Scenario: no address disables the toggle and shows the hint

- GIVEN `shippingAddress == null`
- WHEN the charge step renders
- THEN the toggle MUST render in a disabled state
- AND an inline hint with the literal text "asigná cliente y dirección primero" MUST be visible

#### Scenario: address present enables the toggle without a hint

- GIVEN `shippingAddress != null`
- WHEN the charge step renders
- THEN the toggle MUST be enabled (interactive)
- AND no gating hint MUST be visible

#### Scenario: clearing the address reactively disables the toggle

- GIVEN the toggle is ON with an assigned address
- WHEN the address is cleared (e.g. customer reassignment triggers backend address clear)
- THEN the toggle MUST immediately become disabled again on the next render
- AND the gating hint MUST be visible again
- AND the built payload MUST NOT carry `delivery: true` while the gate is closed

#### Scenario: gating alone prevents the 422 in normal flow

- GIVEN a draft with no shipping address
- WHEN the cashier submits the charge (with the toggle disabled)
- THEN the request body MUST NOT carry `delivery: true`
- AND the backend `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` MUST NOT be triggered by this flow

### REQ-DLV-4: Toggle CTA Reuses Existing Customer/Address Assignment

When the toggle is disabled because the draft has no shipping address, the charge step MUST surface an affordance (CTA) that reuses the existing customer/address assignment flow already triggered by `request-assign-customer` (the same emit the modal already uses for the same purpose from its other surfaces). Activating the CTA MUST open the existing `AssignCustomerSlideover` — no new slideover, no new route, no new picker MUST be introduced.

#### Scenario: disabled toggle exposes a CTA to assign customer/address

- GIVEN `shippingAddress == null`
- WHEN the charge step renders
- THEN a CTA MUST be visible alongside (or directly reachable from) the disabled toggle
- AND activating it MUST emit `request-assign-customer` (the existing signal)

#### Scenario: CTA opens the existing AssignCustomerSlideover

- GIVEN the cashier activates the CTA
- WHEN `SalesView` receives the `request-assign-customer` emit
- THEN the existing `AssignCustomerSlideover` MUST open
- AND no new slideover, route, or picker is rendered

#### Scenario: customer/address assignment enables the toggle

- GIVEN the cashier assigns a customer and a shipping address from the opened slideover
- WHEN the address propagates back to the charge step (via the `shippingAddress` prop)
- THEN the toggle MUST become enabled automatically on the next render
- AND the gating hint MUST disappear

### REQ-DLV-5: Idempotency Key Regenerates When Delivery Toggle Changes

The idempotency key used on the charge request MUST be regenerated whenever the "Entrega a domicilio" toggle changes (ON → OFF or OFF → ON), in addition to the existing regen behavior driven by the payment entries. The toggle MUST be a source in the same key-regen effect that already watches the entries. A pin test MUST assert the key changes when the toggle flips while entries are otherwise unchanged. Without this regen, a legitimate toggle edit would reuse an `Idempotency-Key` whose backend hash captured the prior `delivery` value and would respond with `409 IDEMPOTENCY_KEY_CONFLICT`.

#### Scenario: toggling delivery regenerates the idempotency key

- GIVEN the charge modal is open with a stable `entries` value
- WHEN the cashier flips the "Entrega a domicilio" toggle
- THEN the displayed `Idempotency-Key` MUST change
- AND the new key MUST be sent on the next charge request

#### Scenario: stable entries + no toggle change keep the key stable

- GIVEN `entries` is unchanged
- WHEN the toggle is NOT flipped
- THEN the idempotency key MUST NOT regenerate

#### Scenario: toggle flip never produces IDEMPOTENCY_KEY_CONFLICT for legitimate edits

- GIVEN the cashier flips the toggle
- WHEN the cashier submits the charge with the newly-generated key
- THEN the backend MUST NOT respond with `409 IDEMPOTENCY_KEY_CONFLICT`
- AND the `IDEMPOTENCY_KEY_CONFLICT` mapping (`new-key` action) remains a backstop only

### REQ-DLV-6: SalesView Passes Shipping Address Reactively to PaymentModal

`SalesView` MUST pass the active draft's `shippingAddress` through to `PaymentModal` (alongside the existing `:customer` binding). The address passed MUST be reactive to `activeDraft.shippingAddress` so that backend-driven clears (the customer-change rule) propagate without manual wiring in the modal. The binding MUST use `activeDraft.shippingAddress ?? null` semantics (null when absent).

#### Scenario: PaymentModal receives the active draft's shipping address

- GIVEN `activeDraft.shippingAddress` is a `CustomerAddress`
- WHEN `SalesView` renders `PaymentModal`
- THEN `PaymentModal` MUST receive the address via its `shippingAddress` prop

#### Scenario: missing address propagates as null

- GIVEN `activeDraft.shippingAddress == null`
- WHEN `SalesView` renders `PaymentModal`
- THEN `PaymentModal`'s `shippingAddress` prop MUST be `null`

#### Scenario: address clear on customer change propagates to the modal

- GIVEN the cashier reassigns the customer and the backend clears `shippingAddress`
- WHEN the active draft updates reactively
- THEN `PaymentModal`'s `shippingAddress` prop MUST become `null` without a manual refresh
- AND the toggle gating MUST recompute to disabled (per the gating requirement)

### REQ-DLV-7: Charge Response, Success Modal, and Counts Are Unchanged

The change MUST NOT alter the charge response contract, the success modal behavior, or the `counts` payload from `GET /sales`. The charge response still carries no `deliveryStatus` — the value is read from `GET /sales` / `GET /sales/:id` after the charge. `PaymentSuccessModal` MUST render exactly as it does today for a charge with `delivery: true` (no new fields, no new copy, no new totals). The KPI `counts` (`all`, `pendingPayments`, `notDelivered`) MUST NOT change because of this change — extended filters (including `deliveryStatus`) intentionally do not alter counts per the locked backend contract.

#### Scenario: charge response carries no `deliveryStatus`

- GIVEN the cashier submits a charge with `delivery: true`
- WHEN the backend responds
- THEN the response shape is identical to a charge without `delivery: true`
- AND no `deliveryStatus` field appears on the response

#### Scenario: success modal renders unchanged

- GIVEN the charge succeeds with `delivery: true`
- WHEN `PaymentSuccessModal` renders
- THEN it MUST render exactly as it does today (no new fields, copy, or totals)
- AND the cashier MUST be able to obtain `deliveryStatus` only via a follow-up `GET /sales` / `GET /sales/:id` request

#### Scenario: counts are unaffected by this change

- GIVEN the cashier applies a `deliveryStatus` filter on the sales list
- WHEN `GET /sales` returns
- THEN `counts.all`, `counts.pendingPayments`, and `counts.notDelivered` MUST behave identically to the pre-change baseline (extended filters do not alter counts)
- AND the filter value MUST affect the listed `data` only

### REQ-DLV-8: ChargeDomainErrorCode Enumerates SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY

The `ChargeDomainErrorCode` union MUST include the literal `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'` alongside its existing members. TS exhaustiveness on `Record<ChargeDomainErrorCode, …>` MUST force every consumer to handle the new code — adding the code without an `ERROR_ACTIONS` entry MUST be a type error. This requirement is additive: it MUST NOT remove any existing member of the union (no regression on `PAYMENT_AMOUNT_INSUFFICIENT`, `IDEMPOTENCY_KEY_CONFLICT`, etc.).

#### Scenario: literal is accepted by the union

- GIVEN the literal `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'`
- WHEN it is assigned to a `ChargeDomainErrorCode`-typed value
- THEN the assignment MUST type-check

#### Scenario: omitting an entry in ERROR_ACTIONS is a type error

- GIVEN a `Record<ChargeDomainErrorCode, SalePaymentUxAction>` literal is being authored
- WHEN the new key is not provided
- THEN TypeScript MUST report an excess-property / missing-key error (exhaustiveness)

#### Scenario: existing codes remain in the union

- GIVEN the change is applied
- WHEN the union is inspected
- THEN every pre-existing member (including `PAYMENT_AMOUNT_INSUFFICIENT`, `IDEMPOTENCY_KEY_CONFLICT`) MUST still be a member

### REQ-DLV-9: Friendly Inline Error for SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY

The `ERROR_ACTIONS` map MUST carry an entry keyed by `'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'` with `type: 'inline'` and a Spanish-language `message` telling the cashier to assign a shipping address to use the delivery flow. The copy MUST be neutral and actionable (the proposal locks the wording to "Para entrega a domicilio asigna una dirección de envío."). The entry MUST be retrieved via the existing `getSalePaymentErrorAction(code)` dispatch path used by `SalesView.handleChargeDraft` — no new dispatch chain MAY be introduced.

#### Scenario: 422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY surfaces inline

- GIVEN the backend responds with `422` and `code: 'SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY'`
- WHEN `SalesView.handleChargeDraft` runs the dispatch chain
- THEN `getSalePaymentErrorAction('SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY')` MUST return a `SalePaymentUxAction`
- AND the returned action MUST have `type: 'inline'`
- AND the returned `message` MUST contain "Para entrega a domicilio" and reference "dirección de envío"

#### Scenario: friendly action replaces the raw error toast

- GIVEN the action is returned
- WHEN the cashier sees the result
- THEN a friendly inline message MUST render
- AND no raw backend error toast MUST be shown for this specific code

#### Scenario: gating is the primary path, 422 is the safety net

- GIVEN the toggle gating requirement (disabled-with-hint when no address)
- WHEN the cashier follows the gating flow normally
- THEN the backend `422 SHIPPING_ADDRESS_REQUIRED_FOR_DELIVERY` MUST NOT be reached in normal flow
- AND the friendly inline action exists only as a safety net for stale drafts or races

### REQ-DLV-10: SALE_DELIVERY_STATUS Covers All Four Backend Values

The `SALE_DELIVERY_STATUS` constant object MUST enumerate all four backend values in this exact set: `'PENDING'`, `'SHIPPED'`, `'DELIVERED'`, `'NOT_APPLICABLE'`. The corresponding `SaleDeliveryStatus` TS type MUST be derived from this constant (single source of truth) so that adding a backend value requires only the constant change. Pin tests MUST lock every value in the constant against accidental drift.

#### Scenario: the constant enumerates all four values

- GIVEN `SALE_DELIVERY_STATUS` is exported
- WHEN its keys are enumerated
- THEN it MUST contain `PENDING`, `SHIPPED`, `DELIVERED`, and `NOT_APPLICABLE` — no more, no less

#### Scenario: the type derives from the constant

- GIVEN `SaleDeliveryStatus` is the matching TS type
- WHEN a literal of `'PENDING' | 'SHIPPED' | 'DELIVERED' | 'NOT_APPLICABLE'` is assigned
- THEN the assignment MUST type-check

#### Scenario: adding a new backend value requires only the constant change

- GIVEN the constant is the single source of truth
- WHEN a future value is appended to `SALE_DELIVERY_STATUS`
- THEN the `SaleDeliveryStatus` type MUST pick up the new value automatically
- AND no parallel string-union edits are required

#### Scenario: pin tests freeze the value set

- GIVEN the co-located pin tests
- WHEN they run
- THEN every value in `SALE_DELIVERY_STATUS` MUST be asserted verbatim
- AND a renamed or removed value MUST fail a pin test

### REQ-DLV-11: Delivery Status Filter Exposes All Four Backend Values

`createSalesFiltersSchema` MUST extend the `deliveryStatus` `multiEnum` options to include all four backend values with neutral Spanish labels. The full set MUST be exactly: `PENDING` ("Pendiente"), `SHIPPED` ("En ruta"), `DELIVERED` ("Entregada"), `NOT_APPLICABLE` ("No aplica"). The field MUST continue to use `param: 'deliveryStatus'` so existing serialization to the CSV `deliveryStatus=PENDING,SHIPPED` query string is preserved. The total field count of the schema (11 fields across 4 sections) MUST NOT change — this is purely an option-array expansion on the existing `deliveryStatus` field.

#### Scenario: filter exposes the four labeled options

- GIVEN the sales list slideover
- WHEN the cashier opens the "Entrega" filter
- THEN the options MUST be "Pendiente", "En ruta", "Entregada", and "No aplica" (in that or stable order)
- AND no other delivery-status option MUST appear

#### Scenario: filter value serializes to the backend CSV param

- GIVEN the cashier selects `SHIPPED` and `NOT_APPLICABLE`
- WHEN the request is sent
- THEN the query string MUST carry `deliveryStatus=SHIPPED,NOT_APPLICABLE` (or `deliveryStatus=NOT_APPLICABLE,SHIPPED`)
- AND the backend CSV semantics (OR within the same filter) MUST be honored

#### Scenario: schema field count and section layout are unchanged

- GIVEN the option-array expansion
- WHEN the schema is inspected
- THEN it MUST still define exactly 11 fields across 4 sections (Estado / Personas / Montos / Fechas)
- AND the existing `REQ-19` invariants MUST continue to hold

### REQ-DLV-12: Delivery Status Badge Map Covers All Four Backend Values

The `deliveryStatusBadgeMap` MUST carry a config entry for every one of the four backend values so that valid statuses never fall back to the generic "Desconocido" placeholder. Each entry MUST include a Spanish label and a tonal color (`success` | `warning` | `error` | `neutral`) consistent with the visual semantics: `PENDING` (warning), `SHIPPED` ("En ruta", warning), `DELIVERED` ("Entregada", success), `NOT_APPLICABLE` ("No aplica", neutral). The `getDeliveryStatusBadge` lookup MUST return the configured config for any of the four valid values; the `unknownBadge` fallback remains available only for genuinely unknown/legacy strings outside the four-value set.

> **Spec-drift guard (preserved per design §2/Q2):** the parenthetical visuals above describe the *intent* of badge copy/colors per backend semantics; the canonical implementation preserves the **pre-existing** badge entries verbatim (`PENDING` → `'No Entregados'`/`error`, `DELIVERED` → `'Entregados'`/`success`) and *adds* only `SHIPPED` (`'En ruta'`/`warning`) and `NOT_APPLICABLE` (`'No aplica'`/`neutral`). Scenario-level assertions below remain satisfied because they check lookup → configured config (not exact labels).

#### Scenario: every backend value resolves to a configured config

- GIVEN `getDeliveryStatusBadge` is called with each of `PENDING`, `SHIPPED`, `DELIVERED`, `NOT_APPLICABLE`
- WHEN the lookup runs
- THEN every call MUST return a non-`unknownBadge` `SaleBadgeConfig`
- AND no call MUST return the literal label `"Desconocido"`

#### Scenario: badge copy and tone match the visual semantics

- GIVEN the badge map
- WHEN the entries are inspected
- THEN `DELIVERED` MUST use `color: 'success'`
- AND `SHIPPED` MUST use `color: 'warning'` with the label `"En ruta"`
- AND `NOT_APPLICABLE` MUST use `color: 'neutral'` with the label `"No aplica"`

#### Scenario: unknown strings still fall back to "Desconocido"

- GIVEN `getDeliveryStatusBadge` is called with a string outside the four-value set (e.g. a pre-deploy backend response or a typo)
- WHEN the lookup runs
- THEN the function MUST return the `unknownBadge` ("Desconocido") config
- AND no crash MAY occur

#### Scenario: pin tests freeze the badge map

- GIVEN the co-located badge-map pin tests
- WHEN they run
- THEN every key in `deliveryStatusBadgeMap` MUST be asserted verbatim
- AND a renamed or removed value MUST fail a pin test

## UI Copy (neutral Spanish, examples)

- Reward badge label: `GRATIS`
- Partial-discount reward badge label: `-N%` (e.g. `-50%`)
- BXGY units-needed hint: `2x1 · requiere N unidad(es) más` (N=1 → `"2x1 · requiere 1 unidad más"`; N≥2 → `"2x1 · requiere N unidades más"`)
- Defensive promo fallback label: `Promoción`
