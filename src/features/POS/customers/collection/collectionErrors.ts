/**
 * collectionErrors.ts — «Cobrar todo» error mapping (handoff 30 §8).
 *
 * Switch on `error`, except IDEMPOTENCY_KEY_REQUIRED and INVALID_FORMAT whose code travels in
 * `message`. The backend `message` is never shown: the English sentence of the CASH_* codes in
 * particular must not reach the cashier.
 */
import type { CollectionPreview } from './collection.types'

export interface CollectionFailure {
  /** The documented code, `VALIDATION`, `FORBIDDEN`, `NETWORK` or `UNKNOWN`. */
  code: string
  message: string
  status?: number
  /** No response at all: the request may or may not have reached the backend. */
  network: boolean
  /** The current preview carried by `409 COLLECTION_DEBT_CHANGED`. */
  preview?: CollectionPreview
}

const DEFAULT_MESSAGE = 'No se pudo completar el cobro. Intenta de nuevo.'
const RETRY_CONFIRM = 'No se pudo confirmar el cobro. Vuelve a intentarlo.'

const MESSAGES: Record<string, string> = {
  COLLECTION_EXCEEDS_DEBT:
    'El pago supera la deuda. El excedente solo puede salir como cambio del efectivo entregado.',
  COLLECTION_NO_OPEN_DEBT: 'El cliente ya no tiene deuda por cobrar.',
  COLLECTION_SALE_NOT_ELIGIBLE:
    'Una de las ventas ya no se puede cobrar. Revisa la lista actualizada.',
  COLLECTION_DEBT_CHANGED: 'La deuda del cliente cambió. Revisa los montos y confirma de nuevo.',
  CUSTOMER_NOT_FOUND: 'El cliente ya no existe.',
  PAYMENT_METHOD_NOT_FOUND: 'Ese método de pago ya no existe. Elige otro.',
  INACTIVE_PAYMENT_METHOD: 'Ese método de pago está desactivado. Elige otro.',
  PAYMENT_METHOD_CATEGORY_MISMATCH: 'El método de pago no coincide con su tipo. Elige otro.',
  CASH_SESSION_REQUIRED: 'Elige la caja abierta donde entra el cobro.',
  CASH_SESSION_NOT_FOUND: 'La caja elegida ya no existe. Elige otra.',
  CASH_SESSION_NOT_OWNED: 'La caja elegida es de otro cajero. Elige tu caja abierta.',
  CASH_SESSION_NOT_WRITABLE: 'La caja elegida está cerrada o congelada. Elige una caja abierta.',
  CASH_ACTOR_INACTIVE: 'Tu usuario está inactivo, así que no puedes cobrar en caja.',
  CASH_TENANT_MEMBERSHIP_REQUIRED:
    'No perteneces a esta sucursal, así que no puedes cobrar en caja.',
  IDEMPOTENCY_KEY_IN_FLIGHT:
    'El cobro se sigue procesando. Espera un momento y vuelve a confirmar: no se cobrará dos veces.',
  IDEMPOTENCY_KEY_CONFLICT: RETRY_CONFIRM,
  IDEMPOTENCY_KEY_REQUIRED: RETRY_CONFIRM,
  INVALID_FORMAT: 'Formato de comprobante no válido.',
  COLLECTION_NOT_FOUND: 'El cobro ya no existe.',
  PDF_GENERATION_FAILED: 'No se pudo generar el comprobante. Intenta de nuevo.',
  VALIDATION: 'Revisa los montos y las referencias de los pagos.',
  FORBIDDEN: 'No tienes permiso para cobrar ventas.',
  NETWORK: 'No hubo conexión con el servidor. Reintenta: el cobro no se duplicará.',
}

/** Codes the backend sends in `message` with `error: "Bad Request"`. */
const MESSAGE_CODES: ReadonlySet<string> = new Set(['IDEMPOTENCY_KEY_REQUIRED', 'INVALID_FORMAT'])

interface ErrorBody {
  error?: unknown
  message?: unknown
  preview?: unknown
}

function responseOf(value: unknown): { status?: unknown; data?: unknown } | null {
  if (typeof value !== 'object' || value === null) return null
  const response = (value as { response?: unknown }).response
  return typeof response === 'object' && response !== null
    ? (response as { status?: unknown; data?: unknown })
    : null
}

function codeOf(status: number | undefined, body: ErrorBody | undefined): string {
  if (typeof body?.message === 'string' && MESSAGE_CODES.has(body.message)) return body.message
  if (typeof body?.error === 'string' && body.error in MESSAGES) return body.error
  if (status === 400 && Array.isArray(body?.message)) return 'VALIDATION'
  if (status === 403) return 'FORBIDDEN'
  return typeof body?.error === 'string' && body.error !== '' ? body.error : 'UNKNOWN'
}

export function readCollectionError(error: unknown): CollectionFailure {
  const response = responseOf(error)
  if (!response) return { code: 'NETWORK', message: MESSAGES.NETWORK!, network: true }

  const status = typeof response.status === 'number' ? response.status : undefined
  const body =
    typeof response.data === 'object' && response.data !== null
      ? (response.data as ErrorBody)
      : undefined
  const code = codeOf(status, body)
  const failure: CollectionFailure = {
    code,
    message: MESSAGES[code] ?? DEFAULT_MESSAGE,
    status,
    network: false,
  }
  if (
    code === 'COLLECTION_DEBT_CHANGED' &&
    typeof body?.preview === 'object' &&
    body.preview !== null
  ) {
    failure.preview = body.preview as CollectionPreview
  }
  return failure
}
