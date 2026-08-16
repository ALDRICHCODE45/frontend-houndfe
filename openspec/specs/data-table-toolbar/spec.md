# Data Table Toolbar Specification

Domain: `data-table-toolbar` · Unified mobile toolbar behavior for `AppDataTable` / `DataTableToolbar`: below `md` a three-region fixed layout (search full-width, actions cluster with `flex-wrap`, "Filtros" bottom-sheet); at `md`+ the historical horizontal inline-filters layout is preserved. Serves all 8 list views (`EmployeesListView`, `ExpiringDocumentsView`, `PendingApprovalsView`, `AdminUsersView`, `AdminRolesView`, `AdminTenantsView`, `AdminTenantMembersView`, `ProductsView`) via the new `activeFilterCount: number` contract. Desktop rendering, per-view filter logic, and `AppDataTable` internals are governed elsewhere.

## Purpose

The original `DataTableToolbar` rendered `#filters` and `#actions` as rigid `flex` rows without `flex-wrap` on mobile, hiding buttons and stacking filter chips ("amontonados") on every list view at `< sm`. This capability introduces a single choke-point fix: a unified mobile layout, a bottom-sheet pattern for filters (matching `DataTableFilters` v2), and an `activeFilterCount` prop so each view can derive its count from existing filter state without migrating filter logic.

## Requirements

### REQ-1: Mobile three-region layout

Below `md`, `DataTableToolbar` SHALL render three stacked regions in fixed order: search full-width (row 1), actions cluster (row 2), "Filtros" button with optional count badge (row 3). All 8 list views SHALL inherit the layout via `AppDataTable`. The toolbar SHALL detect `isMobile = useBreakpoints(breakpointsTailwind).smaller('md')`.

#### Scenario: Full toolbar at 360px

- GIVEN `EmployeesListView` at 360px with search, actions, filters
- WHEN the page renders
- THEN search is full-width (row 1), actions (row 2), "Filtros" (row 3)

#### Scenario: Search-only table

- GIVEN a search-only table at 360px
- WHEN the toolbar renders
- THEN only the search row renders

### REQ-2: Actions cluster never overflows

The actions cluster SHALL use `flex-wrap` (`flex flex-wrap gap-2`) in fixed order `add → refresh → "Columnas" → ViewToggle → <slot name="actions" />`. Controls SHALL remain visible and clickable at 360px with no clipping. Compact `UButton color="neutral" variant="ghost"` controls SHALL be used for refresh / columns / view-toggle on mobile.

#### Scenario: All actions at 360px

- GIVEN add, refresh, column-visibility, ViewToggle at 360px
- WHEN the toolbar renders
- THEN controls render in fixed order, the cluster wraps, all controls are visible and clickable

#### Scenario: Card mode hides column visibility

- GIVEN card mode with `enableColumnVisibility`
- WHEN the toolbar renders
- THEN "Columnas" is hidden; remaining actions keep their relative order

### REQ-3: Filters collapse to bottom-sheet on mobile

Below `md`, the `#filters` slot SHALL render inside `USlideover side="bottom"` with a scrollable region sized `h-[85vh] max-h-[85vh] overflow-y-auto` so nothing clips in landscape. At `md`+, the `#filters` slot SHALL render inline beside the search input, unchanged from the historical desktop layout.

#### Scenario: Filters open in bottom-sheet

- GIVEN a mobile viewport and `#filters` content
- WHEN the user taps "Filtros"
- THEN a bottom sheet opens with the view's widgets
- AND filter state persists on close

#### Scenario: Landscape overflow

- GIVEN a landscape mobile viewport with many filters
- WHEN the sheet opens
- THEN it is scrollable and nothing is clipped

### REQ-4: Active-filter-count contract

`AppDataTable` SHALL accept an optional `activeFilterCount: number` prop (default `0`) and forward it to `DataTableToolbar`. When `activeFilterCount > 0`, the "Filtros" button SHALL display a `UBadge` showing the count. Views SHALL derive the count from existing filter state without migrating filter logic.

#### Scenario: Badge shows active count

- GIVEN `AdminTenantsView` with two active filters
- WHEN the toolbar renders on mobile
- THEN "Filtros" shows a badge with value 2

#### Scenario: Zero active filters

- GIVEN filters present, none active
- WHEN the toolbar renders
- THEN "Filtros" renders without a badge

### REQ-5: Filtros button visibility

The "Filtros" button (and its bottom-sheet trigger) SHALL be hidden when the `#filters` slot is empty — currently `AdminUsersView`, `AdminRolesView`, `AdminTenantMembersView`, and `ProductsView`. The button SHALL be shown when the slot has content, regardless of `activeFilterCount` value. Slot presence SHALL be detected via `useSlots()`.

#### Scenario: No filters slot

- GIVEN `AdminUsersView` without `#filters` content
- WHEN the toolbar renders on mobile
- THEN no "Filtros" button or sheet trigger renders

#### Scenario: Filters present, count zero

- GIVEN `#filters` content and `activeFilterCount` 0
- WHEN the toolbar renders
- THEN "Filtros" shows without a badge

### REQ-6: Desktop layout unchanged

At `md`+ the toolbar SHALL keep the historical horizontal layout: inline `#filters` slot beside search, actions cluster right-aligned. This capability SHALL NOT alter desktop rendering.

#### Scenario: Desktop inline filters

- GIVEN a desktop viewport
- WHEN the toolbar renders
- THEN filters render inline beside search; no sheet trigger appears

### REQ-7: No per-view filter migration

Views SHALL keep existing filter state and composables. The only per-view change SHALL be binding `:active-filter-count` to a derivation of existing state. Filter logic MUST NOT be relocated or rewritten. The 3 views with filter state today (`EmployeesListView`, `ExpiringDocumentsView`, `AdminTenantsView`) SHALL each bind the prop; the other 5 views SHALL omit the binding (count defaults to 0).

#### Scenario: Existing state preserved

- GIVEN `EmployeesListView`'s status-tab filter state
- WHEN the count binding is added
- THEN state and composable remain untouched; count derives from them

### REQ-8: Toolbar suppression

When `AppDataTable`'s `showToolbar` prop is `false` (e.g. `PendingApprovals` empty queue), the entire toolbar region SHALL NOT render — only the table body renders.

#### Scenario: Empty queue hides toolbar

- GIVEN `PendingApprovalsView` with `showToolbar` false
- WHEN the page renders
- THEN no toolbar region renders; the table body renders alone
