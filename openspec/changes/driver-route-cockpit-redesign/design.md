# Driver Route Cockpit Redesign — Technical Design

Change: `driver-route-cockpit-redesign`  
Phase: DESIGN  
Scope lock: `driver-detail-only`, `visual-priority-no-enforcement`, `maps-copy-email`, `single-drawer-confirm-refresh`

## 1. Decision summary

`DeliveryRouteDetailView` remains the only server-state orchestration surface for the driver detail. It owns the existing `useDeliveryRouteDetail` observer, the single existing `useCheckInStop` mutation instance, route-id and role gates, permission derivation, loading/error/privacy handling, manual refresh, and mutation pending state. `DriverRouteCockpit` receives one non-null resolved `DeliveryRouteResponseDto` and is presentational with respect to server state: it uses no `useQuery`, `useMutation`, `useQueryClient`, or HTTP client.

The cockpit owns only local interaction state: selected stop, drawer mode/phase, pending confirmation, and the focus-return element. When confirmation is accepted it closes the modal and emits `request-check-in(stopId)` exactly once. The view handles that event with its one `useCheckInStop` instance; the existing composable remains the sole owner of the success/error toasts and detail/list invalidation.

The implementation has exactly seven new SFCs:

1. `DriverRouteCockpit.vue`
2. `DriverCockpitHeader.vue`
3. `DriverOperationalStops.vue`
4. `DriverRouteSpine.vue`
5. `DriverCockpitDrawer.vue`
6. `DriverStopPanel.vue`
7. `DriverCockpitFooter.vue`

`DriverOperationalStops` contains the current-card and next-preview sections as one operational hierarchy. `DriverCockpitFooter` contains mutually exclusive current-action, IN_PROGRESS, terminal, and empty modes. `DriverCockpitDrawer` is the one `UDrawer`; stop mode renders `DriverStopPanel`, and history mode directly reuses `DeliveryRouteTimeline`. There is no `DriverCurrentStopCard`, `DriverNextStopPreview`, `DriverDeliveryActionBar`, `TerminalSummaryCard`, `DriverStopSheet`, `DriverRouteHistorySheet`, or `useCockpitManualRefresh` artifact.

No dependency, backend endpoint, DTO, Zod schema, permission, route, navigation entry, query key, global shell, polling, focus listener, or optimistic cache behavior changes.

## 2. Visual direction and containment

The screen is an in-shift delivery cockpit whose single job is to make active work and route continuity legible at a glance. Its signature element is the functional route spine, not decorative dashboard chrome.

| Role | Existing token/source | Use |
| --- | --- | --- |
| Typeface | Inter / `--font-sans` | All text and tabular progress |
| Active work | Coco gold/action `#f6bb13` | PENDING current section and primary delivery action only |
| Route continuity | Coco blue/primary `#2442f6` | Spine, links, focus emphasis |
| Hierarchy | Coco navy/secondary `#173968` | IN_PROGRESS emphasis and structure |
| Surfaces/text/borders | Existing semantic Nuxt UI tokens | Light/dark surfaces, text, and separators |
| Status/error | Existing status maps and semantic tones | Lifecycle and stop status, always paired with text |

Components use semantic classes/props rather than new global tokens. Gold is not decorative. Normal text retains 4.5:1 contrast and focus indicators retain 3:1 contrast. All touch controls are at least 44×44px.

The cockpit counters only the existing panel padding (`-m-4 sm:-m-6`), uses the panel as its scroll owner, and introduces no fixed element. Mobile uses one column; desktop contains a two-column body with the same DOM and reading order. The header and footer are sticky within the panel. Footer safe-area padding is matched by body bottom padding. Drawer content is independently scrollable and capped at `85dvh`; 320px layouts do not scroll horizontally.

## 3. Component map and typed contracts

All SFCs use Vue 3 `<script setup lang="ts">`, explicit typed props/emits, props down/events up, and script/template/style order.

