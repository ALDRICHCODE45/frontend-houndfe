import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useDebtPayment } from '../useDebtPayment'
import { getSalePaymentErrorAction } from '../../utils/salePaymentErrors.utils'
import type { DebtPaymentPayload, DebtPaymentResponse } from '../../interfaces/sale.types'

const { addToast } = vi.hoisted(() => ({ addToast: vi.fn() }))
const invalidateQueries = vi.fn()

// `useDebtPayment` calls the bare `useToast()`, which @nuxt/ui's Vite
// auto-import transform rewrites into a real module import — so vi.stubGlobal
// no longer intercepts it. Mock the auto-imported module directly instead.
vi.mock('@nuxt/ui/runtime/composables/useToast.js', () => ({
  useToast: () => ({ add: addToast }),
}))

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

// ─── sdd custom-payment-methods S5A — catalog charge error dispatch ────────
// REQ-CAT-007..011: useDebtPayment.onError must resolve the four catalog
// codes FIRST (clear/refetch/toast per design §8.2) and short-circuit BEFORE
// the legacy getSalePaymentErrorAction path.
describe('useDebtPayment S5A — catalog charge error dispatch (REQ-CAT-007..011)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // vi.clearAllMocks() does not clear vi.hoisted-created mocks (addToast)
    // nor mockReturnValueOnce queues in this vitest version — stale queued
    // values from earlier tests would otherwise be consumed by these tests'
    // getSalePaymentErrorAction calls and surface wrong toasts. Reset
    // explicitly and re-establish the default implementation.
    addToast.mockClear()
    vi.mocked(getSalePaymentErrorAction).mockReset()
    vi.mocked(getSalePaymentErrorAction).mockImplementation(() => ({ type: 'inline', message: 'Error de prueba' }))
    vi.mocked(saleApi.registerDebtPayment).mockResolvedValue(SUCCESS_RESPONSE)
  })

  it('CATEGORY_MISMATCH → increments catalogClearSignal once, no toast, legacy dispatch NOT invoked', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({
      response: { data: { error: 'PAYMENT_METHOD_CATEGORY_MISMATCH' } },
    })

    const composable = mountComposable()
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-cat-1' })
    await flushPromises()
    await flushPromises()

    expect(composable.catalogClearSignal.value).toBe(1)
    expect(addToast).not.toHaveBeenCalled()
    expect(getSalePaymentErrorAction).not.toHaveBeenCalled()
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['sales', 'tenant-1', 'payment-methods'],
    })
  })

  it('NOT_FOUND → increments signal, invalidates the projection key once, toasts, legacy NOT invoked', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({
      response: { data: { error: 'PAYMENT_METHOD_NOT_FOUND' } },
    })

    const composable = mountComposable()
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-cat-2' })
    await flushPromises()
    await flushPromises()

    expect(composable.catalogClearSignal.value).toBe(1)
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sales', 'tenant-1', 'payment-methods'],
    })
    expect(addToast).toHaveBeenCalledTimes(1)
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Método de cobro no disponible.' }),
    )
    expect(getSalePaymentErrorAction).not.toHaveBeenCalled()
  })

  it('INACTIVE → increments signal, invalidates the projection key once, toasts, legacy NOT invoked', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({
      response: { data: { error: 'INACTIVE_PAYMENT_METHOD' } },
    })

    const composable = mountComposable()
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-cat-3' })
    await flushPromises()
    await flushPromises()

    expect(composable.catalogClearSignal.value).toBe(1)
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sales', 'tenant-1', 'payment-methods'],
    })
    expect(addToast).toHaveBeenCalledTimes(1)
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Este método fue desactivado.' }),
    )
    expect(getSalePaymentErrorAction).not.toHaveBeenCalled()
  })

  it('INVALID_PAYMENT_METHOD_ID → defensive toast only; no clear, no refetch, legacy NOT invoked', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({
      response: { data: { error: 'INVALID_PAYMENT_METHOD_ID' } },
    })

    const composable = mountComposable()
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-cat-4' })
    await flushPromises()
    await flushPromises()

    expect(composable.catalogClearSignal.value).toBe(0)
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['sales', 'tenant-1', 'payment-methods'],
    })
    expect(addToast).toHaveBeenCalledTimes(1)
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Método de cobro inválido.' }),
    )
    expect(getSalePaymentErrorAction).not.toHaveBeenCalled()
  })

  it('legacy code (PAYMENT_AMOUNT_INSUFFICIENT) → legacy dispatch runs unchanged, signal NOT incremented', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({
      response: { data: { error: 'PAYMENT_AMOUNT_INSUFFICIENT' } },
    })
    vi.mocked(getSalePaymentErrorAction).mockReturnValueOnce({
      type: 'inline',
      message: 'Agregá un pago en efectivo o ajustá los montos para cubrir el total',
    })

    const composable = mountComposable()
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-cat-5' })
    await flushPromises()
    await flushPromises()

    expect(getSalePaymentErrorAction).toHaveBeenCalledTimes(1)
    expect(getSalePaymentErrorAction).toHaveBeenCalledWith('PAYMENT_AMOUNT_INSUFFICIENT')
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Agregá un pago en efectivo o ajustá los montos para cubrir el total',
        color: 'error',
      }),
    )
    expect(composable.catalogClearSignal.value).toBe(0)
  })

  it('unknown code with null catalog action and undefined legacy action → generic fallback toast (no crash)', async () => {
    vi.mocked(saleApi.registerDebtPayment).mockRejectedValueOnce({
      response: { data: { error: 'SOME_FUTURE_CODE' } },
    })
    // Legacy map returns undefined for an unknown code — the guard must fall
    // through to the generic toast instead of crashing on action.message.
    vi.mocked(getSalePaymentErrorAction).mockReturnValueOnce(undefined as never)

    const composable = mountComposable()
    await composable.submitSafe({ payload: MULTI_PAYLOAD, idempotencyKey: 'key-cat-6' })
    await flushPromises()
    await flushPromises()

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No pudimos registrar el pago' }),
    )
    expect(composable.catalogClearSignal.value).toBe(0)
  })
})
