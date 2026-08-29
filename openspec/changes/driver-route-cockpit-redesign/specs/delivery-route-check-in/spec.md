# Delivery Route Check-In Specification

Domain: `delivery-route-check-in` · Capability: the driver surface for `src/features/delivery-routes/`. A driver sees only routes assigned to them (server-scoped by CASL on `driverUserId`), opens a route detail rendered as the cockpit, and performs check-in per stop. The detail is composed of three focused capability specs — `driver-cockpit-derivation` (pure selectors), `driver-cockpit-shell` (header, operational current/next hierarchy, spine, four-mode footer, refresh event), and `driver-cockpit-drawer` (one drawer whose stop mode uses `DriverStopPanel` and whose history mode directly reuses `DeliveryRouteTimeline`). This domain owns route-level data flow, privacy mapping, the single view-owned mutation instance, timeline order, and read-only map behavior. The cockpit owns no server state. Driver list and manager branch remain out of scope and preserve their existing contracts.

## Purpose

The driver surface of the delivery-route feature used to be a vertical stack of equal-weight stop cards plus a compact timeline. That presentation did not give the driver a clear cockpit, did not give any stop visual priority, and did not respect the backend's lack of enforced order. The new driver surface renders one sticky header, one `DriverOperationalStops` hierarchy containing current and next sections, one ordered spine, one `DriverCockpitFooter` with mutually exclusive modes, one shared bottom drawer with stop and history modes, and an explicit manual refresh control. The route-level integration — data flow, role gating, error privacy, not-found mapping, check-in mutation contract, timeline order, read-only map — must remain stable so that every test, composable, and contract from the archived `delivery-route-check-in` (archived with the `2026-08-28-delivery-routes` change) continues to hold. Driver-list, manager-branch, route-path, route-guard, and sidebar-entry invariants remain byte-equivalent to the pre-change codebase.

## Requirements

### REQ-DRC-101: Driver list is server-scoped and shows only own ACTIVE routes (preserved)

`useDriverActiveRoutes` SHALL issue `GET /delivery-routes?status=ACTIVE` (no client-side filter, no `driverUserId` query param). The backend CASL rules `{ driverUserId: userId }` SHALL scope the response to the current driver's own routes. Each route SHALL render as a `DriverRouteCard` showing the route status badge, the driver name, and the x/y delivered-stops counter (`{completed}/{total}` or `"Sin paradas"`). This requirement is preserved verbatim from the archived `REQ-DRC-001`.

#### Scenario: driver sees own ACTIVE routes

- GIVEN a driver with `read:DeliveryRoute` (no `create`/`delete`) and two ACTIVE routes assigned to them
- WHEN the driver list mounts
- THEN `GET /delivery-routes?status=ACTIVE` fires exactly once
- AND two `DriverRouteCard`s render

#### Scenario: driver does not send driverUserId query param

- GIVEN the list composable is mounted
- WHEN the request is inspected
- THEN no `driverUserId` query parameter is present in the URL

#### Scenario: driver sees the exact empty copy when list is empty

- GIVEN zero ACTIVE routes are assigned to the driver
- WHEN the driver list renders
- THEN the empty state "No tienes rutas activas en este momento." renders
- AND no manager controls render

### REQ-DRC-102: Driver list empty / loading / error states (preserved)

`DriverRouteCard` skeletons SHALL render while `isLoading`. The error block SHALL render via `normalizeApiError` with a retry control when `isError` is true. The empty state text SHALL render when `data.length === 0`. This requirement is preserved verbatim from the archived `REQ-DRC-002`.

#### Scenario: loading skeletons

- GIVEN `isLoading` is true
- WHEN the list renders
- THEN `DriverRouteCard` skeleton placeholders render

#### Scenario: error with retry

- GIVEN `GET /delivery-routes?status=ACTIVE` fails
- WHEN the list renders
- THEN the error block with retry renders the Spanish fallback message
- AND clicking retry fires `refresh`

### REQ-DRC-103: Driver 403 surfaces as not-found — no presence leak (preserved)

When a driver opens a route they do not own, the backend CASL rule returns `403`. The detail view SHALL map this to the same full-page "Ruta no encontrada" state as `404 ENTITY_NOT_FOUND` — never to a different message that would leak the existence of the route to the driver. The privacy invariant is preserved from the archived `REQ-DRC-007` and applies to the cockpit composition: when the underlying `useDeliveryRouteDetail` query rejects with `403` or `404`, the cockpit MUST NOT mount — the parent view SHALL render the not-found surface instead.

