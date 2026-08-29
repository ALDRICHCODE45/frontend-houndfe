// useDriverRouteCockpit.ts — S1 of driver-route-cockpit-redesign.
// Pure derivation selector + adaptive computed adapter. Pinned: design.md §3-§4
// and specs/driver-cockpit-derivation REQ-DCD-001..008.
//
// Hard rules (enforced by the spec side-effect test):
//   - No useQuery / useMutation / useQueryClient / HTTP / DOM / I/O.
//   - Never mutates or re-sorts `route.stops`. Plain-object return shape.
import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type {
  DeliveryRouteResponseDto,
  DeliveryRouteStop,
} from '../../interfaces/delivery-route.types'

// ─── Shared typed contracts (consumed by S4..S10) ────────────────────────────

export type DrawerMode = 'stop' | 'history'

export interface StopTrigger {
  stopId: string
  trigger: HTMLElement | null
}

export interface CockpitProgress {
  completed: number
  total: number
}

export type CockpitNodeState = 'completed' | 'current' | 'upcoming' | 'skipped'

export interface CockpitSpineNode {
  stop: DeliveryRouteStop
  nodeState: CockpitNodeState
  isCurrent: boolean
  isSelectable: true
}

export interface DriverCockpitState {
  currentStop: DeliveryRouteStop | null
  nextStop: DeliveryRouteStop | null
  spine: CockpitSpineNode[]
  progress: CockpitProgress
  isTerminal: boolean
  hasStops: boolean
  notes: string | null
}

// ─── Selection helpers (REQ-DCD-001..002) ──────────────────────────────────

function selectCurrentStop(
  stops: readonly DeliveryRouteStop[],
  isTerminal: boolean,
): DeliveryRouteStop | null {
  if (isTerminal) return null
  for (const stop of stops) if (stop.status === 'IN_PROGRESS') return stop
  for (const stop of stops) if (stop.status === 'PENDING') return stop
  return null
}

function selectNextStop(
  stops: readonly DeliveryRouteStop[],
  currentStop: DeliveryRouteStop | null,
  isTerminal: boolean,
): DeliveryRouteStop | null {
  if (isTerminal || !currentStop) return null
  if (currentStop.status === 'PENDING') {
    // First PENDING strictly after the current PENDING in sortOrder ASC.
    let seenCurrent = false
    for (const stop of stops) {
      if (!seenCurrent) {
        if (stop.id === currentStop.id) seenCurrent = true
        continue
      }
      if (stop.status === 'PENDING') return stop
    }
    return null
  }
  // IN_PROGRESS current: first OTHER PENDING (incl. earlier residual).
  for (const stop of stops) {
    if (stop.id === currentStop.id) continue
    if (stop.status === 'PENDING') return stop
  }
  return null
}

function buildSpine(
  stops: readonly DeliveryRouteStop[],
  currentStop: DeliveryRouteStop | null,
): CockpitSpineNode[] {
  const currentId = currentStop?.id ?? null
  return stops.map((stop): CockpitSpineNode => {
    let nodeState: CockpitNodeState
    if (stop.status === 'COMPLETED') nodeState = 'completed'
    else if (stop.status === 'SKIPPED') nodeState = 'skipped'
    else if (currentId !== null && stop.id === currentId) nodeState = 'current'
    else nodeState = 'upcoming'
    return { stop, nodeState, isCurrent: nodeState === 'current', isSelectable: true }
  })
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Pure derivation. Null input returns the zero sentinel (no throw, no I/O). */
export function deriveDriverRouteCockpit(
  route: DeliveryRouteResponseDto | null,
): DriverCockpitState {
  if (route === null) {
    return {
      currentStop: null,
      nextStop: null,
      spine: [],
      progress: { completed: 0, total: 0 },
      isTerminal: false,
      hasStops: false,
      notes: null,
    }
  }
  const isTerminal = route.status === 'COMPLETED' || route.status === 'CANCELLED'
  const currentStop = selectCurrentStop(route.stops, isTerminal)
  const nextStop = selectNextStop(route.stops, currentStop, isTerminal)
  const completedCount = route.stops.reduce(
    (acc, stop) => acc + (stop.status === 'COMPLETED' ? 1 : 0),
    0,
  )
  return {
    currentStop,
    nextStop,
    spine: buildSpine(route.stops, currentStop),
    progress: { completed: completedCount, total: route.stops.length },
    isTerminal,
    hasStops: route.stops.length > 0,
    notes: route.notes ?? null,
  }
}

/**
 * Adaptive computed adapter. Accepts a `MaybeRefOrGetter` so callers may pass
 * a plain value, ref, or getter; `toValue()` normalises inside the computed.
 * Returns `ComputedRef<DriverCockpitState>` — destructuring consumers read
 * `progress.completed` directly (plain object, no `.value`).
 */
export function useDriverRouteCockpit(
  route: MaybeRefOrGetter<DeliveryRouteResponseDto | null>,
): ComputedRef<DriverCockpitState> {
  return computed(() => deriveDriverRouteCockpit(toValue(route)))
}
