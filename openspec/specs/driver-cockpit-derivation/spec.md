# Driver Cockpit Derivation Specification

Domain: `driver-cockpit-derivation` · Capability: the pure selector surface that turns a single loaded `DeliveryRouteResponseDto` into the cockpit's derived state — `currentStop`, `nextStop`, `spine[]`, `progress`, `isTerminal`, plus route notes and the route-has-stops flag. It lives in `src/features/delivery-routes/composables/cockpit/useDriverRouteCockpit.ts` and is consumed by `DriverRouteCockpit.vue`. The selector is deterministic, side-effect free, and unit-testable without TanStack Query. The consuming cockpit receives a non-null route because the parent mounts it only after resolution; nullable selector input exists only for the computed adapter and isolated sentinel tests.

## Purpose

The driver cockpit needs four pieces of state that the backend does not return directly: which stop is "current" (presentation-only — the backend does not enforce an order), which stop is "next", how to render the spine, and whether the route is in a terminal lifecycle phase. Deriving this state in a single pure composable keeps every cockpit component free of business logic, makes the selection rule unit-testable in isolation, and prevents later PENDING stops from being silently hidden by a presentation decision. The derivation MUST NOT call `useQuery`, MUST NOT mutate state, and MUST NOT branch on user intent.

## Requirements

### REQ-DCD-001: Current stop is the first `IN_PROGRESS`, else the first `PENDING`, else `null` — unless the route is terminal

For a non-terminal route (`DRAFT` or `ACTIVE`), the selector SHALL return `currentStop` by scanning `route.stops` in `sortOrder` ASC and returning the first stop whose `status === 'IN_PROGRESS'`; if none is `IN_PROGRESS`, it SHALL return the first stop whose `status === 'PENDING'`; if neither is present, it SHALL return `null`. For a terminal route (`COMPLETED` or `CANCELLED`), the selector SHALL return `currentStop === null` regardless of any residual `PENDING` or `IN_PROGRESS` stops. The selection rule SHALL be the only definition of "current" used by the cockpit — components MUST NOT re-derive it.

#### Scenario: `IN_PROGRESS` stop wins over earlier `PENDING` stops

- GIVEN a route with stops in `sortOrder` order `[PENDING (idx 0), IN_PROGRESS (idx 1), PENDING (idx 2)]`
- WHEN the selector runs
- THEN `currentStop.id` equals the `IN_PROGRESS` stop's id
- AND `currentStop` is NOT the first `PENDING` stop

#### Scenario: `PENDING` stop is current when no `IN_PROGRESS` exists

- GIVEN a route with stops `[PENDING (idx 0), COMPLETED (idx 1), PENDING (idx 2)]`
- WHEN the selector runs
- THEN `currentStop.id` equals the `sortOrder: 0` stop's id
- AND `currentStop.status === 'PENDING'`

#### Scenario: completed route returns `null`

- GIVEN a route with `status: 'COMPLETED'` whose stops may include `COMPLETED` or `SKIPPED`
- WHEN the selector runs
- THEN `currentStop === null`
- AND `nextStop === null`
- AND `progress.completed` counts only the `COMPLETED` stops while `progress.total` counts all stops

#### Scenario: cancelled route returns `null` current and `null` next

- GIVEN a route with `status: 'CANCELLED'` and any combination of stops
- WHEN the selector runs
- THEN `currentStop === null`
- AND `nextStop === null`

#### Scenario: terminal route with residual PENDING stops returns `null` current and `null` next

- GIVEN a route with `status: 'COMPLETED'` and stops `[COMPLETED (idx 0), PENDING (idx 1)]` (a residual PENDING stop)
- WHEN the selector runs
- THEN `currentStop === null`
- AND `nextStop === null`
- AND the residual PENDING stop is NOT surfaced as current or next

#### Scenario: empty stops array returns `null`

- GIVEN a route with `stops: []`
- WHEN the selector runs
- THEN `currentStop === null`
- AND `nextStop === null`
- AND `progress.completed === 0` AND `progress.total === 0`

### REQ-DCD-002: `nextStop` is the first actionable `PENDING` relative to `currentStop`; terminal routes yield `null`

The selector SHALL return `nextStop` by these rules, applied in order:

