// delivery-route-actions.utils.spec.ts — pure helpers for the manager surface.
//
//   - `assertReorderCoversStops(orderedStopIds, existingStopIds)`: exactly-once
//     guard for the reorder body (inline Spanish message or null).
//   - `deliveryRouteRowActions(row, ctx)`: the ⋮ menu of a route row/card/detail,
//     gated like the detail view. A menu whose only item is "Ver detalle"
//     duplicates the row click, so it returns no actions at all.
//   - `deliveryRouteRowLabel(row)`: names the row for the menu's aria-label.
//   - `buildStopProgress(stops)`: the `x/y` delivered-stops counter.
//
// Pure helpers; no Vue / no axios / no Pinia.

import { describe, it, expect } from 'vitest'

import {
  assertReorderCoversStops,
  buildStopProgress,
  deliveryRouteRowActions,
  deliveryRouteRowLabel,
} from '../delivery-route-actions.utils'
import { DELIVERY_ROUTE_COPY } from '../../copy'
import type { DeliveryRouteResponseDto } from '../../interfaces/delivery-route.types'

function makeStop(
  id: string,
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' = 'PENDING',
) {
  return {
    id,
    saleId: `sale-${id}`,
    saleFolio: null,
    sortOrder: 0,
    status,
    checkedInAt: null,
    completedAt: null,
    customer: null,
    shippingAddress: null,
  }
}

function makeRoute(
  overrides: Partial<DeliveryRouteResponseDto> = {},
): DeliveryRouteResponseDto {
  return {
    id: 'route-1',
    status: 'DRAFT',
    driver: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline: [],
    ...overrides,
  }
}

describe('assertReorderCoversStops (sdd delivery-routes S5a, design §10.2, REQ-DRM-009)', () => {
  it('returns null when every existing stop is present exactly once (valid reorder)', () => {
    const existing = ['s1', 's2', 's3']
    const ordered = ['s3', 's1', 's2']
    expect(assertReorderCoversStops(ordered, existing)).toBeNull()
  })

  it('returns a non-null inline Spanish message when the length differs (dropped stop)', () => {
    const existing = ['s1', 's2', 's3']
    const ordered = ['s1', 's3']
    const msg = assertReorderCoversStops(ordered, existing)
    expect(msg).not.toBeNull()
    expect(msg).toMatch(/paradas/i)
    expect(msg!.length).toBeGreaterThan(0)
  })

  it('returns a non-null inline Spanish message when an unknown id is in the ordered list', () => {
    const existing = ['s1', 's2', 's3']
    const ordered = ['s1', 's2', 'unknown-id']
    const msg = assertReorderCoversStops(ordered, existing)
    expect(msg).not.toBeNull()
    expect(msg).toMatch(/paradas/i)
  })

  it('returns a non-null inline Spanish message when an id appears twice (duplicate)', () => {
    const existing = ['s1', 's2', 's3']
    const ordered = ['s1', 's2', 's2']
    const msg = assertReorderCoversStops(ordered, existing)
    expect(msg).not.toBeNull()
    expect(msg).toMatch(/paradas/i)
  })

  it('matches the canonical copy used by the UI (regression pin)', () => {
    // The DR-009 spec wording is "El orden debe incluir todas las paradas una
    // sola vez". We assert the Spanish copy matches the canonical phrase so a
    // future copy change is visible in this spec.
    const existing = ['s1', 's2', 's3']
    const ordered = ['s1', 's3']
    const msg = assertReorderCoversStops(ordered, existing)
    expect(msg).toMatch(/incluir todas las paradas una sola vez/i)
  })

  it('returns a non-null message when the ordered list is empty but existing has stops', () => {
    const existing = ['s1', 's2']
    const ordered: string[] = []
    expect(assertReorderCoversStops(ordered, existing)).not.toBeNull()
  })

  it('returns null when both lists are empty (vacuously satisfied)', () => {
    expect(assertReorderCoversStops([], [])).toBeNull()
  })
})

