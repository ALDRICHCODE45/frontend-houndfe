# Notification Configuration Specification

Domain: `notification-config` · Capability: tenant settings screen at `/sistema/configuracion/notificaciones`.

## Purpose

Let tenant admins configure WHO receives the email when a product breaches its `minQuantity` (`LOW_STOCK` action). Master kill-switch + per-action toggles + recipient multi-select + data-driven action registry by module.

## Backend contract (consume only)

| Verb | Path | Perm | Body / Response |
|---|---|---|---|
| GET | `/notification-config` | `read:NotificationConfig` | `{ enabled: boolean, recipients: string[], enabledActions: ("LOW_STOCK")[] }`. Default when never configured: `{ enabled:false, recipients:[], enabledActions:[] }` |
| PUT | `/notification-config` | `update:NotificationConfig` | `{ enabled, recipientUserIds, enabledActions }` → returns GET view shape (FULL overwrite, `forbidNonWhitelisted`). Field asymmetry: GET `recipients` ↔ PUT `recipientUserIds`. Errors: 400 `UNKNOWN_ACTION_KEY`, 400 `INVALID_RECIPIENT` (offending ids in `message`), 400 class-validator, 401, 403 |
| GET | `/users/assignable` | (tenant scope from JWT) | `Array<{ id, name }>` |

## Requirements

### REQ-1 Permission Subject Registration
The system MUST register `'NotificationConfig'` in `AppSubject` (`auth.types.ts`) and `APP_SUBJECTS` (`ability.ts`) so CASL `userCan(action,'NotificationConfig')` evaluates.

#### Scenario: registered subject compiles and authenticates
- GIVEN `NotificationConfig` is added to both registries
- WHEN `userCan('read','NotificationConfig')` is called with granted permission
- THEN it returns true
- AND `parsePermissionCode('read:NotificationConfig')` returns the tuple

### REQ-2 Screen Visibility
The system SHALL hide the sidebar entry and route guard when `read:NotificationConfig` is missing (redirect to `/403`).

#### Scenario: read perm absent
- GIVEN user lacks `read:NotificationConfig`
- WHEN they navigate to `/sistema/configuracion/notificaciones`
- THEN router redirects to `/403`
- AND the sidebar entry is not rendered

### REQ-3 Hydration on Mount
`useNotificationConfigQuery` MUST call GET on mount; on 404/absent row the form MUST render defaults (`enabled:false, recipientUserIds:[], enabledActions:[]`) disabled — NOT as an error.

#### Scenario: never configured
- GIVEN GET returns `{ enabled:false, recipients:[], enabledActions:[] }`
- WHEN the view mounts
- THEN controls render in disabled OFF/empty state
- AND no error toast fires

### REQ-4 Master + Action Toggle Independence
The master toggle MUST bind to `enabled`. Each action toggle MUST toggle membership in `enabledActions`. When master is OFF, all action toggles MUST render disabled.

#### Scenario: master OFF greys action toggles
- GIVEN `enabled = false`
- WHEN the view renders the "Bajo inventario" action toggle
- THEN the action toggle renders disabled (greyed)
- AND toggling it does not mutate `enabledActions`

#### Scenario: master ON + action toggle
- GIVEN `enabled = true`, `enabledActions = []`
- WHEN user flips "Bajo inventario" to ON
- THEN `enabledActions` becomes `["LOW_STOCK"]`
- AND the form is dirty

### REQ-5 Recipient Multi-Select
The recipient `USelectMenu :multiple` MUST list items from `GET /users/assignable` (label=name, value=id, multi).

#### Scenario: assignable ids resolve to names
- GIVEN assignable users include id `u1` (name "Ana")
- AND GET `recipients` contains `"u1"`
- WHEN the form hydrates
- THEN the chip for `u1` displays "Ana"

#### Scenario: stale id renders unavailable chip
- GIVEN GET `recipients` contains `"ghost"` not in assignable list
- WHEN the form hydrates
- THEN the chip displays "Usuario no disponible"
- AND the id is NOT auto-removed
- AND it remains in the PUT payload unless the user removes it

