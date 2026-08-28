# Delivery Route Management Specification

Domain: `delivery-route-management` · Capability: the manager surface for `src/features/delivery-routes/`. Lets a manager plan DRAFT routes from eligible sales (`deliveryStatus ∈ {PENDING, SHIPPED}`), assign a driver, edit driver/notes on DRAFT, append stops, reorder stops (DnD + up/down fallback), start/cancel/delete, with permission-gated controls, x/y stop progress counter, and Spanish error surfacing for `422 DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE`, `409 DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE`, `422 DELIVERY_ROUTE_INVALID_TRANSITION`, and `404 ENTITY_NOT_FOUND`.

## Purpose

Plan and execute delivery routes from the POS without leaving the Hound frontend. A manager creates a DRAFT route by selecting eligible sales (PENDING/SHIPPED confirmed sales with a shipping address), assigns a courier, optionally adds a note, then appends/reorders stops, starts the route, and tracks progress through a status badge plus an `x/y` delivered stops counter. The surface is gated by `create`/`delete:DeliveryRoute`; users holding only `read`+`update` see the driver surface (governed by `delivery-route-check-in`). The manager list never filters by `driverUserId` — scoping is server-side CASL — and the view discriminates internally via `useDeliveryRouteRole`.

## Requirements

### REQ-DRM-001: Manager list renders all tenant routes with status + progress

`DeliveryRoutesListView` SHALL render every `DeliveryRouteResponseDto` for the current tenant, sorted by `updatedAt` desc by default, each row showing the route status badge (`DELIVERY_ROUTE_STATUS_LABELS` + tones), the driver name (or `—` when unassigned), and an `x/y` delivered-stops counter derived from `stops.filter(s => s.status === 'COMPLETED').length / stops.length`. The counter SHALL render as `"{completed}/{total}"` when `total > 0` and as `"Sin paradas"` when `total === 0`. The list SHALL be wrapped by `useServerTable` (full-fetch + client pagination) so derived flags are stable on every refetch.

#### Scenario: DRAFT route with zero stops shows "Sin paradas"

- GIVEN a route with `status: 'DRAFT'` and `stops: []`
- WHEN the row renders
- THEN the progress cell shows `"Sin paradas"`
- AND the status badge shows "Borrador" with `neutral` tone

#### Scenario: ACTIVE route with 3 delivered / 7 total shows "3/7"

- GIVEN a route with `status: 'ACTIVE'`, `stops.length === 7`, and `stops.filter(s => s.status === 'COMPLETED').length === 3`
- WHEN the row renders
- THEN the progress cell shows `"3/7"`
- AND the status badge shows "Activa" with `warning` tone

#### Scenario: COMPLETED route shows full count

- GIVEN a route with `status: 'COMPLETED'` and all stops `COMPLETED`
- WHEN the row renders
- THEN the progress cell shows `"7/7"` (or `{stops.length}/{stops.length}`)
- AND the status badge shows "Completada" with `success` tone

### REQ-DRM-002: "Nueva ruta" button gated by `create:DeliveryRoute`

The manager list SHALL expose a "Nueva ruta" button only when `authStore.userCan('create', 'DeliveryRoute')` is true. The button SHALL open `DeliveryRouteUpsertSlideover` in create mode. When the user lacks `create`, the button SHALL NOT render (never render disabled) and the manager list SHALL still render so drivers holding read+delete can navigate to detail.

#### Scenario: manager with create sees the button

- GIVEN a user holding `create:DeliveryRoute`
- WHEN the manager list renders
- THEN a "Nueva ruta" button is visible

#### Scenario: user without create does not see the button

- GIVEN a user lacking `create:DeliveryRoute` (driver-only)
- WHEN the manager list renders
- THEN no "Nueva ruta" button is rendered
- AND no disabled placeholder renders

### REQ-DRM-003: Eligible-sales picker is status-only with backend re-validation

`EligibleSalesPicker` SHALL list confirmed sales fetched via `useConfirmedSales` filtered to `deliveryStatus ∈ {PENDING, SHIPPED}`, displayed via `saleApi.listConfirmed({ deliveryStatus: ['PENDING','SHIPPED'], ... })`. The picker MUST NOT pre-filter by address presence (the backend re-validates and returns `422 DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE` for address-less sales). Multi-select SHALL emit `update:selected` with an array of `saleId` UUIDs, and the slideover SHALL refuse submission when the array is empty (zod `saleIds.min(1)`).

#### Scenario: picker renders only PENDING + SHIPPED sales

