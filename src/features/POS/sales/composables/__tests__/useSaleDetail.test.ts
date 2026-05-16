import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useSaleDetail } from '../useSaleDetail'

const push = vi.fn()
const addToast = vi.fn()

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    getById: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
  }),
}))

vi.stubGlobal('useToast', () => ({ add: addToast }))

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

  mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return result!
}

describe('useSaleDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.getById).mockResolvedValue({
      id: 'sale-1',
      folio: 'A-202605-000012',
      status: 'CONFIRMED',
      channel: 'POS',
      register: 'Principal',
      confirmedAt: '2026-05-06T14:43:00.000Z',
      dueDate: null,
      subtotalCents: 127000,
      discountCents: 0,
      totalCents: 127000,
      paidCents: 127000,
      debtCents: 0,
      changeDueCents: 0,
      paymentStatus: 'PAID',
      deliveryStatus: 'DELIVERED',
      customer: { id: 'c1', name: 'Empresa F.' },
      cashier: { id: 'u1', name: 'Cajero' },
      seller: null,
      items: [],
      payments: [],
      timeline: [],
    })
  })

  it('returns sale data when request succeeds', async () => {
    const result = mountComposable(() => useSaleDetail(computed(() => 'sale-1')))

    await vi.waitFor(() => {
      expect(saleApi.getById).toHaveBeenCalledWith('sale-1')
      expect(result.sale.value?.id).toBe('sale-1')
    })
  })

  it('exposes error state when backend returns 404', async () => {
    vi.mocked(saleApi.getById).mockRejectedValueOnce({ response: { status: 404 }, status: 404 })

    const result = mountComposable(() => useSaleDetail(computed(() => 'missing-id')))

    await vi.waitFor(() => {
      expect(saleApi.getById).toHaveBeenCalledWith('missing-id')
      expect(result.isError.value).toBe(true)
    })
  })
})
