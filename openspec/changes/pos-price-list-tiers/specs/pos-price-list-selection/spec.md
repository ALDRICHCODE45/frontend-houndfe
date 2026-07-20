# pos-price-list-selection Specification

## Purpose

Dropdown in ActiveSalePanel actions bar for assigning a global price list to a POS draft. Empty sales apply immediately; sales with items show a confirmation dialog. Covers clear (null), error revert, and loading/disabled states.

## Requirements

### Requirement: Selector Rendering
The system SHALL render a UInputMenu in the actions bar fetching global price lists via `productApi.getGlobalPriceLists()`. The dropdown SHALL show the active list name when `activeDraft.globalPriceListId` is set, and a placeholder when `null`. Value SHALL be driven by `activeDraft.globalPriceListId`.

#### Scenario: Dropdown shows active list name
- GIVEN `activeDraft.globalPriceListId` is `"uuid-mayoreo"`
- WHEN the panel renders
- THEN the dropdown displays the list name for that id

#### Scenario: Dropdown shows placeholder when null
- GIVEN `activeDraft.globalPriceListId` is `null`
- WHEN the panel renders
- THEN a placeholder (e.g. "Sin lista") is shown

### Requirement: Price List Change on Empty Sale
When `activeDraft.items.length === 0`, selecting a price list SHALL immediately call `PUT /sales/drafts/:id/price-list` without a confirmation dialog. On success, the draft cache SHALL be replaced with the response.

#### Scenario: Apply immediately on empty draft
- GIVEN `items.length === 0` and the cashier selects "MAYOREO"
- WHEN the selection fires
- THEN the endpoint is called with `{ globalPriceListId: "uuid-mayoreo" }` and no dialog appears

### Requirement: Price List Change on Sale With Items
When `activeDraft.items.length > 0`, changing the price list SHALL show a confirmation dialog warning about price recalculation. On confirm, the endpoint SHALL be called and cache updated. On cancel, the selector SHALL revert to its previous value.

#### Scenario: Confirm applies the change
- GIVEN `items.length > 0` and the cashier changes the list
- WHEN the confirm button is clicked
- THEN the endpoint is called and cache is updated on success

#### Scenario: Cancel reverts selector
- GIVEN the confirmation dialog is shown
- WHEN the cashier cancels
- THEN the endpoint is NOT called and the selector reverts to the prior value

### Requirement: Price List Clear
The dropdown SHALL include a "Sin lista" option. Selecting it SHALL send `{ globalPriceListId: null }`, reverting items to default pricing (PUBLICO).

#### Scenario: Clear sends null
- GIVEN the cashier selects "Sin lista"
- WHEN the change is applied
- THEN the endpoint is called with `{ globalPriceListId: null }`

### Requirement: Error Handling
On a 400 response or network error, the system SHALL show an error toast and revert the selector to its previous value.

#### Scenario: 400 error shows toast and reverts
- GIVEN the cashier selects an inexistent price list
- WHEN the endpoint returns 400
- THEN an error toast is shown and the selector reverts

#### Scenario: Network error shows toast and reverts
- GIVEN the request fails with a network error
- WHEN the error is caught
- THEN an error toast is shown and the selector reverts

### Requirement: Loading and Disabled States
The dropdown SHALL be disabled when `isMutating` is `true`. It SHALL show a loading spinner while fetching price lists. The confirmation button SHALL show loading state during the mutation.

#### Scenario: Dropdown disabled during mutation
- GIVEN `isMutating` is `true`
- WHEN the panel renders
- THEN the price list dropdown is disabled

#### Scenario: Spinner while fetching lists
- GIVEN the price list query is loading
- WHEN the dropdown renders
- THEN a spinner is shown instead of options

### Requirement: Active Price List Display
The actions bar SHALL display the active list as "Lista: [Nombre]" with an icon when `globalPriceListId` is set. The display SHALL be hidden when `null`.

#### Scenario: List name shown with icon
- GIVEN `activeDraft.globalPriceListId` links to "MAYOREO"
- WHEN the panel renders
- THEN "Lista: MAYOREO" with an icon is visible

#### Scenario: Hidden when null
- GIVEN `activeDraft.globalPriceListId` is `null`
- WHEN the panel renders
- THEN no list name or "Lista:" prefix is shown