- GIVEN `useConfirmedSales` returns sales with statuses `{PENDING, SHIPPED, DELIVERED, NOT_APPLICABLE}`
- WHEN the picker renders
- THEN only PENDING + SHIPPED sales appear
- AND DELIVERED + NOT_APPLICABLE sales do NOT appear

#### Scenario: empty picker shows "No hay ventas pendientes o enviadas"

- GIVEN zero PENDING or SHIPPED sales in the cache
- WHEN the picker renders
- THEN the empty state shows "No hay ventas pendientes o enviadas"

#### Scenario: create with zero selected sales is blocked client-side

- GIVEN the user opens the create slideover
- WHEN the user submits with an empty selection
- THEN the form shows the inline error "Selecciona al menos una venta"
- AND no request is sent

### REQ-DRM-004: Driver picker uses `usersApi.listAssignable()`

`DriverPicker` SHALL render `AssignableUser {id, name}` items fetched via `usersApi.listAssignable()` with the existing `usersQueryKeys.assignable()` cache slot, and SHALL emit `update:driverUserId` with a single UUID. The picker SHALL be required (`driverUserId` is a UUID, no null) and SHALL render the empty state "No hay repartidores disponibles" when the assignable list is empty.

#### Scenario: picker lists assignable users

- GIVEN `listAssignable()` returns `[{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Beto' }]`
- WHEN the picker renders
- THEN two options are visible (Ana, Beto)

#### Scenario: create with no driver selected is blocked

- GIVEN the user opens the create slideover
- WHEN the user submits with `driverUserId` empty
- THEN the form shows the inline error "Selecciona un repartidor"
- AND no request is sent

### REQ-DRM-005: Notes are optional, trimmed, and capped at 280 chars

`DeliveryRouteUpsertSlideover` SHALL accept an optional `notes` field. The notes input SHALL trim on blur and SHALL refuse submission when the trimmed length exceeds 280 characters (zod `notes.max(280)` → inline error "Máximo 280 caracteres"). On edit (`PATCH`), `notes: null` SHALL clear the value.

#### Scenario: notes over 280 chars is blocked client-side

- GIVEN the user types 281 characters into notes
- WHEN the user submits
- THEN the form shows the inline error "Máximo 280 caracteres"
- AND no request is sent

#### Scenario: edit with empty notes clears the value

- GIVEN the user opens the edit slideover with current notes "Llevar cambio"
- WHEN the user clears the input and submits
- THEN the PATCH payload contains `notes: null`
- AND the backend persists `null`

### REQ-DRM-006: Create DRAFT route with eligible sales, driver, optional notes

The create flow SHALL submit `POST /delivery-routes` with body `{ saleIds: string[] (min 1, UUID), driverUserId: UUID, notes?: string (≤ 280, trimmed) }`. The wire payload MUST NOT include `id`, `tenantId`, `createdAt`, `updatedAt`, `timeline`, `status`, `startedAt`, `completedAt`, `cancelledAt`, or `stops` (backend `forbidNonWhitelisted`). On HTTP 201 the slideover SHALL close, the list query SHALL be invalidated via `deliveryRouteQueryKeys.listPrefix(tenantId)`, the success toast "Ruta creada" SHALL fire, and the list SHALL refetch.

#### Scenario: happy create round-trip

- GIVEN a manager with `create:DeliveryRoute`, one driver selected, three eligible sales selected, and notes "Llevar cambio"
- WHEN the user submits
- THEN `POST /delivery-routes` fires with `{ saleIds: [uuid, uuid, uuid], driverUserId: uuid, notes: 'Llevar cambio' }`
- AND no `id` / `tenantId` / `stops` / `timeline` keys are sent
- AND the slideover closes
- AND the list refetches and shows the new DRAFT row
- AND the toast "Ruta creada" fires

#### Scenario: payload omits forbidden keys

- GIVEN the create payload builder is invoked
- WHEN the request body is inspected
- THEN it contains exactly `saleIds`, `driverUserId`, and optionally `notes`
- AND no other top-level keys are present

### REQ-DRM-007: DRAFT-only edit (driver + notes) on PATCH

The edit flow SHALL submit `PATCH /delivery-routes/:id` with body `{ driverUserId?: UUID, notes?: string | null (≤ 280) }`. The slideover SHALL hide the sales picker in edit mode (sales picker is create-only). On success the detail query (`detail(tenantId, id)`) and list prefix SHALL be invalidated, and the toast "Cambios guardados" SHALL fire. On `422 DELIVERY_ROUTE_INVALID_TRANSITION` the slideover SHALL stay open, the toast "La ruta no permite esta acción en su estado actual." SHALL fire, and the detail query SHALL be invalidated to resync stale status.

