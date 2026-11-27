// owner-ideas-batch T3 (S5): the customer's quotations offer the shared 5..50 page sizes and
// remember the choice under 'customer-quotations' (default 10).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { TABLE_PAGE_SIZE_OPTIONS } from '@/core/shared/constants/table-page-size'
import { pageSizeStorageKey } from '@/core/shared/composables/useTablePageSize'
import type { PaginatedQuotations } from '../../interfaces/quotation.types'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))
const list = vi.hoisted(() => vi.fn())
vi.mock('../../api/quotation.api', () => ({ quotationApi: { list } }))

import { useCustomerQuotations } from '../useCustomerQuotations'

const KEY = pageSizeStorageKey('customer-quotations')
const empty = (): PaginatedQuotations => ({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })

const wrappers: VueWrapper[] = []
function harness() {
  let result!: ReturnType<typeof useCustomerQuotations>
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(
    defineComponent({
      setup() {
        result = useCustomerQuotations({ customerId: () => 'c-1', enabled: () => true })
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  )
  wrappers.push(wrapper)
  return { result, wrapper }
}

beforeEach(() => {
  localStorage.clear()
  list.mockReset().mockResolvedValue(empty())
})
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
})

describe('useCustomerQuotations — page size (S5)', () => {
  it('offers 5 to 50 in steps of 5 and asks for 10 by default', async () => {
    const { result } = harness()
    expect(result.pageSizeOptions).toEqual([...TABLE_PAGE_SIZE_OPTIONS])
    expect(result.pageSize.value).toBe(10)
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(1)
    expect(list.mock.calls[0]![0]).toMatchObject({ page: 1, limit: 10 })
  })

  it('the first request uses the stored size', async () => {
    localStorage.setItem(KEY, '25')
    harness()
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(1)
    expect(list.mock.calls[0]![0]).toMatchObject({ page: 1, limit: 25 })
  })

  it.each([['7'], ['100'], ['"abc"'], ['not json']])('an invalid stored size %s falls back to 10', async (stored) => {
    localStorage.setItem(KEY, stored)
    const { result } = harness()
    expect(result.pageSize.value).toBe(10)
    await flushPromises()
    expect(list.mock.calls[0]![0]).toMatchObject({ limit: 10 })
  })

  it('a new size goes back to page 1, is requested and remembered across a remount', async () => {
    const first = harness()
    await flushPromises()
    first.result.page.value = 3
    await flushPromises()
    first.result.pageSize.value = 40
    await nextTick()
    expect(first.result.page.value).toBe(1)
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 40 }))
    expect(localStorage.getItem(KEY)).toBe('40')

    first.wrapper.unmount()
    list.mockClear()
    const second = harness()
    expect(second.result.pageSize.value).toBe(40)
    await flushPromises()
    expect(list.mock.calls[0]![0]).toMatchObject({ page: 1, limit: 40 })
  })
})
