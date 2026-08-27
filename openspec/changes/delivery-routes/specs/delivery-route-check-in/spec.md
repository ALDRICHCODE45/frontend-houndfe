# Delivery Route Check-In Specification

Domain: `delivery-route-check-in` · Capability: the driver surface for `src/features/delivery-routes/`. A driver sees only routes assigned to them (server-scoped by CASL on `driverUserId`), opens a stop detail with `customer.name`, formatted address, and a read-only Leaflet map, performs an idempotent check-in per stop, and reads the 5-event timeline rendered in backend order. Mobile-first polish: touch-sized check-in targets, address/step layout that works on a phone held in the field.

## Purpose

Give a courier in the field a focused, server-scoped view of their own ACTIVE routes so they can move stop by stop, check each one in, and see the route progress and history. The driver surface is gated by `read`+`update` on `DeliveryRoute` (with `create`/`delete` absent — the discriminator is `useDeliveryRouteRole`). Detail 403 (driver opening a non-owned route) surfaces as the not-found full-page state, never a presence leak.

## Requirements

### REQ-DRC-001: Driver list is server-scoped and shows only own ACTIVE routes

`useDriverActiveRoutes` SHALL issue `GET /delivery-routes?status=ACTIVE` (no client-side filter, no `driverUserId` query param). The backend CASL rules `{ driverUserId: userId }` SHALL scope the response to the current driver's own routes. Each route SHALL render as a `DriverRouteCard` showing the route status badge, the driver name, and the x/y delivered-stops counter (`{completed}/{total}` or `"Sin paradas"`).

#### Scenario: driver sees own ACTIVE routes

- GIVEN a driver with `read+update:DeliveryRoute` and two ACTIVE routes assigned to them
- WHEN the driver list mounts
- THEN `GET /delivery-routes?status=ACTIVE` fires exactly once
- AND two `DriverRouteCard`s render

#### Scenario: driver does not send driverUserId query param

- GIVEN the list composable is mounted
- WHEN the request is inspected
- THEN no `driverUserId` query parameter is present in the URL

#### Scenario: driver sees "No tienes rutas activas" when empty

- GIVEN zero ACTIVE routes are assigned to the driver
- WHEN the driver list renders
- THEN the empty state "No tienes rutas activas" renders
- AND no manager controls render

### REQ-DRC-002: Driver list empty / loading / error states

`DriverRouteCard` skeletons SHALL render while `isLoading`. The error block SHALL render via `normalizeApiError` with a retry control when `isError` is true. The empty state text SHALL render when `data.length === 0`.

#### Scenario: loading skeletons

- GIVEN `isLoading` is true
- WHEN the list renders
- THEN `DriverRouteCard` skeleton placeholders render

#### Scenario: error with retry

- GIVEN `GET /delivery-routes?status=ACTIVE` fails
- WHEN the list renders
- THEN the error block with retry renders the Spanish fallback message
- AND clicking retry fires `refresh`

### REQ-DRC-003: Driver detail renders stops in `sortOrder` ASC with customer + formatted address

`DriverStopDetail` SHALL render the route's stops sorted by `sortOrder` ASC (no client re-sort — backend already returns them ordered). Each stop SHALL show: `customer.name` (or `"Cliente sin nombre"` when null); the address rendered via `formatAddress(stop.shippingAddress)` from `src/core/shared/utils/formatAddress` (label → street + `#exterior` + `Int. interior` → neighborhood, municipality, city, state → `CP zipCode`); the stop status badge (`DELIVERY_ROUTE_STOP_STATUS_LABELS`); and the check-in button.

#### Scenario: stops render in backend sortOrder

- GIVEN stops with `sortOrder: [2, 0, 1]`
- WHEN the detail renders
- THEN the rendered order matches the backend order (no client re-sort)
- AND `stop.sortOrder === 0` is rendered first

#### Scenario: address uses shared formatAddress ordering

