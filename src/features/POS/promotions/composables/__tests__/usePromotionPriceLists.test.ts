/**
 * usePromotionPriceLists — the one ['price-lists'] query shared by PromotionForm
 * (summary names) and PromotionConditionsSection (picker): same key, fetcher and
 * gate, so both read one cache entry and the list is requested once.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { usePromotionPriceLists } from '../usePromotionPriceLists'

const getGlobalPriceListsMock = vi.fn()

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: {
    getGlobalPriceLists: (...args: unknown[]) => getGlobalPriceListsMock(...args),
  },
}))

const LISTS = [
  { id: 'pl-1', name: 'Mayoreo' },
  { id: 'pl-2', name: 'Distribuidor' },
]

function mountUsers(enabled: () => boolean, users = 2) {
  const results: ReturnType<typeof usePromotionPriceLists>[] = []
  const User = defineComponent({
    setup() {
      results.push(usePromotionPriceLists(enabled))
      return () => h('div')
    },
  })
  const Host = defineComponent({
    setup: () => () => h('div', Array.from({ length: users }, () => h(User))),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mount(Host, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return { results, queryClient }
}

describe('usePromotionPriceLists', () => {
  beforeEach(() => {
    getGlobalPriceListsMock.mockReset()
    getGlobalPriceListsMock.mockResolvedValue(LISTS)
  })

  it('does not request the lists while the gate is closed', async () => {
    const { results } = mountUsers(() => false)
    await flushPromises()
    expect(getGlobalPriceListsMock).not.toHaveBeenCalled()
    expect(results.every((r) => r.data.value === undefined)).toBe(true)
  })

  it('two users share one request under the price-lists key', async () => {
    const { results, queryClient } = mountUsers(() => true)
    await flushPromises()
    expect(getGlobalPriceListsMock).toHaveBeenCalledTimes(1)
    expect(results.map((r) => r.data.value)).toEqual([LISTS, LISTS])
    expect(queryClient.getQueryData(['price-lists'])).toEqual(LISTS)
  })

  it('requests once the gate opens', async () => {
    const open = ref(false)
    const { results } = mountUsers(() => open.value, 1)
    await flushPromises()
    expect(getGlobalPriceListsMock).not.toHaveBeenCalled()
    open.value = true
    await nextTick()
    await flushPromises()
    expect(getGlobalPriceListsMock).toHaveBeenCalledTimes(1)
    expect(results[0]!.data.value).toEqual(LISTS)
  })
})
