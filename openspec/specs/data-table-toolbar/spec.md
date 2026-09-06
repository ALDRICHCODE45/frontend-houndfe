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

Below `md`, the `#filters` slot SHALL render inside a single `USlideover side="bottom"` with three regions: a sticky header (`data-testid="toolbar-filters-header"`) carrying the title (via `<slot name="filters-title">` defaulting to `"Filtros"`), an active-count badge when `activeFilterCount > 0`, and a `"Limpiar todo"` action that emits `clear-filters` (resolved by the consuming view); a scrollable body (`data-testid="toolbar-filters-body"`) sized `h-[85vh] max-h-[85vh] overflow-y-auto` so nothing clips in landscape; and a sticky footer (`data-testid="toolbar-filters-footer"`) with a `"Cerrar"` button that closes the sheet. The body SHALL render the `#filters` slot **directly** — the toolbar MUST NOT capture and re-render slot vnodes (vnode capture breaks leaf components that rely on provide/inject + Teleport, e.g. `USelect`'s Reka UI popover). Card sections are therefore owned by the consuming views, not by the toolbar: each view wraps its raw filter content in `FilterSectionCard` (`rounded-lg border border-default bg-elevated/30 px-4 py-4` with a `text-sm font-semibold text-highlighted` title), and `DataTableFilters` v2 in embedded mode styles each of its schema groups as a card with the same `bg-elevated/30` + section-title pattern. When the slot hosts `DataTableFilters` v2 in embedded mode, the sheet SHALL render its sections and chips directly and MUST NOT render a second trigger or slideover. At `md`+, the `#filters` slot SHALL render inline beside the search input, unchanged from the historical desktop layout.

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
- THEN sticky header (`"Filtros"` + badge `"2"` + `"Limpiar todo"`), card-section body, and sticky `"Cerrar"` footer render

#### Scenario: View-owned cards, slot rendered directly

- GIVEN a view that wraps raw filters in `FilterSectionCard` and `DataTableFilters` v2 in embedded mode
- WHEN the sheet renders
- THEN card titles and filter content render inside the body, no wrapper-rendered `toolbar-filters-section-*` markers exist, and leaf `USelect` / Reka controls keep their parentage and open correctly

#### Scenario: Embedded filters, single sheet

- GIVEN `#filters` hosting `DataTableFilters` v2 in embedded mode
- WHEN the sheet opens
- THEN its sections and chips render inside the sheet and no second trigger or slideover appears

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

## Mobile Dashboard List Density Pilot (mobile-dashboard-list-density)

The following requirements were added by `mobile-dashboard-list-density` (verify tip `a306f8e3c19b509286d69488be7fc767d9e69b75`, archived `2026-09-06`). They apply only to the Products, Customers, and Employees/Colaboradores pilot compositions.

### Requirement: REQ-DTT-001 — Pilot toolbar containment

For the three pilot list compositions only, the mobile toolbar SHALL preserve the established three-region semantics: full-width search first, a wrapping actions region second, and the Filters trigger third when filters exist. The denser presentation SHALL keep each region within the available content width and SHALL NOT rely on page-level clipping to hide overflow. The existing mobile filter sheet, its filter state, and its scrollable content SHALL remain available.

#### Scenario: Three-region mobile toolbar remains usable

- GIVEN a Products, Customers, or Employees/Colaboradores list at 360, 412, or 740 CSS px
- WHEN the mobile toolbar renders
- THEN search remains the first region, actions remain the second region, and the Filters trigger remains the third region when a filters slot exists
- AND each region remains reachable without page-level horizontal scrolling
- IF the action controls need more than one line
- THEN the actions region wraps without clipping or changing the established order

#### Scenario: Filter sheet remains the filter owner

- GIVEN a pilot list with filter content at a mobile width
- WHEN the user opens Filters
- THEN the established bottom filter sheet opens with its header, scrollable body, and footer behavior
- AND filter values persist when the sheet closes
- IF filter content is taller than the available mobile height
- THEN the sheet body scrolls instead of clipping filter controls

### Requirement: REQ-DTT-002 — Labeled ViewToggle remains accessible and touchable

Within the three pilot toolbars, ViewToggle SHALL retain both human-readable mode labels, accessible names for both choices, keyboard operation, visible focus behavior, and a practical touch target of at least 44 CSS px in both dimensions for each actionable choice. Compact spacing MAY reduce visual density, but the control SHALL NOT become icon-only, lose a label, or become dependent on pointer hover.

#### Scenario: Both display modes remain discoverable

- GIVEN a pilot toolbar renders ViewToggle on a narrow viewport
- WHEN the user views the control
- THEN both mode labels are present and each choice has an accessible name
- AND the control remains contained within the toolbar content width

#### Scenario: Keyboard and touch interaction remain available

- GIVEN keyboard focus is placed on ViewToggle
- WHEN the user moves between choices and activates the selected choice with the keyboard
- THEN focus and selection follow the existing keyboard behavior
- AND IF a user activates either choice by touch
- THEN its actionable target is at least 44 CSS px by 44 CSS px and the display mode changes

### Requirement: REQ-DTT-003 — Toolbar behavior is pilot-scoped

The responsive density and containment delta SHALL apply only to the Products, Customers, and Employees/Colaboradores pilot compositions. It SHALL NOT require migration of non-pilot list views, change filter logic, change slot semantics, or introduce a new public component API. Existing desktop toolbar semantics SHALL remain unchanged.

#### Scenario: Non-pilot toolbar behavior is not broadened

- GIVEN a list view outside the three pilots
- WHEN the change is applied
- THEN its existing toolbar contract remains the governing behavior
- AND no pilot-only density requirement is inferred for that view

#### Scenario: Desktop semantics remain stable

- GIVEN a pilot list at the existing desktop toolbar breakpoint or wider
- WHEN the toolbar renders
- THEN its established desktop search, inline-filter, and actions semantics remain unchanged

### Requirement: REQ-DTT-004 — Visual evidence is not a DOM contract

Supplied screenshots SHALL be treated as visual evidence for density, containment, spacing, and light/dark fidelity, not as an exact deployed-DOM, selector, class, or component-API contract. The implementation MAY use any equivalent internal structure that satisfies these observable requirements.

#### Scenario: Screenshot differences do not redefine behavior

- GIVEN a supplied screenshot differs from the checked-in pilot markup
- WHEN the responsive behavior is reviewed
- THEN the review uses the screenshot to assess visual evidence only
- AND the normative contract is determined by these requirements and the canonical toolbar requirements
