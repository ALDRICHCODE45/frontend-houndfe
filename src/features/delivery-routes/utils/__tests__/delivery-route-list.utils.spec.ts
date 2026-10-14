import { describe, expect, it } from 'vitest'
import type {
  DeliveryRouteResponseDto,
  DeliveryRouteStop,
} from '../../interfaces/delivery-route.types'
import {
  buildRouteDisplayName,
  countRoutesByStatus,
  getRouteCreatedAt,
  getRouteCustomers,
  getRouteProgress,
  matchesRouteSearch,
  queryDeliveryRoutes,
  shortRouteId,
  sortDeliveryRoutes,
} from '../delivery-route-list.utils'

function stop(overrides: Partial<DeliveryRouteStop> = {}): DeliveryRouteStop {
  return {
    id: 'stop-1',
    saleId: 'sale-1',
    saleFolio: null,
    sortOrder: 0,
    status: 'PENDING',
    checkedInAt: null,
    completedAt: null,
    customer: null,
    shippingAddress: null,
    ...overrides,
  }
}

function route(overrides: Partial<DeliveryRouteResponseDto> = {}): DeliveryRouteResponseDto {
  return {
    id: '3f2a9c1b-0000-4000-8000-000000000001',
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

function created(at: string): DeliveryRouteResponseDto['timeline'] {
  return [{ type: 'ROUTE_CREATED', at, actor: null }]
}

const driver = (name: string) => ({ id: `d-${name}`, name, email: `${name}@x.mx` })

describe('getRouteCreatedAt', () => {
  it('reads the ROUTE_CREATED timeline event', () => {
    expect(getRouteCreatedAt(route({ timeline: created('2026-10-13T15:00:00') }))).toBe(
      '2026-10-13T15:00:00',
    )
  })

  it('returns null when the timeline has no ROUTE_CREATED event', () => {
    expect(getRouteCreatedAt(route())).toBeNull()
  })
})

describe('buildRouteDisplayName', () => {
  it('combines the creation day and the driver: "Ruta del 13 oct · Juan Pérez"', () => {
    const r = route({ timeline: created('2026-10-13T15:00:00'), driver: driver('Juan Pérez') })
    expect(buildRouteDisplayName(r)).toBe('Ruta del 13 oct · Juan Pérez')
  })

  it('names an unassigned route "Sin repartidor"', () => {
    const r = route({ timeline: created('2026-01-02T10:00:00') })
    expect(buildRouteDisplayName(r)).toBe('Ruta del 2 ene · Sin repartidor')
  })

  it('falls back to the short id when the creation date is unknown', () => {
    expect(buildRouteDisplayName(route({ driver: driver('Ana') }))).toBe('Ruta 3f2a9c1b · Ana')
  })
})

describe('shortRouteId', () => {
  it('keeps the first 8 characters of a long id', () => {
    expect(shortRouteId('3f2a9c1b-0000-4000')).toBe('3f2a9c1b')
  })

  it('returns short ids unchanged', () => {
    expect(shortRouteId('abc')).toBe('abc')
  })
})

describe('getRouteCustomers', () => {
  it('lists unique customer names in stop order, skipping stops without customer', () => {
    const r = route({
      stops: [
        stop({ id: 's1', customer: { id: 'c1', name: 'María', email: null } }),
        stop({ id: 's2' }),
        stop({ id: 's3', customer: { id: 'c2', name: 'Luis', email: null } }),
        stop({ id: 's4', customer: { id: 'c1', name: 'María', email: null } }),
      ],
    })
    expect(getRouteCustomers(r)).toEqual(['María', 'Luis'])
  })
})

describe('getRouteProgress', () => {
  it('counts completed stops over total with a rounded percentage', () => {
    const r = route({
      stops: [
        stop({ status: 'COMPLETED' }),
        stop({ status: 'PENDING' }),
        stop({ status: 'SKIPPED' }),
      ],
    })
    expect(getRouteProgress(r)).toEqual({ completed: 1, total: 3, percent: 33 })
  })

  it('reports 0% for a route without stops', () => {
    expect(getRouteProgress(route())).toEqual({ completed: 0, total: 0, percent: 0 })
  })
})

describe('matchesRouteSearch', () => {
  const r = route({
    timeline: created('2026-10-13T15:00:00'),
    driver: driver('Juan Pérez'),
    notes: 'Entregar por la tarde',
    stops: [
      stop({
        saleFolio: 'V-0042',
        customer: { id: 'c1', name: 'Ferretería López', email: null },
      }),
    ],
  })

  it.each([
    ['driver name', 'juan'],
    ['driver name without accents', 'perez'],
    ['customer name', 'ferreteria'],
    ['sale folio', 'v-0042'],
    ['notes', 'tarde'],
    ['short id', '3f2a9c1b'],
    ['display name', '13 oct'],
  ])('matches by %s', (_label, query) => {
    expect(matchesRouteSearch(r, query)).toBe(true)
  })

  it('matches everything for an empty or blank query', () => {
    expect(matchesRouteSearch(r, '')).toBe(true)
    expect(matchesRouteSearch(r, '   ')).toBe(true)
  })

  it('rejects a query that matches nothing', () => {
    expect(matchesRouteSearch(r, 'zapatería')).toBe(false)
  })
})

describe('countRoutesByStatus', () => {
  it('counts every status plus ALL, with zero for absent statuses', () => {
    const rows = [
      route({ id: 'a', status: 'DRAFT' }),
      route({ id: 'b', status: 'DRAFT' }),
      route({ id: 'c', status: 'ACTIVE' }),
    ]
    expect(countRoutesByStatus(rows)).toEqual({
      ALL: 3,
      DRAFT: 2,
      ACTIVE: 1,
      COMPLETED: 0,
      CANCELLED: 0,
    })
  })
})

describe('sortDeliveryRoutes', () => {
  const a = route({
    id: 'a',
    status: 'ACTIVE',
    driver: driver('Beto'),
    timeline: created('2026-10-10T10:00:00'),
    startedAt: '2026-10-11T10:00:00',
    stops: [stop({ status: 'COMPLETED' }), stop()],
  })
  const b = route({
    id: 'b',
    status: 'DRAFT',
    driver: driver('Ana'),
    timeline: created('2026-10-12T10:00:00'),
  })
  const c = route({ id: 'c', status: 'COMPLETED', timeline: created('2026-10-11T10:00:00') })

  const ids = (rows: DeliveryRouteResponseDto[]) => rows.map((r) => r.id)

  it('sorts by creation date descending (default order)', () => {
    expect(ids(sortDeliveryRoutes([a, b, c], [{ id: 'createdAt', desc: true }]))).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('sorts by driver name ascending, unassigned last', () => {
    expect(ids(sortDeliveryRoutes([a, b, c], [{ id: 'driver', desc: false }]))).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('keeps null dates last in both directions', () => {
    expect(ids(sortDeliveryRoutes([b, a, c], [{ id: 'startedAt', desc: true }]))[0]).toBe('a')
    expect(ids(sortDeliveryRoutes([b, a, c], [{ id: 'startedAt', desc: false }]))[0]).toBe('a')
  })

  it('sorts by status in lifecycle order', () => {
    expect(ids(sortDeliveryRoutes([c, a, b], [{ id: 'status', desc: false }]))).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('sorts by progress percentage', () => {
    expect(ids(sortDeliveryRoutes([a, b], [{ id: 'progress', desc: true }]))).toEqual(['a', 'b'])
  })

  it('keeps the input order for unknown or empty sorting and never mutates the input', () => {
    const input = [a, b, c]
    expect(ids(sortDeliveryRoutes(input, [{ id: 'updatedAt', desc: true }]))).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(ids(sortDeliveryRoutes(input, []))).toEqual(['a', 'b', 'c'])
    expect(ids(input)).toEqual(['a', 'b', 'c'])
  })
})

describe('queryDeliveryRoutes', () => {
  const rows = [
    route({
      id: 'a',
      status: 'DRAFT',
      driver: driver('Ana'),
      timeline: created('2026-10-01T10:00:00'),
    }),
    route({
      id: 'b',
      status: 'ACTIVE',
      driver: driver('Beto'),
      timeline: created('2026-10-02T10:00:00'),
    }),
    route({
      id: 'c',
      status: 'DRAFT',
      driver: driver('Carla'),
      timeline: created('2026-10-03T10:00:00'),
    }),
  ]

  it('filters by status, then search, then sorts and paginates', () => {
    const result = queryDeliveryRoutes(rows, {
      status: 'DRAFT',
      search: '',
      sorting: [{ id: 'createdAt', desc: true }],
      pageIndex: 0,
      pageSize: 1,
    })
    expect(result.data.map((r) => r.id)).toEqual(['c'])
    expect(result.pagination).toEqual({ pageIndex: 0, pageSize: 1, totalCount: 2, pageCount: 2 })
  })

  it('applies the search across all statuses when status is ALL', () => {
    const result = queryDeliveryRoutes(rows, {
      status: 'ALL',
      search: 'beto',
      sorting: [],
      pageIndex: 0,
      pageSize: 10,
    })
    expect(result.data.map((r) => r.id)).toEqual(['b'])
    expect(result.pagination.totalCount).toBe(1)
  })

  it('returns an empty page with pageCount 1 when nothing matches', () => {
    const result = queryDeliveryRoutes(rows, {
      status: 'CANCELLED',
      search: '',
      sorting: [],
      pageIndex: 0,
      pageSize: 10,
    })
    expect(result.data).toEqual([])
    expect(result.pagination).toEqual({ pageIndex: 0, pageSize: 10, totalCount: 0, pageCount: 1 })
  })
})
