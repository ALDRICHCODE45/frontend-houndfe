# Delta for Authorization — `DeliveryRoute` Subject Registration

Extends `openspec/specs/authorization/spec.md` with the registration of the `DeliveryRoute` CASL subject so the existing generic permission-code parsing path grants/revokes manager and driver permissions uniformly. Anchored on `openspec/changes/delivery-routes/design.md` §9 (permission matrix + CASL registration) and §9.1 (the three registration touch points: `AppSubject` union, `APP_SUBJECTS` runtime array, and the role-permissions UI copy in `PERMISSION_COPY` + `SUBJECT_LABELS`).

No existing `REQ-AUTH-*` is modified. The new subject follows the same generic contract as `PaymentDetail` — exactly the four CRUD actions (`create`, `read`, `update`, `delete`), no `manage`, no `batch_delete` — so future regressions where a subject is missing from `APP_SUBJECTS` are caught by the existing `parsePermissionCode` invariant `REQ-AUTH-004`.

## ADDED Requirements

### REQ-AUTH-005: `AppSubject` union includes `DeliveryRoute`

`'DeliveryRoute'` SHALL be a member of the `AppSubject` union in `auth.types.ts`, alongside the existing subjects (including `'PaymentDetail'`), so that typed permission checks (`userCan`, `PermissionTuple`, route `meta.permission`) accept it at compile time.

#### Scenario: compile-time membership

- GIVEN the `AppSubject` type
- WHEN code assigns `'DeliveryRoute'` to an `AppSubject`-typed value
- THEN type-checking passes (missing membership would fail `vue-tsc --build`)

### REQ-AUTH-006: `APP_SUBJECTS` registry includes `DeliveryRoute`

`'DeliveryRoute'` SHALL be present in the `APP_SUBJECTS` runtime array in `ability.ts`. As a result, `parsePermissionCode` SHALL accept `create:DeliveryRoute`, `read:DeliveryRoute`, `update:DeliveryRoute`, and `delete:DeliveryRoute`, and `updateAbilityFromPermissionCodes` SHALL grant the corresponding CASL actions. A `DeliveryRoute` permission code MUST NOT be silently dropped (the regression that occurs when a subject is missing from `APP_SUBJECTS`).

#### Scenario: permission code grants the action

- GIVEN `updateAbilityFromPermissionCodes(['read:DeliveryRoute'])`
- WHEN the ability is queried
- THEN `ability.can('read', 'DeliveryRoute')` is true
- AND `ability.can('create', 'DeliveryRoute')` is false

#### Scenario: no silent drop

- GIVEN a fresh ability (no prior grants)
- WHEN `updateAbilityFromPermissionCodes(['read:DeliveryRoute'])` runs
- THEN the grant is present (guards against `parsePermissionCode` returning null for a missing registry entry)

#### Scenario: four CRUD actions grant in lock-step

- GIVEN `updateAbilityFromPermissionCodes(['create:DeliveryRoute','read:DeliveryRoute','update:DeliveryRoute','delete:DeliveryRoute'])`
- WHEN the ability is queried for each action
- THEN all four actions on `DeliveryRoute` are granted

### REQ-AUTH-007: Exactly four actions exposed in the role-permissions UI

The role-permissions UI SHALL expose `DeliveryRoute` under the label "Rutas de entrega" with exactly the four actions `create`, `read`, `update`, `delete` — no `manage`, no `batch_delete`. `DeliveryRoute` MUST NOT be listed in `HIDDEN_SUBJECTS`.

#### Scenario: permission section shows the four CRUD actions

- GIVEN the role-permissions page for a tenant
- WHEN the subject sections render
- THEN a "Rutas de entrega" section is present
- AND it contains exactly the `create`, `read`, `update`, and `delete` toggles
- AND it contains no `manage` or `batch_delete` toggle

#### Scenario: DeliveryRoute label copy

- GIVEN the role-permissions page
- WHEN the "Rutas de entrega" section renders
- THEN the subject label is "Rutas de entrega"
- AND the four action descriptions match the proposal copy:
  - `create` → "Crear rutas de entrega" / "Agrupar ventas pendientes o enviadas en una ruta y asignar un repartidor."
  - `read` → "Ver rutas de entrega" / "Listar y consultar rutas de entrega (propias para repartidores)."
  - `update` → "Editar rutas de entrega" / "Editar rutas en borrador, iniciarlas, cancelarlas y registrar entregas."
  - `delete` → "Eliminar rutas de entrega" / "Eliminar rutas en borrador sin paradas."

### REQ-AUTH-008: `DeliveryRoute` is registered consistently across all three touch points

Registration of `DeliveryRoute` SHALL occur in exactly the three touch points and SHALL be in lock-step across them:

1. `src/features/auth/interfaces/auth.types.ts` — `AppSubject` union includes `'DeliveryRoute'`.
2. `src/features/auth/authorization/ability.ts` — `APP_SUBJECTS` runtime array includes `'DeliveryRoute'`.
3. `src/features/admin/roles/i18n/permissions.ts` — `SUBJECT_LABELS['DeliveryRoute'] = 'Rutas de entrega'` and the `PERMISSION_COPY['DeliveryRoute']` block has exactly the four CRUD actions.

Skipping any of the three touch points SHALL cause a silent drop or a missing UI section; the regression test SHALL verify all three at once.

#### Scenario: all three touch points present

- GIVEN the change is complete
- WHEN the verify phase audits the three files
- THEN `'DeliveryRoute'` is present in `AppSubject` (union position before `| 'all'`)
- AND `'DeliveryRoute'` is present in `APP_SUBJECTS` (array position before `'all'`)
- AND `'DeliveryRoute'` is present in `SUBJECT_LABELS` AND `PERMISSION_COPY`
- AND no touch point is missing

#### Scenario: hidden-subjects regression check

- GIVEN `HIDDEN_SUBJECTS` in the role-permissions UI
- WHEN the array is inspected
- THEN `'DeliveryRoute'` is NOT listed
- AND the section is visible to role admins

### REQ-AUTH-009: Menu entry and routes gated by `read:DeliveryRoute`

The sidebar entry `pos-delivery-routes` (label "Rutas de entrega", icon `i-lucide-truck`) and both lazy routes (`/pos/rutas-de-entrega` list + `/pos/rutas-de-entrega/:id` detail) SHALL carry `meta.permission: ['read', 'DeliveryRoute']`. Without `read:DeliveryRoute`, the sidebar entry SHALL be hidden and the route guard SHALL redirect to `/403`.

#### Scenario: sidebar entry hidden without read permission

- GIVEN a user without `read:DeliveryRoute`
- WHEN the navigation registry renders the POS group
- THEN no `pos-delivery-routes` entry is rendered

#### Scenario: route guard redirects without read permission

- GIVEN a user without `read:DeliveryRoute` who navigates to `/pos/rutas-de-entrega`
- WHEN the global `beforeEach` guard runs
- THEN the guard redirects to `/403`

#### Scenario: manager and driver both pass the read gate

- GIVEN a user with `read+create:DeliveryRoute` (manager) OR `read+update:DeliveryRoute` (driver)
- WHEN the guard runs
- THEN access is granted (no redirect)
- AND the view discriminates manager vs driver internally via `useDeliveryRouteRole`
