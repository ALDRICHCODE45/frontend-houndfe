# Driver Cockpit Drawer Specification

Domain: `driver-cockpit-drawer` · Capability: one `DriverCockpitDrawer.vue` bottom drawer with `stop` and `history` modes. Stop mode renders `DriverStopPanel.vue`; history mode directly renders the existing `DeliveryRouteTimeline.vue`. No separate stop-sheet or history-sheet SFC exists.

## Purpose

Provide inspectable stop detail and route history without stacking overlays. One Nuxt UI v4 `UDrawer` owns modal/focus/scroll-lock behavior. It closes fully before sibling `ConfirmModal` opens. Quick actions remain truthful and synchronous in visibility gating.

## Requirements

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

`DriverStopPanel` SHALL accept the minimal body-only contract `{ stop; mapReady }` and SHALL render body content only: stop position/folio, customer fallback, formatted address above any map, and quick actions. It MUST NOT render an internal sticky header, an internal close control, or an inline secondary delivery action — on any viewport. The stop panel body NEVER owns a delivery action.

The single delivery entry point for the open overlay SHALL render in the active overlay's footer slot on desktop (`USlideover` `#footer`); on mobile it renders in the cockpit's bottom page footer (governed by `driver-cockpit-shell` REQ-DCS-006). Delivery-action permission gating (`canCheckIn` / `checkInPending` / `routeTerminal`) and the `request-confirm` emission belong to the overlay/footer composition, not to the body panel. `AddressMapPicker mode="read"` SHALL mount only after the overlay opening settles (`mapReady`) and both coordinates are finite.

(Previously: the spec mandated a five-prop panel contract `{ stop; routeTerminal; canCheckIn; checkInPending; mapReady }`; the panel also owned a close affordance and an inline secondary `Marcar entregada` action on all viewports. The approved body-only contract `{ stop; mapReady }` supersedes that normative clause per the S3 design decision. Permission/pending/terminal gating now belongs to the overlay footer, not the body panel.)

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

### REQ-DCK-004: History mode directly reuses the existing timeline

History mode SHALL mount `DeliveryRouteTimeline` directly, without a `DriverRouteHistorySheet` wrapper and without modification. It SHALL preserve backend order, all five existing labels, separate STOP_CHECKED_IN position, actor behavior, empty copy `Sin eventos registrados`, and read-only behavior.

#### Scenarios

- History mode mounts `DeliveryRouteTimeline` as the direct mode content with existing test ids/order.
- `STOP_CHECKED_IN` renders `Parada entregada` and `Parada N` as separate elements.
- Empty timeline renders `Sin eventos registrados`.

### REQ-DCK-005: Quick actions use exact synchronous predicates

The utility SHALL export typed, synchronous predicates plus guarded helpers:

```ts
export interface MapActionInput {
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}
export type QuickActionResult = { ok: boolean; message: string }

export function canOpenExternalMap(input: MapActionInput): boolean
export function canCopyAddress(address: string | null | undefined): boolean
export function canOpenEmail(email: string | null | undefined): boolean
export function openExternalMap(input: MapActionInput): QuickActionResult
export function copyAddressToClipboard(address: string): Promise<QuickActionResult>
export function openEmail(email: string | null | undefined): QuickActionResult
```

`canOpenExternalMap` SHALL be true exactly when the **trimmed formatted address exists OR both coordinates are finite**. One finite coordinate is insufficient. `openExternalMap` SHALL prefer the finite coordinate pair for the encoded Google Maps query and use the trimmed formatted address only as fallback. It SHALL use `window.open(..., '_blank', 'noopener,noreferrer')` and report blocked/SSR failure.

Copy requires a non-empty trimmed formatted address and uses `navigator.clipboard.writeText`; email requires a non-empty trimmed email and assigns encoded `mailto:` without `window.open`. Helpers SHALL never throw. Visible actions SHALL exactly mirror synchronous predicates, be ordered map/copy/email, be hidden when ineligible, and be ≥44×44px. Every settled result SHALL route through existing `useToast()`.

