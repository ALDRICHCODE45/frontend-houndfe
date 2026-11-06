import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http } from '@/core/shared/api/http'
import { shippingSettingsKeys } from '../shippingSettingsKeys'
import { useShippingBoxes } from '../useShippingBoxes'
import { useShippingOrigin } from '../useShippingOrigin'
import { useOpeningHours } from '../useOpeningHours'

vi.mock('@/core/shared/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

function harness<T>(setup: () => T) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  let result!: T
  mount(defineComponent({ setup() { result = setup(); return () => null } }), {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { queryClient, result }
}

describe('Envíos settings queries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not read without a tenant or without permission', async () => {
    harness(() => useShippingBoxes(() => '', () => true))
    harness(() => useShippingOrigin(() => 't-1', () => false))
    await flushPromises()
    expect(http.get).not.toHaveBeenCalled()
  })

  it('a box write invalidates only that tenant boxes', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { data: [] } })
    vi.mocked(http.patch).mockResolvedValue({ data: {} })
    const { queryClient, result } = harness(() => useShippingBoxes(() => 't-1', () => true))
    await flushPromises()
    queryClient.setQueryData(shippingSettingsKeys.boxes('t-2'), [])

    await result.update.mutateAsync({ boxId: 'b-1', patch: { isActive: false } })

    // The active list is refetched right away; the other tenant is untouched.
    expect(vi.mocked(http.get).mock.calls.map(([url]) => url)).toEqual([
      '/tenants/t-1/shipping-boxes',
      '/tenants/t-1/shipping-boxes',
    ])
    expect(queryClient.getQueryState(shippingSettingsKeys.boxes('t-2'))?.isInvalidated).toBe(false)
  })

  it('origin and opening hours PUT install the saved record from the response', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { configured: false, origin: null, openingHours: null } })
    const savedOrigin = { configured: true, origin: { postalCode: '03100' } }
    const savedHours = { configured: true, openingHours: { timeZone: 'America/Mexico_City', days: [] } }
    vi.mocked(http.put).mockResolvedValueOnce({ data: savedOrigin }).mockResolvedValueOnce({ data: savedHours })
    const origin = harness(() => useShippingOrigin(() => 't-1', () => true))
    const hours = harness(() => useOpeningHours(() => 't-1', () => true))
    await flushPromises()

    await origin.result.save.mutateAsync({} as never)
    await hours.result.save.mutateAsync({} as never)

    expect(origin.queryClient.getQueryData(shippingSettingsKeys.origin('t-1'))).toEqual(savedOrigin)
    expect(hours.queryClient.getQueryData(shippingSettingsKeys.openingHours('t-1'))).toEqual(savedHours)
  })
})
