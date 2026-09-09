# Admin Employees List Specification

Domain: `admin-employees-list` · POS admin employees list view behavior, including surfaced backend errors, working column-visibility selector, `useServerTable`-driven pagination/search with feature-local `statusTab`/`managerId` closures, status tabs rendered inside `AppDataTable`'s `#filters` slot, `AdminPageHeader` shell, `localStorage` `employee-view-mode` table/card preference with `displayMode` bridge, card rendering in `#cards` slot preserving kebab (edit/terminate/reactivate) and card-click navigation to `admin-employee-detail`, preserved bulk-action bar, and non-sortable columns (sorting descoped pending backend). The original `EmployeesListView` pre-dates the spec system, so the whole capability is `ADDED` (no `MODIFIED` block). Auth, `AdminPageHeader` internals, `AppDataTable` internals, and backend changes are not duplicated here. Employee detail, upsert slideover, terminate/reactivate flows, and `useManagerResolution` are governed elsewhere.

## Purpose

Bring `EmployeesListView.vue` to Fase 3 parity with the Fase 2 gold standard (`AdminUsersView` / `AdminTenantMembersView`): surface backend errors that currently render as "No se encontraron colaboradores" on a failed request; migrate the data layer from custom hand-rolled `page`/`pageSize` refs to the shared `useServerTable` composable via Approach C (closure-composition, no modification to the shared composable); replace the custom inline header with `AdminPageHeader`; add the column-visibility selector; fold the status tabs into `AppDataTable`'s `#filters` slot; render the card view inside `AppDataTable`'s `#cards` slot via the `displayMode` bridge (removing the duplicated prev/next pagination); persist `employee-view-mode` in `localStorage`; preserve the employees-only bulk-action bar and card kebab actions; remove the dead UI placeholders (Importar/Exportar, "Filtros", department/modality selects, "Más recientes" sort select); keep columns non-sortable until the backend confirms `sortBy`/`sortOrder`. No `Employee` type change, no new route, no backend change. `useManagerResolution`, `normalizeEmployee`, `computeSeniority`, and `buildCardData` remain untouched.

## Requirements

### REQ-1: Backend error state propagation

`EmployeesListView` SHALL destructure `isError`/`error` from `useServerTable`, compute `employeesErrorMessage`, and pass `:error` + `:error-message` to `AppDataTable`. Failed requests MUST render the error block with retry and MUST NOT render "No se encontraron colaboradores". The empty placeholder SHALL render only on empty success. Message SHALL prefer `response.data.message` (string or first element when array), then `error.message`, then "No se pudieron cargar los colaboradores. Reintenta.".

#### Scenario: failed request renders error

- GIVEN the list request fails
- WHEN `AppDataTable` renders
- THEN the error block with retry shows the message
- AND "No se encontraron colaboradores" is NOT rendered

#### Scenario: retry re-runs the request

- GIVEN the error block is visible
- WHEN the user clicks retry
- THEN `refresh` emits and the request re-runs

#### Scenario: message precedence

- GIVEN `response.data.message` exists as a string or first element of an array
- THEN it wins over `error.message` and the fallback

#### Scenario: empty success vs failed empty

- GIVEN the request succeeds with zero rows
- WHEN `AppDataTable` renders
- THEN the empty placeholder renders
- AND on a failed request the error block renders instead — never the empty placeholder

### REQ-2: `useServerTable` migration with feature-local filter closures (Approach C)

`useEmployeesList` SHALL compose `useServerTable` for pagination/search/error/selection, dropping the hand-rolled `page`/`pageSize` refs. `statusTab` (Todos/Activos/Bajas) and latent `managerId` SHALL remain feature-local refs that close over `queryKey` and `queryFn`. The shared `useServerTable` composable SHALL NOT be modified. Search SHALL map to `useServerTable`'s `globalFilter` (300ms debounce, `keepPreviousData`, `staleTime 30_000`, `refetchOnWindowFocus: false`). `selectedRows` SHALL stay index-based (matches WU-12 semantics). `employees.api.ts` SHALL accept 0-based `pageIndex` and SHALL NOT send a sort param.

#### Scenario: pagination via useServerTable

- GIVEN the user changes page or pageSize
- WHEN `useServerTable` emits `pagination`
- THEN the query refetches with the new 0-based `pageIndex` and `pageSize`

#### Scenario: statusTab closure refetches

- GIVEN `statusTab` is "Todos"
- WHEN the user clicks "Bajas"
- THEN `statusTab` becomes "Bajas"
- AND the request refetches with `status=terminated`

#### Scenario: managerId stays latent