#### Scenario: edit driver + notes on DRAFT succeeds

- GIVEN a DRAFT route with driver Ana and notes "Llevar cambio"
- WHEN the user changes driver to Beto and notes to "Recoger paquete en mostrador" and submits
- THEN `PATCH /delivery-routes/:id` fires with the two changed fields
- AND the slideover closes
- AND the detail and list refetch
- AND the toast "Cambios guardados" fires

#### Scenario: edit hides the sales picker

- GIVEN the edit slideover is open for an existing route
- WHEN the slideover renders
- THEN no sales picker is visible
- AND the sales picker slot is not mounted

#### Scenario: edit on non-DRAFT surfaces DELIVERY_ROUTE_INVALID_TRANSITION

- GIVEN the route is `ACTIVE`
- WHEN the user submits the edit slideover
- THEN a toast "La ruta no permite esta acción en su estado actual." appears
- AND the slideover stays open
- AND the detail query refetches and the status badge re-renders

### REQ-DRM-008: Append stop (single sale) on DRAFT

The append-stop flow SHALL submit `POST /delivery-routes/:id/stops` with body `{ saleId: UUID }` returning `201`. On success the detail query and list prefix SHALL be invalidated AND `saleQueryKeys.confirmed` SHALL be invalidated (the appended sale is no longer eligible for other routes). The toast "Parada agregada" SHALL fire.

#### Scenario: happy append

- GIVEN a DRAFT route
- WHEN the user appends an eligible sale
- THEN `POST /delivery-routes/:id/stops` fires with `{ saleId: uuid }`
- AND the detail refetches with the new stop appended in `sortOrder`
- AND the list refetches
- AND the eligible-sales cache is invalidated
- AND the toast "Parada agregada" fires

#### Scenario: ineligible sale surfaces DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE inline

- GIVEN the user tries to append a sale that the backend rejects (e.g. address-less)
- WHEN the mutation rejects with `422 DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE`
- THEN the toast "Una de las ventas no es elegible (debe estar pendiente o enviada y tener dirección de envío)." appears
- AND the detail query is invalidated so the stop list resyncs

### REQ-DRM-009: Reorder stops (DnD + up/down fallback) covers every stop exactly once

`DeliveryRouteReorderPanel` SHALL render the DRAFT route's stops sorted by `sortOrder` ASC, allow reordering via `vuedraggable` AND via per-row ↑/↓ buttons, and SHALL submit `PUT /delivery-routes/:id/stops/reorder` with body `{ orderedStopIds: string[] }` where the array contains every existing stop id exactly once. A pure guard `assertReorderCoversStops(orderedStopIds, existingStopIds)` SHALL run before the mutation; on mismatch (length differs, unknown id, or duplicate) the request SHALL be blocked and an inline error SHALL render. Save SHALL fire only on explicit click of "Guardar orden" — never on drag-end autosave. On success the detail and list SHALL be invalidated and the toast "Orden guardado" SHALL fire.

#### Scenario: DnD reorders stops and Guardar orden submits

- GIVEN a DRAFT route with stops `[A, B, C]` in `sortOrder`
- WHEN the user drags C above A
- THEN the local ordered copy becomes `[C, A, B]`
- AND clicking "Guardar orden" fires `PUT /delivery-routes/:id/stops/reorder` with `{ orderedStopIds: ['C','A','B'] }`
- AND the detail refetches with stops in the new order

#### Scenario: up/down buttons produce the same ordered array

- GIVEN the local ordered copy is `[A, B, C]`
- WHEN the user clicks ↑ on C twice
- THEN the local ordered copy becomes `[C, A, B]`
- AND the same `PUT` payload is produced

#### Scenario: exactly-once guard blocks bad payload

- GIVEN the local ordered copy accidentally drops stop B (e.g. `[A, C]` with stops `[A, B, C]`)
- WHEN the user clicks "Guardar orden"
- THEN no PUT fires
- AND the inline error "El orden debe incluir todas las paradas una sola vez" renders

#### Scenario: 422 DELIVERY_ROUTE_INVALID_TRANSITION on reorder of non-DRAFT

- GIVEN the route is `ACTIVE`
- WHEN the reorder panel is rendered
- THEN the DnD and ↑/↓ controls are hidden
- AND no "Guardar orden" button renders

### REQ-DRM-010: Start with confirmation and 409 race handling

