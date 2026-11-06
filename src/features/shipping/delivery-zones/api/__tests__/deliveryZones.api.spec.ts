import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { deliveryZonesApi, zoneValidationsApi } from '../deliveryZones.api'

vi.mock('@/core/shared/api/http', () => ({
  http: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const page = { data: [], pagination: { pageIndex: 0, pageSize: 20, totalCount: 0, pageCount: 0 } }

describe('delivery zones transport (handoff §2)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lists with the 1-based page and only the filters that are set', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: page })
    const signal = new AbortController().signal
    expect(await deliveryZonesApi.list({ page: 2, limit: 20, search: ' 067 ', type: 'SURCHARGE', active: false }, signal)).toEqual(page)
    expect(http.get).toHaveBeenCalledWith('/delivery-zones', {
      params: { page: 2, limit: 20, search: '067', type: 'SURCHARGE', active: false },
      signal,
    })

    await deliveryZonesApi.list({ page: 1, limit: 20, search: '   ' })
    expect(vi.mocked(http.get).mock.calls[1]![1]).toEqual({ params: { page: 1, limit: 20 }, signal: undefined })
  })

  it('replaces a zone by postal code with the whole body', async () => {
    const body = { type: 'FREE' as const, surchargeCents: null, etaDays: 0, state: null, municipality: 'Benito Juárez', neighborhood: null }
    vi.mocked(http.put).mockResolvedValue({ data: { zipCode: '03100' } })
    await deliveryZonesApi.upsert('03100', body)
    expect(http.put).toHaveBeenCalledWith('/delivery-zones/03100', body)
  })

  it('deactivates with DELETE on the postal code', async () => {
    vi.mocked(http.delete).mockResolvedValue({ data: { zipCode: '03100', isActive: false } })
    await deliveryZonesApi.deactivate('03100')
    expect(http.delete).toHaveBeenCalledWith('/delivery-zones/03100')
  })
})

describe('zone validations transport (handoff §3)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lists pending validations, narrowing by postal code only when given', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: page })
    await zoneValidationsApi.list({ page: 1, limit: 50 })
    expect(http.get).toHaveBeenCalledWith('/delivery-zone-validations', { params: { page: 1, limit: 50 }, signal: undefined })
    await zoneValidationsApi.list({ page: 1, limit: 1, zipCode: '06600' })
    expect(vi.mocked(http.get).mock.calls[1]![1]).toEqual({ params: { page: 1, limit: 1, zipCode: '06600' }, signal: undefined })
  })

  it('reads one validation by id', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { id: 'v1' } })
    await zoneValidationsApi.get('v1')
    expect(http.get).toHaveBeenCalledWith('/delivery-zone-validations/v1', { signal: undefined })
  })

  it('resolves with the id, version and decision in the body (no Idempotency-Key header)', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { validation: {}, zone: {} } })
    const body = {
      expectedVersion: 1,
      resolutionRequestId: '3f6c9a1e-4b2d-4c8e-9f0a-1b2c3d4e5f60',
      action: 'APPROVE_DELIVERY_ZONE' as const,
      zoneType: 'SURCHARGE' as const,
      surchargeCents: 4500,
      etaDays: 2,
    }
    await zoneValidationsApi.resolve('v1', body)
    expect(http.post).toHaveBeenCalledWith('/delivery-zone-validations/v1/resolve', body)
  })
})