| Artifact | Responsibility | Typed props | Typed emits |
| --- | --- | --- | --- |
| `DriverRouteCockpit.vue` | Compose derived data and own drawer/confirmation/focus local UI state; never own server state. | `{ route: DeliveryRouteResponseDto; isFetching: boolean; canCheckIn: boolean; checkInPending: boolean }` | `{ back: []; refresh: []; 'request-check-in': [stopId: string] }` |
| `DriverCockpitHeader.vue` | Sticky identity, lifecycle, progress, back/history, and refresh controls. | `{ route: DeliveryRouteResponseDto; progress: CockpitProgress; isFetching: boolean }` | `{ back: []; refresh: []; 'open-history': [trigger: HTMLElement] }` |
| `DriverOperationalStops.vue` | Render the current-card section, route notes, and next-preview section as one hierarchy. | `{ currentStop: DeliveryRouteStop | null; nextStop: DeliveryRouteStop | null; notes: string | null; hasStops: boolean; isTerminal: boolean }` | `{ 'open-stop': [payload: StopTrigger] }` |
| `DriverRouteSpine.vue` | Render every derived node in backend order as an accessible selectable sequence. | `{ nodes: readonly CockpitSpineNode[] }` | `{ 'select-stop': [payload: StopTrigger] }` |
| `DriverCockpitDrawer.vue` | Own one `UDrawer`, mode switching, native-event adaptation, and settled map timing. | `{ open: boolean; mode: DrawerMode; route: DeliveryRouteResponseDto; stop: DeliveryRouteStop | null; routeTerminal: boolean; canCheckIn: boolean; checkInPending: boolean }` | `{ 'update:open': [open: boolean]; closed: []; 'request-confirm': [payload: StopTrigger] }` |
| `DriverStopPanel.vue` | Render stop details, map, truthful quick actions, and secondary delivery action. | `{ stop: DeliveryRouteStop; routeTerminal: boolean; canCheckIn: boolean; checkInPending: boolean; mapReady: boolean }` | `{ close: []; 'request-confirm': [payload: StopTrigger] }` |
| `DriverCockpitFooter.vue` | Render exactly one of current-action, disabled IN_PROGRESS, terminal/history, or empty modes. | `{ routeStatus: DeliveryRouteStatus; currentStop: DeliveryRouteStop | null; progress: CockpitProgress; hasStops: boolean; canCheckIn: boolean; checkInPending: boolean }` | `{ 'request-confirm': [payload: StopTrigger]; 'open-history': [trigger: HTMLElement] }` |

```ts
export type DrawerMode = 'stop' | 'history'
export interface StopTrigger { stopId: string; trigger: HTMLElement | null }
export interface CockpitProgress { completed: number; total: number }
export type CockpitNodeState = 'completed' | 'current' | 'upcoming' | 'skipped'
export interface CockpitSpineNode {
  stop: DeliveryRouteStop
  nodeState: CockpitNodeState
  isCurrent: boolean
  isSelectable: true
}
```

`canCheckIn` is exactly `canUpdate` from the existing role/permission surface. A read-only driver can inspect the cockpit, stop drawer, map, quick actions, and history, but sees no delivery action. `checkInPending` is passed from the view through cockpit/footer/drawer/stop panel so current and non-current entry points are disabled for the full mutation.

## 4. DTO and derivation contracts

Existing route, stop, address, and timeline schemas remain unchanged. The selector utility never mutates or re-sorts `route.stops` and performs no I/O.

```ts
export interface DriverCockpitState {
  currentStop: DeliveryRouteStop | null
  nextStop: DeliveryRouteStop | null
  spine: CockpitSpineNode[]
  progress: CockpitProgress
  isTerminal: boolean
  hasStops: boolean
  notes: string | null
}

export function deriveDriverRouteCockpit(
  route: DeliveryRouteResponseDto | null,
): DriverCockpitState

export function useDriverRouteCockpit(
  route: MaybeRefOrGetter<DeliveryRouteResponseDto | null>,
): ComputedRef<DriverCockpitState>
```