- GIVEN a stop with `shippingAddress.label: 'Casa'`, `street: 'Av. Reforma'`, `exteriorNumber: '123'`, `neighborhood: 'Centro'`, `city: 'CDMX'`, `state: 'CDMX'`, `zipCode: '06000'`
- WHEN the detail renders
- THEN the address reads "Casa, Av. Reforma #123, Centro, CDMX, CDMX, CP 06000"

#### Scenario: null customer renders fallback

- GIVEN a stop with `customer: null`
- WHEN the stop renders
- THEN the customer line shows "Cliente sin nombre"

### REQ-DRC-004: Check-in is idempotent and refreshes detail + timeline

`useCheckInStop` SHALL submit `POST /delivery-routes/:id/stops/:stopId/check-in` (no body) on tap of the check-in button. The button SHALL be disabled for stops with `status !== 'PENDING'` and SHALL show a spinner while `isPending`. On success the detail query (`detail(tenantId, id)`) and list prefix SHALL be invalidated, the toast "Entrega registrada" SHALL fire, and the stop status SHALL flip to `COMPLETED` with `completedAt` set on the next render. When the last PENDING stop flips, the route SHALL transition to `COMPLETED` (server-driven) and the detail refetch SHALL reflect the new route status plus timeline entry. The mutation MUST be replay-safe (the backend treats repeat POSTs as idempotent for already-checked-in stops).

#### Scenario: happy check-in flips the stop

- GIVEN a PENDING stop in an ACTIVE route
- WHEN the driver taps "Registrar entrega"
- THEN `POST /delivery-routes/:id/stops/:stopId/check-in` fires
- AND the detail refetches with the stop now `COMPLETED` and `completedAt` set
- AND the toast "Entrega registrada" fires
- AND the x/y counter increments

#### Scenario: completed stop disables the check-in button

- GIVEN a stop with `status: 'COMPLETED'`
- WHEN the stop renders
- THEN the "Registrar entrega" button is disabled
- AND no mutation fires on tap

#### Scenario: replay-safe — repeat check-in does not error

- GIVEN the stop has already been checked in (status `COMPLETED`)
- WHEN a stale `POST check-in` fires (e.g. retry)
- THEN the backend returns 200/204 with no error
- AND no duplicate toast fires
- AND the detail refetch does not change state

#### Scenario: last stop completion transitions the route

- GIVEN a route with one remaining PENDING stop
- WHEN the driver checks that stop in
- THEN the detail refetches with `route.status: 'COMPLETED'`
- AND the timeline gains the `ROUTE_COMPLETED` event

### REQ-DRC-005: 5-event timeline rendered in backend order (at ASC)

`DeliveryRouteTimeline` SHALL render the timeline array as returned by the backend (`at` ASC), never re-sorted. The 5 event types SHALL render with these labels:
- `ROUTE_CREATED` → "Ruta creada"
- `ROUTE_STARTED` → "Ruta iniciada" + actor name when present
- `STOP_CHECKED_IN` → "Parada {sortOrder + 1} entregada" + actor name when present
- `ROUTE_COMPLETED` → "Ruta completada"
- `ROUTE_CANCELLED` → "Ruta cancelada"

`ROUTE_CREATED.actor` SHALL be `null` per the backend contract and SHALL render without an actor line. `STOP_CHECKED_IN` SHALL display the stop position (`sortOrder + 1`) so the driver can map it to the stop list. The timeline SHALL be read-only — no edit/delete affordance (governed by design §4.4, no `SaleDetailTimeline` generalization).

#### Scenario: timeline renders in backend order

- GIVEN a timeline of `[ROUTE_CREATED (at 10:00), ROUTE_STARTED (at 10:05), STOP_CHECKED_IN (at 10:20, sortOrder 0), STOP_CHECKED_IN (at 10:35, sortOrder 1), ROUTE_COMPLETED (at 10:40)]`
- WHEN the timeline renders
- THEN the events appear in the same order
- AND the `ROUTE_COMPLETED` event renders the "Ruta completada" label