- GIVEN `managerId` has no UI exposure
- WHEN the request fires
- THEN `managerId` is omitted from the URL unless set programmatically
- AND `useServerTable` does not surface `managerId` in its params

#### Scenario: shared composable untouched

- GIVEN the change ships
- THEN `useServerTable` is unchanged in the diff
- AND `status`/`managerId` are NOT promoted to shared params

### REQ-3: `AdminPageHeader` and dead-UI cleanup

`EmployeesListView` SHALL replace the custom inline `<h1>Colaboradores</h1>` header with `AdminPageHeader`. The `Nuevo colaborador` button SHALL stay gated by CASL `canCreate`. The disabled placeholders — Importar button, Exportar button, "Filtros" button, "Todos los departamentos" select, "Cualquier modalidad" select, "Más recientes" sort select — SHALL be removed (dead UI: not wired to backend params, no sort support).

#### Scenario: header shell replaces inline h1

- GIVEN the standardized list renders
- THEN `AdminPageHeader` shows the title "Colaboradores" with its description
- AND no inline `<h1>Colaboradores</h1>` is present

#### Scenario: create button gated by canCreate

- GIVEN `canCreate` is false
- WHEN the toolbar renders
- THEN `Nuevo colaborador` is hidden

#### Scenario: dead UI removed

- GIVEN the standardized view renders
- THEN no Importar/Exportar buttons render
- AND no "Filtros" button, department select, modality select, or sort select render

### REQ-4: Status tabs in `#filters` slot and search via `globalFilter`

`EmployeeFilters`' status tabs (Todos/Activos/Bajas) SHALL render inside `AppDataTable`'s `#filters` slot. The toolbar search box SHALL map to `useServerTable`'s `globalFilter`. Selecting a status tab SHALL update `statusTab` (closed over by `queryKey`/`queryFn`); typing in the search box SHALL update `globalFilter` after 300ms debounce.

#### Scenario: status tab selection

- GIVEN "Todos" is the active tab
- WHEN the user clicks "Activos"
- THEN `statusTab` becomes "active"
- AND the request refetches with `status=active`

#### Scenario: search updates globalFilter

- GIVEN the search box is empty
- WHEN the user types "juan"
- THEN after 300ms `globalFilter` becomes "juan"
- AND the request refetches with `search=juan`

### REQ-5: Column visibility

`EmployeesListView` SHALL set `enable-column-visibility` on `AppDataTable`. The 7 data columns — `colaborador, cargo, departamento, jefedirecto, fechaIngreso, modalidad, estado` — SHALL set `enableHiding: true`; `actions` SHALL stay non-hideable (`enableHiding: false`).

#### Scenario: dropdown lists every data column

- GIVEN the toolbar renders
- WHEN the user opens the visibility dropdown
- THEN each of the 7 data columns toggles independently
- AND `actions` is not hideable

#### Scenario: all data columns hidden

- GIVEN the user hides every data column
- THEN only `actions` remains visible

### REQ-6: View mode preference with `displayMode` bridge

`useEmployeeViewMode` SHALL wrap `useViewMode` (key `employee-view-mode`, modes `['table','card']`, default `table`), expose `isEmployeeViewMode`, and return `{ viewMode, setMode, toggleViewMode, displayMode }` bridging `card`→`cards`. `EmployeesListView` SHALL render `ViewToggle`, pass `:display-mode` to `AppDataTable`, and persist the choice across reloads.

#### Scenario: toggle switches and persists

- GIVEN table mode by default
- WHEN the user toggles to card
- THEN `display-mode="cards"` renders the `#cards` slot
- AND reload keeps card view

#### Scenario: invalid stored value falls back

- GIVEN an invalid `employee-view-mode` value in `localStorage`
- WHEN the view loads
- THEN mode is `table`

### REQ-7: Card rendering in `#cards` slot (kebab + click→detail PRESERVED)

`EmployeeCardGrid` SHALL render inside `AppDataTable`'s `#cards` slot via the `displayMode` bridge. `EmployeeCard` SHALL keep its kebab (Editar / Dar de baja / Reactivar, gated by CASL `canUpdate`) and the card-click → `admin-employee-detail` navigation — diverging from the Fase 2 no-kebab card contract by explicit decision (employees has a real detail route and richer per-row actions). The hand-rolled prev/next pagination that previously lived outside the table SHALL be removed; `AppDataTable`'s pagination governs both views.

#### Scenario: card mode renders inside #cards

- GIVEN card view is active
- WHEN `AppDataTable` renders
- THEN the `#cards` slot shows `EmployeeCardGrid`
- AND no sibling `v-else` branch with duplicate pagination renders