### REQ-6 Save Guard
Save MUST be disabled when (a) not dirty, (b) PUT in flight, OR (c) any action enabled AND zero recipients. (c) MUST show inline Spanish: "Selecciona al menos un usuario a notificar".

#### Scenario: zero-recipient guard
- GIVEN `enabledActions = ["LOW_STOCK"]`, `recipientUserIds = []`
- WHEN the user views Save
- THEN Save is disabled
- AND the inline message appears in Spanish

#### Scenario: update perm absent
- GIVEN user lacks `update:NotificationConfig`
- WHEN the form renders
- THEN Save is disabled with Spanish notice "No tienes permisos para guardar cambios"

### REQ-7 Save Behaviour
`useUpdateNotificationConfigMutation` MUST send PUT, invalidate `notificationConfigQueryKeys.config(tenantId)`, re-hydrate the form from the response, and show Spanish success toast.

#### Scenario: happy PUT round-trip
- GIVEN dirty valid form, no in-flight
- WHEN Save is clicked
- THEN `toPutBody` returns `{ enabled, recipientUserIds, enabledActions }` only (no extras)
- AND the response shape re-hydrates `fromConfigResponse`
- AND a Spanish success toast appears
- AND the cache key is invalidated

### REQ-8 Error Mapping (Spanish)
`mapNotificationConfigError(code)` MUST return `{ field?, toast? }`. `INVALID_RECIPIENT` → recipient field "Uno de los usuarios seleccionados no pertenece a esta cuenta". `UNKNOWN_ACTION_KEY` → toast. 400/401/403 → mapped Spanish fallback.

#### Scenario: INVALID_RECIPIENT attaches to recipient field
- GIVEN PUT returns 400 `INVALID_RECIPIENT` with offending ids
- WHEN error maps
- THEN the recipient field shows the Spanish message
- AND no toast appears

#### Scenario: UNKNOWN_ACTION_KEY toasts
- GIVEN PUT returns 400 `UNKNOWN_ACTION_KEY`
- WHEN error maps
- THEN a Spanish toast appears
- AND no field-level error renders

### REQ-9 Loading State
While `isLoading` is true, the view MUST render `USkeleton` and no controls SHALL be enabled.

### REQ-10 Data-Driven Action Registry
The action list MUST come from a registry `Array<{ moduleKey, moduleLabel, actions: Array<{ key, label }> }>`. Adding a module/action MUST require registry-only edits — no component restructure.

#### Scenario: registry drives accordion items
- GIVEN the registry `[{ moduleKey:'pos', moduleLabel:'Punto de venta', actions:[{ key:'LOW_STOCK', label:'Bajo inventario' }] }]`
- WHEN the view renders
- THEN the `UAccordion` renders "Punto de venta" with "Bajo inventario"

#### Scenario: extension via registry only
- GIVEN a second entry `{ moduleKey:'hr', moduleLabel:'Recursos humanos', actions:[{ key:'NEW_HIRE', label:'Nuevo empleado' }] }` is added to the registry
- WHEN the view renders
- THEN "Recursos humanos" appears with "Nuevo empleado"
- AND no view/component code changes are required

## Mappers (pure, test-first)

| Function | Input → Output |
|---|---|
| `fromConfigResponse(view)` | `view.recipients` → form `recipientUserIds`; identity for `enabled`/`enabledActions` |
| `toPutBody(form)` | `{ enabled, recipientUserIds, enabledActions }` exactly 3 keys, no extras |
| `mapNotificationConfigError(code)` | code → `{ field?: 'recipients', toast?: string }`, uppercase keys, Spanish fallback |
| `isDirty(state, pristine)` | deep snapshot diff → `boolean` |

## UI Copy (neutral Spanish, examples)

- Master label: "Notificaciones"
- Recipients section: "Usuarios a notificar"
- Actions section: "Acciones a notificar"
- Zero-recipient: "Selecciona al menos un usuario a notificar"
- Update perm missing: "No tienes permisos para guardar cambios"
- INVALID_RECIPIENT field: "Uno de los usuarios seleccionados no pertenece a esta cuenta"
- Stale chip: "Usuario no disponible"
- Success toast: "Configuración de notificaciones guardada"