- If the route is terminal (`COMPLETED` or `CANCELLED`), `nextStop` SHALL be `null` regardless of any residual `PENDING` stops.
- If the route is non-terminal and `currentStop.status === 'PENDING'`, `nextStop` SHALL be the first `PENDING` stop strictly after `currentStop` in `sortOrder` ASC.
- If the route is non-terminal and `currentStop.status === 'IN_PROGRESS'`, `nextStop` SHALL be the first `PENDING` stop other than `currentStop` in `sortOrder` ASC — including an earlier residual `PENDING` stop.
- Otherwise (no stops, or no `PENDING` stop satisfies the rule), `nextStop` SHALL be `null`.

The selector MUST NOT consider `IN_PROGRESS` as `next` — that stop is `current`. The spine (REQ-DCD-003) continues to render every stop in backend `sortOrder` order regardless of the `nextStop` choice; `nextStop` only drives the preview copy.

#### Scenario: next stop picks the first later PENDING when current is PENDING

- GIVEN a non-terminal route with stops `[PENDING (idx 0), PENDING (idx 1), COMPLETED (idx 2)]` and `currentStop` is the `idx 0` stop
- WHEN the selector runs
- THEN `nextStop.id` equals the `idx 1` stop's id

#### Scenario: current IN_PROGRESS with an earlier residual PENDING yields that residual as next

- GIVEN a non-terminal route with stops `[PENDING (idx 0), IN_PROGRESS (idx 1), PENDING (idx 2)]` and `currentStop` is the `IN_PROGRESS` stop
- WHEN the selector runs
- THEN `nextStop.id` equals the `idx 0` stop's id (the first PENDING other than current in backend order)
- AND all three stops still render in the spine in backend order

#### Scenario: current IN_PROGRESS with only later PENDING yields the later PENDING as next

- GIVEN a non-terminal route with stops `[COMPLETED (idx 0), IN_PROGRESS (idx 1), PENDING (idx 2)]` and `currentStop` is the `IN_PROGRESS` stop
- WHEN the selector runs
- THEN `nextStop.id` equals the `idx 2` stop's id

#### Scenario: next stop is null when the current is the last PENDING

- GIVEN a non-terminal route with stops `[COMPLETED (idx 0), PENDING (idx 1)]` and `currentStop` is the `idx 1` stop
- WHEN the selector runs
- THEN `nextStop === null`

#### Scenario: all-PENDING route yields the first PENDING as current and the second as next

- GIVEN a route with `status: 'ACTIVE'`, `stops: [PENDING, PENDING, PENDING]`, and no `IN_PROGRESS`
- WHEN the selector runs
- THEN `currentStop.id` equals the first stop's id (REQ-DCD-001)
- AND `nextStop.id` equals the second stop's id (first PENDING strictly after `sortOrder: 0`)

#### Scenario: terminal route with residual PENDING yields null next

- GIVEN a route with `status: 'CANCELLED'` and stops `[COMPLETED, PENDING, PENDING]`
- WHEN the selector runs
- THEN `nextStop === null`
- AND `currentStop === null` (per REQ-DCD-001)

### REQ-DCD-003: `spine` is the full ordered stop list with derived state for each node

The selector SHALL return `spine` as an array with the same length as `route.stops` and the same `sortOrder` order. Each entry SHALL carry the original stop plus derived fields:
- `nodeState ∈ {'completed' | 'current' | 'upcoming' | 'skipped'}` — `'completed'` when the stop is `COMPLETED`; `'skipped'` when the stop is `SKIPPED`; `'current'` when `stop.id === currentStop?.id`; otherwise `'upcoming'`.
- `isCurrent: boolean` — `true` iff `nodeState === 'current'`.
- `isSelectable: boolean` — `true` for every entry (the cockpit uses the spine to open any stop in the drawer; visual priority never disables navigation).

The selector MUST NOT exclude `SKIPPED` stops from the spine (the driver still needs to read them in history); MUST NOT include phantom stops; MUST NOT re-sort. Exactly one entry SHALL carry `nodeState === 'current'` when `currentStop` is non-null; when `currentStop` is `null`, no entry SHALL be `'current'`.

#### Scenario: spine preserves backend order and length

- GIVEN a route with `stops.length === 5`
- WHEN the selector runs
- THEN `spine.length === 5`
- AND `spine[i].stop.sortOrder === route.stops[i].sortOrder` for every `i`

#### Scenario: each spine node carries a nodeState derived from the stop status

