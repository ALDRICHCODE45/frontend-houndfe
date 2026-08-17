# Mobile Filters Sheet Specification

Domain: `mobile-filters-sheet` — the unified "Filtros" bottom-sheet rendered below `md` across list views, and the `embedded` rendering mode of `DataTableFilters` v2.

## Purpose

Every list view shows one "Filtros" button opening one bottom-sheet with an identical design: sticky header (title + active-count badge + "Limpiar todo"), scrollable card-section body (~85vh max), sticky "Cerrar" footer. Fixes the nested sheet-in-sheet in `QuotationsListView` / `SalesListView` and gives bare admin sheets structure.

## Requirements

### REQ-1: Single sheet, no nesting

Below `md`, one "Filtros" tap SHALL open exactly one `USlideover side="bottom"`. When the `#filters` slot hosts `DataTableFilters` v2 in embedded mode, the sheet MUST NOT render a second trigger or slideover.

#### Scenario: Filtros opens one sheet

- GIVEN `QuotationsListView` below md with embedded `DataTableFilters` in `#filters`
- WHEN the user taps "Filtros"
- THEN exactly one bottom-sheet opens with no nested trigger or slideover

#### Scenario: Toolbar suppressed

- GIVEN `AppDataTable` with `showToolbar` false
- WHEN the page renders
- THEN no "Filtros" trigger or sheet renders

### REQ-2: Sticky header

The sheet SHALL render a sticky header (`data-testid="toolbar-filters-header"`) with the title "Filtros", a count badge when `activeFilterCount > 0`, and a "Limpiar todo" action shown only when the count is > 0.

#### Scenario: Active filters

- GIVEN two active filters
- WHEN the sheet opens
- THEN the header shows "Filtros", badge "2", and "Limpiar todo"

#### Scenario: Zero active filters

- GIVEN no active filters and `activeFilterCount` 0
- WHEN the sheet opens
- THEN the header shows no badge and no "Limpiar todo"

#### Scenario: Phase-1 count limitation

- GIVEN embedded v2 with active chips but wrapper `activeFilterCount` 0
- WHEN the sheet opens
- THEN the header shows no badge (documented phase-1 limitation; phase-2 derives the count from embedded state)

### REQ-3: Card sections body

The sheet SHALL render a scrollable body (`data-testid="toolbar-filters-body"`) capped at `h-[85vh] max-h-[85vh] overflow-y-auto`. The body SHALL render the `#filters` slot **directly** — the wrapper MUST NOT capture and re-render slot vnodes (vnode capture breaks leaf components that rely on provide/inject + Teleport, e.g. `USelect`'s Reka UI popover). Card sections are therefore owned by the consuming views, not by the toolbar: each view wraps its filter content in `FilterSectionCard` (`rounded-lg border border-default bg-elevated/30 px-4 py-4` with a `text-sm font-semibold text-highlighted` title), and `DataTableFilters` v2 in embedded mode styles each of its schema groups as a card with the same `bg-elevated/30` + section-title pattern.

#### Scenario: Embedded sections as cards

- GIVEN embedded v2 with two schema groups
- WHEN the sheet renders
- THEN each group renders as a card with its section title

#### Scenario: View-owned cards

- GIVEN a view that wraps its raw filters in `FilterSectionCard`
- WHEN the sheet renders
- THEN the card title and filter content render inside the body, and leaf `USelect`/Reka controls keep their parentage and open correctly

#### Scenario: Landscape scroll

- GIVEN a landscape mobile viewport with many sections
- WHEN the sheet opens
- THEN the body scrolls and nothing is clipped

### REQ-4: Sticky footer

The sheet SHALL render a sticky footer (`data-testid="toolbar-filters-footer"`) with a "Cerrar" button that closes the sheet.

#### Scenario: Cerrar closes

- GIVEN an open sheet with applied filters
- WHEN the user taps "Cerrar"
- THEN the sheet closes and filter state persists

### REQ-5: DataTableFilters v2 embedded mode

`DataTableFilters` v2 SHALL accept `embedded: boolean` (default `false`). When true it SHALL render only filter sections and chips (`data-testid="data-table-filters-embedded"`); trigger and own slideover MUST NOT render; `open`/`close` SHALL be no-ops. Standalone mode (default) SHALL remain unchanged.

#### Scenario: Standalone preserved

- GIVEN `embedded` unset or false
- WHEN the component renders
- THEN the trigger and own slideover render as today

#### Scenario: Exposed controls inert

- GIVEN embedded mode
- WHEN `open()` or `close()` is invoked
- THEN no slideover state changes

### REQ-6: Quotations and Sales use embedded

`QuotationsListView` and `SalesListView` SHALL pass `:embedded="true"` to `DataTableFilters` v2 inside `AppDataTable`'s `#filters` slot.

#### Scenario: One sheet in POS views

- GIVEN `SalesListView` below md
- WHEN the user taps "Filtros"
- THEN embedded sections and chips render inside the single sheet

### REQ-7: Raw admin filters in cards

Employees (status tabs), Expiring Documents (threshold select), and Tenants (checkbox) SHALL render inside the unified sheet, each wrapped in card section(s) per REQ-3.

#### Scenario: Admin sheet structured

- GIVEN `EmployeesListView` below md
- WHEN the user taps "Filtros"
- THEN a sheet with header, status-tabs card, and "Cerrar" footer opens

### REQ-8: Desktop unchanged

At `md`+, filters SHALL render inline as before; no sheet trigger or bottom-sheet SHALL render.

#### Scenario: Desktop inline

- GIVEN a desktop viewport
- WHEN the toolbar renders
- THEN filters render inline beside search with no sheet trigger