The start flow SHALL open a `ConfirmModal` with the title "Iniciar ruta" and body "La ruta pasará a Activa y no podrá editarse ni eliminar la composición de paradas."; on confirm, `POST /delivery-routes/:id/start` SHALL fire. On success the detail and list SHALL be invalidated, the confirm modal SHALL close, and the toast "Ruta iniciada" SHALL fire. On `409 DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE` the toast "Una de las ventas ya pertenece a otra ruta activa." SHALL fire, the detail and list SHALL be invalidated (so the manager sees the now-conflicted sale and can re-pick), and the confirm SHALL close WITHOUT auto-retry.

#### Scenario: happy start

- GIVEN a DRAFT route with stops
- WHEN the user clicks "Iniciar ruta" and confirms
- THEN `POST /delivery-routes/:id/start` fires
- AND the confirm modal closes
- AND the detail refetches with `status: 'ACTIVE'` and `startedAt` set
- AND the toast "Ruta iniciada" fires

#### Scenario: 409 surfaces a conflict toast and refetches

- GIVEN another route has been started between picker and start, claiming a sale
- WHEN `POST :id/start` rejects with `409 DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE`
- THEN the confirm modal closes
- AND the toast "Una de las ventas ya pertenece a otra ruta activa." appears
- AND `detail(tenantId, id)` and `listPrefix(tenantId)` are invalidated
- AND no auto-retry fires

#### Scenario: confirm cancel does nothing

- GIVEN the confirm modal is open
- WHEN the user cancels
- THEN no `POST :id/start` fires
- AND the route remains DRAFT

### REQ-DRM-011: Cancel works from DRAFT and ACTIVE

The cancel flow SHALL open a `ConfirmModal` titled "Cancelar ruta"; on confirm, `POST /delivery-routes/:id/cancel` SHALL fire. Cancel SHALL be available for routes with `status ∈ {DRAFT, ACTIVE}`. On success the detail and list SHALL be invalidated and the toast "Ruta cancelada" SHALL fire. On `422 DELIVERY_ROUTE_INVALID_TRANSITION` the toast "La ruta no permite esta acción en su estado actual." SHALL fire and the detail SHALL be invalidated.

#### Scenario: cancel DRAFT

- GIVEN a DRAFT route
- WHEN the user cancels
- THEN `POST /delivery-routes/:id/cancel` fires
- AND the detail refetches with `status: 'CANCELLED'` and `cancelledAt` set
- AND the toast "Ruta cancelada" fires

#### Scenario: cancel ACTIVE

- GIVEN an ACTIVE route
- WHEN the user cancels
- THEN `POST :id/cancel` fires and the route transitions to CANCELLED

#### Scenario: cancel on COMPLETED/CANCELLED is hidden

- GIVEN a route with `status: 'COMPLETED'` or `'CANCELLED'`
- WHEN the detail view renders
- THEN the "Cancelar" button does NOT render

### REQ-DRM-012: Delete is available only for zero-stop DRAFT routes

The delete control SHALL render only when `status === 'DRAFT'` AND `stops.length === 0` AND the user holds `delete:DeliveryRoute`. The flow SHALL open a `ConfirmModal` titled "Eliminar ruta" with body "Esta ruta está vacía y se eliminará permanentemente."; on confirm, `DELETE /delivery-routes/:id` (HTTP 204) SHALL fire. On success the detail query SHALL be `removeQueries`-ed, the list prefix SHALL be invalidated, the toast "Ruta eliminada" SHALL fire, and the user SHALL navigate back to the list. On `422 DELIVERY_ROUTE_INVALID_TRANSITION` the toast "La ruta no permite esta acción en su estado actual." SHALL fire and the detail SHALL be invalidated.

#### Scenario: delete zero-stop DRAFT

- GIVEN a DRAFT route with `stops.length === 0` and a user with `delete:DeliveryRoute`
- WHEN the user confirms delete
- THEN `DELETE /delivery-routes/:id` fires and returns 204
- AND the detail is removed from cache
- AND the list refetches without the row
- AND the toast "Ruta eliminada" fires
- AND the user navigates to `/pos/rutas-de-entrega`

#### Scenario: delete hidden once stops exist

- GIVEN a DRAFT route with `stops.length > 0`
- WHEN the detail view renders
- THEN the "Eliminar" button does NOT render (zero-stop constraint violated)

#### Scenario: delete hidden for non-DRAFT

- GIVEN a route with `status: 'ACTIVE'` (any number of stops)
- WHEN the detail view renders
- THEN the "Eliminar" button does NOT render

### REQ-DRM-013: Permission-gated manager controls on the detail view

