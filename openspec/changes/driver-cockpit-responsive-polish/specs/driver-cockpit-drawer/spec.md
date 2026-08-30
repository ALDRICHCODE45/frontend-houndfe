# Delta for Driver Cockpit Drawer

Delta spec against canonical `openspec/specs/driver-cockpit-drawer/spec.md`.
REQ-DCK-004 (direct timeline reuse), REQ-DCK-005 (quick-action predicates), REQ-DCK-006 (close-before-confirm), REQ-DCK-007 (reduced motion), and REQ-DCK-008 (focus trap/restore) are preserved verbatim and apply to whichever container is active. No REMOVED requirements.

## MODIFIED Requirements

### REQ-DCK-001: One viewport-adaptive cockpit overlay, two modes, explicit native-event adaptation

The cockpit overlay SHALL mount exactly one active container per viewport, controlled by `open` and `mode: 'stop' | 'history'`:

- On `lg+` (viewport ≥ 1024px, Tailwind `lg` boundary, aligned with the app shell) it SHALL be a `USlideover` with `side="right"` and `inset`, matching the `DeliveryRouteUpsertSlideover` precedent.
- Below `lg` it SHALL be the existing `UDrawer direction="bottom"`.

Exactly one container SHALL be mounted at a time; the inactive container MUST NOT be mounted. Stop mode SHALL mount `DriverStopPanel`; history mode SHALL directly mount `DeliveryRouteTimeline`. Switching mode while open SHALL close and reopen instead of swapping trapped content in place, in either container.

Nuxt UI containers do not emit a custom `closed` event; native close/update events begin closure but MUST NOT be interpreted as closure completion. The two containers are deliberately treated differently:

- **Drawer (known contract):** the drawer adapter is known to emit `animationEnd(open: boolean)`; the drawer SHALL synthesize its custom `closed` event only from `animationEnd(false)`. `animationEnd(true)` SHALL mark opening settled and MUST NOT emit `closed`.
- **Slideover (behavioral requirement, unverified event name):** this spec does NOT assert that the installed `USlideover` emits `animationEnd` or any specific settled-closed event. Whatever its installed native lifecycle actually provides, the slideover SHALL emit its custom `closed` event only after its native leave transition has fully settled. The design phase SHALL verify the installed `@nuxt/ui` slideover source/API and name the exact event there; this spec codifies only the behavior, not the event name.

In either container, the custom `closed` event MUST NOT be emitted prematurely (before the native leave transition settles) and MUST NOT be emitted more than once per full close, regardless of the underlying event name. Any slideover opening-settled signal identified in design SHALL mark opening settled and MUST NOT emit `closed`.

(Previously: the canonical requirement mandated a single `UDrawer direction="bottom"` on every viewport; container selection was not viewport-aware.)

#### Scenario: Desktop opens the right slideover

- GIVEN the viewport is ≥ 1024px
- WHEN the driver opens stop detail or history
- THEN a right-side `USlideover` (`side="right"`, `inset`) is the only mounted overlay container
- AND no `UDrawer` portal exists in the DOM

#### Scenario: Mobile keeps the bottom drawer

- GIVEN the viewport is < 1024px
- WHEN the driver opens stop detail or history
- THEN the `UDrawer direction="bottom"` is the only mounted overlay container
- AND no slideover portal exists in the DOM

#### Scenario: Mode switch closes then reopens in the active container

- GIVEN the overlay is open in stop mode on either viewport
- WHEN the driver switches to history
- THEN the active container closes, emits its settled-closed signal, and reopens with the direct timeline content
- AND the custom `closed` event is emitted exactly once per full close

#### Scenario: Custom `closed` is not emitted prematurely

- GIVEN the overlay is open in the active container
- WHEN the native close/update event fires but the settled-closed signal has not
- THEN the custom `closed` event MUST NOT be emitted
- AND when the settled-closed signal fires, `closed` is emitted exactly once

### REQ-DCK-002: Overlay follows accessible header/body containment with single chrome

The active overlay container SHALL have one titled header with exactly one ≥44px close control (`aria-label="Cerrar"`) owned by the overlay header — in both the desktop slideover and the mobile drawer. `DriverStopPanel` MUST NOT render any competing header, title, or close control. Stop title is `Parada N — {customer}`; history title is `Historial de la ruta`. Stop mode content is provided by `DriverStopPanel`; history contains only unchanged timeline content plus the overlay close control.

The body SHALL be independently scrollable and contained within the overlay: the mobile drawer body SHALL remain capped at `85dvh` with dynamic viewport units preventing landscape clipping; the desktop slideover body SHALL scroll within the slideover panel without page-level overflow.

(Previously: containment was defined only for the bottom drawer; the requirement now covers both containers and forbids duplicate header chrome.)