#### Scenario: driver opening non-owned route renders not-found

- GIVEN the driver opens `/pos/rutas-de-entrega/:id` for a route not assigned to them
- WHEN the detail query rejects with `403`
- THEN the view renders the full-page "Ruta no encontrada" state
- AND no toast or banner reveals that the route exists

#### Scenario: not-found state replaces the cockpit

- GIVEN the detail query rejects with `403` or `404`
- WHEN the detail view renders
- THEN `DriverRouteCockpit` is NOT mounted
- AND no cockpit child (header, operational stops, spine, drawer, stop panel, or footer) is mounted
- AND the full-page "Ruta no encontrada" state renders instead

#### Scenario: a successful query mounts the cockpit with the resolved route

- GIVEN the detail query resolves with a non-null route owned by the driver
- WHEN the detail view renders
- THEN the cockpit mounts with the resolved route as the `route` prop
- AND the role gate (driver vs manager) selects the cockpit branch (governed by REQ-DRC-109)

### REQ-DRC-104: Check-in mutation contract is preserved

`DeliveryRouteDetailView` SHALL instantiate the single existing `useCheckInStop` mutation once. `DriverRouteCockpit` and its children SHALL not instantiate or invoke it. Confirmation may originate from `DriverCockpitFooter` current-action mode or `DriverStopPanel` for any eligible selected PENDING stop. On accepted confirmation, cockpit SHALL close the modal and emit `request-check-in(stopId)` exactly once; the view SHALL handle that event by invoking its mutation instance once with `{ id: routeId, stopId }`.

The existing mutation SHALL submit `POST /delivery-routes/:id/stops/:stopId/check-in` with no body and remain the sole owner of success/error toasts plus detail/list invalidation. The UI prevents repeat entry by removing actions for non-PENDING stops and disabling both footer and stop-panel entry points while the view-provided `checkInPending` is true. On success, the refetched server DTO remains canonical. The mutation contract is preserved from archived REQ-DRC-004; only ownership and call-site event flow change.

#### Scenario: happy check-in flips the stop

- GIVEN a PENDING stop in an ACTIVE route
- WHEN the driver accepts confirmation initiated by the cockpit footer
- THEN the cockpit closes the modal and emits `request-check-in(stopId)` exactly once
- AND the view's single `useCheckInStop` instance sends `POST /delivery-routes/:id/stops/:stopId/check-in` with no body
- AND the detail refetches with the stop now `COMPLETED` and `completedAt` set
- AND the toast "Entrega registrada" fires
- AND the x/y counter in the header increments

#### Scenario: completed stop does not offer the delivery CTA

- GIVEN a stop with `status: 'COMPLETED'`
- WHEN the cockpit renders
- THEN the footer current-action mode is NOT rendered
- AND no mutation event fires from the cockpit

#### Scenario: repeat check-in is prevented in the UI; a replayed request follows the existing error path

- GIVEN the stop has already been checked in (status `COMPLETED`)
- WHEN the cockpit renders
- THEN no delivery affordance is offered for that stop (removed/disabled UI prevents the repeat)
- AND if a replayed `POST check-in` still reaches the backend (e.g. stale retry), the backend MAY respond `422 DELIVERY_ROUTE_INVALID_TRANSITION`
- AND the existing error toast path fires — a guaranteed 200/204 replay success is NOT part of this contract
- AND no duplicate success toast fires
- AND the detail refetch does not change state

#### Scenario: last stop completion transitions the route to COMPLETED

- GIVEN a route with one remaining PENDING stop
- WHEN the driver accepts confirmation initiated by the cockpit footer
- THEN the detail refetches with `route.status: 'COMPLETED'`
- AND the timeline gains the `ROUTE_COMPLETED` event
- AND `DriverCockpitFooter` renders terminal mode on the next render (governed by `driver-cockpit-shell` REQ-DCS-008)

#### Scenario: non-current PENDING stops fire check-in only through the drawer's secondary delivery flow

