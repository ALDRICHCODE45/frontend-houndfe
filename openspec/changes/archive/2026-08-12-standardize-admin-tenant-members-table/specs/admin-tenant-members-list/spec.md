# Admin Tenant Members List Specification

Domain: `admin-tenant-members-list` · POS admin tenant members list view behavior, including surfaced backend errors, working column-visibility selector, per-user table/card preference persisted in `localStorage` under `admin-tenant-members-view-mode`, TenantCard-pattern card rendering with click-to-edit guarded on `canUpdateMembership`, null-safe `StatusDotBadge` chip + dashed-divider card body, explicit column flags on all 4 columns, fixed `defaultSorting` targeting `userName`, `AdminPageHeader` shell, and CASL `userCan`-gated kebab actions. Auth, the `AdminPageHeader` shell, the slideover contract, and backend changes are not duplicated here. Membership upsert, the eligible-users picker, and `memberships.api.ts` local-filter semantics are governed elsewhere (the latter is untouchable here).

## Purpose

Bring `AdminTenantMembersView.vue` to Fase 2 parity with the standardized `AdminTenantsView.vue`: surface backend errors, add the card view, fix the dead column-visibility binding, fix the latent `defaultSorting` bug where `userEmail` referenced a column that does not exist, and set explicit `enableSorting`/`enableHiding` on all 4 columns. `userIsActive` is optional on `MembershipTableRow`, so the card chip must be null-safe. The view pre-dates the spec system; this whole capability is introduced in `standardize-admin-tenant-members-table` (no `MODIFIED` block). `membershipsApi.getPaginated` fetches the full catalog and applies local filter/sort/paginate — semantically correct for a non-paginated backend and **untouchable** here.

## Requirements

### REQ-1: Backend error state propagation

`AdminTenantMembersView` SHALL destructure `isError`/`error` from `useServerTable`, compute `membershipsErrorMessage`, and pass `:error` + `:error-message` to `AppDataTable`. Failed requests MUST render the error block with retry, never "No hay miembros en este tenant". The empty placeholder SHALL render only on empty success. Message SHALL prefer `response.data.message` (string or first element when array), then `error.message`, then "No se pudieron cargar los miembros. Reintenta.".

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

- GIVEN `response.data.message` exists (string or array)
- THEN it wins over `error.message` and the fallback

### REQ-2: View mode preference

`useMembershipViewMode` SHALL wrap `useViewMode` (key `admin-tenant-members-view-mode`, modes `['table','card']`, default `table`), expose `isMembershipViewMode`, and return `{ viewMode, setMode, toggleViewMode, displayMode }` bridging `card`→`cards`. `AdminTenantMembersView` SHALL render `ViewToggle` in `#actions`, pass `:display-mode`, and persist the choice across reloads. The view-mode key is global (no tenantId — preference is cross-tenant); the table-state `persistKey: 'admin-tenant-members-{tenantId}'` stays per-tenant — localStorage churn across tenants is intended.

#### Scenario: toggle switches and persists

- GIVEN table mode by default
- WHEN the user toggles to card
- THEN `display-mode="cards"` renders the `#cards` slot
- AND reload keeps card view

#### Scenario: invalid stored value

- GIVEN an invalid `admin-tenant-members-view-mode` value
- WHEN the view loads
- THEN mode is `table`

### REQ-3: Card rendering (TenantCard pattern, click-to-edit guarded)

`MemberCard` SHALL render an `article` with `EntityAvatar(name=userName, seed=userId||id, lg)`, `userName`/`userEmail` header, chip row (`AppBadge(roleName, info)` + `StatusDotBadge(userIsActive → activityToBadgeTone, compact, label Activo/Inactivo)` rendered only when `userIsActive !== undefined` — null-safe), dashed divider, and 2-col body (`Rol` info chip + `Fecha de ingreso` es-AR). It SHALL emit `click` only — no kebab, no checkbox. Card click SHALL open `MembershipUpsertSlideover` in edit mode via the same `openEdit` the kebab triggers, guarded: no-op when `canUpdateMembership` is false, no detail route, no `router.push`. `MemberCardGrid` SHALL use the 1/2/3/5/7 ladder with 8 pulse skeletons and an `i-lucide-users` empty state.

#### Scenario: card click opens edit slideover

