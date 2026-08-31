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
- GIVEN the cockpit is inside the dashboard panel, THEN its root composes inside the detail-view wrapper gutter with panel scrolling, and introduces no fixed element.

### REQ-DCS-002: Sticky header renders identity, lifecycle, progress, history, refresh, and back with safe narrow-width composition

`DriverCockpitHeader` SHALL render a sticky panel-contained header with back, route identity (`route.driver?.name ?? 'Ruta'`), existing lifecycle badge/labels, `completed/total`, history, and refresh controls. Back SHALL emit; it SHALL not push the router. Refresh follows REQ-DCS-007. Controls SHALL not force horizontal scrolling at 320px, SHALL be at least 44×44px when interactive, and SHALL wrap into deliberate groups without cramped overlap at 320–373px.

The route identity SHALL NOT be destructively or prematurely truncated at 320–373px: the driver name or `Ruta` fallback SHALL remain readable at those widths, truncating only when the full header layout is genuinely exhausted, and never down to a meaningless fragment (e.g. `Re`). Header content MUST NOT cause horizontal overflow at 320px.

(Previously: identity and control composition were unspecified below 373px; real usage truncated the identity to fragments and cramped the controls.)

#### Scenario: Full identity at 373px

- GIVEN a driver named with a long name (e.g. more than 8 characters) on a 373px viewport
- WHEN the cockpit header renders
- THEN the identity is readable without collapsing to a one-or-two-character fragment
- AND the lifecycle badge, progress counter, history, and refresh controls remain present and reachable

#### Scenario: No horizontal overflow at 320px

- GIVEN a 320px viewport
- WHEN the header renders with all controls
- THEN no horizontal page or panel scroll is introduced by the header
- AND controls wrap within the header instead of overflowing

#### Scenario: Preserved header behavior

- GIVEN a null driver name, `{ completed: 2, total: 5 }`, a back press, or a panel scroll
- WHEN the header renders or is interacted with
- THEN it shows `Ruta` without an empty line, renders `2/5`, emits back once without router push, and stays inside the panel below the global navbar

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

### REQ-DCS-006: `DriverCockpitFooter` modes remain exclusive and gated; primary action placement is viewport-composed with additive safe-area padding

For a non-terminal route with current PENDING, the footer SHALL render one sticky primary `Marcar entregada` action targeting only that current stop. It SHALL emit `request-confirm({ stopId, trigger })`; it SHALL not mutate. The action is visible only when `canCheckIn` is true and disabled while `checkInPending` is true. `canCheckIn` SHALL equal the view's existing `canUpdate` permission. This gating is byte-equivalent across viewports.

Exactly one primary delivery action SHALL be visible per active viewport/context:

- Below `lg` (< 1024px): the action renders in the cockpit's bottom page footer, prominent and bottom-aligned.
- On `lg+` (≥ 1024px): the action renders in the open stop overlay's footer slot (governed by `driver-cockpit-drawer` REQ-DCK-003); the page footer's current-action mode MUST NOT render a competing primary delivery action on `lg+`.

For current IN_PROGRESS, the footer SHALL render the specified disabled IN_PROGRESS mode and emit nothing. Other non-actionable current states use empty mode.

The footer's bottom padding SHALL be additive with respect to the safe-area inset: the base bottom spacing SHALL be preserved even when `env(safe-area-inset-bottom)` is 0, and the inset SHALL be added or otherwise chosen to be sufficient when nonzero. The footer padding MUST NOT collapse the ordinary bottom padding to 0 on devices without a safe-area inset, and the cockpit body SHALL retain matching clearance so the last content is never hidden under the footer.

(Previously: the footer rendered the primary action on all viewports while the stop panel duplicated it inline, and safe-area padding could override ordinary bottom padding with a 0 inset.)

#### Scenario: Mobile keeps the single page-footer action

- GIVEN a non-terminal route with a PENDING current stop, `canCheckIn` true, `checkInPending` false, on a <1024px viewport
- WHEN the cockpit renders
- THEN one enabled ≥44px `Marcar entregada` action renders in the bottom page footer and emits the current stop id
- AND no duplicate delivery action exists in the page footer, the drawer body, or the drawer header

#### Scenario: Desktop page footer does not compete with the slideover footer action

