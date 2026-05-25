import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useDebtPayment } from '../useDebtPayment'
import { getSalePaymentErrorAction } from '../../utils/salePaymentErrors.utils'
import type { DebtPaymentPayload, DebtPaymentResponse } from '../../interfaces/sale.types'

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

const MULTI_PAYLOAD: DebtPaymentPayload = {
  payments: [
    { method: 'cash', amountCents: 5000 },
    { method: 'transfer', amountCents: 3000, reference: 'TRF-001' },
  ],
}

const SUCCESS_RESPONSE: DebtPaymentResponse = {
  saleId: 'sale-1',
  paidCents: 8000,
  debtCents: 2000,
  totalCents: 10000,
  paymentStatus: 'PARTIAL',
  paymentIds: ['pay-1', 'pay-2'],
}

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
    // @ts-expect-error — global auto-import mock
    globalThis.useToast = () => ({ add: addToast })
    vi.mocked(saleApi.registerDebtPayment).mockResolvedValue(SUCCESS_RESPONSE)
  })

  it('submits multi-method Form A payload with idempotency key', async () => {
    const composable = mountComposable()

    await composable.submit({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-1' })

    expect(saleApi.registerDebtPayment).toHaveBeenCalledWith(
      'sale-1',
      MULTI_PAYLOAD,
      'key-1',
    )
  })

  it('invalidates detail and confirmed list queries on success', async () => {
    const composable = mountComposable()

    await composable.submit({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-2' })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'detail', 'sale-1'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'confirmed', {}] })
  })

  it('shows "Venta pagada" toast when paymentStatus is PAID', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockResolvedValue({
      ...SUCCESS_RESPONSE,
      paymentStatus: 'PAID',
      debtCents: 0,
    })

    const composable = mountComposable()
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-3' })
    await flushPromises()

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Venta pagada', color: 'success' }),
    )
  })

  it('shows "Pago parcial registrado" toast when paymentStatus is PARTIAL', async () => {
    const composable = mountComposable()
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-4' })
    await flushPromises()

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pago parcial registrado', color: 'success' }),
    )
  })

  it('sets externalErrorCode on PAYMENT_EXCEEDS_DEBT and does NOT signal close', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({
      response: { data: { error: 'PAYMENT_EXCEEDS_DEBT' } },
    })
    vi.mocked(getSalePaymentErrorAction).mockReturnValueOnce({ type: 'inline', message: 'El monto supera la deuda actual.' })

    const composable = mountComposable()
    try {
      await composable.submit({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-5' })
    } catch {
      // expected rejection from mutateAsync
    }

    await flushPromises()
    await flushPromises()
    expect(composable.externalErrorCode.value).toBe('PAYMENT_EXCEEDS_DEBT')
    expect(composable.shouldClose.value).toBe(false)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'detail', 'sale-1'] })
  })

  it('signals close and toasts on NO_OUTSTANDING_DEBT', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({
      response: { data: { error: 'NO_OUTSTANDING_DEBT' } },
    })
    vi.mocked(getSalePaymentErrorAction).mockReturnValueOnce({ type: 'refetch', message: 'Ya no tiene deuda.' })

    const composable = mountComposable()
    // Use submitSafe (catches rejection) to let onError run before assertions
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-6' })
    await flushPromises()

    expect(composable.shouldClose.value).toBe(true)
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
  })

  it('signals close on SALE_NOT_FOUND and invalidates list', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({
      response: { data: { error: 'SALE_NOT_FOUND' } },
    })
    vi.mocked(getSalePaymentErrorAction).mockReturnValueOnce({ type: 'refetch', message: 'No existe.' })

    const composable = mountComposable()
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-7' })
    await flushPromises()

    expect(composable.shouldClose.value).toBe(true)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'confirmed', {}] })
  })

  it('shows generic toast on network error without error code', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce(new Error('Network Error'))

    const composable = mountComposable()
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-8' })
    await flushPromises()

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No pudimos registrar el pago' }),
    )
    expect(composable.shouldClose.value).toBe(false)
  })

  it('resetError clears externalErrorCode and shouldClose', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({
      response: { data: { error: 'PAYMENT_EXCEEDS_DEBT' } },
    })
    vi.mocked(getSalePaymentErrorAction).mockReturnValueOnce({ type: 'inline', message: 'Supera deuda.' })

    const composable = mountComposable()
    try {
      await composable.submit({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-9' })
    } catch {
      // expected rejection from mutateAsync
    }

    await flushPromises()
    await flushPromises()
    expect(composable.externalErrorCode.value).toBe('PAYMENT_EXCEEDS_DEBT')

    composable.resetError()
    expect(composable.externalErrorCode.value).toBeNull()
    expect(composable.shouldClose.value).toBe(false)
  })
})
