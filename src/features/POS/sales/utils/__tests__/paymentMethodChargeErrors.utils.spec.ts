import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { AxiosError } from 'axios'
import {
  applyCatalogChargeErrorAction,
  getPaymentMethodChargeErrorAction,
  PAYMENT_METHOD_CHARGE_ERROR_MAP,
  type PaymentMethodChargeErrorEnvelope,
} from '../paymentMethodChargeErrors.utils'

function axiosError(code: string | undefined): AxiosError<PaymentMethodChargeErrorEnvelope> {
  return {
    response: { data: code ? { error: code } : {}, status: 400, statusText: 'Bad Request', headers: {}, config: {} as never },
    config: {} as never,
    isAxiosError: true,
    toJSON: () => ({}),
    name: 'AxiosError',
    message: 'Request failed',
  }
}

function makeContext() {
  const invalidateQueries = vi.fn().mockResolvedValue(undefined)
  const toastAdd = vi.fn()
  const catalogClearSignal = ref(0)
  return {
    context: {
      queryClient: { invalidateQueries },
      tenantId: { value: 'tenant-1' },
      toast: { add: toastAdd },
      catalogClearSignal,
    },
    invalidateQueries,
    toastAdd,
    catalogClearSignal,
  }
}

describe('getPaymentMethodChargeErrorAction (design §8.2)', () => {
  it('PAYMENT_METHOD_CATEGORY_MISMATCH → clear silently, no refetch, no toast', () => {
    expect(getPaymentMethodChargeErrorAction('PAYMENT_METHOD_CATEGORY_MISMATCH')).toEqual({
      clearCatalogSelection: true,
      refetchSelector: false,
      toast: undefined,
    })
  })

  it('PAYMENT_METHOD_NOT_FOUND → clear + refetch + toast "Método de cobro no disponible."', () => {
    expect(getPaymentMethodChargeErrorAction('PAYMENT_METHOD_NOT_FOUND')).toEqual({
      clearCatalogSelection: true,
      refetchSelector: true,
      toast: 'Método de cobro no disponible.',
    })
  })

  it('INACTIVE_PAYMENT_METHOD → clear + refetch + toast "Este método fue desactivado."', () => {
    expect(getPaymentMethodChargeErrorAction('INACTIVE_PAYMENT_METHOD')).toEqual({
      clearCatalogSelection: true,
      refetchSelector: true,
      toast: 'Este método fue desactivado.',
    })
  })

  it('INVALID_PAYMENT_METHOD_ID → defensive toast only, no clear, no refetch', () => {
    expect(getPaymentMethodChargeErrorAction('INVALID_PAYMENT_METHOD_ID')).toEqual({
      clearCatalogSelection: false,
      refetchSelector: false,
      toast: 'Método de cobro inválido.',
    })
  })

  it('legacy code (PAYMENT_AMOUNT_INSUFFICIENT) → null so the legacy dispatch runs (REQ-CAT-011)', () => {
    expect(getPaymentMethodChargeErrorAction('PAYMENT_AMOUNT_INSUFFICIENT')).toBeNull()
  })

  it('unknown/absent code → null', () => {
    expect(getPaymentMethodChargeErrorAction('SOME_FUTURE_CODE')).toBeNull()
    expect(getPaymentMethodChargeErrorAction(undefined)).toBeNull()
  })

  it('map is keyed by the four catalog codes (no drift)', () => {
    expect(Object.keys(PAYMENT_METHOD_CHARGE_ERROR_MAP).sort()).toEqual([
      'INACTIVE_PAYMENT_METHOD',
      'INVALID_PAYMENT_METHOD_ID',
      'PAYMENT_METHOD_CATEGORY_MISMATCH',
      'PAYMENT_METHOD_NOT_FOUND',
    ])
  })
})

describe('applyCatalogChargeErrorAction (REQ-CAT-011 short-circuit pipeline)', () => {
  it('returns { handled: false } for a legacy code and performs no side effects', () => {
    const { context, invalidateQueries, toastAdd, catalogClearSignal } = makeContext()

    const result = applyCatalogChargeErrorAction(axiosError('PAYMENT_AMOUNT_INSUFFICIENT'), context)

    expect(result).toEqual({ handled: false })
    expect(catalogClearSignal.value).toBe(0)
    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('CATEGORY_MISMATCH → handled, increments the signal exactly once, silent, no refetch', () => {
    const { context, invalidateQueries, toastAdd, catalogClearSignal } = makeContext()

    const result = applyCatalogChargeErrorAction(axiosError('PAYMENT_METHOD_CATEGORY_MISMATCH'), context)

    expect(result).toEqual({ handled: true })
    expect(catalogClearSignal.value).toBe(1)
    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('NOT_FOUND → handled, increments signal, invalidates saleQueryKeys.paymentMethods(tenant) exactly once, toasts', () => {
    const { context, invalidateQueries, toastAdd, catalogClearSignal } = makeContext()

    const result = applyCatalogChargeErrorAction(axiosError('PAYMENT_METHOD_NOT_FOUND'), context)

    expect(result).toEqual({ handled: true })
    expect(catalogClearSignal.value).toBe(1)
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'payment-methods'] })
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith({ title: 'Método de cobro no disponible.', color: 'error' })
  })

  it('INACTIVE → handled, increments signal, invalidates once, toasts "Este método fue desactivado."', () => {
    const { context, invalidateQueries, toastAdd, catalogClearSignal } = makeContext()

    const result = applyCatalogChargeErrorAction(axiosError('INACTIVE_PAYMENT_METHOD'), context)

    expect(result).toEqual({ handled: true })
    expect(catalogClearSignal.value).toBe(1)
    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'payment-methods'] })
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith({ title: 'Este método fue desactivado.', color: 'error' })
  })

  it('INVALID_PAYMENT_METHOD_ID → handled with defensive toast only (REQ-CAT-010)', () => {
    const { context, invalidateQueries, toastAdd, catalogClearSignal } = makeContext()

    const result = applyCatalogChargeErrorAction(axiosError('INVALID_PAYMENT_METHOD_ID'), context)

    expect(result).toEqual({ handled: true })
    expect(catalogClearSignal.value).toBe(0)
    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith({ title: 'Método de cobro inválido.', color: 'error' })
  })

  it('uses tenantId.value at error time (not a snapshot) for the invalidation key', () => {
    const { context, invalidateQueries } = makeContext()
    context.tenantId.value = 'tenant-2'

    applyCatalogChargeErrorAction(axiosError('PAYMENT_METHOD_NOT_FOUND'), context)

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-2', 'payment-methods'] })
  })
})