#### Scenarios

- Address-only map input shows map action and queries encoded address.
- Finite-coordinate pair plus address shows map action and prefers coordinates in the query.
- Coordinates without address show action only when both are finite.
- Missing address or only one/non-finite coordinate hides map action.
- Copy action is synchronously gated, writes the trimmed formatted address, and failure toasts `No se pudo copiar la dirección` without throwing.
- Email action is hidden when absent and uses `mailto:` when present.
- Template visibility reads predicates only and never awaits/calls async copy for gating.

### REQ-DCK-006: Drawer closes before confirmation; cockpit emits accepted request exactly once

For footer and stop-panel entry points, cockpit SHALL set drawer closed when needed and wait for `DriverCockpitDrawer.closed`, synthesized from native `animationEnd(false)`, before opening sibling `ConfirmModal`. Modal copy SHALL name the selected customer and stop/folio and state `Esta acción registra la entrega y no se puede deshacer.`

Cancel SHALL close without server event. Accept SHALL close the modal and emit `request-check-in(selectedStopId)` exactly once. Cockpit SHALL NOT invoke `useCheckInStop`; `DeliveryRouteDetailView` owns the single existing mutation instance and invokes it from that event. Existing composable owns success/error toast and invalidation. During `checkInPending`, neither entry point nor modal SHALL accept another request.

#### Scenarios

- Drawer-initiated confirmation opens only after `animationEnd(false)` and never overlaps portals.
- Footer initiation with no open drawer opens the same modal on the next tick.
- Cancel emits no `request-check-in` and no toast.
- One accepted confirmation closes modal and emits one selected stop id; repeated activation while pending emits nothing.
- View receives that event and its one existing mutation instance handles endpoint, toast, and invalidations.

### REQ-DCK-007: Reduced motion is no-op or instant cross-fade

Under `prefers-reduced-motion: reduce`, custom drawer/overlay motion SHALL become a no-op or instant cross-fade and drag-handle transitions SHALL snap. No marker animation is added. Native `animationEnd` semantics, modal behavior, focus trap, dismissibility, and stacking MUST remain unchanged. With no preference, standard Nuxt UI drawer motion remains.

#### Scenarios

- Reduced-motion opening has no slide and is a no-op/instant cross-fade.
- No-preference opening uses standard transition.
- Both modes still produce the same native settled/closed event sequence.

### REQ-DCK-008: Drawer portal traps and restores focus

The one drawer SHALL use Nuxt UI's portal, modal focus trap, and body scroll lock. Tab/Shift+Tab stay inside while open. Cockpit SHALL retain the originating element; after final close/cancel/mutation settlement, focus returns if connected, otherwise moves without scrolling to cockpit root (`tabindex="-1"`). Panel scroll position remains unchanged.

#### Scenarios

- Tab cycles within drawer controls and does not reach the cockpit.
- Closing from a spine node restores that node and visible focus.
- Detached origin falls back to cockpit root without scrolling.
- Full-viewport portal coverage does not reset underlying panel scroll.

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

## State and copy matrix

| Mode/state                   | Behavior                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Stop without selected stop   | Cockpit does not open this state; drawer stop prop may be null only while closed |
| Null optional stop fields    | Customer fallback; absent address/map/action rows omitted                        |
| History empty                | Existing `Sin eventos registrados`                                               |
| Quick-action runtime failure | Existing toast; drawer remains usable                                            |
| Drawer mount/runtime failure | No new cockpit error boundary/report-up/retry surface is introduced              |
| Check-in pending             | Stop-panel secondary delivery action disabled                                    |

Canonical copy: `Parada N — {customer}`, `Historial de la ruta`, `Cerrar`, `Ver en mapa`, `Copiar dirección`, `Email`, existing quick-action result copy, `Confirmar entrega`, `Cancelar`, irreversible statement above, and `Sin eventos registrados`.
