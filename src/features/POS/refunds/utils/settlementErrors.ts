import { isAxiosError } from 'axios'
import { ZodError } from 'zod'

/**
 * Errors of `POST /sales/refunds/:refundId/settlements` (odd/handoff/06-refund-settlements.md §6)
 * mapped to es-MX copy. Domain errors are switched on `error`; validation 400s carry the raw
 * class-validator array in `message`, placed on the form fields. A server string is never shown.
 */
export type SettlementErrorCode =
  | 'SETTLEMENT_EXCEEDS_REFUND'
  | 'REFUND_ALREADY_SETTLED'
  | 'REFUND_NOT_FOUND'
  | 'IDEMPOTENCY_KEY_IN_FLIGHT'
  | 'IDEMPOTENCY_KEY_CONFLICT'
  | 'CASH_SESSION_CREDIT_NOT_ALLOWED'
  | 'CASH_SESSION_NOT_FOUND'
  | 'CASH_SESSION_NOT_OWNED'
  | 'CASH_SESSION_NOT_WRITABLE'
  | 'CASH_ACTOR_INACTIVE'
  | 'CASH_TENANT_MEMBERSHIP_REQUIRED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'VALIDATION'
  /** A 200 whose body broke the contract: the settlement exists, its response is unreadable. */
  | 'RESPONSE_INVALID'
  /** No response, 5xx or 401: nothing is known; retrying the same key is safe. */
  | 'NETWORK'
  /** A 400 that only a FE bug produces (missing key, bad refund id). */
  | 'UNEXPECTED'

/** Form fields a validation error can land on. */
export type SettlementField = 'amount' | 'method' | 'reference' | 'settledAt' | 'cashSession'

export interface SettlementErrorInfo {
  code: SettlementErrorCode
  message: string
  fieldErrors: Partial<Record<SettlementField, string>>
}

const CASH_UNUSABLE = 'No puedes registrar movimientos en esta caja. Registra la devolución sin caja.'

const DOMAIN_MESSAGES: Record<string, string> = {
  SETTLEMENT_EXCEEDS_REFUND:
    'El monto es mayor que lo pendiente. Actualizamos el saldo; revisa el monto.',
  REFUND_ALREADY_SETTLED: 'Este reembolso ya se completó.',
  REFUND_NOT_FOUND: 'No encontramos este reembolso. Actualizamos la lista.',
  IDEMPOTENCY_KEY_IN_FLIGHT: 'Estamos registrando la devolución, espera un momento.',
  IDEMPOTENCY_KEY_CONFLICT: 'Los datos cambiaron desde el último intento. Vuelve a confirmar.',
  CASH_SESSION_CREDIT_NOT_ALLOWED: 'Una devolución a crédito no se registra en caja.',
  CASH_SESSION_NOT_WRITABLE:
    'La caja ya está cerrada. Registra la devolución sin caja o abre una nueva.',
  CASH_SESSION_NOT_OWNED: 'Esta caja pertenece a otro cajero.',
  CASH_SESSION_NOT_FOUND: 'No encontramos tu caja. Registra la devolución sin caja.',
  CASH_ACTOR_INACTIVE: CASH_UNUSABLE,
  CASH_TENANT_MEMBERSHIP_REQUIRED: CASH_UNUSABLE,
  INSUFFICIENT_PERMISSIONS: 'No tienes permiso para registrar devoluciones.',
}

const FIELD_BY_PROPERTY: Record<string, { field: SettlementField; message: string }> = {
  amountCents: { field: 'amount', message: 'Escribe un monto válido mayor que $0.00.' },
  method: { field: 'method', message: 'Elige un método de devolución.' },
  reference: { field: 'reference', message: 'Revisa la referencia.' },
  settledAt: { field: 'settledAt', message: 'Elige una fecha y hora válidas.' },
  cashSessionId: {
    field: 'cashSession',
    message: 'No pudimos usar tu caja. Desmarca la opción e intenta de nuevo.',
  },
}

const NETWORK_MESSAGE = 'No pudimos registrar la devolución. Revisa tu conexión e intenta de nuevo.'
const UNEXPECTED_MESSAGE =
  'No pudimos registrar la devolución. Recarga la página e intenta de nuevo.'

interface ErrorBody {
  error?: unknown
  message?: unknown
}

function info(
  code: SettlementErrorCode,
  message: string,
  fieldErrors: SettlementErrorInfo['fieldErrors'] = {},
): SettlementErrorInfo {
  return { code, message, fieldErrors }
}

export function mapSettlementError(error: unknown): SettlementErrorInfo {
  if (error instanceof ZodError) {
    return info(
      'RESPONSE_INVALID',
      'Registramos la devolución, pero no pudimos leer la respuesta. Revisa la lista.',
    )
  }
  if (!isAxiosError(error) || !error.response) return info('NETWORK', NETWORK_MESSAGE)

  const { status } = error.response
  const body = (error.response.data ?? {}) as ErrorBody
  const code = typeof body.error === 'string' ? body.error : undefined

  if (code && code in DOMAIN_MESSAGES) {
    return info(code as SettlementErrorCode, DOMAIN_MESSAGES[code]!)
  }
  if (status === 403) {
    return info('INSUFFICIENT_PERMISSIONS', DOMAIN_MESSAGES.INSUFFICIENT_PERMISSIONS!)
  }
  if (status === 400 && Array.isArray(body.message)) {
    const fieldErrors: SettlementErrorInfo['fieldErrors'] = {}
    for (const entry of body.message as { property?: unknown }[]) {
      const mapped = typeof entry?.property === 'string' ? FIELD_BY_PROPERTY[entry.property] : undefined
      if (mapped) fieldErrors[mapped.field] = mapped.message
    }
    return info('VALIDATION', 'Revisa los datos marcados e intenta de nuevo.', fieldErrors)
  }
  if (status === 400) return info('UNEXPECTED', UNEXPECTED_MESSAGE)
  return info('NETWORK', NETWORK_MESSAGE)
}
