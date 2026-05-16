import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useSaleDueDate } from '../useSaleDueDate'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import type { SaleDetail } from '../../interfaces/sale.types'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    setDueDate: vi.fn(),
  },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))

const baseSaleDetail = (overrides: Partial<SaleDetail> = {}): SaleDetail =>
  ({
    id: 'sale-1',
    folio: 'V-001',
    status: 'CONFIRMED',
    channel: 'POS',
    register: 'Principal',
    confirmedAt: '2026-01-01T00:00:00.000Z',
    dueDate: null,
    subtotalCents: 1000,
    discountCents: 0,
    totalCents: 1000,
    paidCents: 1000,
    debtCents: 0,
    changeDueCents: 0,
    paymentStatus: 'PAID',
    deliveryStatus: 'DELIVERED',
    customer: null,
    cashier: { id: 'u-cash', name: 'Cashier' },
    seller: null,
    items: [],
    payments: [],
    timeline: [],
    ...overrides,
  }) as SaleDetail

function mountComposable(saleId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  let result: ReturnType<typeof useSaleDueDate> | undefined

  const TestComponent = defineComponent({
    setup() {
      const maybeSaleId = computed(() => saleId)
      result = useSaleDueDate(maybeSaleId)
      return () => h('div')
    },
  })

  mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })

  return { composable: result!, queryClient, invalidateQueries }
}

describe('useSaleDueDate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.setDueDate).mockResolvedValue(baseSaleDetail())
  })

  it('setDueDate with a date string calls API and invalidates the sale detail', async () => {
    const { composable, invalidateQueries } = mountComposable('sale-1')

    await composable.setDueDate('2026-06-15')

    expect(saleApi.setDueDate).toHaveBeenCalledWith('sale-1', { dueDate: '2026-06-15' })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: saleQueryKeys.detail('tenant-1', 'sale-1'),
    })
  })

  it('setDueDate with null clears the due date and invalidates', async () => {
    const { composable, invalidateQueries } = mountComposable('sale-1')

    await composable.setDueDate(null)

    expect(saleApi.setDueDate).toHaveBeenCalledWith('sale-1', { dueDate: null })
    expect(invalidateQueries).toHaveBeenCalled()
  })

  it('maps backend domain errors to typed lastError', async () => {
    const { composable } = mountComposable('sale-1')
    const codes = ['INVALID_DUE_DATE', 'SALE_ALREADY_PAID', 'SALE_NOT_FOUND', 'SALE_UPDATE_FORBIDDEN'] as const

    for (const code of codes) {
      vi.mocked(saleApi.setDueDate).mockRejectedValueOnce({
        response: { data: { error: code } },
      })
      await expect(composable.setDueDate('2026-06-15')).rejects.toMatchObject({ code })
      expect(composable.lastError.value?.code).toBe(code)
    }
  })
})
