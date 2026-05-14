import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useDebtPayment } from '../useDebtPayment'
import { getSalePaymentErrorAction } from '../../utils/salePaymentErrors.utils'

const addToast = vi.fn()
const invalidateQueries = vi.fn()

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    registerDebtPayment: vi.fn(),
  },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))

vi.mock('@tanstack/vue-query', async () => {
  const actual = await vi.importActual('@tanstack/vue-query')
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries }),
  }
})

vi.mock('../../utils/salePaymentErrors.utils', () => ({
  getSalePaymentErrorAction: vi.fn(() => ({ type: 'inline', message: 'Error de prueba' })),
}))

vi.stubGlobal('useToast', () => ({ add: addToast }))

function mountComposable() {
  let result: ReturnType<typeof useDebtPayment> | undefined

  const TestComponent = defineComponent({
    setup() {
      result = useDebtPayment('sale-1')
      return () => h('div')
    },
  })

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return result!
}

describe('useDebtPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.registerDebtPayment).mockResolvedValue({
      saleId: 'sale-1',
      paidCents: 8000,
      debtCents: 2000,
      totalCents: 10000,
      paymentStatus: 'PARTIAL',
    })
  })

  it('submits debt payment with method/amount/reference and generated idempotency key', async () => {
    const composable = mountComposable()

    await composable.submit({ method: 'transfer', amountCents: 2000, reference: 'TRF-001' })

    expect(saleApi.registerDebtPayment).toHaveBeenCalledWith(
      'sale-1',
      { method: 'transfer', amountCents: 2000, reference: 'TRF-001' },
      expect.any(String),
    )
  })

  it('invalidates sale detail query after successful payment', async () => {
    const composable = mountComposable()

    await composable.submit({ method: 'cash', amountCents: 1000 })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'detail', 'sale-1'] })
  })

  it('uses mapped UX action for error handling', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({ response: { data: { error: 'PAYMENT_EXCEEDS_DEBT' } } })
    const composable = mountComposable()

    await expect(composable.submit({ method: 'cash', amountCents: 1000 })).rejects.toBeTruthy()

    expect(getSalePaymentErrorAction).toHaveBeenCalledWith('PAYMENT_EXCEEDS_DEBT')
  })

  it('refetches detail on NO_OUTSTANDING_DEBT', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({ response: { data: { error: 'NO_OUTSTANDING_DEBT' } } })
    const composable = mountComposable()

    await expect(composable.submit({ method: 'cash', amountCents: 1000 })).rejects.toBeTruthy()

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'detail', 'sale-1'] })
  })

  it('refetches detail on PAYMENT_EXCEEDS_DEBT', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({ response: { data: { error: 'PAYMENT_EXCEEDS_DEBT' } } })
    const composable = mountComposable()

    await expect(composable.submit({ method: 'cash', amountCents: 1000 })).rejects.toBeTruthy()

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'detail', 'sale-1'] })
  })
})