- GIVEN a member card in card mode and `canUpdateMembership` is true
- WHEN the user clicks it
- THEN `card-click` fires and the slideover opens in edit mode
- AND no `router.push` occurs

#### Scenario: card click without update permission

- GIVEN `canUpdateMembership` is false
- WHEN the user clicks a card
- THEN the click is a no-op — no slideover, no `router.push`

#### Scenario: ladder and no kebab

- GIVEN card mode with rows
- THEN cards fill the 1/2/3/5/7 ladder
- AND no kebab or checkbox renders on the card

#### Scenario: null-safe status chip

- GIVEN a membership row omits `userIsActive`
- WHEN `MemberCard` renders
- THEN no `StatusDotBadge` renders and no error occurs

#### Scenario: loading and empty

- GIVEN card mode
- THEN skeletons show while loading
- AND the `i-lucide-users` empty state shows when no rows

### REQ-4: Permission-gated kebab and add flow

The kebab SHALL render only for actions CASL `userCan(action, 'TenantMembership')` permits (read/create/update/delete gates preserved). No empty kebab SHALL render. "Agregar miembro" SHALL keep flowing through `AppDataTable`'s add prop to the eligible-users picker slideover.

#### Scenario: no permission

- GIVEN a user without update/delete permission on `TenantMembership`
- WHEN a row renders
- THEN no kebab appears

#### Scenario: permission granted

- GIVEN `userCan` grants the action
- WHEN the kebab opens
- THEN "Editar rol" and "Eliminar miembro" show as today

#### Scenario: add member flow

- GIVEN the toolbar renders
- WHEN the user clicks "Agregar miembro"
- THEN the eligible-users picker slideover opens

### REQ-5: Explicit column flags, sortability, and defaultSorting fix

`useMembershipColumns` SHALL set explicit `enableSorting`/`enableHiding` on all 4 columns in order `[userName, roleName, createdAt, actions]`. `userName`/`roleName`/`createdAt` SHALL stay sortable via `SortableHeader` with headers `Usuario`, `Rol`, `Fecha de ingreso`; `actions` SHALL be non-sortable, non-hideable, and right-aligned. `defaultSorting` SHALL be `[{ id: 'userName', desc: false }]`. (Behavior change: previously `defaultSorting: [{ id: 'userEmail' }]` referenced a non-existent column — no active-sort indicator and by-table-default order; now the initial sort is user name ascending.)

#### Scenario: flags locked

- GIVEN the columns render
- THEN `userName`/`roleName`/`createdAt` offer a sort header
- AND `actions` is non-sortable, non-hideable, and right-aligned

#### Scenario: defaultSorting targets userName

- GIVEN the table mounts
- THEN the initial sort is `userName` ascending
- AND no `userEmail` sort id is referenced anywhere

### REQ-6: Column visibility

`AdminTenantMembersView` SHALL set `enable-column-visibility` on `AppDataTable`. The 3 data columns — `userName`, `roleName`, `createdAt` — SHALL be hideable; `actions` SHALL stay non-hideable.

#### Scenario: dropdown lists every data column

- GIVEN the toolbar renders
- WHEN the user opens the visibility dropdown
- THEN `userName`/`roleName`/`createdAt` toggle independently
- AND `actions` is not hideable

#### Scenario: all data columns hidden

- GIVEN the user hides all three data columns
- THEN only `actions` remains visible

### REQ-7: Header and preserved invariants

The standardized view SHALL preserve `AdminPageHeader` (`title="Miembros del tenant"`, description via `useTenantSummary`) with `tenantId` sourced from `route.params.tenantId` (NOT `authStore`). `defaultPinning: { right: ['actions'] }` and `persistKey: 'admin-tenant-members-{tenantId}'` (per-tenant, intended) SHALL be preserved. `memberships.api.ts` full-catalog local filter/sort/paginate semantics SHALL remain untouched — correct, not a defect. No type, route, or backend change. The `#filters` slot is NOT applicable: members have no natural filter (no `includeInactive`-style query param exists) — out of scope.

#### Scenario: invariants hold

- GIVEN the standardized list renders
- THEN `actions` stays pinned right and non-hideable
- AND `tenantId` comes from `route.params`, not `authStore`
- AND `persistKey` includes the tenant id

#### Scenario: api semantics untouched

- GIVEN the change ships
- THEN `memberships.api.ts` is unchanged in the change diff
- AND no type, route, or backend change is introduced
