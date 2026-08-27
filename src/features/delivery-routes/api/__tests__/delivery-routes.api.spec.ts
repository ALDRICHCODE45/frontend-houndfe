import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http } from '@/core/shared/api/http'
import {
  deliveryRoutesApi,
  paginateDeliveryRoutes,
} from '../delivery-routes.api'
import type { DeliveryRouteResponseDto } from '../../interfaces/delivery-route.types'

vi.mock('@/core/shared/api/http')

function makeRoute(overrides: Partial<DeliveryRouteResponseDto> = {}): DeliveryRouteResponseDto {
  return {
    id: 'route-1',
    status: 'DRAFT',
    driver: { id: 'd-1', name: 'Carlos', email: 'c@x.com' },
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline: [],
    ...overrides,
  }
}

describe('deliveryRoutesApi (sdd delivery-routes S1b, design §3/§6.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list()', () => {
    it('GET /delivery-routes with no status param by default', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [] })
      await deliveryRoutesApi.list()
      expect(http.get).toHaveBeenCalledWith('/delivery-routes', { params: undefined })
    })

    it('GET /delivery-routes?status=ACTIVE when status is provided', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [] })
      await deliveryRoutesApi.list('ACTIVE')
      expect(http.get).toHaveBeenCalledWith('/delivery-routes', { params: { status: 'ACTIVE' } })
    })

    it('returns the flat array from .data', async () => {
      const rows = [makeRoute({ id: 'a' }), makeRoute({ id: 'b' })]
      vi.mocked(http.get).mockResolvedValue({ data: rows })
      const result = await deliveryRoutesApi.list()
      expect(result).toEqual(rows)
    })
  })

  describe('getById()', () => {
    it('GET /delivery-routes/:id', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: makeRoute({ id: 'route-42' }) })
      await deliveryRoutesApi.getById('route-42')
      expect(http.get).toHaveBeenCalledWith('/delivery-routes/route-42')
    })

    it('returns the unwrapped DTO', async () => {
      const row = makeRoute({ id: 'route-7' })
      vi.mocked(http.get).mockResolvedValue({ data: row })
      const result = await deliveryRoutesApi.getById('route-7')
      expect(result).toEqual(row)
    })
  })

  describe('create()', () => {
    it('POST /delivery-routes with the payload', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRoute() })
      const payload = {
        saleIds: ['11111111-1111-1111-1111-111111111111'],
        driverUserId: '22222222-2222-2222-2222-222222222222',
        notes: 'Notas',
      }
      await deliveryRoutesApi.create(payload)
      expect(http.post).toHaveBeenCalledWith('/delivery-routes', payload)
    })

    it('WHITELIST: never sends id/tenantId/timeline/startedAt/.../activeRouteId/status/stops/driver', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRoute() })
      await deliveryRoutesApi.create({
        saleIds: ['11111111-1111-1111-1111-111111111111'],
        driverUserId: '22222222-2222-2222-2222-222222222222',
        id: 'x',
        tenantId: 'y',
        timeline: [],
        startedAt: 'x',
        completedAt: 'x',
        cancelledAt: 'x',
        createdAt: 'x',
        updatedAt: 'x',
        activeRouteId: 'x',
        status: 'DRAFT' as never,
        stops: [],
        driver: { id: 'd', name: 'd', email: 'd' },
      } as unknown as Parameters<typeof deliveryRoutesApi.create>[0])

      const body = vi.mocked(http.post).mock.calls[0]?.[1] as Record<string, unknown>
      for (const forbidden of [
        'id',
        'tenantId',
        'timeline',
        'startedAt',
        'completedAt',
        'cancelledAt',
        'createdAt',
        'updatedAt',
        'activeRouteId',
        'status',
        'stops',
        'driver',
      ]) {
        expect(body).not.toHaveProperty(forbidden)
      }
      expect(Object.keys(body).sort()).toEqual(['driverUserId', 'saleIds'])
    })
  })

  describe('update()', () => {
    it('PATCH /delivery-routes/:id with the payload', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRoute() })
      const payload = { driverUserId: '22222222-2222-2222-2222-222222222222' }
      await deliveryRoutesApi.update('route-1', payload)
      expect(http.patch).toHaveBeenCalledWith('/delivery-routes/route-1', payload)
    })

    it('WHITELIST: never sends id/tenantId/timeline/status/stops/startedAt', async () => {
      vi.mocked(http.patch).mockResolvedValue({ data: makeRoute() })
      await deliveryRoutesApi.update('route-1', {
        driverUserId: '22222222-2222-2222-2222-222222222222',
        id: 'x',
        tenantId: 'y',
        timeline: [],
        status: 'ACTIVE' as never,
        stops: [],
        startedAt: 'x',
      } as unknown as Parameters<typeof deliveryRoutesApi.update>[1])

      const body = vi.mocked(http.patch).mock.calls[0]?.[1] as Record<string, unknown>
      for (const forbidden of ['id', 'tenantId', 'timeline', 'status', 'stops', 'startedAt']) {
        expect(body).not.toHaveProperty(forbidden)
      }
    })
  })

  describe('delete()', () => {
    it('DELETE /delivery-routes/:id', async () => {
      vi.mocked(http.delete).mockResolvedValue({})
      await deliveryRoutesApi.delete('route-1')
      expect(http.delete).toHaveBeenCalledWith('/delivery-routes/route-1')
    })

    it('returns void (204 contract)', async () => {
      vi.mocked(http.delete).mockResolvedValue({})
      const result = await deliveryRoutesApi.delete('route-1')
      expect(result).toBeUndefined()
    })
  })

  describe('start()', () => {
    it('POST /delivery-routes/:id/start', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRoute({ status: 'ACTIVE' }) })
      await deliveryRoutesApi.start('route-1')
      expect(http.post).toHaveBeenCalledWith('/delivery-routes/route-1/start')
    })
  })

  describe('cancel()', () => {
    it('POST /delivery-routes/:id/cancel', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRoute({ status: 'CANCELLED' }) })
      await deliveryRoutesApi.cancel('route-1')
      expect(http.post).toHaveBeenCalledWith('/delivery-routes/route-1/cancel')
    })
  })

  describe('appendStop()', () => {
    it('POST /delivery-routes/:id/stops with the saleId payload', async () => {
      vi.mocked(http.post).mockResolvedValue({
        data: makeRoute({
          stops: [
            {
              id: 's-1',
              saleId: '33333333-3333-3333-3333-333333333333',
              saleFolio: null,
              sortOrder: 0,
              status: 'PENDING',
              checkedInAt: null,
              completedAt: null,
              customer: null,
              shippingAddress: null,
            },
          ],
        }),
      })
      const payload = { saleId: '33333333-3333-3333-3333-333333333333' }
      await deliveryRoutesApi.appendStop('route-1', payload)
      expect(http.post).toHaveBeenCalledWith('/delivery-routes/route-1/stops', payload)
    })

    it('WHITELIST: never sends id/sortOrder/stopId', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRoute() })
      await deliveryRoutesApi.appendStop('route-1', {
        saleId: '33333333-3333-3333-3333-333333333333',
        id: 'x',
        sortOrder: 0,
        stopId: 'x',
      } as unknown as Parameters<typeof deliveryRoutesApi.appendStop>[1])

      const body = vi.mocked(http.post).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).not.toHaveProperty('id')
      expect(body).not.toHaveProperty('sortOrder')
      expect(body).not.toHaveProperty('stopId')
    })
  })

  describe('reorderStops()', () => {
    it('PUT /delivery-routes/:id/stops/reorder with the orderedStopIds payload', async () => {
      vi.mocked(http.put).mockResolvedValue({ data: makeRoute() })
      const payload = { orderedStopIds: ['s-1', 's-2'] }
      await deliveryRoutesApi.reorderStops('route-1', payload)
      expect(http.put).toHaveBeenCalledWith('/delivery-routes/route-1/stops/reorder', payload)
    })

    it('WHITELIST: never sends sortOrder or stops', async () => {
      vi.mocked(http.put).mockResolvedValue({ data: makeRoute() })
      await deliveryRoutesApi.reorderStops('route-1', {
        orderedStopIds: ['s-1'],
        sortOrder: [0],
        stops: [],
      } as unknown as Parameters<typeof deliveryRoutesApi.reorderStops>[1])

      const body = vi.mocked(http.put).mock.calls[0]?.[1] as Record<string, unknown>
      expect(body).not.toHaveProperty('sortOrder')
      expect(body).not.toHaveProperty('stops')
    })
  })

  describe('checkInStop()', () => {
    it('POST /delivery-routes/:id/stops/:stopId/check-in', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeRoute() })
      await deliveryRoutesApi.checkInStop('route-1', 'stop-1')
      expect(http.post).toHaveBeenCalledWith('/delivery-routes/route-1/stops/stop-1/check-in')
    })
  })
})

