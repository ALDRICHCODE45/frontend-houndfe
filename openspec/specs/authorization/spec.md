# Authorization Specification

Domain: `authorization` · CASL-based permission model that gates every admin surface: the `AppSubject` union and `APP_ACTIONS` in `src/features/auth/interfaces/auth.types.ts`, the `APP_SUBJECTS` runtime registry and permission-code parser in `src/features/auth/authorization/ability.ts`, and the role-permissions UI copy in `src/features/admin/roles/i18n/permissions.ts`. This is the first canonical spec for the domain; it captures the existing generic registration/parsing mechanism plus the `PaymentDetail` subject registration introduced by this change (registration only — no new permission semantics).

## Purpose

Keep the typed subject union, the runtime subject registry, and the role-permissions UI in sync so that any registered subject is granted/revoked uniformly through one generic code path: permission codes arrive as `"<action>:<subject>"` strings, parse through `parsePermissionCode`, and materialize as CASL rules. Registering a subject is the single act that unlocks menu gating, route guarding, and button gating for that subject without per-subject logic.

## Requirements

### REQ-AUTH-001: AppSubject union includes PaymentDetail

`'PaymentDetail'` SHALL be a member of the `AppSubject` union in `auth.types.ts`, alongside the existing subjects, so that typed permission checks (`userCan`, `PermissionTuple`, route `meta.permission`) accept it at compile time.

#### Scenario: compile-time membership

- GIVEN the `AppSubject` type
- WHEN code assigns `'PaymentDetail'` to an `AppSubject`-typed value
- THEN type-checking passes (missing membership would fail `vue-tsc --build`)

### REQ-AUTH-002: APP_SUBJECTS registry includes PaymentDetail

`'PaymentDetail'` SHALL be present in the `APP_SUBJECTS` runtime array in `ability.ts`. As a result, `parsePermissionCode` SHALL accept `create:PaymentDetail`, `read:PaymentDetail`, `update:PaymentDetail`, and `delete:PaymentDetail`, and `updateAbilityFromPermissionCodes` SHALL grant the corresponding CASL actions. A `PaymentDetail` permission code MUST NOT be silently dropped (the regression that occurs when a subject is missing from `APP_SUBJECTS`).

#### Scenario: permission code grants the action

- GIVEN `updateAbilityFromPermissionCodes(['read:PaymentDetail'])`
- WHEN the ability is queried
- THEN `ability.can('read', 'PaymentDetail')` is true
- AND `ability.can('create', 'PaymentDetail')` is false

#### Scenario: no silent drop

- GIVEN a fresh ability (no prior grants)
- WHEN `updateAbilityFromPermissionCodes(['read:PaymentDetail'])` runs
- THEN the grant is present (guards against `parsePermissionCode` returning null for a missing registry entry)

### REQ-AUTH-003: Exactly four actions exposed in the role-permissions UI

The role-permissions UI SHALL expose `PaymentDetail` under the label "Datos bancarios" with exactly the four actions `create`, `read`, `update`, `delete` — no `manage`, no `batch_delete`. `PaymentDetail` MUST NOT be listed in `HIDDEN_SUBJECTS`.

#### Scenario: permission section shows the four CRUD actions

- GIVEN the role-permissions page for a tenant
- WHEN the subject sections render
- THEN a "Datos bancarios" section is present
- AND it contains exactly the `create`, `read`, `update`, and `delete` toggles
- AND it contains no `manage` or `batch_delete` toggle

### REQ-AUTH-004: Generic permission-code parsing invariants

`parsePermissionCode` SHALL accept only well-formed `"<action>:<subject>"` codes whose action is in `APP_ACTIONS` and whose subject is in `APP_SUBJECTS`. Malformed codes (extra `:` segments, missing parts, unknown action, or unknown subject) SHALL be dropped without affecting other grants. Removing a code from the list SHALL revoke the corresponding grant on the next `updateAbilityFromPermissionCodes` call.

#### Scenario: well-formed code grants

- GIVEN the code `'read:PaymentDetail'`
- WHEN `updateAbilityFromPermissionCodes` runs
- THEN the `read` action on `PaymentDetail` is granted

#### Scenario: malformed or unknown codes are dropped

- GIVEN codes `'read:PaymentDetail:extra'`, `'fly:PaymentDetail'`, and `'read:UnknownSubject'`
- WHEN `updateAbilityFromPermissionCodes` runs
- THEN none of them grant anything
- AND any previously granted unrelated permission remains granted

#### Scenario: removal revokes

- GIVEN `read:PaymentDetail` was granted in a prior update
- WHEN `updateAbilityFromPermissionCodes` runs again without it
- THEN `ability.can('read', 'PaymentDetail')` is false
