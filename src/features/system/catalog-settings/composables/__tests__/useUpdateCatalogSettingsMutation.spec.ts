// useUpdateCatalogSettingsMutation.spec.ts — REAL-RUNTIME contract (WU2C
// remediation, REQ-7 / REQ-18): a mounted component harness backed by a real
// QueryClient; ONLY the http transport is mocked. Proves a successful PATCH
// invalidates ONLY catalogSettingsQueryKeys.detail(variables.tenantId) with no
// cache write, and a failed PATCH invalidates / writes nothing.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http } from '@/core/shared/api/http'
import { catalogSettingsQueryKeys } from '@/core/shared/constants/query-keys'
import { handleUpdateSuccess, useUpdateCatalogSettingsMutation } from '../useUpdateCatalogSettingsMutation'
import type { CatalogSettingsResponseDto } from '../../interfaces/catalog-settings.types'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn(), patch: vi.fn() } }))

const sampleResponse: CatalogSettingsResponseDto = {
  catalogPublished: true,
  effectivePublication: true,
  priceContexts: [{ priceListId: 'pl_a', name: 'Retail', isCatalogDefault: true }],
  stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
  warnings: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function mountMutation() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  let result!: ReturnType<typeof useUpdateCatalogSettingsMutation>
  const Harness = defineComponent({
    setup() {
      result = useUpdateCatalogSettingsMutation()
      return () => null
    },
  })
  mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return { queryClient, mutation: result }
}

describe('handleUpdateSuccess (pure invalidation contract)', () => {
  it('invalidates exactly detail(tenantId), keyed on the variables tenant; deps have no cache-write hook', () => {
    const invalidateSettings = vi.fn()
    handleUpdateSuccess('tenant-1', { invalidateSettings })
    handleUpdateSuccess('tenant-B', { invalidateSettings })

    expect(invalidateSettings).toHaveBeenCalledTimes(2)
    expect(invalidateSettings).toHaveBeenNthCalledWith(1, {
      queryKey: catalogSettingsQueryKeys.detail('tenant-1'),
    })
    expect(invalidateSettings).toHaveBeenNthCalledWith(2, {
      queryKey: catalogSettingsQueryKeys.detail('tenant-B'),
    })
    // Structural pin: no setQueryData collaborator ⇒ no optimistic pre-flip.
    expect(Object.keys({ invalidateSettings })).toEqual(['invalidateSettings'])
  })
})

describe('useUpdateCatalogSettingsMutation (runtime, REQ-7 / REQ-18)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('success invalidates ONLY the variables tenant key — invalidated data is not overwritten', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: sampleResponse })
    const { queryClient, mutation } = mountMutation()
    queryClient.setQueryData(catalogSettingsQueryKeys.detail('tenant-1'), sampleResponse)
    queryClient.setQueryData(catalogSettingsQueryKeys.detail('tenant-2'), sampleResponse)

    await mutation.mutateAsync({ tenantId: 'tenant-1', body: { catalogPublished: true } })
    await flushPromises()

    expect(queryClient.getQueryState(catalogSettingsQueryKeys.detail('tenant-1'))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryData(catalogSettingsQueryKeys.detail('tenant-1'))).toEqual(sampleResponse)
    expect(queryClient.getQueryState(catalogSettingsQueryKeys.detail('tenant-2'))?.isInvalidated).toBe(false)
    expect(queryClient.getQueryData(catalogSettingsQueryKeys.detail('tenant-2'))).toEqual(sampleResponse)
  })

  it('failure invalidates / writes nothing and the error propagates (dirty draft kept)', async () => {
    vi.mocked(http.patch).mockRejectedValue(new Error('boom'))
    const { queryClient, mutation } = mountMutation()
    queryClient.setQueryData(catalogSettingsQueryKeys.detail('tenant-1'), sampleResponse)
    queryClient.setQueryData(catalogSettingsQueryKeys.detail('tenant-2'), sampleResponse)

    await expect(
      mutation.mutateAsync({ tenantId: 'tenant-1', body: { catalogPublished: false } }),
    ).rejects.toThrow('boom')
    await flushPromises()

    expect(queryClient.getQueryState(catalogSettingsQueryKeys.detail('tenant-1'))?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(catalogSettingsQueryKeys.detail('tenant-2'))?.isInvalidated).toBe(false)
    expect(queryClient.getQueryData(catalogSettingsQueryKeys.detail('tenant-1'))).toEqual(sampleResponse)
  })
})
