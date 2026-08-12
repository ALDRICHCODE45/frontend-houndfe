# Delta for `admin-tenants-list` — `standardize-admin-tenants-table`

Purpose: new capability — no prior list spec; standardizes `AdminTenantsView.vue` to `AdminRolesView`/`AdminUsersView` parity (Fase 2). All requirements ADDED.

## ADDED Requirements

### REQ-1 Backend error state propagation

`AdminTenantsView` SHALL destructure `isError`/`error` from `useServerTable`, compute `tenantsErrorMessage`, and pass `:error` + `:error-message` to `AppDataTable`. Failed requests MUST render the error block with retry, never "No se encontraron sucursales". The empty placeholder SHALL render only on empty success. Message SHALL prefer `response.data.message`, then `error.message`, then "No se pudieron cargar las sucursales. Reintenta.".

#### Scenario: failed request
- GIVEN the list request fails
- WHEN `AppDataTable` renders
- THEN the error block with retry shows the message
- AND the empty text is not rendered

#### Scenario: retry
- GIVEN the error block is visible
- WHEN the user clicks retry
- THEN `refresh` emits and the request re-runs

#### Scenario: precedence
- GIVEN `response.data.message` exists
- THEN it wins over `error.message` and the fallback

### REQ-2 View mode preference

`useTenantViewMode` SHALL wrap `useViewMode` (key `admin-tenants-view-mode`, modes `['table','card']`, default `table`), expose `isTenantViewMode`, and return `{ viewMode, setMode, toggleViewMode, displayMode }` bridging `card`→`cards`. `AdminTenantsView` SHALL render `ViewToggle` in `#actions`, pass `:display-mode`, and persist across reloads.

#### Scenario: toggle switches and persists
- GIVEN table mode by default
- WHEN the user toggles to card
- THEN `display-mode="cards"` renders the `#cards` slot
- AND reload keeps card view

#### Scenario: invalid stored value
- GIVEN an invalid `admin-tenants-view-mode` value
- WHEN the view loads
- THEN mode is `table`

### REQ-3 Card rendering (EmployeeCard pattern, click-to-edit)

`TenantCard` SHALL render an `article` with `EntityAvatar` seeded by the tenant id, `name`/`slug`, chip row (`StatusDotBadge` "Activa"/"Inactiva"), dashed divider, and 2-col body (`Dirección` null-safe `'—'`, `Creación` es-AR), emitting `click` only (no kebab/checkbox). Card click SHALL open `TenantUpsertSlideover` in edit mode via the same `openEdit` the kebab triggers — no detail route, no `router.push`. `TenantCardGrid` SHALL use the 1/2/3/5/7 ladder with skeleton/empty states (`i-lucide-building`).

#### Scenario: card click opens edit slideover
- GIVEN a tenant card in card mode
- WHEN the user clicks it
- THEN `card-click` fires and `TenantUpsertSlideover` opens in edit mode
- AND no `router.push` occurs

#### Scenario: ladder and no kebab
- GIVEN card mode with rows
- THEN cards fill the 1/2/3/5/7 ladder
- AND no kebab or checkbox renders on the card

#### Scenario: loading / empty
- GIVEN card mode
- THEN skeletons show while loading, the `i-lucide-building` empty state when no rows

### REQ-4 Super-admin-gated kebab

The kebab SHALL render only for `isSuperAdmin` (super-admin-only gate; CASL `userCan` is NOT used). No empty kebab SHALL render. "Editar", "Gestionar miembros", and "Desactivar" SHALL keep current behavior from `tenant-actions.utils.ts`; "Gestionar miembros" SHALL appear on the table kebab only.

#### Scenario: non-super-admin
- GIVEN a user without `isSuperAdmin`
- WHEN a row renders
- THEN no kebab appears

#### Scenario: super-admin
- GIVEN an `isSuperAdmin` user
- WHEN the kebab opens
- THEN "Editar", "Gestionar miembros", and "Desactivar" show as today

### REQ-5 Explicit column flags and sortability

`useTenantColumns` SHALL set explicit `enableSorting`/`enableHiding` on every column. `name`, `slug`, `createdAt` SHALL stay sortable via `SortableHeader`; `isActive` SHALL stay non-sortable (boolean comparator no-op); `address`, `phone`, `actions` SHALL be non-sortable; `actions` SHALL be non-hideable and right-aligned.

#### Scenario: flags locked
- GIVEN the columns render
- THEN `name`/`slug`/`createdAt` offer a sort header, `isActive`/`address`/`phone`/`actions` do not
- AND `actions` is not hideable

### REQ-6 Column visibility and #filters slot

`AdminTenantsView` SHALL set `enable-column-visibility` on `AppDataTable`. All data columns — `name`, `slug`, `address`, `phone`, `isActive`, `createdAt` — SHALL be hideable; `actions` SHALL stay non-hideable. The `includeInactive` `<UCheckbox>` SHALL render inside `AppDataTable`'s `#filters` slot, visible in both table and card modes, and SHALL keep driving the `adminTenantQueryKeys.list({ includeInactive })` query key.

#### Scenario: dropdown lists all data columns
- GIVEN the toolbar renders
- WHEN the user opens the visibility dropdown
- THEN every data column toggles independently
- AND `actions` is not hideable

#### Scenario: filter visible in both modes
- GIVEN table or card mode
- WHEN the view renders
- THEN `includeInactive` shows in the filters slot and still drives the query key

### REQ-7 Header and preserved invariants

The standardized view SHALL render `AdminPageHeader` (`title="Gestión de sucursales"`, description) instead of the inline `<h2>`, preserving `defaultPinning.right: ['actions']`, the `isSuperAdmin` kebab gate, `persistKey: 'admin-tenants'`, and full-array local filter/sort/paginate semantics. `tenants.api.ts` and `tenant-actions.utils.ts` SHALL remain untouched — full-catalog local semantics are correct, not a defect. "Gestionar miembros" routing SHALL be preserved. No type, route, or backend change.

#### Scenario: header swap
- GIVEN the standardized view renders
- THEN `AdminPageHeader` with "Gestión de sucursales" replaces the inline heading

#### Scenario: invariants hold
- GIVEN the standardized list renders
- THEN `actions` stays pinned right and non-hideable
- AND the `isSuperAdmin` gate, `persistKey`, and full-catalog local semantics behave as before
