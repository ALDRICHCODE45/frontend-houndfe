/**
 * Errors of `DELETE /customers/:id` (ODD restock-backorder S10, backend L11).
 *
 * The backend refuses with `409 CUSTOMER_HAS_ACTIVE_BACKORDERS` while the customer has a backorder
 * WAITING or RESERVED; the body is `{ statusCode, error, message, timestamp }`. Switches on status
 * and code, never on the server `message`.
 */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'

export const CUSTOMER_HAS_ACTIVE_BACKORDERS_CODE = 'CUSTOMER_HAS_ACTIVE_BACKORDERS'

export const CUSTOMER_HAS_ACTIVE_BACKORDERS_MESSAGE =
  'No se puede eliminar: este cliente tiene un pedido por reposición en espera o apartado. Cancélalo primero en Pedidos por reposición.'

export function isCustomerHasActiveBackordersError(error: unknown): boolean {
  const { status, code } = readApiErrorEnvelope(error)
  return status === 409 && code === CUSTOMER_HAS_ACTIVE_BACKORDERS_CODE
}
