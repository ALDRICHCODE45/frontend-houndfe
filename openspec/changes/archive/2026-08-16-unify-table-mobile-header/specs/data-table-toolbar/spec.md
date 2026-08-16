# data-table-toolbar Specification

## Purpose

Unified mobile toolbar for `AppDataTable`/`DataTableToolbar`: below `md` three fixed regions — search, actions cluster, "Filtros" bottom-sheet; at `md`+ desktop unchanged. Serves all 8 list views.

## Requirements

### Requirement: Mobile three-region layout

Below `md`, the toolbar SHALL render three stacked regions in fixed order: search full-width, actions cluster, "Filtros" button with optional count badge. All 8 list views SHALL inherit it.

#### Scenario: Full toolbar at 360px

- GIVEN EmployeesListView at 360px with search, actions, filters
- WHEN the page renders
- THEN search is full-width (row 1), actions (row 2), "Filtros" (row 3)

#### Scenario: Search-only table

- GIVEN a search-only table at 360px
- WHEN the toolbar renders
- THEN only the search row renders

### Requirement: Actions cluster never overflows

The actions cluster SHALL use `flex-wrap` in fixed order add → refresh → "Columnas" → ViewToggle, compact controls on mobile; nothing clips at 360px.

#### Scenario: All actions at 360px

- GIVEN add, refresh, column-visibility, ViewToggle at 360px
- WHEN the toolbar renders
- THEN controls render in fixed order, cluster wraps, all visible and clickable

#### Scenario: Card mode hides column visibility

- GIVEN card mode with `enableColumnVisibility`
- WHEN the toolbar renders
- THEN "Columnas" is hidden; remaining actions keep relative order

### Requirement: Filters collapse to bottom-sheet on mobile

Below `md`, the `#filters` slot SHALL render inside `USlideover side="bottom"` (scrollable, ~85vh max). At `md`+, it SHALL render inline, unchanged.

#### Scenario: Filters open in bottom-sheet

- GIVEN a mobile viewport and `#filters` content
- WHEN the user taps "Filtros"
- THEN a bottom sheet opens with the view's widgets
- AND filter state persists on close

#### Scenario: Landscape overflow

- GIVEN a landscape mobile viewport with many filters
- WHEN the sheet opens
- THEN it is scrollable and nothing is clipped

### Requirement: Active-filter-count contract

`AppDataTable` SHALL accept optional `activeFilterCount: number` (default 0) and forward it to `DataTableToolbar`; when > 0, "Filtros" SHALL show a `UBadge` with the count. Views SHALL derive it from existing filter state.

#### Scenario: Badge shows active count

- GIVEN AdminTenantsView with two active filters
- WHEN the toolbar renders on mobile
- THEN "Filtros" shows a badge with value 2

#### Scenario: Zero active filters

- GIVEN filters present, none active
- WHEN the toolbar renders
- THEN "Filtros" renders without a badge

### Requirement: Filtros button visibility

The "Filtros" button SHALL be hidden when the `#filters` slot is empty (Users, Roles, TenantMembers, Products) and SHALL be shown when it has content, regardless of count.

#### Scenario: No filters slot

- GIVEN AdminUsersView without `#filters` content
- WHEN the toolbar renders on mobile
- THEN no "Filtros" button or sheet trigger renders

#### Scenario: Filters present, count zero

- GIVEN `#filters` content and `activeFilterCount` 0
- WHEN the toolbar renders
- THEN "Filtros" shows without a badge

### Requirement: Desktop layout unchanged

At `md`+, the toolbar SHALL keep the current horizontal layout (inline filters beside search, actions right). The change SHALL NOT alter desktop rendering.

#### Scenario: Desktop inline filters

- GIVEN a desktop viewport
- WHEN the toolbar renders
- THEN filters render inline beside search; no sheet trigger appears

### Requirement: No per-view filter migration

Views SHALL keep existing filter state and composables; the only per-view change SHALL be binding `active-filter-count`. Filter logic MUST NOT be relocated.

#### Scenario: Existing state preserved

- GIVEN EmployeesListView's status-tab filter state
- WHEN the count binding is added
- THEN state and composable remain untouched; count derives from them

### Requirement: Toolbar suppression

When `showToolbar` is `false` (e.g. PendingApprovals empty queue), the toolbar SHALL NOT render.

#### Scenario: Empty queue hides toolbar

- GIVEN PendingApprovalsView with `showToolbar` false
- WHEN the page renders
- THEN no toolbar region renders; the table body renders alone
