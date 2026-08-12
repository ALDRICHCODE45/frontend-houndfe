# Delta for `admin-roles-list` — `standardize-admin-roles-table`

Purpose: new capability — no prior list spec; standardizes `AdminRolesView.vue` to `AdminUsersView` parity (Fase 2 #2). All requirements ADDED.

## ADDED Requirements

### REQ-1 Backend error state propagation

`AdminRolesView` SHALL destructure `isError`/`error` from `useServerTable`, compute `rolesErrorMessage`, and pass `:error` + `:error-message` to `AppDataTable`. Failed requests MUST render the error block with retry, never "No se encontraron roles". The empty placeholder SHALL render only on empty success. Message SHALL prefer `response.data.message`, then `error.message`, then "No se pudieron cargar los roles. Reintenta.".

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

`useRoleViewMode` SHALL wrap `useViewMode` (key `admin-roles-view-mode`, modes `['table','card']`, default `table`), expose `isRoleViewMode`, and return `{ viewMode, setMode, toggleViewMode, displayMode }` bridging `card`→`cards`. `AdminRolesView` SHALL render `ViewToggle` in `#actions`, pass `:display-mode`, and persist across reloads.

#### Scenario: toggle switches and persists
- GIVEN table mode by default
- WHEN the user toggles to card
- THEN `display-mode="cards"` renders the `#cards` slot
- AND reload keeps card view

#### Scenario: invalid stored value
- GIVEN an invalid `admin-roles-view-mode` value
- WHEN the view loads
- THEN mode is `table`

### REQ-3 Card rendering (EmployeeCard pattern, click-to-edit)

`RoleCard` SHALL render an `article` with `EntityAvatar` seeded by the role id, `name`/`description`, chip row (`userCount` "N usuarios", `permissionCount` "N permisos", `isSystem` "Sistema" info chip), dashed divider, and 2-col body (`Descripción`, `Creación`), emitting `click` only (no kebab/checkbox). Card click SHALL open `RoleUpsertSlideover` in edit mode — no detail route, no `router.push`. `RoleCardGrid` SHALL use the 1/2/3/5/7 ladder with skeleton/empty states (`i-lucide-shield`).

#### Scenario: card click opens edit slideover
- GIVEN a card with update permission
- WHEN the user clicks it
- THEN `card-click` fires and `RoleUpsertSlideover` opens in edit mode
- AND no `router.push` occurs

#### Scenario: ladder and no kebab
- GIVEN card mode with rows
- THEN cards fill the 1/2/3/5/7 ladder
- AND no kebab or checkbox renders on the card

#### Scenario: loading / empty
- GIVEN card mode
- THEN skeletons show while loading, the `i-lucide-shield` empty state when no rows

### REQ-4 Permission-gated kebab and system-role gate

The kebab SHALL be hidden without `canManageRoleActions` — no empty kebab SHALL render. Rows with `isSystem: true` MUST NOT show "Eliminar" (per-row gate); "Editar" and "Permisos" SHALL remain available per current behavior.

#### Scenario: read-only user
- GIVEN no role actions permission
- WHEN a row renders
- THEN no kebab appears

#### Scenario: editor
- GIVEN `update` permission
- THEN kebab shows "Editar" and "Permisos"; "Eliminar" only with `delete`

#### Scenario: system role hides delete
- GIVEN a row with `isSystem: true` and `delete` permission
- WHEN the kebab opens
- THEN "Eliminar" does not appear
- AND "Editar" and "Permisos" remain

### REQ-5 Sortable count columns

`permissionCount` and `userCount` SHALL be sortable via `SortableHeader` over the full catalog; `name`/`createdAt` stay sortable; `description`/`actions` stay non-sortable.

#### Scenario: counts sort over the full catalog
- GIVEN roles loaded from the full `/admin/roles` array
- WHEN the user clicks `userCount` or `permissionCount`
- THEN rows re-sort by that count (full-catalog semantics)
- AND `description` and `actions` offer no sort header

### REQ-6 Column visibility selector

`AdminRolesView` SHALL set `enable-column-visibility` on `AppDataTable`, enabling the toolbar's visibility dropdown. All data columns — `name`, `description`, `userCount`, `permissionCount`, `createdAt` (and `isSystem` if it becomes a column) — SHALL be hideable; `actions` SHALL stay non-hideable. Persistence SHALL follow TanStack's built-in state.

#### Scenario: dropdown lists all data columns
- GIVEN the toolbar renders
- WHEN the user opens the visibility dropdown
- THEN every data column toggles independently
- AND `actions` is not hideable

### REQ-7 Header and preserved table invariants

The standardized view SHALL render `AdminPageHeader` ("Gestión de roles", tenant signposting) instead of the inline `<h2>`, preserving `actions` pinned right, `authStore.currentTenantId` scoping, and full-catalog local filter/paginate. `rolesApi.getPaginated` SHALL remain untouched — `useAdminRolesQuery` couples to it. No type, route, or backend change.

#### Scenario: invariants hold
- GIVEN the standardized list renders
- THEN `actions` stays pinned right and non-hideable
- AND tenant scoping, full-catalog semantics, and the `rolesApi.getPaginated` contract behave as before

### REQ-8 Test-locked standardized behaviors

The view and column tests SHALL lock: error block precedence and retry; `ViewToggle` persistence under `admin-roles-view-mode`; card render with click-to-edit (no `router.push`); kebab gating (read-only hides, editor shows, `isSystem` hides "Eliminar"); sortable headers; visibility dropdown; `AdminPageHeader`.

#### Scenario: view test locks behavior
- GIVEN `AdminRolesView.test.ts` runs
- THEN it pins error block, toggle persistence, card click-to-edit, kebab gating, visibility dropdown, and header
- AND no `router.push` on card click

#### Scenario: columns test locks flags
- GIVEN `useRoleColumns.test.ts` runs
- THEN it pins column order, sortability/hideability flags, and headers (`Nombre`, `Descripción`, `Permisos`, `Usuarios`, `Creación`)