#### Scenario: card kebab actions

- GIVEN a card in card mode and CASL `canUpdate` is true
- WHEN the user opens the kebab
- THEN "Editar", "Dar de baja", "Reactivar" render per permission
- AND no checkbox renders on the card

#### Scenario: card click navigates to detail

- GIVEN a card in card mode
- WHEN the user clicks the card body
- THEN the router navigates to `admin-employee-detail` for that employee
- AND no edit slideover opens (kebab and card-click are separate affordances)

### REQ-8: Preserved bulk-action bar

The bulk-action bar (batch terminate / batch reactivate, `BATCH_OPS_CAP = 100`, CASL `batch_delete`/`update` on `Employee`) SHALL be preserved unchanged. `AppDataTable.bulkActions` SHALL still receive the same actions; row selection SHALL still come from `useServerTable.selectedRows` (index-based).

#### Scenario: bulk actions visible on selection

- GIVEN the user selects one or more rows within the cap
- WHEN the selection is non-empty
- THEN the bulk-action bar shows batch-terminate and batch-reactivate per CASL permission

#### Scenario: cap enforced at 100

- GIVEN the user selects more than 100 rows
- WHEN the bulk action runs
- THEN the cap of 100 is enforced (no-op or refused above the cap)

### REQ-9: Non-sortable columns (sorting descoped)

All 8 columns SHALL stay non-sortable (`enableSorting: false`, no `SortableHeader`). Sorting is descoped pending backend confirmation of `sortBy`/`sortOrder` support; the disabled "Más recientes" sort select SHALL NOT be reintroduced.

#### Scenario: no sort affordance on any column

- GIVEN the table renders
- WHEN the user interacts with a column header
- THEN no sort indicator or sortable header renders on any data column
- AND `actions` is non-sortable, non-hideable, and right-aligned

### REQ-10: Preserved invariants (no regressions)

`EmployeesListView` SHALL preserve: `useManagerResolution` batch resolution (60s cache), `normalizeEmployee`/`computeSeniority`/`buildCardData` internals, `EmployeeCard`/`EmployeeCardGrid` visual contract (article + `EntityAvatar` + `DotBadge`/`StatusDotBadge` + dashed divider + 2-col body), `defaultPinning: { right: ['actions'] }`, the `admin-employee-detail` route, and the CASL `canCreate` gate on the create button. No `Employee` type change, no new route, no backend change. The `mapPaginated` adapter SHALL bridge `{ data, total, page, limit, pageSize }` → `pageIndex` and SHALL NOT introduce a sort param.

#### Scenario: invariants hold

- GIVEN the standardized list renders
- THEN `actions` stays pinned right
- AND manager names resolve via `useManagerResolution` (no N+1)
- AND card body shows Antigüedad computed by `computeSeniority` without salary

#### Scenario: no type, route, or backend change

- GIVEN the change ships
- THEN no `Employee` field is added/removed
- AND no new route is registered
- AND `employees.api.ts` accepts 0-based `pageIndex` while keeping `status`/`managerId` and sends no sort param

## Mobile Dashboard List Density Pilot (mobile-dashboard-list-density)

The following requirements were added by `mobile-dashboard-list-density` (verify tip `a306f8e3c19b509286d69488be7fc767d9e69b75`, archived `2026-09-06`). They apply only to the Employees/Colaboradores pilot composition.

### Requirement: REQ-AEL-001 — Dashboard-owned Employees mobile gutter

The Employees/Colaboradores pilot SHALL use the dashboard layout as the sole owner of its outer mobile gutter. The Employees route surface SHALL NOT add a second outer horizontal gutter that compounds the dashboard gutter. Necessary inner surface spacing MAY remain when it does not create a second outer page gutter.

#### Scenario: Employees uses one outer gutter

- GIVEN the Employees/Colaboradores list renders at 360, 412, or 740 CSS px
- WHEN the route surface is measured
- THEN the outer mobile content begins within the dashboard-owned gutter without a duplicated route-level outer gutter
- AND the list surface remains sized to its available content width

### Requirement: REQ-AEL-002 — Employees has no page-level horizontal overflow

At 360, 412, and 740 CSS px, the Employees/Colaboradores page SHALL have no page-level horizontal overflow in either table mode or card mode. Containment SHALL be established by the participating list surface and its content regions rather than by masking overflow at an unrelated ancestor.

#### Scenario: Employees page fits target widths

- GIVEN Employees/Colaboradores is rendered with representative data at one of 360, 412, or 740 CSS px
- WHEN the user views either display mode
- THEN the document does not acquire horizontal page scrolling
- AND the toolbar, list surface, cards, batch actions, and pagination remain within the available page content width

