# Promotions List Specification

Domain: `promotions-list` · POS admin promotions list view behavior, including surfaced backend errors, per-user table/card preference persisted in `localStorage` under `promotions-view-mode`, EmployeeCard-pattern card rendering, permission-gated kebab actions, filters consolidated into the `AppDataTable` toolbar, and the `updatedAt` server-side sortable header. The existing `promotions` capability governs form composition only (target types, payload mapping, error mapping) and is not duplicated here.

## Purpose

Bring `PromotionsView.vue` to parity with `CustomersView.vue` / `ProductsView.vue`: surface backend errors, add a card view users now expect, move the three filter selects into the unified toolbar, gate the empty kebab for read-only users, and finish the `updatedAt` sortable header. The original view pre-dates the spec system; this capability is introduced in `standardize-promotions-table`.

## Requirements

### REQ-1: Backend error state propagation

`PromotionsView` SHALL destructure `isError`/`error` from `useServerTable`, compute `promotionsErrorMessage`, and pass `:error` + `:error-message` to `AppDataTable`. Failed requests MUST render the error block with retry, never "No hay promociones todavía". Message SHALL prefer `response.data.message` (string), then the first element of `response.data.message` (array), then `error.message`, then "No se pudieron cargar las promociones. Reintenta.".

#### Scenario: failed request

- GIVEN the list request fails
- WHEN `AppDataTable` renders
- THEN the error block with retry shows the message
- AND the empty text is not rendered

#### Scenario: retry

- GIVEN the error block is visible
- WHEN the user clicks retry
- THEN `refresh` emits and the request re-runs

#### Scenario: message precedence

- GIVEN `response.data.message` exists as a string
- THEN it wins over `error.message` and the fallback
- GIVEN `response.data.message` exists as an array
- THEN its first element wins over `error.message` and the fallback

### REQ-2: View mode preference

`usePromotionViewMode` SHALL wrap `useViewMode` (`promotions-view-mode`, modes `['table','card']`, default `table`), expose `isPromotionViewMode`, and return `{ viewMode, setMode, toggleViewMode, displayMode }` bridging `card`→`cards`. `PromotionsView` SHALL render `ViewToggle` in `#actions`, pass `:display-mode`, and persist the choice across reloads.

#### Scenario: toggle switches and persists

- GIVEN table mode by default
- WHEN the user toggles to card
- THEN `display-mode="cards"` renders the `#cards` slot
- AND reload keeps card view

#### Scenario: invalid stored value

- GIVEN an invalid `promotions-view-mode` value
- WHEN the view loads
- THEN mode is `table`

### REQ-3: Card rendering (EmployeeCard pattern, click-only)

`PromotionCard` SHALL render an `article` with `EntityAvatar`, title, status/type/method chips, dashed divider, and 2-col body (`Inicio` = `startDate`, `Creada` = `createdAt`). It SHALL emit `click` only — cards SHALL NOT render a kebab or a checkbox. Card click SHALL navigate to `/pos/promociones/:id` via `router.push`. `PromotionCardGrid` SHALL use the Employee ladder (1/2/3/5/7) with 8 pulse skeletons and an empty state. Destructive and edit actions SHALL live exclusively on the table row kebab (REQ-5), consistent with `CustomersView` parity.

#### Scenario: card click navigates to detail

- GIVEN a promotion card
- WHEN the user clicks the card body
- THEN the router navigates to `/pos/promociones/{id}`

#### Scenario: ladder and no checkboxes

- GIVEN card mode with rows
- THEN cards fill the 1/2/3/5/7 ladder
- AND no checkboxes are rendered

#### Scenario: card has no kebab

- GIVEN card mode with rows
- WHEN the card renders
- THEN no kebab dropdown appears on the card
- AND all actions remain available on the corresponding table row

### REQ-4: Filters in `#filters` slot

The `Tipo`, `Estado`, and `Método` `USelect`s and the `Limpiar` button SHALL move from their standalone row into `AppDataTable`'s `<template #filters>` slot. The testids `filter-type`, `filter-status`, `filter-method`, and `clear-filters-btn` SHALL be preserved in the toolbar. Query params, pagination reset on filter change, and selection clear on filter change SHALL behave as before.

#### Scenario: selects render in toolbar

- GIVEN the standardized view renders
- WHEN the toolbar opens
- THEN each `USelect` and the `Limpiar` button resolve to their testids inside the toolbar

#### Scenario: filter change still resets selection

- GIVEN rows selected and a filter changes
- WHEN the watch fires
- THEN `pageIndex` resets to 0 and `rowSelection` clears

### REQ-5: Permission-gated kebab

`canManagePromotionActions` SHALL equal `canUpdate || canDelete`. When false, the kebab `UDropdownMenu` on the table row SHALL NOT render. The kebab SHALL offer `Editar` (with `update`), `Finalizar` (with `update`, when status permits), and `Eliminar` (only with `delete`). Bulk actions remain gated by `batch_delete` independently.

#### Scenario: read-only user

- GIVEN no `update`/`delete` on `Promotion`
- WHEN a row renders
- THEN no kebab appears

#### Scenario: editor

- GIVEN `update` permission
- WHEN a row renders
- THEN kebab shows `Editar` and `Finalizar` (when status permits)
- AND `Eliminar` only with `delete`

### REQ-6: `updatedAt` sortable header

`#updatedAt-header` SHALL render a `SortableHeader` with label "Actualizada". The `updatedAt` column SHALL have `enableSorting: true`. Header clicks SHALL send `sortBy=updatedAt` and toggle `sortOrder` between `desc` and `asc`, matching the rest of the table's sort behavior delegated to the shared `SortableHeader` + `useServerTable`.

#### Scenario: header click sorts server-side

- GIVEN sorted by `updatedAt` desc
- WHEN the user clicks the header
- THEN the request carries `sortBy=updatedAt&sortOrder=asc`

### REQ-7: Preserved table invariants

The standardized view SHALL preserve: bulk actions gated by `batch_delete` (`canBatchDelete` / `canBatchEnd` / `canBatchActivate`), offending-IDs ring on `#title-cell` cleared on selection change, page-reset + selection-clear watch on filter change, `actions` pinned right (non-hideable, non-sortable), and row selection gated by `canBatchDelete || canBatchEnd`.

#### Scenario: bulk actions still permission-gated

- GIVEN `delete` without `batch_delete`
- WHEN the bulk actions toolbar renders
- THEN no bulk "Eliminar" appears

#### Scenario: offending IDs ring on 409

- GIVEN batch delete returns `offendingIds`
- WHEN the affected rows render
- THEN the affected `#title-cell`s render the ring
- AND the next selection change clears it

#### Scenario: filter change clears selection

- GIVEN rows selected and a filter changes
- WHEN the watch fires
- THEN `pageIndex` resets to 0 and `rowSelection` clears

#### Scenario: pinning and row-selection hold

- GIVEN the standardized list renders
- THEN `actions` stays pinned right and is non-sortable / non-hideable
- AND row selection requires `canBatchDelete || canBatchEnd`