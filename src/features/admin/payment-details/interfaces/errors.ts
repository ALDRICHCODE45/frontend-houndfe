/**
 * Domain error codes + Spanish user-facing copy for the PaymentDetail module.
 *
 * Locked contract (sdd payment-details-admin, design.md §5.2 + REQ-PD-008):
 *   - The backend emits `{ statusCode, error: <CODE>, message, timestamp }`.
 *     The CODE lives in `error` (NOT `message`) — Nest class-validator
 *     envelopes use `message: string[]`, so reading `message` would couple us
 *     to a corrupted domain map (this is the documented tenants drift).
 *   - Specific codes surface a specific Spanish toast; anything else falls
 *     back to the generic `normalizeApiError` helper in `error.utils.ts`.
 *   - NO_ACTIVE_PAYMENT_DETAIL is a bot-endpoint code; harmless to keep
 *     mapped here so the admin UI error pipeline can re-use the same map
 *     if a unified envelope ever lands.
 */

export type PaymentDetailDomainErrorCode =
  | 'DUPLICATE_CLABE'
  | 'ENTITY_NOT_FOUND'
  | 'NO_ACTIVE_PAYMENT_DETAIL'

/**
 * PAYMENT_DETAIL_ERROR_MAP — Domain code → user-facing Spanish copy.
 * Copy matches REQ-PD-008 verbatim. Do not edit without updating the spec.
 */
export const PAYMENT_DETAIL_ERROR_MAP: Record<PaymentDetailDomainErrorCode, string> = {
  DUPLICATE_CLABE: 'Esta CLABE ya existe en esta sucursal',
  ENTITY_NOT_FOUND: 'No encontrado',
  NO_ACTIVE_PAYMENT_DETAIL: 'No hay una cuenta activa para mostrar al cliente.',
}

interface MaybeAxiosError {
  response?: { data?: { error?: unknown } }
}

/**
 * extractPaymentDetailErrorCode — pure extractor.
 *
 * Reads ONLY `error.response.data.error` (never `error.message`). Returns the
 * domain code when it is a known key, otherwise `null`. The mutator pipeline in
 * the view short-circuits on the result: a non-null code emits the specific
 * Spanish toast from `PAYMENT_DETAIL_ERROR_MAP`; a `null` falls back to the
 * generic `normalizeApiError` toast.
 *
 * Pure: never throws; accepts `unknown` so callers don't have to cast.
 */
export function extractPaymentDetailErrorCode(
  error: unknown,
): PaymentDetailDomainErrorCode | null {
  const maybe = error as MaybeAxiosError
  const code = maybe?.response?.data?.error
  if (typeof code === 'string' && code in PAYMENT_DETAIL_ERROR_MAP) {
    return code as PaymentDetailDomainErrorCode
  }
  return null
}