- GIVEN the user opens the drawer for a non-current `PENDING` stop
- WHEN the user taps the drawer's secondary delivery affordance and confirms in `ConfirmModal`
- THEN cockpit emits that stop id once and the view's single `useCheckInStop` instance applies the same endpoint, invalidations, and toasts as the footer flow
- AND for `COMPLETED`/`SKIPPED` stops no delivery affordance renders and no mutation can fire (governed by `driver-cockpit-drawer` REQ-DCK-003 and `driver-cockpit-shell` REQ-DCS-009)

### REQ-DRC-105: 5-event timeline rendered in backend order (preserved)

`DeliveryRouteTimeline` SHALL render the timeline array as returned by the backend (`at` ASC), never re-sorted. The 5 event types SHALL render with these labels:
- `ROUTE_CREATED` → "Ruta creada"
- `ROUTE_STARTED` → "Ruta iniciada" + actor name when present
- `STOP_CHECKED_IN` → the label "Parada entregada" + the stop position "Parada {sortOrder + 1}" as a separate element, + actor name when present
- `ROUTE_COMPLETED` → "Ruta completada"
- `ROUTE_CANCELLED` → "Ruta cancelada"

`ROUTE_CREATED.actor` SHALL be `null` per the backend contract and SHALL render without an actor line. `STOP_CHECKED_IN` SHALL display the label "Parada entregada" plus the stop position (`sortOrder + 1`) as a separate element so the driver can map it to the stop list. The timeline SHALL be read-only — no edit/delete affordance. The timeline is now mounted inside the cockpit's history-mode drawer (governed by `driver-cockpit-drawer` REQ-DCK-004); the timeline contract is preserved verbatim from the archived `REQ-DRC-005`.

#### Scenario: timeline renders in backend order

- GIVEN a timeline of `[ROUTE_CREATED (at 10:00), ROUTE_STARTED (at 10:05), STOP_CHECKED_IN (at 10:20, sortOrder 0), STOP_CHECKED_IN (at 10:35, sortOrder 1), ROUTE_COMPLETED (at 10:40)]`
- WHEN the cockpit history drawer renders
- THEN the events appear in the same order
- AND the `ROUTE_COMPLETED` event renders the "Ruta completada" label

#### Scenario: STOP_CHECKED_IN shows the label and the position separately

- GIVEN a `STOP_CHECKED_IN` event with `sortOrder: 2`
- WHEN the cockpit history drawer renders
- THEN the event label reads "Parada entregada"
- AND the position "Parada 3" renders as a separate element (not one combined string "Parada 3 entregada")

#### Scenario: ROUTE_CREATED renders without an actor line

- GIVEN a `ROUTE_CREATED` event with `actor: null`
- WHEN the cockpit history drawer renders
- THEN the event renders with the "Ruta creada" label
- AND no actor name row renders

#### Scenario: history drawer is the only place the timeline mounts in the driver surface

- GIVEN the cockpit is mounted
- WHEN the DOM is inspected
- THEN `DeliveryRouteTimeline` mounts only inside the cockpit's history-mode drawer (or, for the manager branch, in the existing manager detail — which is preserved verbatim and out of scope)
- AND the timeline is not rendered inline in the cockpit body

### REQ-DRC-106: Read-only map renders when coordinates exist (preserved)

`AddressMapPicker` in `mode="read"` SHALL mount only when both `stop.shippingAddress?.latitude != null` and `stop.shippingAddress?.longitude != null` AND both coordinates are finite. When coordinates are absent, null, or non-finite, the map SHALL NOT render — only the formatted address text renders. The read-only map SHALL render a static marker + popup with the formatted address, NO drag handle, NO geocode input, and SHALL hide gracefully on tile/network failure (formatted address remains visible). The map is now mounted inside the cockpit's stop-mode drawer (governed by `driver-cockpit-drawer` REQ-DCK-003); the map contract is preserved verbatim from the archived `REQ-DRC-006`.

#### Scenario: map renders when coords present

- GIVEN a stop with `latitude: 19.4326, longitude: -99.1332`
- WHEN the cockpit stop drawer renders for that stop
- THEN a Leaflet map with a marker at those coords renders
- AND the formatted address text ALSO renders above the map

#### Scenario: map hidden when coords absent

- GIVEN a stop with `latitude: null, longitude: null`
- WHEN the cockpit stop drawer renders
- THEN no Leaflet map renders
- AND the formatted address text still renders

#### Scenario: tile failure hides the map without breaking the view

- GIVEN the Leaflet tile request fails
- WHEN the cockpit stop drawer renders
- THEN the map area is hidden
- AND the formatted address remains visible
- AND no error toast fires from the drawer

