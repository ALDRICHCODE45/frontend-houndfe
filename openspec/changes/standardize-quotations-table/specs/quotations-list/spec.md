# Delta Spec for `quotations-list` — `standardize-quotations-table`

Purpose: bring `QuotationsListView` toolbar assembly, column sorting, and view mode to parity with the Products gold standard (`ProductsView.vue`): one `DataTableToolbar` row, `<SortableHeader>` per sortable column, `ViewToggle` persisted via a `useViewMode` wrapper, and refresh/add wiring through `AppDataTable` instead of external buttons.

Out of scope (unchanged, not rewritten here): REQ-9 header-color split, REQ-10 status tabs + Filtros slideover + chips, REQ-12 URL persistence, REQ-13 delete flow, REQ-14 `useServerTable` adapter, REQ-15 TDD pure functions, and REQ-16 anti-requirements (shared component APIs untouched; `quotations-list-view`, `status-tabs`, `new-quotation-button`, `row-actions-*`, `quotation-link-*`, `refresh-quotations-button`, `app-data-table` testids stable). This delta MODIFIES REQ-11 only; all other requirements remain as-is.

## MODIFIED Requirements

### REQ-11: column visibility + global search + page-size options

`AppDataTable` SHALL run with `enable-column-visibility` + `v-model:column-visibility` and toolbar global search bound to `v-model:global-filter` (placeholder "Buscar cotizaciones…") wired to the backend `search` param; page-size options SHALL render (default `[10, 20, 50]`). The toolbar SHALL be a single `DataTableToolbar` row assembling, in order: search, `Filtros`, refresh, `Columnas`, "Nueva cotización", and the `ViewToggle` in the `#actions` slot; `DataTableFilters` SHALL render inside `AppDataTable`'s `#filters` slot (no standalone row above the toolbar). Refresh SHALL be provided by `AppDataTable` `show-refresh` (default `true`) emitting `@refresh` wired to `useServerTable.refresh()`; "Nueva cotización" SHALL be provided by `show-add-button` + `add-button-text` emitting `@add`; the external refresh/add `UButton`s outside the table SHALL be removed while `refresh-quotations-button` and `new-quotation-button` testids MUST remain. Sorting SHALL be enabled on `cliente`, `status`, `total`, `expiresAt`, and `createdAt` via `enableSorting: true` and `#<id>-header` slots rendering `SortableHeader`; `cliente` SHALL sort by the resolved customer name (`accessorFn`), not the raw `customer` key; the `id` column SHALL remain unsortable; header clicks SHALL flow through `useQuotationsListTable`'s existing `sorting[0].id` → backend `sortBy` mapping. View mode SHALL be exposed via `ViewToggle` driven by `useQuotationsViewMode` (a `useViewMode` wrapper keyed `quotations-view-mode`) feeding `AppDataTable` `displayMode`; the chosen `'table' | 'card'` mode SHALL persist to `localStorage["quotations-view-mode"]` and SHALL be restored on reload. The `quotationFiltersSchema` SHALL define the 5 first-slice filters: `status` (multi-enum), `customerId` (multi-async), `createdAt` (date-range `createdFrom`/`createdTo`), `expiresAt` (date-range `expiresFrom`/`expiresTo`), `totalCents` (numeric-range `minTotalCents`/`maxTotalCents`).

(Previously: AppDataTable ran with column visibility, global search, and page-size options, but refresh and "Nueva cotización" were external UButtons with `show-refresh="false"`, no column header was sortable, and there was no table/card view-mode toggle.)

#### Scenario: global search filters server-side
- GIVEN the cashier types `juan` in the toolbar search
- WHEN debounce elapses
- THEN a request with `search=juan` fires and rows narrow (no longer silently dropped).

#### Scenario: column picker toggles
- GIVEN `enable-column-visibility`
- WHEN a column is hidden in the picker
- THEN its cell disappears and `columnVisibility` persists (localStorage via `persistKey`).

#### Scenario: page size change
- GIVEN 25 rows
- WHEN page size 50 is chosen
- THEN a `limit=50` request fires and pagination resets to page 1.

#### Scenario: single toolbar row
- GIVEN the list route renders
- WHEN the header area is inspected
- THEN search, `Filtros`, refresh, `Columnas`, "Nueva cotización", and `ViewToggle` all render inside one `DataTableToolbar` row
- AND `DataTableFilters` renders inside the `#filters` slot with no standalone row above the toolbar.

#### Scenario: sortable headers re-sort rows
- GIVEN the list renders with `cliente`, `status`, `total`, `expiresAt`, `createdAt` sortable
- WHEN the cashier clicks the `Total` header
- THEN `useQuotationsListTable` maps the column id to backend `sortBy` and a sorted request fires
- AND rows re-order; the `id` header renders without a sort control.

#### Scenario: cliente sorts by resolved name
- GIVEN rows whose `customer` key holds `{ firstName, lastName }`
- WHEN the cashier sorts by `cliente`
- THEN ordering uses the resolved `firstName lastName` value, not the raw `customer` key.

#### Scenario: view mode persists across reload
- GIVEN the cashier toggles `ViewToggle` to "Tarjetas"
- THEN `localStorage["quotations-view-mode"]` stores `card` and card rendering is active
- AND after a reload the card mode is restored (no reset to table).

#### Scenario: toolbar refresh refetches
- GIVEN the toolbar refresh control (`refresh-quotations-button` testid) inside the table
- WHEN clicked
- THEN `@refresh` fires and `useServerTable.refresh()` refetches the current params.

#### Scenario: add button emits @add
- GIVEN "Nueva cotización" renders via `show-add-button` inside the toolbar
- WHEN clicked
- THEN `@add` fires and the view navigates to quotation creation
- AND `new-quotation-button` still resolves, with no duplicate external button outside the table.
