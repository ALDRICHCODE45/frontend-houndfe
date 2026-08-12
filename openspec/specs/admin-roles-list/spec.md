# Admin Roles List Specification

Domain: `admin-roles-list` · POS admin roles list view behavior, including surfaced backend errors, working column-visibility selector, sortable count columns (`permissionCount` / `userCount`), per-user table/card preference persisted in `localStorage` under `admin-roles-view-mode`, EmployeeCard-pattern card rendering with click-to-edit, `isSystem` chip plus per-row `Eliminar` gate, `AdminPageHeader` shell, and CASL-gated kebab actions. Auth, tenant scoping, the `AdminPageHeader` shell, and backend changes are not duplicated here. Role upsert and permissions slideovers are governed by other capabilities.

## Purpose

Bring `AdminRolesView.vue` to Fase 2 parity with `AdminUsersView.vue` and `CustomersView.vue` (the gold standard): surface backend errors, add the card view roles now expect, fix the dead column-visibility binding, expose the description column, make count columns sortable over the full catalog, and gate the `Eliminar` action for system roles so it disappears from the kebab instead of relying on a `window.alert` runtime block. The original view pre-dates the spec system; this capability is introduced in `standardize-admin-roles-table` (Fase 2, change #2). Roles are deliberately different from users: `rolesApi.getPaginated` already fetches the full `/admin/roles` catalog and applies local filter/sort/paginate, so `permissionCount` / `userCount` can be made sortable without a backend change — `rolesApi.getPaginated` is **untouchable** in this capability because `useAdminRolesQuery` (the users-side role picker) couples to its full-catalog contract.

## Requirements

### REQ-1: Backend error state propagation

`AdminRolesView` SHALL destructure `isError`/`error` from `useServerTable`, compute `rolesErrorMessage`, and pass `:error` + `:error-message` to `AppDataTable`. Failed requests MUST render the error block with retry, never "No se encontraron roles". The empty placeholder SHALL render only on empty success. Message SHALL prefer `response.data.message` (string or first element when array), then `error.message`, then "No se pudieron cargar los roles. Reintenta.".

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

`useRoleViewMode` SHALL wrap `useViewMode` (key `admin-roles-view-mode`, modes `['table','card']`, default `table`), expose `isRoleViewMode`, and return `{ viewMode, setMode, toggleViewMode, displayMode }` bridging `card`→`cards`. `AdminRolesView` SHALL render `ViewToggle` in `#actions`, pass `:display-mode`, and persist the choice across reloads.

#### Scenario: toggle switches and persists

- GIVEN table mode by default
- WHEN the user toggles to card
- THEN `display-mode="cards"` renders the `#cards` slot
- AND reload keeps card view

#### Scenario: invalid stored value

- GIVEN an invalid `admin-roles-view-mode` value
- WHEN the view loads
- THEN mode is `table`

### REQ-3: Card rendering (EmployeeCard pattern, click-to-edit)

`RoleCard` SHALL render an `article` with `EntityAvatar` seeded by the role id, `name`/`description` header, chip row (`isSystem` info-tone "Sistema" chip first, then `permissionCount` "N permisos" info badge, then `userCount` "N usuarios" type-tone outline badge), dashed divider, and 2-col body (`Descripción`, `Creación`). It SHALL emit `click` only — no kebab, no checkbox. Card click SHALL open `RoleUpsertSlideover` in edit mode via `openEdit`; no detail route, no `router.push`. `RoleCardGrid` SHALL use the Employee ladder (1/2/3/5/7) with 8 pulse skeletons and an `i-lucide-shield` empty state.

#### Scenario: card click opens edit slideover

- GIVEN a card with update permission
- WHEN the user clicks the card body
- THEN `card-click` fires and `RoleUpsertSlideover` opens in edit mode
- AND no `router.push` occurs

#### Scenario: ladder and no kebab or checkbox

- GIVEN card mode with rows
- THEN cards fill the 1/2/3/5/7 ladder
- AND no kebab or checkbox renders on the card

#### Scenario: loading and empty

- GIVEN card mode
- THEN skeletons show while loading
- AND the `i-lucide-shield` empty state shows when no rows

### REQ-4: Permission-gated kebab and system-role gate

The kebab SHALL be hidden when the user lacks `canManageRoleActions` (`canUpdateRole || canDeleteRole`) — no empty kebab SHALL render. Rows with `isSystem: true` MUST NOT show "Eliminar"; the per-row `getRowItems` destructive-actions gate (`canDeleteRole && !role.isSystem`) replaces the previous `window.alert` runtime block. "Editar" and "Permisos" SHALL remain available per current behavior and CASL gating.

#### Scenario: read-only user

- GIVEN no role actions permission
- WHEN a row renders
- THEN no kebab appears

#### Scenario: editor

- GIVEN `update` permission
- THEN the kebab shows "Editar" and "Permisos"
- AND "Eliminar" appears only with `delete`

#### Scenario: system role hides Eliminar

- GIVEN a row with `isSystem: true` and `delete` permission
- WHEN the kebab opens
- THEN "Eliminar" does not appear
- AND "Editar" and "Permisos" remain

### REQ-5: Sortable count columns

`permissionCount` and `userCount` SHALL be sortable via `SortableHeader` over the full `/admin/roles` catalog (local number sort in `applyLocalRoleFilters`). `name` and `createdAt` stay sortable; `description` and `actions` SHALL stay non-sortable.

#### Scenario: counts sort over the full catalog

- GIVEN roles loaded from the full `/admin/roles` array
- WHEN the user clicks `userCount` or `permissionCount`
- THEN rows re-sort by that count (full-catalog semantics)
- AND `description` and `actions` offer no sort header

### REQ-6: Column visibility selector

`AdminRolesView` SHALL set `enable-column-visibility` on `AppDataTable`, enabling the toolbar's visibility dropdown. All data columns — `name`, `description`, `permissionCount`, `userCount`, `createdAt` — SHALL be hideable; `actions` SHALL stay non-hideable. `isSystem` is a card-only chip, not a table column. Persistence SHALL follow TanStack's built-in state.

#### Scenario: dropdown lists every data column

- GIVEN the toolbar renders
- WHEN the user opens the visibility dropdown
- THEN `name`, `description`, `permissionCount`, `userCount`, `createdAt` each toggle independently
- AND `actions` is not hideable

#### Scenario: hidden column stays hidden

- GIVEN the user hides `description`
- WHEN the table re-renders
- THEN `description` stays hidden

### REQ-7: Header and preserved table invariants

The standardized view SHALL render `AdminPageHeader` ("Gestión de roles" plus tenant signposting `"Administrá los roles y permisos de ${currentTenant.name}"`) instead of the inline `<h2>`, preserving `defaultPinning: { right: ['actions'] }`, `authStore.currentTenantId` scoping in the query key, full-catalog local filter/sort/paginate, `usersApi.clearRolesCache()` invalidation on every role mutation, and the CASL-gated kebab. `rolesApi.getPaginated` SHALL remain untouched — `useAdminRolesQuery` couples to it. No `RoleTableRow` type, route, or backend change.

#### Scenario: invariants hold

- GIVEN the standardized list renders
- THEN `actions` stays pinned right and non-hideable
- AND tenant scoping, full-catalog semantics, and the `rolesApi.getPaginated` contract behave as before
- AND the `roles.api.ts` file is unchanged in the change diff

### REQ-8: Test-locked standardized behaviors

The view and column tests SHALL lock: error block precedence and retry; `ViewToggle` persistence under `admin-roles-view-mode`; card render with click-to-edit (no `router.push`); kebab gating (read-only hides, editor shows, `isSystem` hides "Eliminar"); sortable count headers; visibility dropdown; `AdminPageHeader`.

#### Scenario: view test locks behavior

- GIVEN `AdminRolesView.test.ts` runs
- THEN it pins error block, toggle persistence, card click-to-edit, kebab gating, visibility dropdown, and header
- AND no `router.push` occurs on card click

#### Scenario: columns test locks flags

- GIVEN `useRoleColumns.test.ts` runs
- THEN it pins column order, sortability/hideability flags, and headers (`Nombre`, `Descripción`, `Permisos`, `Usuarios`, `Creación`)