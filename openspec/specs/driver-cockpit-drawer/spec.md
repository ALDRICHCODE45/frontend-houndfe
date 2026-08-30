# Driver Cockpit Drawer Specification

Domain: `driver-cockpit-drawer` · Capability: one `DriverCockpitDrawer.vue` bottom drawer with `stop` and `history` modes. Stop mode renders `DriverStopPanel.vue`; history mode directly renders the existing `DeliveryRouteTimeline.vue`. No separate stop-sheet or history-sheet SFC exists.

## Purpose

Provide inspectable stop detail and route history without stacking overlays. One Nuxt UI v4 `UDrawer` owns modal/focus/scroll-lock behavior. It closes fully before sibling `ConfirmModal` opens. Quick actions remain truthful and synchronous in visibility gating.

## Requirements

### REQ-DCK-001: One `DriverCockpitDrawer`, two modes, explicit native-event adaptation

The cockpit SHALL mount exactly one `UDrawer`, controlled by `open` and `mode: 'stop' | 'history'`. Stop mode SHALL mount `DriverStopPanel`; history mode SHALL directly mount `DeliveryRouteTimeline`. Switching mode while open SHALL close and reopen instead of swapping trapped content in place.

Nuxt UI native events are `close`/`update:open` and `animationEnd(open: boolean)`, not `closed`. `DriverCockpitDrawer` SHALL synthesize its custom `closed` event **only** from native `animationEnd(false)`. Native close/update events begin closure but MUST NOT be interpreted as closure completion. `animationEnd(true)` SHALL mark opening settled and MUST NOT emit `closed`.

#### Scenarios

- DOM inspection finds one drawer portal and no nested drawer/slideover.
- Switching stop → history closes, receives `animationEnd(false)`, then reopens with direct timeline content.
- Escape, drag, overlay, close button, or parent close emits/causes `update:open(false)`.
- Native `close` alone does not emit custom `closed`; `animationEnd(false)` emits it once; `animationEnd(true)` does not.

### REQ-DCK-002: Drawer follows accessible header/body containment

The drawer SHALL have a sticky titled header with a ≥44px close control and an independently scrollable body capped at `85dvh`. Stop title is `Parada N — {customer}`; history title is `Historial de la ruta`. Stop mode owns inline actions and close control through `DriverStopPanel`; history contains only unchanged timeline content plus the drawer close control. Dynamic viewport units SHALL prevent landscape clipping.

#### Scenarios

- Stop mode title and `aria-label="Cerrar"` are present.
- Overflow scrolls inside the `85dvh` body without clipping.
- History mode directly mounts `DeliveryRouteTimeline` inside the body.

### REQ-DCK-003: `DriverStopPanel` renders selected stop, optional map, and gated secondary action

`DriverStopPanel` SHALL accept `{ stop; routeTerminal; canCheckIn; checkInPending; mapReady }`. It SHALL render stop position/folio, customer fallback, formatted address above any map, quick actions, and close affordance. `AddressMapPicker mode="read"` SHALL mount only after drawer opening settles (`mapReady`) and both coordinates are finite.

A secondary `Marcar entregada` action SHALL be visible only for a PENDING stop on a non-terminal route when `canCheckIn` is true. It SHALL be disabled while `checkInPending` and emit nothing then. It SHALL emit `request-confirm({ stopId, trigger })` rather than mutate. `canCheckIn` is the existing `canUpdate`; read-only drivers inspect but see no delivery action. Route position never gates this action.

#### Scenarios

- PENDING/non-terminal/canCheckIn/not-pending renders a secondary action that emits selected id.
- Mutation pending disables that action and repeat activation emits nothing.
- Read-only, terminal, COMPLETED, SKIPPED, and IN_PROGRESS stops expose no delivery action.
- Finite coordinates render the settled map below address; missing/non-finite coordinates omit it.
- Tile failure hides the map while address remains and no tile toast fires.

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

## State and copy matrix

| Mode/state | Behavior |
| --- | --- |
| Stop without selected stop | Cockpit does not open this state; drawer stop prop may be null only while closed |
| Null optional stop fields | Customer fallback; absent address/map/action rows omitted |
| History empty | Existing `Sin eventos registrados` |
| Quick-action runtime failure | Existing toast; drawer remains usable |
| Drawer mount/runtime failure | No new cockpit error boundary/report-up/retry surface is introduced |
| Check-in pending | Stop-panel secondary delivery action disabled |

Canonical copy: `Parada N — {customer}`, `Historial de la ruta`, `Cerrar`, `Ver en mapa`, `Copiar dirección`, `Email`, existing quick-action result copy, `Confirmar entrega`, `Cancelar`, irreversible statement above, and `Sin eventos registrados`.