- GIVEN a route with `[COMPLETED, PENDING, SKIPPED, IN_PROGRESS, PENDING]`
- WHEN the selector runs
- THEN `spine[0].nodeState === 'completed'`
- AND `spine[1].nodeState === 'upcoming'` (a PENDING stop, but the IN_PROGRESS at idx 3 wins as current per REQ-DCD-001 — the earlier PENDING stays upcoming/actionable, never current)
- AND `spine[2].nodeState === 'skipped'`
- AND `spine[3].nodeState === 'current'` (the first IN_PROGRESS is current)
- AND `spine[4].nodeState === 'upcoming'`
- AND exactly one node has `nodeState === 'current'`

#### Scenario: every spine node is selectable

- GIVEN a route with mixed `COMPLETED`/`PENDING`/`SKIPPED` stops
- WHEN the selector runs
- THEN `spine.every(node => node.isSelectable === true)` is true

#### Scenario: SKIPPED stops remain in the spine and remain selectable

- GIVEN a route with a `SKIPPED` stop in the middle of the order
- WHEN the selector runs
- THEN that stop's entry is present in `spine`
- AND its `nodeState === 'skipped'`
- AND its `isSelectable === true`

### REQ-DCD-004: `progress` is `{ completed, total }` over every stop regardless of status

The selector SHALL return `progress = { completed, total }` where `total = route.stops.length` and `completed = route.stops.filter(s => s.status === 'COMPLETED').length`. `SKIPPED`, `IN_PROGRESS`, and `PENDING` stops MUST NOT count as completed. The shape MUST be a plain object (not a `ref` or `computed`) so `DriverCockpitHeader.vue` can destructure it without `.value`.

#### Scenario: progress counts only COMPLETED

- GIVEN a route with `[COMPLETED, PENDING, COMPLETED, SKIPPED, IN_PROGRESS]`
- WHEN the selector runs
- THEN `progress.completed === 2`
- AND `progress.total === 5`

#### Scenario: empty route yields zero progress

- GIVEN a route with `stops: []`
- WHEN the selector runs
- THEN `progress.completed === 0`
- AND `progress.total === 0`

#### Scenario: SKIPPED stops do not inflate the completed count

- GIVEN a route with `[COMPLETED, SKIPPED, COMPLETED]`
- WHEN the selector runs
- THEN `progress.completed === 2`
- AND `progress.total === 3`

### REQ-DCD-005: `isTerminal` is `true` exactly when the route is `COMPLETED` or `CANCELLED`

The selector SHALL return `isTerminal: boolean` where `isTerminal === true` iff `route.status === 'COMPLETED' || route.status === 'CANCELLED'`. `DRAFT` and `ACTIVE` SHALL yield `isTerminal === false`. The cockpit uses `isTerminal` to select `DriverCockpitFooter` terminal mode instead of current-action, IN_PROGRESS, or empty mode.

#### Scenario: ACTIVE route is not terminal

- GIVEN a route with `status: 'ACTIVE'`
- WHEN the selector runs
- THEN `isTerminal === false`

#### Scenario: COMPLETED route is terminal

- GIVEN a route with `status: 'COMPLETED'`
- WHEN the selector runs
- THEN `isTerminal === true`

#### Scenario: CANCELLED route is terminal

- GIVEN a route with `status: 'CANCELLED'`
- WHEN the selector runs
- THEN `isTerminal === true`

#### Scenario: DRAFT route is not terminal

- GIVEN a route with `status: 'DRAFT'`
- WHEN the selector runs
- THEN `isTerminal === false`

### REQ-DCD-006: Selector returns a stable shape, is deterministic, and has no side effects

The selector SHALL accept a single `DeliveryRouteResponseDto` argument (or `Ref<DeliveryRouteResponseDto | null>` exposed via `computed`) and SHALL return a single object with the keys `currentStop`, `nextStop`, `spine`, `progress`, `isTerminal`, `hasStops`, and `notes`. `hasStops === true` iff `route.stops.length > 0`. `notes === route.notes ?? null`. Calling the selector twice with the same input SHALL return deep-equal objects. The selector SHALL NOT call `useQuery`, `useMutation`, `useQueryClient`, `localStorage`, `window`, `document`, or any I/O channel.

#### Scenario: stable shape across repeated calls

- GIVEN a fully populated `DeliveryRouteResponseDto`
- WHEN the selector is invoked twice with the same input
- THEN both returns are deep-equal (same `currentStop.id`, same `spine.length`, same `progress`)

