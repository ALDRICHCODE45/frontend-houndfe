import type { AxiosError } from 'axios'
import type { QueryClient } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'

/**
 * sdd custom-payment-methods S5A — catalog charge-error map + shared dispatch
 * pipeline (design §8.2, REQ-CAT-007..011).
 *
 * Deliberately ISOLATED from `salePaymentErrors.utils.ts` (proposal risk #7):
 * the legacy map keys `ChargeDomainErrorCode` and would never match these four
 * catalog codes, but keeping them in a separate module prevents any future
 * collision and makes the short-circuit ordering explicit at the call sites.
 *
 * Dispatch order (REQ-CAT-011) in BOTH `SalesView.handleChargeDraft` and
 * `useDebtPayment.onError`:
 *   1. `getPaymentMethodChargeErrorAction(code)` FIRST.
 *   2. Non-null → `applyCatalogChargeErrorAction` handles it and the caller
 *      RETURNS (never falls through to `getSalePaymentErrorAction`).
 *   3. Else → legacy error dispatch unchanged.
 */

export type PaymentMethodChargeErrorCode =
  | 'INVALID_PAYMENT_METHOD_ID'
  | 'PAYMENT_METHOD_CATEGORY_MISMATCH'
  | 'PAYMENT_METHOD_NOT_FOUND'
  | 'INACTIVE_PAYMENT_METHOD'

export interface PaymentMethodChargeErrorAction {
  clearCatalogSelection: boolean
  refetchSelector: boolean
  /** undefined = silent (CATEGORY_MISMATCH clears without a toast). */
  toast?: string
}

export const PAYMENT_METHOD_CHARGE_ERROR_MAP: Record<PaymentMethodChargeErrorCode, PaymentMethodChargeErrorAction> = {
  PAYMENT_METHOD_CATEGORY_MISMATCH: { clearCatalogSelection: true, refetchSelector: false },
  PAYMENT_METHOD_NOT_FOUND: {
    clearCatalogSelection: true,
    refetchSelector: true,
    toast: 'Método de cobro no disponible.',
  },
  INACTIVE_PAYMENT_METHOD: {
    clearCatalogSelection: true,
    refetchSelector: true,
    toast: 'Este método fue desactivado.',
  },
  INVALID_PAYMENT_METHOD_ID: {
    clearCatalogSelection: false,
    refetchSelector: false,
    toast: 'Método de cobro inválido.',
  },
}

/**
 * Resolves the four catalog charge-error codes (REQ-CAT-007..010).
 * Returns `null` for legacy codes (e.g. `PAYMENT_AMOUNT_INSUFFICIENT`) and for
 * unknown/absent codes so the legacy `getSalePaymentErrorAction` dispatch runs
 * unchanged (REQ-CAT-011).
 */
export function getPaymentMethodChargeErrorAction(
  code: string | undefined,
): PaymentMethodChargeErrorAction | null {
  if (!code) return null
  return PAYMENT_METHOD_CHARGE_ERROR_MAP[code as PaymentMethodChargeErrorCode] ?? null
}

/** Minimal response envelope the dispatch reads (`error.response.data.error`). */
export interface PaymentMethodChargeErrorEnvelope {
  error?: string
  message?: string
}

export interface CatalogChargeErrorDispatchContext {
  queryClient: Pick<QueryClient, 'invalidateQueries'>
  /**
   * The tenant id read AT ERROR TIME (ref, not a snapshot) so a tenant switch
   * during the in-flight charge does not invalidate the wrong cache slot
   * (tasks.md TRIANGULATE).
   */
  tenantId: { value: string }
  toast: {
    add: (options: {
      title: string
      description?: string
      color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
    }) => void
  }
  /**
   * Incremented once per handled clear action. The modal watches this counter
   * (S4B wiring) and drops every entry carrying a `paymentMethodId` — the
   * entries filter is owned by the modals, so this pipeline only increments.
   */
  catalogClearSignal: { value: number }
}

export interface CatalogChargeErrorDispatchResult {
  handled: boolean
}

/**
 * Shared clear+refetch+toast pipeline for a catalog charge error. Returns
 * `{ handled: true }` when the code is one of the four catalog codes (caller
 * MUST return without touching the legacy dispatch), `{ handled: false }`
 * otherwise (caller falls through to `getSalePaymentErrorAction`).
 */
export function applyCatalogChargeErrorAction(
  error: AxiosError<PaymentMethodChargeErrorEnvelope>,
  context: CatalogChargeErrorDispatchContext,
): CatalogChargeErrorDispatchResult {
  const action = getPaymentMethodChargeErrorAction(error.response?.data?.error)
  if (!action) return { handled: false }

  if (action.clearCatalogSelection) {
    // ref(0).value++ — never reassign, so the modal's `watch` fires on the
    // increment (tasks.md TRIANGULATE).
    context.catalogClearSignal.value++
  }

  if (action.refetchSelector) {
    void context.queryClient.invalidateQueries({
      queryKey: saleQueryKeys.paymentMethods(context.tenantId.value),
    })
  }

  if (action.toast) {
    context.toast.add({ title: action.toast, color: 'error' })
  }

  return { handled: true }
}