The null input remains a unit-testable zero sentinel, but `DriverRouteCockpit.route` is non-null because `DeliveryRouteDetailView` mounts it only after a matching DTO resolves.

Derivation rules:

1. Terminal means route status `COMPLETED` or `CANCELLED`; current and next are null.
2. Otherwise current is the first backend-ordered `IN_PROGRESS`, else first `PENDING`, else null.
3. For PENDING current, next is the first later PENDING. For IN_PROGRESS current, next is the first other PENDING in backend order, including an earlier residual PENDING.
4. Spine is a one-for-one map: COMPLETED → completed, SKIPPED → skipped, current id → current, otherwise upcoming. Every node is selectable.
5. Progress total is all stops; completed counts only COMPLETED.
6. `hasStops` reflects array length and `notes` is `route.notes ?? null`.

No blocked/locked state or route-order enforcement is introduced.

## 5. Server-state and event flow

```text
route :id + role
  -> DeliveryRouteDetailView
     -> useDeliveryRouteDetail(:id) [one existing query observer]
     -> useCheckInStop()             [one existing mutation instance]
     -> loading / privacy / stale-id / generic-error gates
     -> DriverRouteCockpit(route, isFetching, canCheckIn=canUpdate, checkInPending)
        -> pure derivation
        -> local drawer / confirmation / focus state
        -> refresh --------------------------> view.handleRefresh()
        -> accepted confirmation
           close modal
           emit request-check-in(stopId) once
              --------------------------------> view.handleCheckIn(stopId)
                                                -> mutateAsync({ id, stopId })
                                                -> existing toast + invalidations
```

Neither cockpit nor any child imports TanStack Query or HTTP code. The view's check-in handler invokes `mutateAsync` once per accepted event and does not duplicate toast, invalidation, retry, or optimistic behavior. While `checkInPending` is true, footer and stop-panel delivery controls are disabled and cannot emit confirmation requests. Confirmation itself is also non-repeatable while pending.

## 6. Manual refresh: one observer, one request

`DriverCockpitHeader` emits `refresh`. `DriverRouteCockpit` forwards it. `DeliveryRouteDetailView` handles it with the existing detail observer's `refetch()` and passes that observer's `isFetching` down to disable the header control.

The handler awaits/inspects the refetch result and catches rejection. If the result reports an error or the call rejects, the view uses the existing `useToast()` helper with canonical copy `No se pudo actualizar la ruta`. Success produces no extra toast. Cached DTO and panel scroll remain in place.

There is no `useCockpitManualRefresh.ts`, `useQueryClient`, invalidate-then-refetch sequence, `refetchQueries`, new query key, polling, interval, timeout, focus listener, invalidation wrapper, broad refresh, or duplicate GET.

## 7. Drawer, confirmation, and focus state machine

The cockpit stores `selectedStopId`, drawer mode/phase, `pendingConfirmationStopId`, and a `shallowRef<HTMLElement | null>` focus-return element. These are local UI state only; no route DTO or mutation state is copied.

```text
CLOSED
  openStop(id, trigger) -> DRAWER_STOP
  openHistory(trigger)  -> DRAWER_HISTORY

DRAWER_STOP/HISTORY
  dismiss               -> CLOSING -> native animationEnd(false) -> CLOSED -> restore focus
  switch mode           -> CLOSING_TO_SWITCH -> animationEnd(false) -> reopen target mode
  request confirm(id)   -> CLOSING_TO_CONFIRM -> animationEnd(false) -> CONFIRM(id)

CONFIRM
  cancel                -> CLOSED -> restore focus
  accept                -> close modal -> emit request-check-in(id) exactly once -> MUTATING

MUTATING
  view settles mutation -> CLOSED -> restore connected trigger or cockpit root fallback
```

`DriverCockpitDrawer` synthesizes its custom `closed` event only from native Nuxt UI `UDrawer` `animationEnd(false)`. Native `close`/`update:open(false)` begins closing; it is not treated as completion. `animationEnd(true)` marks opening settled (`mapReady=true`) and never emits `closed`. This adapter is pinned by component tests.