### REQ-DRC-107: Stale DTO from `keepPreviousData` does not render against the wrong route id (preserved)

`useDeliveryRouteDetail` SHALL guard against `keepPreviousData` returning a DTO for a different route id than the one in the URL. When the URL `:id` and the resolved `route.id` differ, the detail view SHALL treat the state as not-yet-resolved until the query catches up, and the cockpit MUST NOT mount against the stale DTO. While placeholder data exists, the view MUST NOT render the stale route's data as if it matched the URL; the spec does not require a specific skeleton to render during that window — only that the stale cockpit never mounts.

#### Scenario: stale detail for a different route never mounts the cockpit

- GIVEN the driver navigates from `/pos/rutas-de-entrega/A` to `/pos/rutas-de-entrega/B`
- WHEN the detail query for `B` is in-flight and the cache still holds `A` via `keepPreviousData`
- THEN the view treats the state as not-yet-resolved and the cockpit does NOT mount with the stale `A` DTO
- AND the view does not render `A`'s data as if it were `B` (no specific skeleton is mandated while placeholder data exists)

#### Scenario: stale detail does not leak into the cockpit

- GIVEN the cockpit is mounted and the URL route id is `B`
- WHEN the parent view resolves with `B`'s DTO
- THEN the cockpit's `route` prop matches `B`
- AND the cockpit does NOT briefly render `A`'s data

### REQ-DRC-108: Manager branch and driver route list are byte-equivalent to the pre-change codebase (preserved)

The cockpit change SHALL modify ONLY the driver-success composition and necessary existing-observer/single-mutation wiring in `DeliveryRouteDetailView.vue`. The manager branch (manager lifecycle controls, edit / reorder / start / cancel / delete / append, eligibility surfaces, error mapping, permission-gated controls, read-only timeline) SHALL remain byte-equivalent in observable behavior. The driver route list SHALL remain byte-equivalent. Route path, guard, sidebar, existing detail key, and list-prefix invalidation SHALL remain unchanged. The existing `useCheckInStop` behavior remains unchanged and is instantiated once by the view. `useDeliveryRouteDetail` keeps `keepPreviousData` and focus-refetch disabled; no new query key or refresh composable is introduced.

#### Scenario: manager branch is untouched

- GIVEN a manager opens `/pos/rutas-de-entrega/:id` for an ACTIVE route
- WHEN the detail view renders
- THEN no cockpit components mount
- AND the existing manager lifecycle controls render as today
- AND the existing manager tests remain green without modification

#### Scenario: driver list is untouched

- GIVEN a driver opens `/pos/rutas-de-entrega`
- WHEN the list renders
- THEN `GET /delivery-routes?status=ACTIVE` fires once
- AND `DriverRouteCard`s render with the existing count + status badges
- AND no cockpit components are mounted in the list

#### Scenario: route path, route guard, and sidebar entry are unchanged

- GIVEN the cockpit change is applied
- WHEN the route registry is inspected
- THEN `/pos/rutas-de-entrega/:id` is still the only route
- AND the route guard still uses the existing `meta.permission`
- AND the sidebar entry still exists at the same position

#### Scenario: existing check-in mutation contract is preserved

- GIVEN the user accepts delivery confirmation in the cockpit
- WHEN the view-owned mutation fires
- THEN `POST /delivery-routes/:id/stops/:stopId/check-in` fires with no body
- AND `deliveryRouteQueryKeys.detail(tenantId, id)` and `deliveryRouteQueryKeys.listPrefix(tenantId)` are invalidated
- AND the success toast "Entrega registrada" fires
- AND no new query keys are introduced

### REQ-DRC-109: Role gate selects the cockpit branch when the user is a driver (preserved + replaced)

`DeliveryRouteDetailView.vue` SHALL use `useDeliveryRouteRole` (or equivalent) to discriminate the branch. The discriminator SHALL be `isManager = canCreate:DeliveryRoute || canDelete:DeliveryRoute`; `isDriver = !isManager && canRead:DeliveryRoute`. When the role resolves to driver, the view SHALL mount `DriverRouteCockpit` with a non-null resolved DTO; update permission is not required to render. The view SHALL pass `canCheckIn = canUpdate` and its mutation `checkInPending`. A read-only driver can inspect cockpit/drawer/history/quick actions but sees no delivery actions. Manager branch, guard, and privacy mapping remain existing.