#### Scenario: notes expose route-level notes or null

- GIVEN a route with `notes: 'Entregar en puerta trasera'`
- WHEN the selector runs
- THEN `notes === 'Entregar en puerta trasera'`

- GIVEN a route with `notes: null` or `notes` absent
- WHEN the selector runs
- THEN `notes === null`

#### Scenario: hasStops reflects whether any stop exists

- GIVEN an empty route (`stops: []`)
- WHEN the selector runs
- THEN `hasStops === false`

- GIVEN a route with at least one stop
- WHEN the selector runs
- THEN `hasStops === true`

#### Scenario: selector is side-effect free

- GIVEN any `DeliveryRouteResponseDto`
- WHEN the selector is invoked inside a `computed` that is read 100 times
- THEN no network request fires
- AND no `console` log is produced
- AND no `localStorage` write occurs

### REQ-DCD-007: Selector tolerates null and missing fields without throwing

The selector SHALL treat `customer === null`, `shippingAddress === null`, `latitude/longitude === null`, `notes === null`, `completedAt === null`, `checkedInAt === null`, and `saleFolio === null` as valid inputs and SHALL NOT throw. The selector MUST NOT replace null fields with synthetic placeholders — components are responsible for fallback copy (e.g. "Cliente sin nombre").

#### Scenario: every stop field may be null

- GIVEN a stop with `customer: null`, `shippingAddress: null`, `saleFolio: null`, `checkedInAt: null`, `completedAt: null`
- WHEN the selector runs
- THEN the spine entry carries the same null fields verbatim
- AND no exception is thrown

#### Scenario: route with null driver name does not block derivation

- GIVEN a route with `driver: null` or missing driver fields
- WHEN the selector runs
- THEN the selector returns a valid object
- AND `currentStop`, `nextStop`, `spine`, `progress`, and `isTerminal` are still defined

### REQ-DCD-008: Selector does not enforce route order — later `PENDING` stops stay reachable

The selector SHALL NOT mark a `PENDING` stop as "blocked", "locked", or "disabled" because a later `PENDING` stop is selected or highlighted. Every `PENDING` stop in the spine SHALL remain `isSelectable: true` and SHALL NOT be filtered out of `nextStop` candidates because an earlier `PENDING` exists. The selection rule is purely visual priority; the backend does not enforce order, and the UI MUST NOT impose order on its own.

#### Scenario: visual current does not lock later PENDING stops

- GIVEN a route with `[PENDING (idx 0), PENDING (idx 1), PENDING (idx 2)]`
- WHEN the selector runs
- THEN `spine[1].isSelectable === true`
- AND `spine[2].isSelectable === true`
- AND `spine[1].nodeState !== 'current'`
- AND `spine[2].nodeState !== 'current'`

#### Scenario: opening any PENDING stop via the spine is allowed

- GIVEN any `PENDING` stop in the spine
- WHEN a cockpit component reads that stop's entry
- THEN the entry exposes `isSelectable: true` and no field reports a locked state

## Empty / loading / error states (per selector)

| Selector state | Behavior |
| --- | --- |
| Input route is `null` | Selector SHALL return a "no route" sentinel: `currentStop === null`, `nextStop === null`, `spine === []`, `progress === { completed: 0, total: 0 }`, `isTerminal === false`, `hasStops === false`, `notes === null`. This nullable input is for the computed adapter and isolated tests; `DriverRouteCockpit.route` is non-null and the parent owns loading/not-found/error states. |
| Stale DTO for a different route id | The selector SHALL run on whatever DTO it is given. The `DeliveryRouteDetailView` already guards stale `keepPreviousData` by checking the returned route id (REQ from the archived `delivery-route-check-in`); the selector inherits that guard and does not duplicate it. |

## UI Copy (neutral Spanish)

The selector returns data only; copy is owned by consuming sections. `DriverCockpitHeader.vue` renders `Ruta` when `route.driver?.name` is null and the progress fraction as `"{completed}/{total}"`. The current section of `DriverOperationalStops.vue` renders `Cliente sin nombre` when `currentStop?.customer?.name` is null. Its next-preview section renders `Última parada` when `nextStop === null && hasStops && !isTerminal`, `No hay más pendientes` when `nextStop === null && isTerminal`, and no fabricated stop when the route is empty.
