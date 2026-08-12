# Customer List Specification

Domain: `customer-list` · POS customers list view behavior, including surfaced backend errors, server-side sortable columns (`email`, `phone`, `globalPriceListName`), per-user table/card preference persisted in `localStorage` under `customers-view-mode`, EmployeeCard-pattern card rendering, permission-gated actions, and the post-create visibility reset. Customer detail, upsert slideover, address modal, and backend changes are governed by other capabilities and are not duplicated here.

## Purpose

Bring `CustomersView.vue` to parity with `ProductsView.vue`: surface backend errors, add the card view users now expect, gate destructive menus, add sortable headers plus tests, and port the post-create visibility reset. The original view pre-dates the spec system; this capability is introduced in `standardize-customers-table`.

## Requirements

### REQ-1: Backend error state propagation

`CustomersView` SHALL destructure `isError`/`error` from `useServerTable`, compute `customersErrorMessage`, and pass `:error` + `:error-message` to `AppDataTable`. Failed requests MUST render the error block with retry, never "No se encontraron clientes". Message SHALL prefer `response.data.message`, then `error.message`, then "No se pudieron cargar los clientes. Reintenta.".

#### Scenario: failed request

- GIVEN the list request fails
- WHEN `AppDataTable` renders
- THEN the error block with retry shows the message
- AND the empty text is not rendered

#### Scenario: retry

- GIVEN the error block is visible
- WHEN the user clicks retry
- THEN `refresh` emits and the request re-runs

#### Scenario: precedence

- GIVEN `response.data.message` exists
- THEN it wins over `error.message` and the fallback

### REQ-2: Server-side sortable columns

`email`, `phone`, and `globalPriceListName` SHALL be sortable like `fullName` (sorting enabled + `SortableHeader` slots). Sort changes SHALL send `sortBy`/`sortOrder` to the backend (already accepted). `actions` MUST stay pinned right, non-sortable, non-hideable.

#### Scenario: header click sorts server-side

- GIVEN default sort `fullName` asc
- WHEN the user clicks the `email` header
- THEN the request carries `sortBy=email&sortOrder=asc`, second click `desc`

#### Scenario: phone sorts as string

- GIVEN customers with different `phone` values
- WHEN sorting `phone` asc
- THEN rows order by string value (country code prepended)

### REQ-3: View mode preference

`useCustomerViewMode` SHALL wrap `useViewMode` (`customers-view-mode`, `['table','card']`, default `table`), expose `isCustomerViewMode`, and return `{ viewMode, setMode, toggleViewMode, displayMode }` bridging `card`→`cards`. `CustomersView` SHALL render `ViewToggle` in `#actions` and pass `:display-mode`; the choice SHALL persist across reloads.

#### Scenario: toggle switches and persists

- GIVEN table mode by default
- WHEN the user toggles to card
- THEN `display-mode="cards"` renders the `#cards` slot
- AND reload keeps card view

#### Scenario: invalid stored value

- GIVEN an invalid `customers-view-mode` value
- WHEN the view loads
- THEN mode is `table`

### REQ-4: Card rendering (EmployeeCard pattern)

`CustomerCard` SHALL render an `article` with `EntityAvatar`, `fullName`, chip row, dashed divider, and 2-col body (`email`, `phone`, `globalPriceListName`, `createdAt`) — no RFC/fiscal (on `CustomerDetail`). It SHALL emit `edit`/`delete`/`click`; kebab stops propagation and is gated. `CustomerCardGrid` SHALL use the Employee ladder (1/2/3/5/7) with skeleton/empty states, forwarding card events.

#### Scenario: card click opens editor

- GIVEN a card with update permission
- WHEN the user clicks it
- THEN `card-click` fires and the edit slideover opens

#### Scenario: grid ladder

- GIVEN card mode with rows
- THEN cards fill the 1/2/3/5/7 ladder

#### Scenario: loading / empty

- GIVEN card mode
- THEN skeletons show while loading, the empty message when no rows

### REQ-5: Permission-gated actions

The kebab SHALL be hidden when the user lacks update and delete: `CustomersView` gates it via `canManageCustomerActions`; no empty kebab SHALL render.

#### Scenario: read-only user

- GIVEN no `update`/`delete` on `Customer`
- WHEN a row or card renders
- THEN no kebab appears

#### Scenario: editor

- GIVEN `update` permission
- THEN kebab shows "Editar"; "Eliminar" only with `delete`

### REQ-6: Post-create visibility reset

After a successful create, `CustomersView` SHALL mirror Products' `resetVisibilityContextAfterCreate`: reset `pageIndex` to 0 when not already, and clear `globalFilter` when it does not match the created customer. Matching filter / page 0 are left unchanged.

#### Scenario: deep page resets

- GIVEN `pageIndex > 0` and create succeeds
- THEN `pageIndex` becomes 0

#### Scenario: non-matching filter clears

- GIVEN an active filter not matching the created customer
- WHEN create succeeds
- THEN `globalFilter` clears; matching filters persist

### REQ-7: Preserved table invariants

The standardized view SHALL preserve: `actions` pinned right, column-visibility selector, single-row toolbar, server pagination with page-size options, global search.

#### Scenario: invariants hold

- GIVEN the standardized list renders
- THEN pinning, visibility, toolbar, pagination, and search behave as before
