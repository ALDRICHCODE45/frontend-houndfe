import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useConfirmedSales, mapServerTableParamsToListSalesParams } from '../useConfirmedSales'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    listConfirmed: vi.fn(),
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
  }),
}))

function mountComposable<T>(composable: () => T) {
  let result: T | undefined

  const TestComponent = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

  const wrapper = mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return { result: result!, wrapper }
}

describe('useConfirmedSales', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.listConfirmed).mockResolvedValue({
      data: [
        {
          id: 'sale-1',
          folio: 'A-202605-000012',
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          deliveryStatus: 'DELIVERED',
          totalCents: 127000,
          debtCents: 0,
          confirmedAt: '2026-05-06T14:43:00.000Z',
          customer: { id: 'customer-1', name: 'Empresa F.' },
          cashier: { id: 'cashier-1', name: 'cesar flores' },
          seller: null,
        },
      ],
      pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
      counts: { all: 50, pendingPayments: 3, notDelivered: 1 },
    })
  })

  it('maps server table params to list-confirmed params', () => {
    expect(
      mapServerTableParamsToListSalesParams({
        pageIndex: 0,
        pageSize: 20,
        sorting: [{ id: 'totalCents', desc: false }],
        globalFilter: 'jean',
      }),
    ).toEqual({
      page: 1,
      limit: 20,
      sortBy: 'totalCents',
      sortOrder: 'asc',
      q: 'jean',
    })
  })

  it('loads confirmed sales with default filters and exposes counts', async () => {
    const { result } = mountComposable(() => useConfirmedSales())

    await vi.waitFor(() => {
      expect(saleApi.listConfirmed).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
      })
    })

    await vi.waitFor(() => {
      expect(result.data.value).toHaveLength(1)
      expect(result.counts.value).toEqual({ all: 50, pendingPayments: 3, notDelivered: 1 })
      expect(result.totalCount.value).toBe(50)
    })
  })

  it('forwards deliveryStatus when tab filter changes', async () => {
    const { result } = mountComposable(() => useConfirmedSales())
    await vi.waitFor(() => expect(saleApi.listConfirmed).toHaveBeenCalledTimes(1))

    result.setDeliveryStatusFilter('PENDING')

    await vi.waitFor(() => {
      expect(saleApi.listConfirmed).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
        deliveryStatus: 'PENDING',
      })
    })
  })
})
