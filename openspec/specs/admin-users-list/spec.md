# Admin Users List Specification

Domain: `admin-users-list` · POS admin users list view behavior, including surfaced backend errors, working column-visibility selector, server-side sortable columns, per-user table/card preference persisted in `localStorage` under `admin-users-view-mode`, EmployeeCard-pattern card rendering with click-to-edit, `isActive` status chip, and permission-gated kebab actions. Auth, tenant scoping, the per-page `rolesCache` batch, the `AdminPageHeader` shell, and backend changes are not duplicated here. User detail, upsert slideover, and address modal are governed by other capabilities.

## Purpose

Bring `AdminUsersView.vue` to Fase 1 parity with `CustomersView.vue` (the gold standard): surface backend errors, add the card view users now expect, fix the dead column-visibility binding, expose the email column, and lock the behavior with the same test surface as the rest of Fase 1. The original view pre-dates the spec system; this capability is introduced in `standardize-admin-users-table` (Fase 2, change #1).

## Requirements

### REQ-1: Backend error state propagation

`AdminUsersView` SHALL destructure `isError`/`error` from `useServerTable`, compute `usersErrorMessage`, and pass `:error` + `:error-message` to `AppDataTable`. Failed requests MUST render the error block with retry, never "No se encontraron usuarios". The empty placeholder SHALL render only on empty success. Message SHALL prefer `response.data.message`, then `error.message`, then "No se pudieron cargar los usuarios. Reintenta.".

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

### REQ-2: View mode preference

`useUserViewMode` SHALL wrap `useViewMode` (key `admin-users-view-mode`, modes `['table','card']`, default `table`), expose `isUserViewMode`, and return `{ viewMode, setMode, toggleViewMode, displayMode }` bridging `card`→`cards`. `AdminUsersView` SHALL render `ViewToggle` in `#actions`, pass `:display-mode`, and persist the choice across reloads.

#### Scenario: toggle switches and persists

- GIVEN table mode by default
- WHEN the user toggles to card
- THEN `display-mode="cards"` renders the `#cards` slot
- AND reload keeps card view

#### Scenario: invalid stored value

- GIVEN an invalid `admin-users-view-mode` value
- WHEN the view loads
- THEN mode is `table`

### REQ-3: Card rendering (EmployeeCard pattern, click-to-edit)

`UserCard` SHALL render an `article` with `EntityAvatar` seeded by the user id, chip row, dashed divider, and 2-col body (`roles`, `createdAt`). It SHALL emit `click` only — no kebab or checkbox. Card click SHALL open `UserUpsertSlideover` in edit mode; no detail route, no `router.push`. `UserCardGrid` SHALL use the Employee ladder (1/2/3/5/7) with skeleton/empty states.

#### Scenario: card click opens edit slideover

- GIVEN a card with update permission
- WHEN the user clicks it
- THEN `card-click` fires and `UserUpsertSlideover` opens in edit mode
- AND no `router.push` occurs

#### Scenario: ladder and no kebab

- GIVEN card mode with rows
- THEN cards fill the 1/2/3/5/7 ladder
- AND no kebab or checkbox renders on the card

#### Scenario: loading / empty

- GIVEN card mode
- THEN skeletons show while loading, the empty message when no rows

### REQ-4: Permission-gated kebab

The kebab SHALL be hidden when the user lacks the permissions: `AdminUsersView` gates it via `canManageUserActions` (`canUpdateUser || canDeleteUser`); no empty kebab SHALL render. Destructive and edit actions SHALL live only on the table row kebab (REQ-3). The Add button is gated separately by `canUpdateUser` and is not part of the kebab.

#### Scenario: read-only user

- GIVEN no `update`/`delete` on `User`
- WHEN a row renders
- THEN no kebab appears

#### Scenario: editor

- GIVEN `update` permission
- THEN kebab shows "Editar"; "Eliminar" only with `delete`

### REQ-5: Status chip

`UserCard` SHALL render `isActive` as an `Activo` / `Inactivo` chip in the chip row (display only, no toggle), using `StatusDotBadge` / `AppBadge`.

#### Scenario: active user

- GIVEN a user with `isActive: true`
- WHEN the card renders
- THEN the chip row shows "Activo"
- AND no toggle control renders

#### Scenario: inactive user

- GIVEN a user with `isActive: false`
- WHEN the card renders
- THEN the chip row shows "Inactivo"

### REQ-6: Column visibility selector

`AdminUsersView` SHALL set `enable-column-visibility` on `AppDataTable`, enabling the toolbar's visibility dropdown. All four columns — `name`, `email`, `roles`, `createdAt` — SHALL be hideable; `actions` SHALL stay non-hideable (REQ-7). Persistence SHALL follow TanStack's built-in state.

#### Scenario: dropdown lists all four columns

- GIVEN the toolbar renders
- WHEN the user opens the visibility dropdown
- THEN `name`, `email`, `roles`, `createdAt` each toggle independently
- AND `actions` is not hideable

#### Scenario: hidden column stays hidden

- GIVEN the user hides `roles`
- WHEN the table re-renders
- THEN `roles` stays hidden

### REQ-7: Preserved table invariants

The standardized view SHALL preserve: `actions` pinned right (`defaultPinning.right: ['actions']`), tenant scoping via `authStore.currentTenantId` in the query key, and the per-page `rolesCache` batch solving the roles N+1 (cleared on mutations). The header SHALL stay `AdminPageHeader`; no bulk actions, type, route, or backend change. G5 local filter semantics (name/email/roles over the fetched page) SHALL remain unchanged — documented follow-up to `houndfe-backend`.

#### Scenario: invariants hold

- GIVEN the standardized list renders
- THEN `actions` stays pinned right and non-hideable
- AND tenant scoping and the `rolesCache` batch behave as before
