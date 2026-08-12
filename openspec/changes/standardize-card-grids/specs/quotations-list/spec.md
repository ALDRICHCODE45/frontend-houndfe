# Delta for `quotations-list` — `standardize-card-grids`

Purpose: `QuotationsListView` gains the same multi-column card mode through `AppDataTable`'s `#cards` slot when `display-mode="cards"`. `QuotationCard` is redesigned to the EmployeeCard layout pattern, emits `click`, and keeps its gated `delete` and `navigate` events. `AppDataTable.vue` is NOT modified; existing REQ-1..REQ-16 remain as-is.

## ADDED Requirements

### REQ-17 Multi-column card mode via `#cards`

`QuotationsListView` SHALL supply a `#cards` slot (replacing `#mobile-card`) rendering `QuotationCardGrid`, gated by `display-mode="cards"`. `QuotationCardGrid` SHALL use the Employee ladder grid `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7`. `card-click` SHALL route to `goToDetail(quotation)`; `delete` SHALL route to `handleDelete(quotation)` (existing ConfirmModal flow, REQ-13). View-test stubs SHALL expose `<slot name="cards" />`.

#### Scenario: card mode renders multi-column grid

- GIVEN `display-mode="cards"` and quotations exist
- WHEN the `#cards` slot renders
- THEN a 1/2/3/5/7 responsive grid shows one `QuotationCard` per row

#### Scenario: delete flow preserved from card

- GIVEN a DRAFT/CANCELLED card with `delete` permission
- WHEN the dropdown `Eliminar` is selected
- THEN `delete` emits and the existing ConfirmModal/delete flow runs

#### Scenario: dropdown does not trigger card click

- GIVEN the card dropdown is opened or its button clicked
- WHEN the user interacts with it
- THEN the interaction does not propagate to card navigation (`@click.stop`)

### REQ-18 QuotationCard uses EmployeeCard layout and emits `click`

`QuotationCard` SHALL render an `article` root with `data-testid="quotation-card"` styled like EmployeeCard: `border-default`/`bg-default`, initials avatar (seed=`quotation.id`, status dot when DRAFT/SENT), customer name, truncated id, status chip, dashed divider, and 2-column body (Total / Expira). It SHALL emit `click` with the quotation; `navigate` and `delete` events MUST remain. The dropdown (`quotation-card-delete`) MUST stay gated on deletable status + `canDelete`. The `RouterLink` wrapper (`quotation-card-link`) is removed with the redesign; tests referencing it MUST be updated in the same change.

#### Scenario: article renders the EmployeeCard pattern with testid

- GIVEN a quotation
- WHEN `QuotationCard` renders
- THEN an `article` with `data-testid="quotation-card"`, avatar, chips, dashed divider, and 2-col body renders on `border-default`/`bg-default`

#### Scenario: click navigates; delete stays gated

- GIVEN a card with delete permission on a DRAFT quotation
- WHEN the card is clicked
- THEN `click` emits the quotation
- AND the dropdown still shows gated `Eliminar` emitting `delete`

#### Scenario: non-deletable status hides Eliminar

- GIVEN a SENT quotation card
- WHEN the dropdown opens
- THEN no `quotation-card-delete` item renders (REQ-13 status gate)

### REQ-19 QuotationCardGrid provides skeleton + empty states

`QuotationCardGrid` SHALL render pulse skeletons (`border-default` + `bg-elevated`) while loading and an empty state with `i-lucide-file-text` when there are no rows. It SHALL forward each card's `click` as `card-click` and its `delete` as `delete`.

#### Scenario: loading shows skeleton

- GIVEN the grid is loading
- WHEN it renders
- THEN pulse skeletons render inside the ladder grid

#### Scenario: empty state

- GIVEN zero quotations
- WHEN the grid renders
- THEN the `i-lucide-file-text` empty state renders instead of cards