One modal, dismissible `UDrawer` is mounted. `ConfirmModal` is its sibling and opens only after synthesized `closed`; overlays never overlap. Focus returns to a connected origin, otherwise to the cockpit root (`tabindex="-1"`) without scrolling. Existing primitive focus trap/body lock remain enabled.

`AddressMapPicker` mounts in stop mode only after `animationEnd(true)` and only for a finite coordinate pair. Formatted address remains authoritative and appears above the map. Tile failure hides only the map.

Reduced-motion CSS makes drawer/overlay transitions a no-op or instant cross-fade and snaps drag-handle state. It does not change native events, modal semantics, focus, dismissal, or stacking.

## 8. Truthful quick actions

Predicates are synchronous and pure; browser helpers are guarded and never throw.

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

Map visibility is true only when the trimmed formatted address exists **or** both latitude and longitude are finite. A finite coordinate pair is preferred for the encoded Google Maps query; formatted address is the fallback. One coordinate alone is never sufficient. Copy requires a non-empty trimmed formatted address. Email requires a non-empty trimmed email address. Visible controls exactly mirror predicates and remain map/copy/email ordered.

Map uses `window.open(url, '_blank', 'noopener,noreferrer')`; email assigns an encoded `mailto:` URL; copy uses `navigator.clipboard.writeText`. SSR absence, blocked popup, unsupported clipboard, and runtime failures return typed failures. `DriverStopPanel` sends each settled result to the existing toast helper.

## 9. Query, mutation, permissions, and state surfaces

### 9.1 Query and mutation lock

| Operation | Owner | Contract |
| --- | --- | --- |
| Detail read | `DeliveryRouteDetailView` via existing `useDeliveryRouteDetail` | Existing key, `keepPreviousData`, enabled guard, and `refetchOnWindowFocus: false` |
| Manual refresh | View via active observer `refetch()` | One explicit request; no invalidation; `isFetching` disables refresh; failure toast only |
| Check-in | View via one existing `useCheckInStop` | Existing POST with no body; no retry/optimistic/duplicate wrapper |
| Check-in settlement | Existing mutation composable | Existing success/error toast and detail/list invalidation |

### 9.2 Permissions

`canCheckIn = canUpdate`. Read and driver/manager discrimination remain existing. The primary and secondary delivery actions additionally require selected stop PENDING, non-terminal route, and `!checkInPending`. Read-only drivers can inspect but see no delivery actions. Backend remains authoritative.

### 9.3 Honest view states

| State | Exact behavior |
| --- | --- |
| Initial loading | Existing detail skeleton; cockpit does not mount |
| Stale DTO for another id | Existing id guard; stale cockpit does not mount |
| Driver 403 / 404 | Existing `Ruta no encontrada`; no presence leak |
| Generic query error | Existing detail error block only; no new retry/refetch control is claimed |
| Zero stops | Cockpit mounts with `0/0`, `Sin parada activa`, `Sin paradas`, and empty footer mode |
| Null optional fields | Customer fallback only; absent rows/callouts leave no decoration |
| No next stop, non-terminal | `Última parada`; no ETA |
| Terminal | Read-only spine, terminal footer mode/history, no delivery action |
| All skipped/non-actionable | No active action; spine remains selectable |
| Empty history | Existing timeline copy `Sin eventos registrados` |
| Missing/non-finite map data | Address remains; map omitted |
| Refresh failure | Cached DTO and scroll remain; toast `No se pudo actualizar la ruta` |
| Check-in pending | Both footer and drawer delivery controls disabled |
| Check-in error/success | Existing composable owns toast/invalidation; cockpit has no extra error surface |

There is no cockpit error boundary, report-up event, local retry surface, or invented generic retry control.

## 10. File plan

### New implementation artifacts

- `src/features/delivery-routes/components/cockpit/{DriverRouteCockpit,DriverCockpitHeader,DriverOperationalStops,DriverRouteSpine,DriverCockpitDrawer,DriverStopPanel,DriverCockpitFooter}.vue`
- Co-located component tests.
- `src/features/delivery-routes/composables/cockpit/useDriverRouteCockpit.ts` plus tests.
- `src/features/delivery-routes/utils/cockpit/driverCockpitQuickActions.ts` plus tests.

