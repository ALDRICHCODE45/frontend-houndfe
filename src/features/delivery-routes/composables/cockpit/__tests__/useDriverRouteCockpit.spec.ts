// useDriverRouteCockpit.spec.ts — strict-TDD tests for the pure derivation
// selector (S1 of driver-route-cockpit-redesign). Pinned: design.md §3-§4 and
// specs/driver-cockpit-derivation REQ-DCD-001..008. Side-effect contract proven
// by the 100-read computed spy (no queryFn/mutationFn/fetch/storage/console).

import { describe, it, expect, vi } from 'vitest'
import { ref, computed, isRef, nextTick } from 'vue'
import type {
  DeliveryRouteResponseDto,
  DeliveryRouteStop,
  DeliveryRouteStatus,
  DeliveryRouteStopStatus,
} from '../../../interfaces/delivery-route.types'
import {
  deriveDriverRouteCockpit,
  useDriverRouteCockpit,
} from '../useDriverRouteCockpit'
import type { DriverCockpitState, CockpitSpineNode } from '../useDriverRouteCockpit'

const FULL_ADDRESS = {
  id: '', street: 'Reforma', exteriorNumber: '1', interiorNumber: null,
  zipCode: '06600', neighborhood: 'Centro', municipality: 'Cuauhtémoc',
  city: 'CDMX', state: 'CMX', label: null, latitude: null, longitude: null,
}

function makeStop(
  id: string,
  sortOrder: number,
  status: DeliveryRouteStopStatus,
  overrides: Partial<DeliveryRouteStop> = {},
): DeliveryRouteStop {
  return {
    id, saleId: `${id}-sale`, saleFolio: `F-${sortOrder + 1}`, sortOrder, status,
    checkedInAt: null, completedAt: null,
    customer: { id: `${id}-c`, name: `Customer ${sortOrder + 1}`, email: null },
    shippingAddress: { ...FULL_ADDRESS, id: `${id}-a` },
    ...overrides,
  }
}

function makeRoute(
  status: DeliveryRouteStatus,
  stops: DeliveryRouteStop[],
  overrides: Partial<DeliveryRouteResponseDto> = {},
): DeliveryRouteResponseDto {
  return {
    id: '99999999-9999-9999-9999-999999999999',
    status,
    driver: { id: 'driver-1', name: 'Carlos', email: 'c@x.com' },
    startedAt: null, completedAt: null, cancelledAt: null, notes: null,
    stops, timeline: [], ...overrides,
  }
}

const id = (stop: DeliveryRouteStop | null): string | null => (stop ? stop.id : null)

