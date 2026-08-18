import type { SaleDetailPayment } from '../interfaces/sale.types'

/**
 * sales-pos-charge WU-B.6: predicate that decides whether a payment row in
 * `PaymentsListSection` should show the "Editar referencia" affordance.
 *
 * Two conditions MUST both hold:
 *   1. `method` is one of the non-cash, non-credit payment methods
 *      (CARD_DEBIT, CARD_CREDIT, TRANSFER) — cash and credit sales have no
 *      reference by definition; the edit affordance would be misleading.
 *   2. `paymentId` is set — REQ-NEW-6 makes the field required, but TypeScript
 *      narrows to `string` already; the runtime guard is defensive in case a
 *      legacy backend payload ever leaks through with a missing id.
 *
 * Kept in its own file (rather than appended to `paymentMethodMeta.ts`)
 * because the concern is "edit affordance", not "method metadata"; mixing
 * them would force a refactor if the method list grows.
 */
const REFERENCE_EDITABLE_METHODS = new Set(['CARD_DEBIT', 'CARD_CREDIT', 'TRANSFER'])

export function shouldShowEditReference(payment: SaleDetailPayment): boolean {
  return REFERENCE_EDITABLE_METHODS.has(payment.method) && Boolean(payment.paymentId)
}