describe('buildStopProgress (sdd delivery-routes S5a, design §4.1, REQ-DRM-001)', () => {
  it('returns "Sin paradas" when the stops array is empty', () => {
    expect(buildStopProgress([])).toBe('Sin paradas')
  })

  it('returns "{completed}/{total}" when stops are present', () => {
    const stops = [
      makeStop('s1', 'COMPLETED'),
      makeStop('s2', 'COMPLETED'),
      makeStop('s3', 'PENDING'),
      makeStop('s4', 'PENDING'),
    ]
    expect(buildStopProgress(stops)).toBe('2/4')
  })

  it('returns "{0}/{total}" when no stops have been delivered', () => {
    const stops = [makeStop('s1', 'PENDING'), makeStop('s2', 'PENDING')]
    expect(buildStopProgress(stops)).toBe('0/2')
  })

  it('returns "{total}/{total}" when all stops are COMPLETED', () => {
    const stops = [
      makeStop('s1', 'COMPLETED'),
      makeStop('s2', 'COMPLETED'),
      makeStop('s3', 'COMPLETED'),
    ]
    expect(buildStopProgress(stops)).toBe('3/3')
  })

  it('only counts COMPLETED stops (SKIPPED / IN_PROGRESS / PENDING do not contribute)', () => {
    const stops = [
      makeStop('s1', 'COMPLETED'),
      makeStop('s2', 'SKIPPED'),
      makeStop('s3', 'IN_PROGRESS'),
      makeStop('s4', 'PENDING'),
    ]
    expect(buildStopProgress(stops)).toBe('1/4')
  })
})

describe('deliveryRouteRowActions (row menu, same gates as the detail view)', () => {
  const both = { canUpdate: true, canDelete: true }
  const keys = (row: DeliveryRouteResponseDto, ctx = both) =>
    deliveryRouteRowActions(row, ctx).map((action) => action.key)

  it('DRAFT with stops: view, edit, start and cancel; no delete (the route has stops)', () => {
    expect(keys(makeRoute({ stops: [makeStop('s1')] }))).toEqual(['view', 'edit', 'start', 'cancel'])
  })

  it('empty DRAFT: start hidden, delete last and destructive', () => {
    const actions = deliveryRouteRowActions(makeRoute(), both)
    expect(actions.map((a) => a.key)).toEqual(['view', 'edit', 'cancel', 'delete'])
    expect(actions[actions.length - 1]?.destructive).toBe(true)
    expect(actions.filter((a) => a.destructive)).toHaveLength(1)
  })

  it('ACTIVE: view and cancel', () => {
    expect(keys(makeRoute({ status: 'ACTIVE', stops: [makeStop('s1')] }))).toEqual(['view', 'cancel'])
  })

  it('marks the items that open a confirmation with an ellipsis', () => {
    const actions = deliveryRouteRowActions(makeRoute({ stops: [makeStop('s1')] }), both)
    const label = (key: string) => actions.find((a) => a.key === key)?.label
    expect(label('start')).toBe(`${DELIVERY_ROUTE_COPY.actions.start}…`)
    expect(label('cancel')).toBe(`${DELIVERY_ROUTE_COPY.actions.cancel}…`)
    expect(label('view')).toBe(DELIVERY_ROUTE_COPY.actions.view)
    expect(label('edit')).toBe(DELIVERY_ROUTE_COPY.actions.edit)
    const empty = deliveryRouteRowActions(makeRoute(), both)
    expect(empty.find((a) => a.key === 'delete')?.label).toBe(`${DELIVERY_ROUTE_COPY.actions.delete}…`)
  })

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    '%s: no menu at all, because "Ver detalle" only repeats the row click',
    (status) => {
      expect(deliveryRouteRowActions(makeRoute({ status }), both)).toEqual([])
    },
  )

  it('without update permission keeps delete gated by its own permission', () => {
    expect(keys(makeRoute(), { canUpdate: false, canDelete: true })).toEqual(['view', 'delete'])
  })

  it('without any permission the menu disappears', () => {
    expect(keys(makeRoute(), { canUpdate: false, canDelete: false })).toEqual([])
  })

  it('gives every action an icon', () => {
    for (const action of deliveryRouteRowActions(makeRoute(), both)) expect(action.icon).toBeTruthy()
  })
})

describe('deliveryRouteRowLabel', () => {
  it('names the route by day, driver and status, never by id', () => {
    const label = deliveryRouteRowLabel(
      makeRoute({
        id: '3f2a9c1b-0000',
        driver: { id: 'd1', name: 'Juan Pérez', email: 'j@x.mx' },
        timeline: [{ type: 'ROUTE_CREATED', at: '2026-10-13T15:00:00', actor: null }],
      }),
    )
    expect(label).toBe('la ruta del 13 oct de Juan Pérez, borrador')
    expect(label).not.toContain('3f2a9c1b')
  })

  it('says it when the route has no driver', () => {
    expect(
      deliveryRouteRowLabel(
        makeRoute({
          status: 'ACTIVE',
          timeline: [{ type: 'ROUTE_CREATED', at: '2026-10-13T15:00:00', actor: null }],
        }),
      ),
    ).toBe('la ruta del 13 oct sin repartidor, activa')
  })
})