### Modified implementation artifacts

- `DeliveryRouteDetailView.vue` and tests: driver-success branch, existing observer destructuring/refresh handler, single check-in wiring, and props/events only.
- `useDeliveryRouteDetail.ts`: comment only; behavior unchanged.
- Existing delivery-route copy source: cockpit, drawer, confirmation, and refresh strings.

### Deleted after replacement tests pass

- `DriverStopDetail.vue` and its obsolete equal-card tests.

Shared API, DTO schemas, query-key factory, mutation composable, route/navigation registries, list UI, manager branch, and global shell remain unchanged.

## 11. Requirement-to-code and test matrix

| Requirements | Components/modules | Verification focus |
| --- | --- | --- |
| REQ-DRC-101–102 | Existing list surface | Preserved list request/loading/empty/error behavior |
| REQ-DRC-103, 107, 109, 112 | Detail view | Privacy, stale id, role, loading, generic existing error block, zero stops |
| REQ-DRC-104 | View + existing mutation + cockpit event | One mutation instance, exactly-once accepted event, pending gates, endpoint/toasts/invalidations |
| REQ-DRC-105–106 | Drawer + timeline/map | Direct timeline reuse, backend order, finite coordinate map gate |
| REQ-DRC-108, 110–111 | Existing registries/composable + cockpit a11y | No manager/list/path/key drift, focus/touch/reduced motion |
| REQ-DCD-001–008 | Pure selector | Terminal/current/next/spine/progress/null/purity/no lock |
| REQ-DCK-001–004 | Drawer + stop panel + timeline | One drawer, two modes, native `animationEnd(false)` synthesis, direct history reuse |
| REQ-DCK-005 | Quick-action utility + stop panel | Exact synchronous predicates, coordinate preference, guards/toasts |
| REQ-DCK-006, 008 | Cockpit state machine | Drawer fully closed before modal, one overlay, focus return |
| REQ-DCK-007 | Drawer scoped motion | No-op/instant cross-fade without semantic changes |
| REQ-DCS-001–005 | Cockpit/header/operational/spine | Seven-SFC composition, non-null route, DOM hierarchy, accessibility |
| REQ-DCS-006, 008–009 | Footer/drawer/cockpit/view | Four footer modes, non-current secondary action, canUpdate and pending gates |
| REQ-DCS-007 | Header/cockpit/view | One existing observer refetch, `isFetching`, canonical failure toast, no wrapper/invalidation |
| REQ-DCS-010 | Existing manager/list/registry code | Regression suites unchanged |

Pure derivation and quick-action tests run without Nuxt UI. Presentational tests assert typed props/emits, DOM, copy, and accessibility. Drawer integration uses `mountWithUApp` and covers portal dismissal, native event adaptation, focus trap/return, mode switch, reduced motion, and no overlay overlap. View tests assert one check-in composable instance, exactly-once event handling, pending propagation, manual-refetch result errors, privacy, stale data, roles, and unchanged manager behavior.

Verification remains RED → GREEN → TRIANGULATE → REFACTOR, followed by `pnpm test:unit --run`, `vue-tsc --build`, and `pnpm build`.

## 12. Rollout and rollback

There is no migration. Roll out in review-sized slices: (1) pure derivation and compact shell, (2) shared drawer/quick actions/focus integration, (3) view-owned check-in/manual refresh and driver branch swap, (4) responsive/a11y/regression hardening and old-card deletion.

Rollback is a source revert: restore the old driver branch and `DriverStopDetail`, remove cockpit files and copy additions. API contracts, query keys, invalidation, permissions, routes, manager UI, and backend data remain unchanged, so rollback needs no cache migration or backend coordination. Trigger rollback on privacy leakage, manager/list regression, overlay overlap/focus loss, duplicate request/mutation, type failure, or production build failure.
