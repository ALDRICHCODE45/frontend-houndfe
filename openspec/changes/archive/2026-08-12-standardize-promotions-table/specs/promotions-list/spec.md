# Delta for `promotions-list` — `standardize-promotions-table`

Purpose: new capability — no prior list spec; standardizes `PromotionsView.vue` to CustomersView parity. All requirements ADDED.

## ADDED Requirements

### REQ-1 Backend error state propagation

`PromotionsView` SHALL destructure `isError`/`error` from `useServerTable`, compute `promotionsErrorMessage`, and pass `:error` + `:error-message` to `AppDataTable`. Failed requests MUST render the error block with retry, not "No hay promociones todavía". Message SHALL prefer `response.data.message`, then `error.message`, then "No se pudieron cargar las promociones. Reintenta.".

#### Scenario: failed request
- GIVEN the list request fails
- WHEN `AppDataTable` renders
- THEN the error block with retry shows the message
- AND the empty text is not rendered

#### Scenario: retry
- GIVEN the error block shows
- WHEN the user clicks retry
- THEN `refresh` emits and the request re-runs

#### Scenario: message precedence
- GIVEN `response.data.message` exists
- THEN it wins over `error.message` and the fallback

### REQ-2 View mode preference

`usePromotionViewMode` SHALL wrap `useViewMode` (key `promotions-view-mode`, modes `['table','card']`, default `table`), expose `isPromotionViewMode`, and return `{ viewMode, setMode, toggleViewMode, displayMode }` bridging `card`→`cards`. `PromotionsView` SHALL render `ViewToggle` in `#actions`, pass `:display-mode`, and persist across reloads.

#### Scenario: toggle switches and persists
- GIVEN table mode by default
- WHEN the user toggles to card
- THEN `display-mode="cards"` renders the `#cards` slot
- AND reload keeps card view

#### Scenario: invalid stored value
- GIVEN an invalid `promotions-view-mode` value
- WHEN the view loads
- THEN mode is `table`

### REQ-3 Card rendering (EmployeeCard pattern)

`PromotionCard` SHALL render an `article` with `EntityAvatar`, title, status/type/method chips, dashed divider, and 2-col body (`startDate`, `createdAt`). It SHALL emit `click`; the kebab SHALL stop propagation and be gated by `canManagePromotionActions`. Cards SHALL NOT render checkboxes; click SHALL navigate to `/pos/promociones/:id`. `PromotionCardGrid` SHALL use the Employee ladder (1/2/3/5/7) with skeleton/empty states.

#### Scenario: card click navigates to detail
- GIVEN a promotion card
- WHEN the user clicks the card body
- THEN the router navigates to `/pos/promociones/{id}`

#### Scenario: ladder and no checkboxes
- GIVEN card mode with rows
- THEN cards fill the 1/2/3/5/7 ladder with no checkboxes

### REQ-4 Filters in `#filters` slot

The Tipo/Estado/Método `USelect`s SHALL move from the standalone row into `AppDataTable`'s `#filters` slot. Testids `filter-type`, `filter-status`, `filter-method` SHALL be preserved in the toolbar. Query params, pagination reset, and selection clear SHALL behave as before.

#### Scenario: selects render in toolbar
- GIVEN the standardized view renders
- WHEN the toolbar opens
- THEN the testids resolve to each `USelect` in the toolbar

### REQ-5 Permission-gated actions

`canManagePromotionActions` SHALL equal `canUpdate || canDelete`. When false, the kebab SHALL NOT render.

#### Scenario: read-only user
- GIVEN no `update`/`delete` on `Promotion`
- WHEN a row or card renders
- THEN no kebab appears

#### Scenario: editor
- GIVEN `update` permission
- THEN kebab shows "Editar" and "Finalizar"; "Eliminar" only with `delete`

### REQ-6 `updatedAt` sortable header

`#updatedAt-header` SHALL render a `SortableHeader` (column already `enableSorting: true`). Clicks SHALL send `sortBy=updatedAt`.

#### Scenario: header click sorts server-side
- GIVEN sorted by `updatedAt` asc
- WHEN the user clicks the header
- THEN the request carries `sortBy=updatedAt&sortOrder=desc`, next click `asc`

### REQ-7 Preserved table invariants

The standardized view SHALL preserve: bulk actions gated by `batch_delete` (`canBatchDelete`/`canBatchEnd`/`canBatchActivate`), offending-IDs ring on `#title-cell` cleared on selection change, page-reset + selection-clear watch on filter change, `actions` pinned right (non-hideable, non-sortable), and row selection gated by `canBatchDelete || canBatchEnd`.

#### Scenario: bulk actions still permission-gated
- GIVEN `delete` without `batch_delete`
- THEN no bulk "Eliminar" renders

#### Scenario: offending IDs ring on 409
- GIVEN batch delete returns `offendingIds`
- THEN the affected `#title-cell`s render the ring; next selection clears it

#### Scenario: filter change clears selection
- GIVEN rows selected and a filter changes
- THEN `pageIndex` resets to 0 and `rowSelection` clears

#### Scenario: pinning and row-selection hold
- GIVEN the standardized list renders
- THEN `actions` stays pinned right; row selection needs batch permissions