describe('shape and exports', () => {
  it('exports both functions and returns the documented zero-sentinel keys', () => {
    expect(typeof deriveDriverRouteCockpit).toBe('function')
    expect(typeof useDriverRouteCockpit).toBe('function')
    expect(deriveDriverRouteCockpit(null)).toEqual({
      currentStop: null, nextStop: null, spine: [],
      progress: { completed: 0, total: 0 },
      isTerminal: false, hasStops: false, notes: null,
    })
  })
})
// REQ-DCD-001: current = first IN_PROGRESS else first PENDING.
describe('REQ-DCD-001 current-stop selection', () => {
  it.each([
    ['IN_PROGRESS beats earlier PENDING', 'ACTIVE',
      ['PENDING', 'IN_PROGRESS', 'PENDING'], 's1'],
    ['first PENDING when no IN_PROGRESS', 'ACTIVE',
      ['PENDING', 'COMPLETED', 'PENDING'], 's0'],
    ['COMPLETED route returns null', 'COMPLETED',
      ['COMPLETED', 'SKIPPED'], null],
    ['CANCELLED route returns null (residual stops ignored)', 'CANCELLED',
      ['COMPLETED', 'PENDING', 'IN_PROGRESS'], null],
    ['COMPLETED with residual PENDING returns null', 'COMPLETED',
      ['COMPLETED', 'PENDING'], null],
    ['empty stops returns null + 0/0 + no hasStops', 'ACTIVE', [], null],
  ] as const)('%s', (_label, status, statuses, expectedId) => {
    const stops = statuses.map((s, i) => makeStop(`s${i}`, i, s as DeliveryRouteStopStatus))
    const state = deriveDriverRouteCockpit(makeRoute(status as DeliveryRouteStatus, stops))
    expect(id(state.currentStop)).toBe(expectedId)
    if (status === 'COMPLETED' || status === 'CANCELLED' || statuses.length === 0) {
      expect(state.nextStop).toBeNull()
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        expect(state.isTerminal).toBe(true)
      }
    }
    if (statuses.length === 0) {
      expect(state.progress).toEqual({ completed: 0, total: 0 })
      expect(state.hasStops).toBe(false)
    }
  })
})
// REQ-DCD-002: next semantics for both PENDING and IN_PROGRESS currents.
describe('REQ-DCD-002 next-stop selection', () => {
  it.each([
    ['PENDING current → first later PENDING',
      ['PENDING', 'PENDING', 'COMPLETED'], 's0', 's1'],
    ['IN_PROGRESS + earlier residual PENDING → residual is next',
      ['PENDING', 'IN_PROGRESS', 'PENDING'], 's1', 's0'],
    ['IN_PROGRESS + only later PENDING → later PENDING is next',
      ['COMPLETED', 'IN_PROGRESS', 'PENDING'], 's1', 's2'],
    ['last PENDING current → null next',
      ['COMPLETED', 'PENDING'], 's1', null],
    ['all-PENDING → current=first, next=second',
      ['PENDING', 'PENDING', 'PENDING'], 's0', 's1'],
    ['CANCELLED with residual PENDING → null next (no leak)',
      ['COMPLETED', 'PENDING', 'PENDING'], null, null],
  ] as const)('%s', (_label, statuses, expectedCurrent, expectedNext) => {
    const stops = statuses.map((s, i) => makeStop(`s${i}`, i, s as DeliveryRouteStopStatus))
    const status = expectedCurrent === null ? 'CANCELLED' : 'ACTIVE'
    const state = deriveDriverRouteCockpit(makeRoute(status as DeliveryRouteStatus, stops))
    expect(id(state.currentStop)).toBe(expectedCurrent)
    expect(id(state.nextStop)).toBe(expectedNext)
  })
  it('IN_PROGRESS is never treated as next (current only)', () => {
    const state = deriveDriverRouteCockpit(makeRoute('ACTIVE', [
      makeStop('s0', 0, 'IN_PROGRESS'),
      makeStop('s1', 1, 'IN_PROGRESS'),
      makeStop('s2', 2, 'PENDING'),
    ]))
    expect(id(state.currentStop)).toBe('s0')
    expect(id(state.nextStop)).toBe('s2')
  })
})
// REQ-DCD-003: spine = one-for-one ordered map.
describe('REQ-DCD-003 spine', () => {
  it('preserves backend order, length, and selectable flag', () => {
    const { spine } = deriveDriverRouteCockpit(makeRoute('ACTIVE', [
      makeStop('s0', 0, 'COMPLETED'),
      makeStop('s1', 1, 'PENDING'),
      makeStop('s2', 2, 'SKIPPED'),
      makeStop('s3', 3, 'IN_PROGRESS'),
      makeStop('s4', 4, 'PENDING'),
    ]))
    expect(spine).toHaveLength(5)
    expect(spine.map(n => n.stop.sortOrder)).toEqual([0, 1, 2, 3, 4])
    expect(spine.map(n => n.stop.id)).toEqual(['s0', 's1', 's2', 's3', 's4'])
    expect(spine.every(n => n.isSelectable === true)).toBe(true)
  })
  it('derives nodeState from stop status; exactly one current when current exists', () => {
    const { spine, currentStop } = deriveDriverRouteCockpit(makeRoute('ACTIVE', [
      makeStop('s0', 0, 'COMPLETED'),
      makeStop('s1', 1, 'PENDING'),
      makeStop('s2', 2, 'SKIPPED'),
      makeStop('s3', 3, 'IN_PROGRESS'),
      makeStop('s4', 4, 'PENDING'),
    ]))
    expect(id(currentStop)).toBe('s3')
    expect(spine.map(n => n.nodeState)).toEqual([
      'completed', 'upcoming', 'skipped', 'current', 'upcoming',
    ])
    expect(spine.filter(n => n.nodeState === 'current')).toHaveLength(1)
  })
  it('SKIPPED nodes stay in the spine, marked skipped, and selectable', () => {
    const { spine } = deriveDriverRouteCockpit(makeRoute('ACTIVE', [
      makeStop('s0', 0, 'PENDING'),
      makeStop('s1', 1, 'SKIPPED'),
      makeStop('s2', 2, 'PENDING'),
    ]))
    const skipped = spine[1]!
    expect(skipped.nodeState).toBe('skipped')
    expect(skipped.isSelectable).toBe(true)
    expect(skipped.stop.id).toBe('s1')
  })
  it('no entry is current when currentStop is null', () => {
    const { spine } = deriveDriverRouteCockpit(makeRoute('ACTIVE', [
      makeStop('s0', 0, 'COMPLETED'),
      makeStop('s1', 1, 'SKIPPED'),
    ]))
    expect(spine.every(n => n.nodeState !== 'current')).toBe(true)
  })
  it('never re-sorts; spine[i].stop === route.stops[i] by identity', () => {
    const stops = [
      makeStop('s0', 0, 'PENDING'),
      makeStop('s1', 1, 'IN_PROGRESS'),
      makeStop('s2', 2, 'PENDING'),
    ]
    const route = makeRoute('ACTIVE', stops)
    const before = route.stops.map(s => s.id)
    const { spine } = deriveDriverRouteCockpit(route)
    expect(route.stops.map(s => s.id)).toEqual(before)
    spine.forEach((n, i) => expect(n.stop).toBe(route.stops[i]))
  })
})
// REQ-DCD-004: progress counts only COMPLETED.
describe('REQ-DCD-004 progress', () => {
  it.each([
    ['counts only COMPLETED',
      ['COMPLETED', 'PENDING', 'COMPLETED', 'SKIPPED', 'IN_PROGRESS'], { completed: 2, total: 5 }],
    ['SKIPPED does not inflate completed',
      ['COMPLETED', 'SKIPPED', 'COMPLETED'], { completed: 2, total: 3 }],
    ['empty route yields 0/0',
      [], { completed: 0, total: 0 }],
    ['terminal route reports progress against all stops',
      ['COMPLETED', 'COMPLETED', 'SKIPPED'], { completed: 2, total: 3 }],
  ] as const)('%s', (_label, statuses, expected) => {
    const stops = statuses.map((s, i) => makeStop(`s${i}`, i, s as DeliveryRouteStopStatus))
    const status = expected.total === 3 && expected.completed === 2 ? 'COMPLETED' : 'ACTIVE'
    const { progress } = deriveDriverRouteCockpit(makeRoute(status as DeliveryRouteStatus, stops))
    expect(progress).toEqual(expected)
  })
})
// REQ-DCD-005: isTerminal flag.
describe('REQ-DCD-005 isTerminal', () => {
  it.each([
    ['DRAFT', false], ['ACTIVE', false], ['COMPLETED', true], ['CANCELLED', true],
  ] as const)('status=%s → isTerminal=%s', (status, expected) => {
    expect(deriveDriverRouteCockpit(makeRoute(status, [])).isTerminal).toBe(expected)
  })
})
// REQ-DCD-006: deterministic, no side effects, notes/hasStops.
describe('REQ-DCD-006 determinism and side-effect freedom', () => {
  it('returns deep-equal objects on repeated calls with identical input', () => {
    const route = makeRoute('ACTIVE', [
      makeStop('s0', 0, 'PENDING'),
      makeStop('s1', 1, 'IN_PROGRESS'),
      makeStop('s2', 2, 'PENDING'),
    ])
    expect(deriveDriverRouteCockpit(route)).toEqual(deriveDriverRouteCockpit(route))
  })
  it('notes === route.notes ?? null; hasStops === stops.length > 0', () => {
    const withNotes = deriveDriverRouteCockpit(
      makeRoute('ACTIVE', [], { notes: 'Entregar antes de las 5' }),
    )
    expect(withNotes.notes).toBe('Entregar antes de las 5')
    expect(deriveDriverRouteCockpit(makeRoute('ACTIVE', [], { notes: null })).notes).toBeNull()
    expect(deriveDriverRouteCockpit(makeRoute('ACTIVE', [])).hasStops).toBe(false)
    expect(
      deriveDriverRouteCockpit(makeRoute('ACTIVE', [makeStop('s0', 0, 'PENDING')])).hasStops,
    ).toBe(true)
  })
  it('does not call any I/O / query / mutation surface across 100 computed reads', () => {
    const localStorageWrite = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('selector MUST NOT fetch')
    })
    const route = makeRoute('ACTIVE', [
      makeStop('s0', 0, 'PENDING'),
      makeStop('s1', 1, 'IN_PROGRESS'),
    ])
    const state = computed(() => deriveDriverRouteCockpit(route))
    for (let i = 0; i < 100; i++) expect(state.value.spine).toHaveLength(2)
    expect(localStorageWrite).not.toHaveBeenCalled()
    expect(consoleLog).not.toHaveBeenCalled()
    expect(consoleWarn).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
    consoleError.mockRestore()
    consoleWarn.mockRestore()
    consoleLog.mockRestore()
    localStorageWrite.mockRestore()
  })
})
// REQ-DCD-007: tolerates null / missing fields.
describe('REQ-DCD-007 null tolerance', () => {
  it('keeps every null stop field verbatim in the spine entry', () => {
    const nullStop = makeStop('s0', 0, 'PENDING', {
      customer: null,
      shippingAddress: null,
      saleFolio: null,
      checkedInAt: null,
      completedAt: null,
    })
    const { spine } = deriveDriverRouteCockpit(makeRoute('ACTIVE', [nullStop]))
    const node = spine[0]!
    expect(node.stop.customer).toBeNull()
    expect(node.stop.shippingAddress).toBeNull()
    expect(node.stop.saleFolio).toBeNull()
    expect(node.stop.checkedInAt).toBeNull()
    expect(node.stop.completedAt).toBeNull()
  })
  it('does not throw when driver is null and notes are null; derivation still valid', () => {
    const route = makeRoute('ACTIVE', [makeStop('s0', 0, 'PENDING')], {
      driver: null, notes: null,
    })
    expect(() => deriveDriverRouteCockpit(route)).not.toThrow()
    const state = deriveDriverRouteCockpit(route)
    expect(state.notes).toBeNull()
    expect(id(state.currentStop)).toBe('s0')
  })
  it('preserves a fully-null address row (latitude/longitude null) verbatim', () => {
    const empty = makeStop('s0', 0, 'PENDING', {
      customer: null,
      shippingAddress: {
        id: 'a', street: null, exteriorNumber: null, interiorNumber: null,
        zipCode: null, neighborhood: null, municipality: null, city: null,
        state: null, label: null, latitude: null, longitude: null,
      },
    })
    const { spine, currentStop } = deriveDriverRouteCockpit(makeRoute('ACTIVE', [empty]))
    expect(id(currentStop)).toBe('s0')
    expect(spine[0]!.stop.customer).toBeNull()
    expect(spine[0]!.stop.shippingAddress?.latitude).toBeNull()
    expect(spine[0]!.stop.shippingAddress?.longitude).toBeNull()
  })
})
// REQ-DCD-008: no route order enforcement.
describe('REQ-DCD-008 no order enforcement', () => {
  it('does not lock or disable later PENDING nodes when an earlier PENDING is current', () => {
    const { spine } = deriveDriverRouteCockpit(makeRoute('ACTIVE', [
      makeStop('s0', 0, 'PENDING'),
      makeStop('s1', 1, 'PENDING'),
      makeStop('s2', 2, 'PENDING'),
    ]))
    expect(spine[1]!.isSelectable).toBe(true)
    expect(spine[2]!.isSelectable).toBe(true)
    expect(spine[1]!.nodeState).not.toBe('current')
    expect(spine[2]!.nodeState).not.toBe('current')
  })
  it('every PENDING node carries isSelectable=true and no locked field', () => {
    const { spine } = deriveDriverRouteCockpit(makeRoute('ACTIVE', [
      makeStop('s0', 0, 'PENDING'),
      makeStop('s1', 1, 'PENDING'),
    ]))
    for (const node of spine) {
      expect(node!.isSelectable).toBe(true)
      expect(node!.nodeState).not.toBe('skipped')
      expect(node!.nodeState).not.toBe('completed')
    }
  })
})
// useDriverRouteCockpit — computed adapter for Vue consumers.
describe('useDriverRouteCockpit computed adapter', () => {
  it('returns a ComputedRef<DriverCockpitState> reactive to a plain ref', () => {
    const routeRef = ref<DeliveryRouteResponseDto | null>(null)
    const state = useDriverRouteCockpit(routeRef)
    expect(isRef(state)).toBe(true)
    expect(state.value.currentStop).toBeNull()
  })
  it('reactively re-derives when the input ref changes', async () => {
    const routeRef = ref<DeliveryRouteResponseDto | null>(null)
    const state = useDriverRouteCockpit(routeRef)
    expect(state.value.currentStop).toBeNull()
    routeRef.value = makeRoute('ACTIVE', [
      makeStop('s0', 0, 'PENDING'),
      makeStop('s1', 1, 'IN_PROGRESS'),
    ])
    await nextTick()
    expect(id(state.value.currentStop)).toBe('s1')
    expect(id(state.value.nextStop)).toBe('s0')
    expect(state.value.spine).toHaveLength(2)
    routeRef.value = makeRoute('COMPLETED', [makeStop('s0', 0, 'COMPLETED')])
    await nextTick()
    expect(state.value.isTerminal).toBe(true)
    expect(state.value.currentStop).toBeNull()
  })
  it('accepts a getter function (MaybeRefOrGetter) and resolves via toValue', () => {
    expect(useDriverRouteCockpit(() => makeRoute('ACTIVE', [makeStop('s0', 0, 'PENDING')]))
      .value.currentStop?.id).toBe('s0')
  })
  it('returns a fresh ComputedRef each call (no shared mutable state)', () => {
    const route = makeRoute('ACTIVE', [makeStop('s0', 0, 'PENDING')])
    const a = useDriverRouteCockpit(() => route)
    const b = useDriverRouteCockpit(() => route)
    expect(a).not.toBe(b)
    expect(a.value).toEqual(b.value)
  })
  it('progress is a plain object — destructuring works without .value', () => {
    const route = makeRoute('ACTIVE', [
      makeStop('s0', 0, 'COMPLETED'),
      makeStop('s1', 1, 'PENDING'),
    ])
    const { progress, currentStop, nextStop, spine, isTerminal, hasStops, notes } =
      useDriverRouteCockpit(() => route).value
    expect(progress).toEqual({ completed: 1, total: 2 })
    expect(progress.completed).toBe(1)
    expect(progress.total).toBe(2)
    expect(currentStop?.id).toBe('s1')
    expect(nextStop).toBeNull()
    expect(spine).toHaveLength(2)
    expect(isTerminal).toBe(false)
    expect(hasStops).toBe(true)
    expect(notes).toBeNull()
  })
  it('exports DriverCockpitState + CockpitSpineNode types from the module', () => {
    const state: DriverCockpitState = deriveDriverRouteCockpit(null)
    expect(state).toBeDefined()
    const typedSpine: readonly CockpitSpineNode[] = state.spine
    expect(typedSpine).toEqual([])
  })
})