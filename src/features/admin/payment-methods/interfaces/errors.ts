/**
 * Domain error codes + Spanish user-facing copy for the PaymentMethod module.
 *
 * Locked contract (sdd custom-payment-methods, design §5.2 + REQ-PM-007):
 *   - The backend emits `{ statusCode, error: <CODE>, message, timestamp }`.
 *     The CODE lives in `error` (NOT `message`) — Nest class-validator
 *     envelopes use `message: string[]`, so reading `message` would couple us
 *     to a corrupted domain map.
 *   - Specific codes surface a specific Spanish toast; anything else falls
 *     back to the generic `normalizeApiError` helper in `core/shared/utils`.
 *   - `DUPLICATE_NAME` is a 409 (per-tenant uniqueness): the slideover stays
 *     open so the cashier can rename.
 *   - `ENTITY_NOT_FOUND` is a 404: the view shows neutral copy without
 *     distinguishing missing vs another tenant (REQ-PM-007).
 *   - `NAME_TOO_LONG` is a 400 (server-side fallback for names >60 chars):
 *     the field-level toast matches the client-side validation copy.
 */

export type PaymentMethodDomainErrorCode =
  | 'DUPLICATE_NAME'
  | 'ENTITY_NOT_FOUND'
  | 'NAME_TOO_LONG'

/**
 * PAYMENT_METHOD_ERROR_MAP — Domain code → user-facing Spanish copy.
 * Copy matches REQ-PM-007 verbatim. Do not edit without updating the spec.
 */
export const PAYMENT_METHOD_ERROR_MAP: Record<PaymentMethodDomainErrorCode, string> = {
  DUPLICATE_NAME: 'Ya existe un método con ese nombre en esta sucursal',
  ENTITY_NOT_FOUND: 'No encontrado',
  NAME_TOO_LONG: 'El nombre no puede superar 60 caracteres',
}

interface MaybeAxiosError {
  response?: { data?: { error?: unknown } }
}

/**
 * extractPaymentMethodErrorCode — pure extractor.
 *
 * Reads ONLY `error.response.data.error` (never `error.message`). Returns the
 * domain code when it is a known key, otherwise `null`. The mutator pipeline
 * in the view short-circuits on the result: a non-null code emits the
 * specific Spanish toast from `PAYMENT_METHOD_ERROR_MAP`; a `null` falls
 * back to the generic `normalizeApiError` toast.
 *
 * Pure: never throws; accepts `unknown` so callers don't have to cast.
 */
export function extractPaymentMethodErrorCode(
  error: unknown,
): PaymentMethodDomainErrorCode | null {
  const maybe = error as MaybeAxiosError
  const code = maybe?.response?.data?.error
  if (typeof code === 'string' && code in PAYMENT_METHOD_ERROR_MAP) {
    return code as PaymentMethodDomainErrorCode
  }
  return null
}