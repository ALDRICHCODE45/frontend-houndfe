# Delta for data-table-toolbar

## MODIFIED Requirements

### REQ-3: Filters collapse to bottom-sheet on mobile

Below `md`, the `#filters` slot SHALL render inside a single `USlideover side="bottom"` with three regions: a sticky header (`Filtros` title + active-count badge + `Limpiar todo` when count > 0), a scrollable body (`h-[85vh] max-h-[85vh] overflow-y-auto`) in which each filter section SHALL render as a card (`rounded-lg border border-default bg-elevated/30 px-4 py-4` with a `text-sm font-semibold text-highlighted` title), and a sticky footer with a `Cerrar` button. Each direct child of the `#filters` slot SHALL render inside a section card; an optional `#filters-title` slot (default `"Filtros"`) SHALL label a section. When the slot hosts `DataTableFilters` v2 in embedded mode, the sheet SHALL render its sections and chips directly and MUST NOT render a second trigger or slideover. At `md`+, the `#filters` slot SHALL render inline beside the search input, unchanged from the historical desktop layout.

(Previously: the sheet was a single scrollable region sized `h-[85vh] max-h-[85vh] overflow-y-auto` holding the raw `#filters` slot content, with no header, section cards, or footer.)

#### Scenario: Filters open in bottom-sheet

- GIVEN a mobile viewport and `#filters` content
- WHEN the user taps "Filtros"
- THEN a bottom sheet opens with the view's widgets
- AND filter state persists on close

#### Scenario: Landscape overflow

- GIVEN a landscape mobile viewport with many filters
- WHEN the sheet opens
- THEN it is scrollable and nothing is clipped

#### Scenario: Structured sheet

- GIVEN a mobile viewport with `#filters` content and `activeFilterCount` 2
- WHEN the sheet opens
- THEN sticky header ("Filtros" + badge "2" + "Limpiar todo"), card-section body, and sticky "Cerrar" footer render

#### Scenario: Raw content wrapped in cards

- GIVEN raw `#filters` content (e.g., admin status tabs)
- WHEN the sheet renders
- THEN each slot child renders in a section card labeled by `#filters-title` (default "Filtros")

#### Scenario: Embedded filters, single sheet

- GIVEN `#filters` hosting `DataTableFilters` v2 in embedded mode
- WHEN the sheet opens
- THEN its sections and chips render inside the sheet and no second trigger or slideover appears
