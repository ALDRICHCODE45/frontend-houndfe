// owner-ideas-batch T3 (S5): the customer history takes the page size of the «Ventas» tab. It stays
// 10 when none is given, so the customer page overview (page 1, no limit) shares the tab's first
// request while the tab is at 10.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useCustomerSalesHistory } from '../useCustomerSalesHistory'

const listConfirmed = vi.hoisted(() => vi.fn())
vi.mock('../../api/sale.api', () => ({ saleApi: { listConfirmed } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

const response = (limit: number) => ({
  data: [],
  pagination: { page: 1, limit, total: 0, totalPages: 0 },
  counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
  summary: { salesCount: 0, totalSoldCents: 0, outstandingDebtCents: 0 },
})

const wrappers: VueWrapper[] = []
function mountHistories(client: QueryClient, setups: Array<{ limit?: Ref<number> }>) {
  const wrapper = mount(
    defineComponent({
      setup() {
        for (const { limit } of setups) {
          useCustomerSalesHistory({ customerId: 'customer-1', page: 1, open: true, ...(limit && { limit }) })
        }
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  )
  wrappers.push(wrapper)
}
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

beforeEach(() => {
  listConfirmed.mockReset().mockImplementation(async (params: { limit: number }) => response(params.limit))
})
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
})

describe('useCustomerSalesHistory — limit (S5)', () => {
  it('sends the given limit in the request and the key, and follows its changes', async () => {
    const limit = ref(25)
    const queryClient = client()
    mountHistories(queryClient, [{ limit }])
    await vi.waitFor(() => expect(listConfirmed).toHaveBeenCalledTimes(1))
    expect(listConfirmed.mock.calls[0]![0]).toMatchObject({ page: 1, limit: 25 })
    expect(queryClient.getQueryCache().findAll()[0]!.queryKey[4]).toMatchObject({ limit: 25 })

    limit.value = 40
    await vi.waitFor(() => expect(listConfirmed).toHaveBeenCalledTimes(2))
    expect(listConfirmed.mock.calls[1]![0]).toMatchObject({ limit: 40 })
  })

  it('without a limit it asks for 10 and shares one request with a history at 10', async () => {
    mountHistories(client(), [{}, { limit: ref(10) }])
    await vi.waitFor(() => expect(listConfirmed).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(listConfirmed).toHaveBeenCalledTimes(1)
    expect(listConfirmed.mock.calls[0]![0]).toMatchObject({ limit: 10 })
  })

  it('a history at another size makes its own request', async () => {
    mountHistories(client(), [{}, { limit: ref(35) }])
    await vi.waitFor(() => expect(listConfirmed).toHaveBeenCalledTimes(2))
    expect(listConfirmed.mock.calls.map((call) => (call[0] as { limit: number }).limit).sort()).toEqual([10, 35])
  })
})
