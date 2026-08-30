# Driver Cockpit Shell Specification

Domain: `driver-cockpit-shell` · Capability: the visible driver cockpit composed by exactly these shell SFCs: `DriverRouteCockpit`, `DriverCockpitHeader`, `DriverOperationalStops`, `DriverRouteSpine`, and `DriverCockpitFooter`; the shared drawer adds `DriverCockpitDrawer` and `DriverStopPanel`, yielding the seven-SFC design. `DriverOperationalStops` owns current and next sections. `DriverCockpitFooter` owns mutually exclusive current-action, IN_PROGRESS, terminal, and empty modes.

## Purpose

Replace the equal-weight driver stop-card stack with a mobile-first operating hierarchy while preserving the existing route path, role/privacy gates, manager branch, query observer, mutation contract, and list behavior. The cockpit receives a resolved route and remains presentational regarding server state.

## Requirements

### REQ-DCS-001: `DriverRouteCockpit` composes a non-null loaded DTO without server-state ownership

`DriverRouteCockpit.vue` SHALL accept `{ route: DeliveryRouteResponseDto; isFetching: boolean; canCheckIn: boolean; checkInPending: boolean }`. `route` is non-null because `DeliveryRouteDetailView` SHALL mount the cockpit only after a matching DTO resolves. The cockpit and every child MUST NOT call `useQuery`, `useMutation`, `useQueryClient`, or HTTP code.

The cockpit SHALL own only local UI state: selected stop id, drawer mode/phase, pending confirmation stop id, and focus-return element. It SHALL NOT duplicate the route DTO, query state, or mutation state. DOM order SHALL be header, `DriverOperationalStops` (current then next sections), spine, and footer; the one drawer and sibling confirmation modal are overlay surfaces.

On accepted confirmation, the cockpit SHALL close `ConfirmModal` and emit `request-check-in(stopId)` exactly once. It SHALL NOT invoke the mutation itself and SHALL NOT emit any duplicate/dead check-in event.

#### Scenarios

- GIVEN a resolved route, WHEN the cockpit mounts, THEN all shell regions derive from that prop and no loading skeleton renders.
- GIVEN the cockpit is inspected, THEN no query/mutation/query-client/HTTP import or call exists and local state is limited to selection, drawer phase/mode, pending confirmation, and focus return.
- GIVEN confirmation is accepted once, THEN the modal closes and exactly one `request-check-in` event with the selected stop id is emitted.
- GIVEN the cockpit is inside the dashboard panel, THEN its root uses the existing full-bleed offset and panel scrolling, and introduces no fixed element.

### REQ-DCS-002: Sticky header renders identity, lifecycle, progress, history, refresh, and back

`DriverCockpitHeader` SHALL render a sticky panel-contained header with back, route identity (`route.driver?.name ?? 'Ruta'`), existing lifecycle badge/labels, `completed/total`, history, and refresh controls. Back SHALL emit; it SHALL not push the router. Refresh follows REQ-DCS-007. Controls SHALL not force horizontal scrolling at 320px and SHALL be at least 44×44px when interactive.

#### Scenarios

- Null driver name shows `Ruta` without an empty line.
- `{ completed: 2, total: 5 }` renders `2/5`.
- Back emits once and parent navigation handles it.
- Scrolling the panel keeps the header inside the panel, below the global navbar.

### REQ-DCS-003: `DriverOperationalStops` owns the current-card section

The current section SHALL render the derived current stop or `Sin parada activa`. When present it SHALL show stop position and optional folio, `EntityAvatar`, customer (`Cliente sin nombre` fallback), formatted address when present, and route notes only when present under `Notas de la ruta`. PENDING current uses the locked gold emphasis; IN_PROGRESS uses navy; other states are muted. Tapping a details affordance SHALL emit `open-stop({ stopId, trigger })`.

#### Scenarios

- A PENDING current stop uses gold emphasis; IN_PROGRESS uses navy.
- Null current renders `Sin parada activa` without customer/address decoration.
- Null customer uses the stop id avatar seed and `Cliente sin nombre`.
- Null address and null notes omit their rows without stray punctuation.
- Opening details emits the stop id and originating element.

### REQ-DCS-004: `DriverOperationalStops` owns the next-preview section

The next section SHALL render the derived next PENDING stop as lower emphasis with `Siguiente · Parada N`, customer fallback, and formatted address. It SHALL emit `open-stop({ stopId, trigger })`. It SHALL render no map, ETA, or distance. Null next with non-terminal stops shows `Última parada`; terminal shows `No hay más pendientes`; empty routes leave no fabricated next stop.

#### Scenarios

- A next stop shows position/customer/address and no ETA, distance, or map.
- Null next on non-terminal non-empty route shows `Última parada`.
- Null next on terminal route shows `No hay más pendientes`.
- Selection emits the stop id and originating element.

### REQ-DCS-005: `DriverRouteSpine` renders every stop as an accessible ordered sequence

The spine SHALL render one node per derived entry in backend order without re-sorting. Each node SHALL use a real button in ordered-list structure, existing textual stop-status labels, a descriptive `aria-label`, visible focus ring, minimum 44×44px target, and a connector. State MUST NOT rely on color alone. Every node, including SKIPPED and non-current PENDING, SHALL remain selectable and emit `select-stop({ stopId, trigger })`.

#### Scenarios

- Five input nodes render five nodes in the same order with textual status.
- Stop 3 PENDING for Ana has an equivalent accessible label `Parada 3: Pendiente — Ana`.
- Enter/Space activates the focused node and emits once.
- SKIPPED and later PENDING nodes remain visible/selectable and have no locked state.

