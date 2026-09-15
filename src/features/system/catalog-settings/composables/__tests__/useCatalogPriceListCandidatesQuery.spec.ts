// useCatalogPriceListCandidatesQuery.spec.ts — STRICT-TDD tests for the WU3B
// candidate enumeration gate (REQ-6A).
//
// The composable reuses productApi.getGlobalPriceLists() and its existing
// productQueryKeys.globalPriceLists() key, and issues a request ONLY when BOTH
// update:TenantCatalogSettings AND read:GlobalPriceList are granted.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { VueQueryPlugin, QueryClient, useQueryClient } from '@tanstack/vue-query'
import { mount, flushPromises } from '@vue/test-utils'
import { useCatalogPriceListCandidatesQuery } from '../useCatalogPriceListCandidatesQuery'

const getGlobalPriceLists = vi.fn()

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: { getGlobalPriceLists: (...args: unknown[]) => getGlobalPriceLists(...args) },
}))

function makeCandidates() {
  return [
    { id: 'pl_a', name: 'Lista A', isDefault: true, createdAt: '', updatedAt: '' },
    { id: 'pl_c', name: 'Lista C', isDefault: false, createdAt: '', updatedAt: '' },
  ]
}

function mountHarness(canUpdate: () => boolean, canReadGlobal: () => boolean) {
  let api: ReturnType<typeof useCatalogPriceListCandidatesQuery> | undefined
  const Harness = defineComponent({
    setup() {
      const queryClient = useQueryClient()
      queryClient.clear()
      api = useCatalogPriceListCandidatesQuery(ref(canUpdate()), ref(canReadGlobal()))
      return () =>
        h('div', { 'data-testid': 'candidates-loaded' }, String(api?.candidates.value?.length ?? 0))
    },
  })
  mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] } })
  return () => api
}

beforeEach(() => {
  getGlobalPriceLists.mockReset()
  getGlobalPriceLists.mockResolvedValue(makeCandidates())
})

describe('useCatalogPriceListCandidatesQuery — least-privilege gate (REQ-6A)', () => {
  it('issues NO candidate request when a gate is missing', async () => {
    const getApiFirst = mountHarness(() => true, () => false)
    await flushPromises()
    await getApiFirst()!.refetch()
    expect(getGlobalPriceLists).not.toHaveBeenCalled()
    const getApi = mountHarness(() => false, () => true)
    await flushPromises()
    await getApi()!.refetch()
    expect(getGlobalPriceLists).not.toHaveBeenCalled()
    expect(getApi()!.candidates.value).toBeUndefined()
  })

  it('fires only when BOTH update:TenantCatalogSettings and read:GlobalPriceList hold', async () => {
    const getApi = mountHarness(() => true, () => true)
    await flushPromises()
    expect(getGlobalPriceLists).toHaveBeenCalledTimes(1)
    expect(getApi()!.candidates.value).toEqual(makeCandidates())
  })
})
