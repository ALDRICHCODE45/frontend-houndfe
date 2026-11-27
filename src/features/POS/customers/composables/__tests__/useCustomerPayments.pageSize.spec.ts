// owner-ideas-batch T3 (S5): «Cobros y recibos» offers the shared 5..50 page sizes and remembers
// the choice under 'customer-payments' (default 50).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { TABLE_PAGE_SIZE_OPTIONS } from '@/core/shared/constants/table-page-size'
import { pageSizeStorageKey } from '@/core/shared/composables/useTablePageSize'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))
const getPayments = vi.hoisted(() => vi.fn())
vi.mock('../../api/customer-detail.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/customer-detail.api')>()
  return { ...actual, customerDetailApi: { ...actual.customerDetailApi, getPayments } }
})

import { useCustomerPayments } from '../useCustomerPayments'

const KEY = pageSizeStorageKey('customer-payments')
const empty = () => ({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })

const wrappers: VueWrapper[] = []
function harness() {
  let result!: ReturnType<typeof useCustomerPayments>
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(
    defineComponent({
      setup() {
        result = useCustomerPayments({ customerId: () => 'c-1', enabled: () => true })
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
  getPayments.mockReset().mockResolvedValue(empty())
})
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
})

describe('useCustomerPayments — page size (S5)', () => {
  it('offers 5 to 50 in steps of 5 and asks for 50 by default', async () => {
    const { result } = harness()
    expect(result.pageSizeOptions).toEqual([...TABLE_PAGE_SIZE_OPTIONS])
    expect(result.pageSize.value).toBe(50)
    await flushPromises()
    expect(getPayments).toHaveBeenCalledTimes(1)
    expect(getPayments).toHaveBeenCalledWith('c-1', 1, 50)
  })

  it('the first request uses the stored size', async () => {
    localStorage.setItem(KEY, '15')
    harness()
    await flushPromises()
    expect(getPayments).toHaveBeenCalledTimes(1)
    expect(getPayments).toHaveBeenCalledWith('c-1', 1, 15)
  })

  it.each([['7'], ['100'], ['"abc"'], ['not json']])('an invalid stored size %s falls back to 50', async (stored) => {
    localStorage.setItem(KEY, stored)
    const { result } = harness()
    expect(result.pageSize.value).toBe(50)
    await flushPromises()
    expect(getPayments).toHaveBeenCalledWith('c-1', 1, 50)
  })

  it('a new size goes back to page 1, is requested and remembered across a remount', async () => {
    const first = harness()
    await flushPromises()
    first.result.page.value = 2
    await flushPromises()
    first.result.pageSize.value = 20
    await nextTick()
    expect(first.result.page.value).toBe(1)
    await flushPromises()
    expect(getPayments).toHaveBeenLastCalledWith('c-1', 1, 20)
    expect(localStorage.getItem(KEY)).toBe('20')

    first.wrapper.unmount()
    getPayments.mockClear()
    const second = harness()
    expect(second.result.pageSize.value).toBe(20)
    await flushPromises()
    expect(getPayments).toHaveBeenCalledWith('c-1', 1, 20)
  })
})