### REQ-DCS-006: `DriverCockpitFooter` current-action and IN_PROGRESS modes are exclusive and gated

For a non-terminal route with current PENDING, the footer SHALL render one sticky primary `Marcar entregada` action targeting only that current stop. It SHALL emit `request-confirm({ stopId, trigger })`; it SHALL not mutate. The action is visible only when `canCheckIn` is true and disabled while `checkInPending` is true. `canCheckIn` SHALL equal the view's existing `canUpdate` permission.

For current IN_PROGRESS, the footer SHALL render the specified disabled IN_PROGRESS mode and emit nothing. It SHALL add safe-area padding and the body SHALL add matching clearance. Other non-actionable current states use empty mode.

#### Scenarios

- PENDING + `canCheckIn` + not pending renders an enabled ≥44px action and emits the current id.
- `checkInPending` disables the action and repeated clicks emit nothing.
- Read-only driver (`canCheckIn=false`) sees no delivery action but retains inspect/history controls.
- IN_PROGRESS renders one disabled mode; null/non-actionable current renders empty mode.

### REQ-DCS-007: Manual refresh uses the existing detail observer exactly once

The header SHALL emit `refresh`; cockpit SHALL forward it. `DeliveryRouteDetailView` SHALL handle it by invoking the existing `useDeliveryRouteDetail` observer's `refetch()` once and SHALL pass its `isFetching` to disable the header button.

The view handler SHALL inspect the resolved refetch result and catch rejection. A reported or thrown failure SHALL use existing `useToast()` with exact copy `No se pudo actualizar la ruta`; cached DTO and panel scroll SHALL remain. Success SHALL produce no extra toast.

There SHALL be no `useCockpitManualRefresh.ts`, `useQueryClient`, invalidate/refetch pair, `refetchQueries`, new query key, polling, interval, timeout, focus listener, invalidation wrapper, or duplicate request.

#### Scenarios

- One refresh click invokes the active observer's `refetch()` exactly once and touches no query key directly.
- `isFetching=true` disables refresh and click emits nothing.
- Idle time and window focus issue no automatic detail request.
- Successful refresh preserves scroll and emits no toast.
- Rejected or error-result refresh preserves cached DTO/scroll and toasts `No se pudo actualizar la ruta`.

### REQ-DCS-008: `DriverCockpitFooter` terminal mode replaces action modes

For `COMPLETED` or `CANCELLED`, the footer SHALL render terminal mode with existing lifecycle presentation, summary copy, and `Ver historial`; it SHALL render no delivery action. COMPLETED copy is `Ruta completada` / `Entregaste {completed} de {total} paradas.`; CANCELLED copy is `Ruta cancelada` / `Esta ruta fue cancelada.` The spine remains selectable/read-only for mutation purposes.

#### Scenarios

- COMPLETED renders completion summary and no delivery control.
- CANCELLED renders cancellation summary and no delivery control.
- `Ver historial` emits with its trigger and opens drawer history mode.
- Terminal routes keep all spine nodes inspectable.

### REQ-DCS-009: Visual priority does not enforce route order

Every non-terminal PENDING stop remains reachable. A selected PENDING stop in `DriverStopPanel` SHALL expose the secondary delivery action when `canCheckIn` and not `checkInPending`; route position MUST NOT hide or disable it. The action closes the drawer before confirmation as specified by REQ-DCK-006. Terminal, non-PENDING, read-only, or mutation-pending conditions gate the action; route order does not.

#### Scenarios

- A later PENDING spine node opens full stop details without locked copy.
- A non-current PENDING exposes the secondary action and confirms that selected id.
- During `checkInPending`, both current footer and non-current drawer entry points are disabled and emit no new request.
- Read-only drivers inspect later PENDING stops but see no delivery actions.

### REQ-DCS-010: Manager branch and driver list remain unchanged

Only the driver-success branch of `DeliveryRouteDetailView` changes. Manager controls/error mapping, driver list, route path, guard, sidebar, existing detail key, mutation endpoint, success/error toasts, and invalidations SHALL remain unchanged. Generic detail errors preserve the existing error block only; this change MUST NOT claim or add a retry/refetch control.

#### Scenarios

- Manager detail mounts none of the seven cockpit SFCs and existing controls remain.
- Driver list issues its existing request once and mounts no cockpit component.
- Accepted cockpit check-in reaches the view's one mutation instance, posts with no body, and existing composable owns toast/invalidation.
- Generic query failure renders the existing detail error block without a newly invented retry control.

## State and copy matrix

| State | Owner / behavior |
| --- | --- |
| Initial loading | Existing view skeleton; cockpit absent |
| Stale id | Existing id guard; stale cockpit absent |
| 403/404 driver | Existing `Ruta no encontrada`; cockpit absent |
| Generic query error | Existing detail error block only; cockpit absent |
| Zero stops | `0/0`, `Sin parada activa`, `Sin paradas`, footer empty mode |
| Check-in pending | Footer and stop-panel delivery actions disabled |
| Check-in settlement | Existing mutation composable owns success/error toast and invalidation |
| Refresh failure | View toast `No se pudo actualizar la ruta`; cached DTO/scroll retained |

Canonical shell copy remains: `Ruta`, `Actualizar ruta`, `Notas de la ruta`, `Sin parada activa`, `Cliente sin nombre`, `Siguiente · Parada N`, `Última parada`, `No hay más pendientes`, existing stop labels, `Marcar entregada`, terminal copy above, and `Ver historial`.
