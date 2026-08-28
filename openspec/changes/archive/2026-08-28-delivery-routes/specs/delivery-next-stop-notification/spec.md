# Delivery Next-Stop Notification Specification

Domain: `delivery-next-stop-notification` · Capability: the tenant opt-in toggle for the "next stop arriving soon" email in the existing Notificaciones admin screen at `/sistema/configuracion/notificaciones`. Adds `DELIVERY_NEXT_STOP` to the data-driven action registry (`src/features/system/notifications/registry/action-registry.ts`) under a new `Entregas` module, registers the action key in `ActionKey`, marks it `requiresRecipients: false` so an empty recipient list is legal when the delivery email is the only enabled action (the backend resolves the recipient to the next customer email), and reuses the existing read → merge → PUT full-overwrite mutation.

## Purpose

Let a tenant admin opt in to the "next stop arriving soon" email from the Notificaciones admin screen without picking recipients — the backend resolves the recipient server-side to the next customer's email. The toggle MUST live in the existing screen, behind the existing data-driven registry, and MUST NOT require recipient selection when `DELIVERY_NEXT_STOP` is the only enabled action. The screen's read-merge-PUT semantics, error routing for `400 UNKNOWN_ACTION_KEY` and `400 INVALID_RECIPIENT`, and master+per-action toggle independence are inherited from `notification-config`.

## Requirements

### REQ-DNS-001: `ActionKey` union includes `DELIVERY_NEXT_STOP`

`ActionKey` (in `src/features/system/notifications/interfaces/notification-config.types.ts`) SHALL include `'DELIVERY_NEXT_STOP'` alongside `'LOW_STOCK'` and `'TIME_OFF_REQUESTED'`. `ActionDescriptor` SHALL accept `requiresRecipients?: boolean` (default `true`).

#### Scenario: DELIVERY_NEXT_STOP compiles

- GIVEN the `ActionKey` union
- WHEN code assigns `'DELIVERY_NEXT_STOP'` to an `ActionKey`-typed value
- THEN type-checking passes

#### Scenario: requiresRecipients defaults to true

- GIVEN an `ActionDescriptor` literal omits `requiresRecipients`
- WHEN the literal is type-checked
- THEN the descriptor is accepted
- AND `requiresRecipients` defaults to `true`

### REQ-DNS-002: `delivery` module in the action registry

The action registry (in `src/features/system/notifications/registry/action-registry.ts`) SHALL include a `delivery` module with the `DELIVERY_NEXT_STOP` action: `moduleKey: 'delivery'`, `moduleLabel: 'Entregas'`, `actions: [{ key: 'DELIVERY_NEXT_STOP', label: 'Próxima parada', description: 'Avisa al siguiente cliente que su paquete está por llegar.', requiresRecipients: false }]`.

#### Scenario: registry lists the delivery module

- GIVEN the action registry is loaded
- WHEN the screen renders its actions accordion
- THEN a "Entregas" accordion section appears
- AND it contains exactly one action row "Próxima parada"

#### Scenario: row carries the description copy

- GIVEN the registry entry is read
- WHEN the action description is inspected
- THEN the description text is "Avisa al siguiente cliente que su paquete está por llegar."

### REQ-DNS-003: `requiresRecipients: false` for `DELIVERY_NEXT_STOP`

The `DELIVERY_NEXT_STOP` action descriptor SHALL set `requiresRecipients: false`. As a result, `computeZeroRecipientViolation(form)` MUST return `false` when the only enabled action is `DELIVERY_NEXT_STOP` (so the zero-recipient block does NOT fire and Save is NOT disabled).

#### Scenario: delivery-only with zero recipients does not block save

- GIVEN `enabledActions: ['DELIVERY_NEXT_STOP']`, `recipientUserIds: []`, `enabled: true`
- WHEN `computeZeroRecipientViolation(form)` is invoked
- THEN it returns `false`
- AND Save is enabled
- AND the zero-recipient inline message is NOT shown

#### Scenario: mixed enabled actions still require recipients

- GIVEN `enabledActions: ['DELIVERY_NEXT_STOP', 'LOW_STOCK']`, `recipientUserIds: []`
- WHEN `computeZeroRecipientViolation(form)` is invoked
- THEN it returns `true`
- AND Save is disabled
- AND the inline message "Selecciona al menos un usuario a notificar" renders

#### Scenario: recipient-based action without recipients still blocks

- GIVEN `enabledActions: ['LOW_STOCK']`, `recipientUserIds: []`
- WHEN `computeZeroRecipientViolation(form)` is invoked
- THEN it returns `true` (regression — pre-existing behavior preserved)

### REQ-DNS-004: Toggle mutates `enabledActions` and Save uses read-merge-PUT

Toggling `DELIVERY_NEXT_STOP` SHALL call `toggleActionMembership` to add or remove the key from `enabledActions`. On Save, the form SHALL read the current config from the cached `useNotificationConfigQuery`, merge the toggle, and `PUT /notification-config` with the FULL body `{ enabled, recipientUserIds, enabledActions }` (full overwrite, never PATCH). The PUT body MUST NOT include `id`, `tenantId`, `createdAt`, `updatedAt`, or any other non-whitelisted key (backend `forbidNonWhitelisted`).

