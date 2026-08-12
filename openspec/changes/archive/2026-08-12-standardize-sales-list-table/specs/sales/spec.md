# Delta Spec for `sales` — `standardize-sales-list-table`

Purpose: bring `SalesListView` to Products parity: error propagation, sortable headers, persisted view mode, single toolbar row.

Out of scope (unchanged): `SalesListTabs`, `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema` (11 fields, 4 sections), `#<id>-cell` slots, `USelect` shortcut, `pos-sales-list` key.

## ADDED Requirements

### REQ-12 Confirmed Sales List Surfaces Request Errors

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

### REQ-13 Sortable Column Headers

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

### REQ-14 View Mode Persistence

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

### REQ-15 Consolidated Toolbar

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

### REQ-16 Preserved Sales List Invariants

`SalesListTabs` (Todas/No Entregadas), `SaleCard`, `PaymentMethodPills`, `salesFiltersSchema` (11 fields, 4 sections), and every `#<id>-cell` slot SHALL remain unchanged.

#### Scenario: domain pieces keep current behavior
- GIVEN tabs, cards, and payment pills render
- WHEN the schema, cell templates, and component testids are inspected
- THEN `salesFiltersSchema` still defines 11 fields across 4 sections and all components and cell slots match current behavior