- GIVEN the same gating on a ≥1024px viewport
- WHEN the cockpit renders with the stop slideover open
- THEN the `Marcar entregada` action renders in the slideover footer
- AND the page footer's current-action mode presents no primary delivery action

#### Scenario: Additive safe-area padding survives a zero inset

- GIVEN a viewport with `env(safe-area-inset-bottom)` = 0
- WHEN the footer renders
- THEN the footer's bottom padding is at least the base bottom spacing (not 0)
- AND when the inset is nonzero the effective bottom padding includes it without reducing the base spacing

#### Scenario: Preserved gating and modes

- GIVEN `checkInPending` true, a read-only driver, an IN_PROGRESS current stop, or a non-actionable current state
- WHEN the footer renders on any viewport
- THEN the action is disabled with no repeat emission, absent for read-only drivers (inspect/history controls retained), the IN_PROGRESS mode renders disabled and emits nothing, and empty mode renders otherwise

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

### REQ-DCS-011: One horizontal gutter authority across cockpit sections

The driver branch's detail-view wrapper (`DeliveryRouteDetailView`) is the single horizontal gutter authority for the cockpit composition. `cockpit-body` and child sections (`DriverOperationalStops`, `DriverRouteSpine`, and other cockpit body sections) MUST NOT add competing horizontal padding. Nested sections SHALL present consistent horizontal padding derived from the wrapper's gutter across 320–1024px. Nested sections MUST NOT add divergent horizontal padding that produces visibly misaligned edges between the operational-stops card and the spine at the same viewport width.

#### Scenario: Operational stops and spine share aligned edges

- GIVEN the cockpit renders on a 320px, 373px, or 768px viewport
- WHEN the left and right edges of the operational-stops content and the spine content are compared
- THEN they align within the wrapper gutter with no mismatched nested padding
- AND no horizontal overflow is introduced by either section

#### Scenario: Gutter authority is single-sourced

- GIVEN the cockpit body composition is inspected
- WHEN horizontal padding for `DriverOperationalStops` and `DriverRouteSpine` is traced
- THEN both derive from the driver branch detail-view wrapper's single gutter, not from `cockpit-body` or any child section declaring independent padding values

### REQ-DCS-012: Spine and header content avoid premature truncation at narrow widths

`DriverRouteSpine` node labels and other cockpit body text SHALL remain readable at narrow widths (down to 320px): text SHALL ellipsize only when actually constrained by its container, MUST NOT truncate prematurely while space remains, and MUST NOT cause horizontal overflow. Stop status remains conveyed by the existing textual labels, preserving REQ-DCS-005's color-plus-text rule.

#### Scenario: Spine label readable at 320px

- GIVEN a spine node whose customer label is long (e.g. more than 12 characters) on a 320px viewport
- WHEN the spine renders
- THEN the label is not truncated to a meaningless fragment while its container has remaining space
- AND if ellipsis applies, it fires only at actual overflow and never introduces horizontal scroll

#### Scenario: Premature truncation regression is closed

- GIVEN the previously observed defect where spine text truncated at typical mobile widths
- WHEN the spine renders at 373px with realistic stop names
- THEN stop names render without the premature ellipsis evidenced at that width

## State and copy matrix

| State               | Owner / behavior                                                       |
| ------------------- | ---------------------------------------------------------------------- |
| Initial loading     | Existing view skeleton; cockpit absent                                 |
| Stale id            | Existing id guard; stale cockpit absent                                |
| 403/404 driver      | Existing `Ruta no encontrada`; cockpit absent                          |
| Generic query error | Existing detail error block only; cockpit absent                       |
| Zero stops          | `0/0`, `Sin parada activa`, `Sin paradas`, footer empty mode           |
| Check-in pending    | Footer and stop-panel delivery actions disabled                        |
| Check-in settlement | Existing mutation composable owns success/error toast and invalidation |
| Refresh failure     | View toast `No se pudo actualizar la ruta`; cached DTO/scroll retained |

Canonical shell copy remains: `Ruta`, `Actualizar ruta`, `Notas de la ruta`, `Sin parada activa`, `Cliente sin nombre`, `Siguiente · Parada N`, `Última parada`, `No hay más pendientes`, existing stop labels, `Marcar entregada`, terminal copy above, and `Ver historial`.
