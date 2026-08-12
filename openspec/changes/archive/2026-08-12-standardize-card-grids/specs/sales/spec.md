# Delta for `sales` — `standardize-card-grids`

Purpose: confirmed-sale rows gain a multi-column card mode rendered through `AppDataTable`'s existing `#cards` slot when `display-mode="cards"` (from `useSalesViewMode`). `SaleCard` is redesigned to the EmployeeCard layout pattern and emits `click`; navigation to the sale detail moves to the view. `AppDataTable.vue` is NOT modified; the data contract, columns, and table mode are unchanged.

## ADDED Requirements

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
