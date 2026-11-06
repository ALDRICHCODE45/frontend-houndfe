import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { withQuery } from './withQuery'

vi.mock('../../api/deliveryZones.api', () => ({
  deliveryZonesApi: { list: vi.fn(), upsert: vi.fn(), deactivate: vi.fn() },
  zoneValidationsApi: { list: vi.fn(), get: vi.fn(), resolve: vi.fn() },
}))

const auth = vi.hoisted(() => ({ grants: ['read', 'manage', 'validate'], tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) => subject === 'DeliveryZone' && auth.grants.includes(action),
  }),
}))
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  refDebounced: (source: unknown) => source,
}))

import { deliveryZonesApi, zoneValidationsApi } from '../../api/deliveryZones.api'
import { useDeliveryZones } from '../useDeliveryZones'
import { usePendingZoneValidationsCount } from '../usePendingZoneValidationsCount'
import { useResolveValidation } from '../useResolveValidation'

const emptyPage = { data: [], pagination: { pageIndex: 0, pageSize: 20, totalCount: 0, pageCount: 0 } }
const validation = { id: 'v1', version: 1 }

beforeEach(() => {
  vi.mocked(deliveryZonesApi.list).mockReset().mockResolvedValue(emptyPage)
  vi.mocked(zoneValidationsApi.list).mockReset().mockResolvedValue(emptyPage)
  vi.mocked(zoneValidationsApi.resolve).mockReset()
  auth.grants = ['read', 'manage', 'validate']
})

describe('useDeliveryZones', () => {
  it('requests the 1-based page of the 0-based table index, with the filters, and goes back to page 1 when a filter changes', async () => {
    const { result } = withQuery(() => useDeliveryZones())
    await flushPromises()
    expect(deliveryZonesApi.list).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: '', type: undefined, active: true }, expect.anything())

    result.pagination.value = { pageIndex: 2, pageSize: 20 }
    await flushPromises()
    expect(vi.mocked(deliveryZonesApi.list).mock.lastCall![0]).toMatchObject({ page: 3 })

    result.type.value = 'SURCHARGE'
    result.active.value = 'ALL'
    await nextTick()
    await flushPromises()
    expect(result.pagination.value.pageIndex).toBe(0)
    expect(vi.mocked(deliveryZonesApi.list).mock.lastCall![0]).toEqual({ page: 1, limit: 20, search: '', type: 'SURCHARGE', active: undefined })
  })

  it('does not read without read:DeliveryZone', async () => {
    auth.grants = []
    withQuery(() => useDeliveryZones())
    await flushPromises()
    expect(deliveryZonesApi.list).not.toHaveBeenCalled()
  })
})

describe('usePendingZoneValidationsCount (nav badge)', () => {
  it('reads totalCount from the lightest page', async () => {
    vi.mocked(zoneValidationsApi.list).mockResolvedValue({ data: [], pagination: { pageIndex: 0, pageSize: 1, totalCount: 3, pageCount: 3 } })
    const { result } = withQuery(() => usePendingZoneValidationsCount())
    await flushPromises()
    expect(zoneValidationsApi.list).toHaveBeenCalledWith({ page: 1, limit: 1 }, expect.anything())
    expect(result.count.value).toBe(3)
  })

  it('does not fire without validate:DeliveryZone and reads 0', async () => {
    auth.grants = ['read']
    const { result } = withQuery(() => usePendingZoneValidationsCount())
    await flushPromises()
    expect(zoneValidationsApi.list).not.toHaveBeenCalled()
    expect(result.count.value).toBe(0)
  })
})

describe('useResolveValidation (resolutionRequestId)', () => {
  const decision = { action: 'REJECT_DELIVERY_ZONE' as const }
  const sentId = (call: number) => (vi.mocked(zoneValidationsApi.resolve).mock.calls[call]![1] as { resolutionRequestId: string }).resolutionRequestId

  it('sends expectedVersion and a fresh UUID per submit', async () => {
    vi.mocked(zoneValidationsApi.resolve).mockResolvedValue({ validation: {}, zone: {} } as never)
    const { result } = withQuery(() => useResolveValidation())
    await result.submit(validation, decision)
    await result.submit(validation, decision)
    expect(zoneValidationsApi.resolve).toHaveBeenNthCalledWith(1, 'v1', expect.objectContaining({ expectedVersion: 1, action: 'REJECT_DELIVERY_ZONE' }))
    expect(sentId(0)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(sentId(1)).not.toBe(sentId(0))
  })

  it('reuses the same id and body only on a retry after a network error', async () => {
    vi.mocked(zoneValidationsApi.resolve)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({ validation: {}, zone: {} } as never)
    const { result } = withQuery(() => useResolveValidation())
    const first = await result.submit(validation, decision)
    expect(first).toMatchObject({ ok: false, error: { kind: 'network' } })
    expect(result.canRetry.value).toBe(true)

    const second = await result.retry()
    expect(second).toMatchObject({ ok: true })
    expect(vi.mocked(zoneValidationsApi.resolve).mock.calls[1]).toEqual(vi.mocked(zoneValidationsApi.resolve).mock.calls[0])
    expect(result.canRetry.value).toBe(false)
  })

  it('does not offer the retry after a conflict', async () => {
    vi.mocked(zoneValidationsApi.resolve).mockRejectedValue({ response: { status: 409, data: { statusCode: 409, code: 'ALREADY_RESOLVED', message: 'x' } } })
    const { result } = withQuery(() => useResolveValidation())
    expect(await result.submit(validation, decision)).toMatchObject({ ok: false, error: { kind: 'reload' } })
    expect(result.canRetry.value).toBe(false)
  })
})