describe('paginateDeliveryRoutes (sdd delivery-routes S1b, design §6.2 + useDeliveryRoutesTable)', () => {
  const rows: DeliveryRouteResponseDto[] = Array.from({ length: 25 }, (_, i) =>
    makeRoute({ id: `route-${i + 1}` }),
  )

  it('returns the correct slice for page 0 pageSize 10', () => {
    const out = paginateDeliveryRoutes(rows, { pageIndex: 0, pageSize: 10 })
    expect(out.data).toHaveLength(10)
    expect(out.data[0]!.id).toBe('route-1')
    expect(out.data[9]!.id).toBe('route-10')
    expect(out.pagination.totalCount).toBe(25)
    expect(out.pagination.pageCount).toBe(3)
    expect(out.pagination.pageIndex).toBe(0)
    expect(out.pagination.pageSize).toBe(10)
  })

  it('returns the correct slice for page 2 pageSize 10 (last partial page)', () => {
    const out = paginateDeliveryRoutes(rows, { pageIndex: 2, pageSize: 10 })
    expect(out.data).toHaveLength(5)
    expect(out.data[0]!.id).toBe('route-21')
  })

  it('returns pageCount=1 and an empty list for an empty dataset', () => {
    const out = paginateDeliveryRoutes([], { pageIndex: 0, pageSize: 10 })
    expect(out.data).toEqual([])
    expect(out.pagination.totalCount).toBe(0)
    expect(out.pagination.pageCount).toBe(1)
  })

  it('returns pageCount=1 for a single-page dataset', () => {
    const tiny = rows.slice(0, 3)
    const out = paginateDeliveryRoutes(tiny, { pageIndex: 0, pageSize: 10 })
    expect(out.data).toHaveLength(3)
    expect(out.pagination.pageCount).toBe(1)
  })

  it('returns an empty slice for an out-of-range pageIndex', () => {
    const out = paginateDeliveryRoutes(rows, { pageIndex: 99, pageSize: 10 })
    expect(out.data).toEqual([])
    expect(out.pagination.pageCount).toBe(3)
    expect(out.pagination.totalCount).toBe(25)
  })
})