#### Scenario: Exactly one title and one close control

- GIVEN the overlay is open in stop mode on any viewport
- WHEN the overlay header is inspected
- THEN exactly one title `Parada N — {customer}` and exactly one `aria-label="Cerrar"` close control (≥44px) are present
- AND no second header, title, or close control exists anywhere in the overlay subtree

#### Scenario: Body scrolls inside the container

- GIVEN content taller than the visible overlay body
- WHEN the driver scrolls in stop or history mode on mobile
- THEN scrolling happens inside the `85dvh` drawer body without clipping the page
- AND on desktop scrolling happens inside the slideover body without horizontal page overflow

#### Scenario: History mode directly mounts the timeline

- GIVEN the overlay is open in history mode
- WHEN the body is inspected
- THEN `DeliveryRouteTimeline` is the direct mode content with its existing test ids and order

### REQ-DCK-003: `DriverStopPanel` renders stop body only; delivery action lives outside the panel

`DriverStopPanel` SHALL accept `{ stop; routeTerminal; canCheckIn; checkInPending; mapReady }` and SHALL render body content only: stop position/folio, customer fallback, formatted address above any map, and quick actions. It MUST NOT render an internal sticky header, an internal close control, or an inline secondary delivery action — on any viewport. The single delivery entry point for the open overlay SHALL render in the active overlay's footer slot on desktop (`USlideover` `#footer`); on mobile it renders in the cockpit's bottom page footer (governed by `driver-cockpit-shell` REQ-DCS-006). The stop panel body NEVER owns a delivery action.

The delivery action's gating is byte-equivalent to the prior contract: visible only for a PENDING stop on a non-terminal route when `canCheckIn` is true, disabled while `checkInPending`, emitting `request-confirm({ stopId, trigger })` and never mutating. `canCheckIn` is the existing `canUpdate`; read-only drivers inspect but see no delivery action. Route position never gates this action. `AddressMapPicker mode="read"` SHALL mount only after the overlay opening settles (`mapReady`) and both coordinates are finite.

(Previously: the panel owned a close affordance and a secondary `Marcar entregada` action inline in its body on all viewports; both are removed and relocated.)

#### Scenario: Desktop delivery action renders in the overlay footer only

- GIVEN a PENDING stop, non-terminal route, `canCheckIn` true, `checkInPending` false, on a ≥1024px viewport
- WHEN the stop slideover renders
- THEN the `Marcar entregada` action renders in the slideover footer slot and emits `request-confirm` with the selected stop id
- AND no delivery action exists in the stop panel body or the page footer

#### Scenario: Mobile stop panel body has no delivery action

- GIVEN the same gating on a <1024px viewport
- WHEN the stop drawer renders
- THEN the stop panel body contains no `Marcar entregada` action and no close control
- AND the delivery action renders in the cockpit's bottom page footer per REQ-DCS-006

#### Scenario: Gating unchanged for ineligible states

- GIVEN a read-only driver, a terminal route, or a COMPLETED/SKIPPED/IN_PROGRESS stop
- WHEN the overlay renders on any viewport
- THEN no delivery action renders in the overlay footer, the page footer, or the panel body

#### Scenario: Pending mutation disables the action

- GIVEN `checkInPending` is true
- WHEN any delivery action entry point is inspected
- THEN it is disabled and repeat activation emits nothing

#### Scenario: Map mounting preserved

- GIVEN finite coordinates on the selected stop
- WHEN the overlay opening settles
- THEN the read-only map renders below the address in the panel body
- AND missing/non-finite coordinates omit it while the address remains, and tile failure hides the map with no toast

## ADDED Requirements

### REQ-DCK-009: Single breakpoint authority for container selection

The cockpit overlay SHALL derive its container choice from one reactive breakpoint authority reading Tailwind's `lg` boundary (1024px), consistent with the app shell. The overlay's `open`/`mode` state SHALL be owned by the cockpit, not by the container, so that crossing the breakpoint does not lose mode state. Resizing across 1024px SHALL swap to exactly one active container without leaking a second overlay portal and without duplicating modal/scroll-lock ownership.

#### Scenario: Crossing the breakpoint with the overlay open keeps one active container

- GIVEN the overlay is open in stop mode and the viewport crosses 1024px in either direction
- WHEN the breakpoint flag updates
- THEN exactly one container is mounted for the new viewport class
- AND no leftover portal, scroll lock, or focus trap from the previous container remains

#### Scenario: The breakpoint is the same `lg` boundary as the app shell

- GIVEN the overlay container-selection logic is inspected
- WHEN the threshold is read
- THEN it is the Tailwind `lg` boundary (1024px), the same boundary used by the app shell sidebar behavior
- AND no second, divergent breakpoint value exists for cockpit overlay selection