#### Scenario: driver mounts the cockpit

- GIVEN a user with `read:DeliveryRoute` and neither `create` nor `delete` opens `/pos/rutas-de-entrega/:id`
- WHEN the detail query resolves
- THEN `DriverRouteCockpit` mounts with the non-null DTO
- AND `canCheckIn` equals `canUpdate`
- AND the manager branch components do NOT mount

#### Scenario: read-only driver can inspect without delivery actions

- GIVEN a driver has read but not update permission
- WHEN the cockpit and stop drawer render
- THEN route, stop, history, map, copy, and email inspection remain available
- AND footer and stop-panel delivery actions are absent

#### Scenario: manager mounts the existing branch

- GIVEN a manager opens `/pos/rutas-de-entrega/:id`
- WHEN the detail query resolves
- THEN the existing manager lifecycle controls mount
- AND `DriverRouteCockpit` does NOT mount

#### Scenario: role gate defers to the route guard

- GIVEN a user lacking `read:DeliveryRoute` opens `/pos/rutas-de-entrega/:id`
- WHEN the route guard runs
- THEN the route guard rejects the navigation
- AND the detail view never mounts (preserved verbatim from the archived role gate)

### REQ-DRC-110: Stale-data comment in `useDeliveryRouteDetail` is tightened to reflect the manual refresh path

`useDeliveryRouteDetail.ts` SHALL keep `keepPreviousData` and `refetchOnWindowFocus: false`. The view SHALL destructure the existing observer's `refetch` and `isFetching`: header refresh forwards to one `refetch()` call, and the view SHALL inspect its result/catch rejection and toast `No se pudo actualizar la ruta` on failure while cached DTO and scroll remain. The composable comment SHALL name mutation invalidation and explicit view-driven manual refresh as freshness sources. There is no `useCockpitManualRefresh`, query-client invalidation wrapper, new key, polling, or focus listener.

#### Scenario: focus refetch remains disabled

- GIVEN the detail view is mounted
- WHEN the window regains focus
- THEN no `GET /delivery-routes/:id` request fires
- AND the rendered data remains the last fetched snapshot

#### Scenario: doc comment names the freshness sources

- GIVEN `useDeliveryRouteDetail.ts` is inspected
- WHEN the doc comment is read
- THEN the comment names "mutation invalidation" and "cockpit manual refresh" as the freshness sources
- AND the comment does not claim polling, focus refetch, push updates, or invalidate/refetch duplication

#### Scenario: manual refresh uses the active observer once

- GIVEN the driver cockpit is mounted
- WHEN header refresh is activated
- THEN `DeliveryRouteDetailView` calls the existing detail observer's `refetch()` exactly once
- AND `isFetching` disables the header while it is in flight
- AND a failed result or rejection toasts `No se pudo actualizar la ruta`
- AND no query-client invalidation or second refetch occurs

### REQ-DRC-111: Mobile-first accessibility for the cockpit (preserved + extended)

The cockpit surface SHALL keep every archived mobile/a11y contract: 44×44px touch targets on the footer current-action control, bottom safe-area padding on the footer, real focusable controls with visible focus rings, and color plus text status. It extends the contract with 44×44px spine nodes and quick actions, drawer focus trap/return, and no-op or instant-cross-fade reduced motion.

#### Scenario: footer action touch target is at least 44px

- GIVEN the cockpit renders with a PENDING current stop
- WHEN the footer current-action mode is inspected on a mobile viewport
- THEN the primary CTA is at least 44px tall

#### Scenario: bottom safe-area padding is honored

- GIVEN a mobile viewport with a notch
- WHEN the cockpit footer renders
- THEN the footer's bottom padding includes `env(safe-area-inset-bottom)`
- AND the cockpit body adds matching bottom padding so the last spine node is not hidden under the bar

#### Scenario: focus rings are visible

- GIVEN the cockpit renders
- WHEN the user tabs through footer controls, spine nodes, and quick-action buttons
- THEN each focusable element shows a visible focus ring
- AND no element relies on color alone to convey state (textual status labels accompany the spine node color and the lifecycle badge)

#### Scenario: reduced motion is respected

- GIVEN `prefers-reduced-motion: reduce` is set
- WHEN the user opens the drawer
- THEN drawer motion becomes a no-op or instant cross-fade
- AND no sliding animation runs