#### Scenario: toggling on adds the key

- GIVEN `enabledActions: []`
- WHEN the user toggles "Próxima parada" ON
- THEN `enabledActions` becomes `['DELIVERY_NEXT_STOP']`
- AND the form is dirty

#### Scenario: toggling off removes the key

- GIVEN `enabledActions: ['DELIVERY_NEXT_STOP']`
- WHEN the user toggles "Próxima parada" OFF
- THEN `enabledActions` becomes `[]`
- AND the form is dirty

#### Scenario: PUT body has exactly three keys

- GIVEN the dirty form has `enabled: true, recipientUserIds: [], enabledActions: ['DELIVERY_NEXT_STOP']`
- WHEN the user clicks Save
- THEN `PUT /notification-config` fires with body `{ enabled: true, recipientUserIds: [], enabledActions: ['DELIVERY_NEXT_STOP'] }`
- AND no other top-level keys are sent

### REQ-DNS-005: Error handling for `UNKNOWN_ACTION_KEY` and `INVALID_RECIPIENT`

The existing `mapNotificationConfigError(code)` SHALL continue to handle the new key. `400 UNKNOWN_ACTION_KEY` SHALL surface as a Spanish toast (stale client enum). `400 INVALID_RECIPIENT` SHALL surface as the inline recipient field error "Uno de los usuarios seleccionados no pertenece a esta cuenta" (offending ids in `message`). The mutation SHALL invalidate `notificationConfigQueryKeys.config(tenantId)` on success and re-hydrate the form from the response.

#### Scenario: UNKNOWN_ACTION_KEY toasts stale-enum warning

- GIVEN PUT returns `400 UNKNOWN_ACTION_KEY`
- WHEN the mutation rejects
- THEN a Spanish toast appears
- AND no field-level error renders

#### Scenario: INVALID_RECIPIENT attaches to recipient field

- GIVEN PUT returns `400 INVALID_RECIPIENT` with offending ids
- WHEN the mutation rejects
- THEN the recipient field shows "Uno de los usuarios seleccionados no pertenece a esta cuenta"
- AND no toast appears

#### Scenario: success invalidates the config cache and re-hydrates

- GIVEN a successful PUT
- WHEN the mutation resolves
- THEN `notificationConfigQueryKeys.config(tenantId)` is invalidated
- AND the form re-hydrates from the response
- AND the Spanish success toast "Configuración de notificaciones guardada" fires

### REQ-DNS-006: Master toggle independence preserved

The master toggle SHALL continue to bind to `enabled`. When master is OFF, the `DELIVERY_NEXT_STOP` toggle SHALL render disabled (inherited rule). Toggling master MUST NOT mutate `enabledActions` (master is independent of the per-action toggles).

#### Scenario: master OFF disables the Próxima parada toggle

- GIVEN `enabled: false`
- WHEN the "Próxima parada" toggle renders
- THEN it is rendered disabled
- AND clicking it does not mutate `enabledActions`

#### Scenario: master ON enables the toggle

- GIVEN `enabled: true`
- WHEN the toggle renders
- THEN it is enabled
- AND the user can flip it

### REQ-DNS-007: Action registry is the single extension point

Adding `DELIVERY_NEXT_STOP` SHALL require registry-only edits plus the `ActionKey` union widening. No view, no accordion, no `Switch`/`UDropdownMenu` code SHALL branch on the action key.

#### Scenario: registry drives accordion sections

- GIVEN the registry contains `[{ moduleKey:'delivery', ... }, { moduleKey:'pos', ... }]`
- WHEN the screen renders
- THEN the accordion renders "Entregas" AND the existing module sections

#### Scenario: no per-action code branches

- GIVEN the `NotificationConfigView` and `ActionRow` source
- WHEN the source is inspected for `DELIVERY_NEXT_STOP` mentions
- THEN no `if/else`/`switch` branches on the action key exist
- AND the row renders purely from the registry descriptor

## Empty / loading / error states (inherited from `notification-config`)

| State | Behavior |
| --- | --- |
| Loading | `USkeleton` ×3 cards (existing); controls disabled |
| Empty | Not applicable (config returns defaults) |
| Error | `INVALID_RECIPIENT` → inline recipient field; `UNKNOWN_ACTION_KEY` → toast; 401/403/400 → mapped Spanish fallback |

## UI Copy (neutral Spanish)

- Module label: "Entregas"
- Action label: "Próxima parada"
- Action description: "Avisa al siguiente cliente que su paquete está por llegar."
- Zero-recipient guard (delivery-only): no message; Save enabled
- Zero-recipient guard (mixed/recipient-based): "Selecciona al menos un usuario a notificar"
- Success toast: "Configuración de notificaciones guardada"
- `INVALID_RECIPIENT` field: "Uno de los usuarios seleccionados no pertenece a esta cuenta"