#### Scenario: STOP_CHECKED_IN shows the position

- GIVEN a `STOP_CHECKED_IN` event with `sortOrder: 2`
- WHEN the timeline renders
- THEN the label contains "Parada 3 entregada"

#### Scenario: ROUTE_CREATED renders without an actor line

- GIVEN a `ROUTE_CREATED` event with `actor: null`
- WHEN the timeline renders
- THEN the event renders with the "Ruta creada" label
- AND no actor name row renders

### REQ-DRC-006: Read-only map renders when coordinates exist; hidden otherwise

`DriverStopDetail` SHALL mount `AddressMapPicker` in `mode="read"` when `stop.shippingAddress?.latitude != null && stop.shippingAddress?.longitude != null`. When coordinates are absent or null, the map SHALL NOT render — only the formatted address text renders. The read-only map SHALL render a static marker + popup with the formatted address, NO drag handle, NO geocode input, and SHALL hide gracefully on tile/network failure (formatted address remains visible).

#### Scenario: map renders when coords present

- GIVEN a stop with `latitude: 19.4326, longitude: -99.1332`
- WHEN the stop detail renders
- THEN a Leaflet map with a marker at those coords renders
- AND the formatted address text ALSO renders above the map

#### Scenario: map hidden when coords absent

- GIVEN a stop with `latitude: null, longitude: null`
- WHEN the stop detail renders
- THEN no Leaflet map renders
- AND the formatted address text still renders

#### Scenario: tile failure hides the map without breaking the view

- GIVEN the Leaflet tile request fails
- WHEN the stop detail renders
- THEN the map area is hidden
- AND the formatted address remains visible
- AND no error toast fires

### REQ-DRC-007: Driver 403 surfaces as not-found (no presence leak)

When a driver opens a route they do not own, the backend CASL rule returns `403`. The detail view SHALL map this to the same full-page "Ruta no encontrada" state as `404 ENTITY_NOT_FOUND` — never to a different message that would leak the existence of the route to the driver.

#### Scenario: driver opening non-owned route renders not-found

- GIVEN the driver opens `/pos/rutas-de-entrega/:id` for a route not assigned to them
- WHEN the detail query rejects with `403`
- THEN the view renders the full-page "Ruta no encontrada" state
- AND no toast or banner reveals that the route exists

### REQ-DRC-008: Mobile-first driver polish

Touch targets on `DriverRouteCard` and the check-in button SHALL be at least 44px tall. The stop detail SHALL stack name + formatted address + map + check-in button vertically with comfortable spacing for a phone held in one hand. The check-in button SHALL be the largest interactive element on the stop row.

#### Scenario: check-in button is touch-sized

- GIVEN a stop is rendered on a mobile viewport
- WHEN the stop row is inspected
- THEN the "Registrar entrega" button has `min-height: 44px`

#### Scenario: stop rows stack vertically on mobile

- GIVEN a viewport < `sm`
- WHEN the stop detail renders
- THEN name, formatted address, map, and check-in button stack in a single column
- AND no side-by-side layout is forced

## Empty / loading / error states (per view)

| View | Loading | Empty | Error |
| --- | --- | --- | --- |
| Driver list | `DriverRouteCard` skeletons | "No tienes rutas activas" | error block + retry (Spanish fallback) |
| Driver detail | `USkeleton` for header/stops/timeline | "Sin paradas" when `stops.length === 0` | `404`/driver-`403` → full-page "Ruta no encontrada"; other errors → error block + retry |

## UI Copy (neutral Spanish)

- Driver list empty: "No tienes rutas activas"
- Check-in success toast: "Entrega registrada"
- Stop status "Pendiente" / "En curso" / "Entregada" / "Omitida"
- Customer fallback: "Cliente sin nombre"
- Not-found full-page: "Ruta no encontrada"
- Timeline labels: "Ruta creada", "Ruta iniciada", "Parada N entregada", "Ruta completada", "Ruta cancelada"