### Requirement: REQ-AEL-003 — Employees card mode contains long content

In card mode, the Employees/Colaboradores pilot SHALL render cards without clipping, card-level horizontal scrolling, or page-level horizontal scrolling. Long representative employee names, departments, manager names, job titles, modality values, status badges, and action controls SHALL wrap or truncate within the card boundary while remaining readable and actionable.

#### Scenario: Long employee values stay inside cards

- GIVEN card mode contains an employee with a long name, department, manager, job title, modality, or status value
- WHEN the card renders at 360, 412, or 740 CSS px
- THEN the value is wrapped or truncated within the card boundary
- AND no card content, status badge, kebab, or pagination control is clipped
- IF the value exceeds the available inline width
- THEN the card does not become a horizontal scroll container

### Requirement: REQ-AEL-004 — Employees table scroll and actions remain local

In table mode, the Employees/Colaboradores pilot SHALL preserve the existing internal horizontal scrolling behavior of the rendered table region. The right actions column SHALL remain aligned with the table region's right edge, visible, and actionable at both the leftmost and rightmost horizontal scroll positions. Page-level scrolling SHALL NOT replace the table region's scroll behavior.

#### Scenario: Employees table scrolls only inside its region

- GIVEN the Employees table is wider than its available content region
- WHEN the user scrolls horizontally
- THEN horizontal movement occurs within the table region
- AND the page itself does not become the horizontal scroll owner
- IF the table is at either horizontal scroll extreme
- THEN the right actions column remains aligned, visible, and actionable

### Requirement: REQ-AEL-005 — Width-aware EmployeeCardGrid and visual fidelity

The Employees/Colaboradores card grid SHALL choose its arrangement from the available list content width, not from viewport width alone, and SHALL never create a track wider than that available width. The pilot SHALL retain the existing Coco/Nuxt UI semantic surfaces, rounded treatment, borders, typography contrast, and light/dark behavior; responsive density SHALL not introduce a separate visual language.

#### Scenario: Grid responds to nested content width

- GIVEN the Employees list surface has less usable width than the viewport because of its dashboard gutter and inner spacing
- WHEN card mode renders
- THEN the grid arrangement responds to the usable list content width
- AND no grid track forces horizontal overflow at 360, 412, or 740 CSS px

#### Scenario: Light and dark Employee surfaces remain faithful

- GIVEN Employees/Colaboradores renders in light mode or dark mode
- WHEN the toolbar, cards, batch actions, pagination, and table surface render
- THEN existing Coco/Nuxt UI semantic tokens and visual treatment remain recognizable
- AND no theme-specific raw styling is required by the responsive behavior

### Requirement: REQ-AEL-006 — Employees interactions and state do not regress

The Employees/Colaboradores delta SHALL preserve existing loading, error, empty, pagination, display-mode persistence, permissions, filters, batch actions, card navigation, card kebab actions, table actions, and employee data behavior. The existing status-filter sheet and three-region mobile toolbar semantics SHALL remain intact.

#### Scenario: Existing Employees behavior remains intact

- GIVEN Employees/Colaboradores is loading, failed, empty, paginated, filtered, persisted in a display mode, selected for batch action, or rendered for a restricted user
- WHEN the responsive layout is exercised
- THEN the existing state, permissions, filters, pagination, persistence, batch actions, navigation, and employee data behavior remain unchanged
- AND IF the user switches between table and card modes
- THEN the existing mode selection behavior remains intact

#### Scenario: Card navigation and actions remain separate

- GIVEN a card is rendered with the existing employee permissions
- WHEN the user clicks the card body or opens its kebab
- THEN card-click navigation and kebab actions remain distinct and actionable according to the canonical employee-list contract

### Requirement: REQ-AEL-007 — Employees pilot boundary

The responsive density delta SHALL apply only to Products, Customers, and Employees/Colaboradores. It SHALL NOT change employee APIs, DTOs, routes, authorization subjects, or business data behavior, and it SHALL NOT require non-pilot list views to adopt the new layout convention.

#### Scenario: Non-pilot views remain outside the delta

- GIVEN the responsive density change ships
- WHEN a non-pilot list view is rendered
- THEN it is not required to adopt the Employees responsive layout contract
- AND no backend, API, route, permission, or data migration is implied

#### Scenario: Employee contracts remain stable

- GIVEN the Employees/Colaboradores pilot is rendered after the responsive change
- WHEN filters, pagination, permissions, batch actions, navigation, or persisted display mode are used
- THEN their existing contracts remain the source of truth