`DeliveryRouteDetailView` (manager branch) SHALL render each control based on the discriminated `useDeliveryRouteRole` result and CASL: "Editar" requires `update:DeliveryRoute` AND `status === 'DRAFT'`; "Reordenar" requires `update` AND `status === 'DRAFT'`; "Iniciar" requires `update` AND `status === 'DRAFT'` AND `stops.length > 0`; "Cancelar" requires `update` AND `status ∈ {DRAFT, ACTIVE}`; "Eliminar" requires `delete` AND `status === 'DRAFT'` AND `stops.length === 0`; "Agregar parada" requires `update` AND `status === 'DRAFT'`. The manager view SHALL render the read-only 5-event timeline (governed by `delivery-route-check-in`).

#### Scenario: ACTIVE route hides edit / reorder / start / add-stop controls

- GIVEN an ACTIVE route viewed by a manager
- WHEN the detail renders
- THEN "Editar", "Reordenar", "Iniciar", and "Agregar parada" do NOT render
- AND "Cancelar" still renders

#### Scenario: COMPLETED route hides all mutating controls

- GIVEN a COMPLETED route
- WHEN the detail renders
- THEN "Editar", "Reordenar", "Iniciar", "Cancelar", "Eliminar", and "Agregar parada" do NOT render

### REQ-DRM-014: Manager list empty / loading / error states

`AppDataTable :loading="isLoading"` SHALL render its skeleton. When `fullList.length === 0`, the empty state SHALL show "No hay rutas de entrega" with the enabled "Nueva ruta" button when `create:DeliveryRoute` is granted. When `isError` is true, `AppDataTable :error` / `:error-message` SHALL render the error block (with retry) using `normalizeApiError`; the empty state SHALL NOT render.

#### Scenario: empty manager list

- GIVEN the route list is empty and the user holds `create:DeliveryRoute`
- WHEN the list renders
- THEN the empty state "No hay rutas de entrega" appears
- AND the "Nueva ruta" button is enabled

#### Scenario: error state replaces empty

- GIVEN `GET /delivery-routes` fails
- WHEN the list renders
- THEN the error block renders with retry
- AND the empty text is NOT rendered

#### Scenario: loading skeleton

- GIVEN `isLoading` is true
- WHEN the list renders
- THEN `AppDataTable` shows its loading skeleton and no rows

### REQ-DRM-015: Manager list refetches on demand (no polling)

The manager list SHALL NOT poll. Refetch SHALL fire only when: a mutation succeeds; the user clicks the refresh control; the user navigates back to the list. The x/y counter and status badge SHALL update from the refetched data, never from a timer.

#### Scenario: no polling timer

- GIVEN the manager list is mounted
- WHEN 60 seconds pass without user interaction or mutation
- THEN no `GET /delivery-routes` request fires
- AND the rendered data remains the last fetched snapshot

#### Scenario: refresh control refetches

- GIVEN the list is mounted with stale data
- WHEN the user clicks the refresh control
- THEN `GET /delivery-routes` fires
- AND the table re-renders with the new snapshot

## Empty / loading / error states (per view)

| View | Loading | Empty | Error |
| --- | --- | --- | --- |
| Manager list | `AppDataTable` skeleton | "No hay rutas de entrega" + "Nueva ruta" (when create permitted) | `AppDataTable` error block + retry via `normalizeApiError` |
| Create/edit slideover | Submit button `:loading="isPending"` | Sales picker empty → "No hay ventas pendientes o enviadas"; driver picker empty → "No hay repartidores disponibles" | zod field errors inline; `422 DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE` toast; `409` toast + slideover stays open for edit |

## UI Copy (neutral Spanish)

- List empty: "No hay rutas de entrega"
- List add: "Nueva ruta"
- Sales picker empty: "No hay ventas pendientes o enviadas"
- Driver picker empty: "No hay repartidores disponibles"
- Validation: "Selecciona al menos una venta", "Selecciona un repartidor", "Máximo 280 caracteres"
- Inline reorder guard: "El orden debe incluir todas las paradas una sola vez"
- Confirm start title/body: "Iniciar ruta" / "La ruta pasará a Activa y no podrá editarse ni eliminar la composición de paradas."
- Confirm cancel title: "Cancelar ruta"
- Confirm delete title/body: "Eliminar ruta" / "Esta ruta está vacía y se eliminará permanentemente."
- Toast success: "Ruta creada", "Cambios guardados", "Parada agregada", "Orden guardado", "Ruta iniciada", "Ruta cancelada", "Ruta eliminada"
- Toast conflict: "Una de las ventas ya pertenece a otra ruta activa."
- Toast invalid-transition: "La ruta no permite esta acción en su estado actual."