### REQ-DRC-112: Empty / loading / error states for the cockpit composition

`DeliveryRouteDetailView.vue` SHALL continue to own the loading / not-found / error states. The cockpit SHALL only mount once the route resolves successfully. When the route is null because of `403` or `404`, the cockpit MUST NOT mount — the not-found surface replaces it (governed by REQ-DRC-103). When the route resolves with `stops.length === 0`, the cockpit SHALL still mount and render "Sin paradas" + "0/0" + the terminal-state appropriate copy.

#### Scenario: loading state does not mount the cockpit

- GIVEN `useDeliveryRouteDetail.isLoading` is true
- WHEN the detail view renders
- THEN the cockpit does NOT mount
- AND the existing loading skeleton renders

#### Scenario: not-found state replaces the cockpit

- GIVEN the detail query rejects with `403` or `404`
- WHEN the detail view renders
- THEN the not-found full-page state renders
- AND the cockpit does NOT mount

#### Scenario: route with zero stops still mounts the cockpit

- GIVEN a successfully resolved route with `stops: []`
- WHEN the detail view renders
- THEN the cockpit mounts
- AND the header shows "0/0"
- AND the current card shows "Sin parada activa"
- AND the spine region shows "Sin paradas"
- AND the footer renders empty mode (no actionable current stop)

#### Scenario: generic error renders the error block

- GIVEN the detail query rejects with a generic 500 / network error
- WHEN the detail view renders
- THEN the existing detail error block renders without a newly claimed retry/refetch control
- AND the cockpit does NOT mount

## Empty / loading / error states (per view)

| View | Loading | Empty | Error |
| --- | --- | --- | --- |
| Driver list | `DriverRouteCard` skeletons | "No tienes rutas activas en este momento." | error block + retry (Spanish fallback) |
| Driver detail (cockpit) | Parent view renders the loading skeleton; the cockpit is not mounted | Route with `stops: []` → "Sin paradas", "0/0", "Sin parada activa"; the cockpit still mounts | `404`/driver-`403` → full-page "Ruta no encontrada"; other errors → existing detail error block only |
| Cockpit stop drawer | n/a | Required `selectedStopId` — the cockpit never opens the drawer without one | Clipboard / map blocked → toast via REQ-DCK-005 |
| Cockpit history drawer | n/a | "Sin eventos registrados" when `route.timeline.length === 0` | n/a |

## UI Copy (neutral Spanish)

- Driver list empty: "No tienes rutas activas en este momento."
- Check-in success toast: "Entrega registrada"
- Stop status "Pendiente" / "En curso" / "Entregada" / "Omitida"
- Customer fallback: "Cliente sin nombre"
- Not-found full-page: "Ruta no encontrada"
- Timeline labels: "Ruta creada", "Ruta iniciada", "Parada entregada" (+ separate position "Parada N"), "Ruta completada", "Ruta cancelada"
- Cockpit header identity fallback: "Ruta"
- Cockpit refresh aria-label: "Actualizar ruta"
- Confirm modal title / body / confirm / cancel: "Confirmar entrega" / "Entrega para {customer} — Parada {N} ({folio}). Esta acción registra la entrega y no se puede deshacer." / "Confirmar entrega" / "Cancelar"
- History drawer empty: "Sin eventos registrados"

## Notes on prior archived contract

- The archived `REQ-DRC-003` ("Driver detail renders stops in `sortOrder` ASC with customer + formatted address") is SUPERSEDED by the cockpit composition (`driver-cockpit-shell`). The spine renders stops in `sortOrder` order and the stop drawer renders the formatted address, but the equal-card list is no longer the primary presentation.
- The archived `REQ-DRC-006` ("Read-only map renders when coordinates exist; hidden otherwise") is REANCHORED to the cockpit stop drawer. The map gating, marker, popup, and tile-error swallow are unchanged.
- The archived `REQ-DRC-008` ("Mobile-first driver polish") is EXTENDED by `driver-cockpit-shell` REQ-DCS-002/005/006/007 and `driver-cockpit-drawer` REQ-DCK-005/007/008. The 44px minimum, bottom safe-area padding, and visible focus rings are preserved; the contract gains spine-node touch targets, quick-action touch targets, drawer focus trap, and no-op/instant-cross-fade reduced-motion behavior.
