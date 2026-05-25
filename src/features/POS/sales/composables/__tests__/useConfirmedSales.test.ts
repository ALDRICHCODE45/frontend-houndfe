import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
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
          dueDate: null,
          customer: { id: 'customer-1', name: 'Empresa F.' },
          cashier: { id: 'cashier-1', name: 'cesar flores' },
          seller: null,
          paymentMethods: ['CASH'],
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
    const { result } = mountComposable(() => useConfirmedSales(ref({})))
    await vi.waitFor(() => expect(saleApi.listConfirmed).toHaveBeenCalledTimes(1))

    result.setDeliveryStatusFilter('PENDING')

    await vi.waitFor(() => {
      expect(saleApi.listConfirmed).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
        deliveryStatus: ['PENDING'],
      })
    })
  })

  it('forwards deliveryStatus from extended filter (slideover) when quick filter is unset', async () => {
    // Regression: previously the queryFn unconditionally overwrote deliveryStatus
    // with the quick-filter value (undefined when "Todas" is selected), so the
    // schema-driven slideover filter never reached the API and no request fired.
    const filters = ref<Record<string, unknown>>({
      deliveryStatus: ['DELIVERED'],
    })

    mountComposable(() => useConfirmedSales(filters))

    await vi.waitFor(() => {
      expect(saleApi.listConfirmed).toHaveBeenLastCalledWith(expect.objectContaining({
        deliveryStatus: ['DELIVERED'],
      }))
    })
  })

  it('slideover deliveryStatus wins over quick filter when both are set', async () => {
    const filters = ref<Record<string, unknown>>({
      deliveryStatus: ['DELIVERED'],
    })

    const { result } = mountComposable(() => useConfirmedSales(filters))
    await vi.waitFor(() => expect(saleApi.listConfirmed).toHaveBeenCalledTimes(1))

    result.setDeliveryStatusFilter('PENDING')

    await vi.waitFor(() => {
      expect(saleApi.listConfirmed).toHaveBeenLastCalledWith(expect.objectContaining({
        deliveryStatus: ['DELIVERED'],
      }))
    })
  })

  it('forwards extended filter state to listConfirmed params', async () => {
    const filters = ref({
      paymentStatus: ['PAID'],
      customerId: ['customer-1'],
      customerIncludeNull: true,
      totalMin: 1000,
    })

    mountComposable(() => useConfirmedSales(filters))

    await vi.waitFor(() => {
      expect(saleApi.listConfirmed).toHaveBeenLastCalledWith(expect.objectContaining({
        paymentStatus: ['PAID'],
        customerId: ['customer-1'],
        customerIncludeNull: true,
        totalMin: 1000,
      }))
    })
  })

  it('transforms folio CSV tokens before calling listConfirmed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-23T12:00:00.000Z'))

    const filters = ref({
      folio: '17,#18,A-202605-000016',
    })

    mountComposable(() => useConfirmedSales(filters))

    await vi.waitFor(() => {
      expect(saleApi.listConfirmed).toHaveBeenLastCalledWith(expect.objectContaining({
        folio: 'A-202605-000017,A-202605-000018,A-202605-000016',
      }))
    })

    vi.useRealTimers()
  })

  it('maps backend listing 400 errors to filterErrors', async () => {
    vi.mocked(saleApi.listConfirmed).mockRejectedValueOnce({
      response: {
        data: {
          error: {
            code: 'LISTING_INVALID_ENUM_VALUE',
            field: 'paymentStatus',
          },
        },
      },
    })

    const { result } = mountComposable(() => useConfirmedSales(ref({ paymentStatus: ['BAD'] })))

    await vi.waitFor(() => {
      expect(result.filterErrors.value.paymentStatus).toContain('Valor inválido')
    })
  })
})
