/**
 * Errors of the chatbot request inbox (handoffs 11, 12, 14 §11) → es-MX copy.
 *
 * Switches on status and `code`, never on `message`. `readRequestError` wraps the shared
 * envelope reader and adds what the typed 409s carry beyond it: `current` (so the row can be
 * patched without reloading), `current.zoneImpact` (ZONE_SET_CHANGED) and `intoRequestId`.
 */
import { readApiErrorEnvelope, type ApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import type {
  ChatbotRequestDeniedCode,
  ChatbotRequestErrorCurrent,
  ChatbotRequestPerson,
  ChatbotRequestStatus,
  ChatbotRequestZoneImpact,
} from '../interfaces/chatbot-request.types'

export interface ChatbotRequestError extends ApiErrorEnvelope {
  /** The request as the server sees it now; `null` when the body carries none. */
  current: ChatbotRequestErrorCurrent | null
  /** Shortcut of `current.zoneImpact`. */
  zoneImpact: ChatbotRequestZoneImpact | null
  /** Target-side `409 VERSION_CONFLICT` of a merge: which side moved. */
  intoRequestId: string | null
}

const STATUSES: ReadonlySet<string> = new Set<ChatbotRequestStatus>([
  'NEW',
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELLED',
])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readPerson(value: unknown): ChatbotRequestPerson | null {
  const person = asRecord(value)
  if (!person || typeof person.id !== 'string' || typeof person.displayName !== 'string') return null
  return { id: person.id, displayName: person.displayName }
}

function readZoneImpact(value: unknown): ChatbotRequestZoneImpact | null {
  const impact = asRecord(value)
  if (
    !impact ||
    typeof impact.requests !== 'number' ||
    typeof impact.customers !== 'number' ||
    typeof impact.setVersion !== 'number'
  ) {
    return null
  }
  return { requests: impact.requests, customers: impact.customers, setVersion: impact.setVersion }
}

function readCurrent(value: unknown): ChatbotRequestErrorCurrent | null {
  const raw = asRecord(value)
  if (!raw) return null
  const current: ChatbotRequestErrorCurrent = {}
  if (typeof raw.version === 'number') current.version = raw.version
  if (typeof raw.status === 'string' && STATUSES.has(raw.status)) {
    current.status = raw.status as ChatbotRequestStatus
  }
  if (raw.claimedBy === null) current.claimedBy = null
  else {
    const holder = readPerson(raw.claimedBy)
    if (holder) current.claimedBy = holder
  }
  const zoneImpact = readZoneImpact(raw.zoneImpact)
  if (zoneImpact) current.zoneImpact = zoneImpact
  return current
}

export function readRequestError(err: unknown): ChatbotRequestError {
  const envelope = readApiErrorEnvelope(err)
  const response = asRecord(asRecord(err)?.response)
  const body = asRecord(response?.data)
  const current = readCurrent(body?.current)
  return {
    ...envelope,
    current,
    zoneImpact: current?.zoneImpact ?? null,
    intoRequestId: typeof body?.intoRequestId === 'string' ? body.intoRequestId : null,
  }
}

/** `400 VALIDATION_ERROR` on a stored customerKey or cursor: reload the list, never retry the same value. */
export function isStaleCustomerKeyError(err: unknown): boolean {
  const { status, code } = readApiErrorEnvelope(err)
  return status === 400 && code === 'VALIDATION_ERROR'
}

const NETWORK = 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.'

function pluralZone({ requests, customers }: ChatbotRequestZoneImpact): string {
  const r = requests === 1 ? '1 solicitud' : `${requests} solicitudes`
  const c = customers === 1 ? '1 cliente' : `${customers} clientes`
  return `${r} de ${c}`
}

const CODE_COPY: Record<string, string> = {
  VERSION_CONFLICT: 'La solicitud cambió mientras la mirabas. No se aplicó tu acción; revisa y vuelve a intentarlo.',
  REQUEST_CLOSED: 'Esta solicitud ya se cerró. Otra persona la resolvió o el cliente la canceló.',
  CANCEL_NOT_ALLOWED: 'Esta solicitud no se puede cancelar.',
  IDEMPOTENCY_CONFLICT: 'Esta acción no coincide con la que ya se registró. Actualiza la solicitud y revísala antes de decidir.',
  MERGE_NOT_ALLOWED: 'Estas solicitudes no se pueden unir: deben ser del mismo cliente, del mismo tipo y de la misma conversación.',
  NOT_ASSIGNEE: 'Solo quien la atiende puede hacerlo. Para actuar sobre la de otra persona hace falta el permiso de reasignar.',
  INSUFFICIENT_PERMISSIONS: 'No tienes permiso para hacer esto.',
  ACTION_NOT_ALLOWED: 'Esta acción ya no aplica a la solicitud en su estado actual.',
  USER_NOT_ASSIGNABLE: 'Esa persona no puede atender solicitudes en esta sucursal. Elige a otra.',
  CUSTOMER_PHONE_MISMATCH: 'El teléfono de ese cliente no coincide con el de la solicitud.',
  VALIDATION_ERROR: 'Revisa los datos e intenta de nuevo.',
  NOT_FOUND: 'Esta solicitud ya no existe en esta sucursal.',
  RANGE_TOO_LARGE: 'El rango de fechas es demasiado amplio: elige un máximo de 92 días.',
  FORBIDDEN: 'No tienes acceso a esta sucursal.',
  UNAUTHORIZED: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Reintenta: se envía la misma acción.',
}

/** Copy for a command or read failure. Accepts the raw axios error or an already-read one. */
export function requestErrorMessage(err: unknown): string {
  const error = isReadError(err) ? err : readRequestError(err)
  const { status, code, current, zoneImpact } = error

  if (status === null) return NETWORK

  if (code === 'REQUEST_CLAIMED_BY_OTHER') {
    const holder = current?.claimedBy?.displayName
    return `${holder ?? 'Otra persona'} ya tomó esta solicitud. No se aplicó tu acción.`
  }
  if (code === 'ZONE_SET_CHANGED') {
    return zoneImpact
      ? `Cambiaron los clientes de este código postal: ahora resolverías ${pluralZone(zoneImpact)}. Revisa y confirma con los datos nuevos.`
      : 'Cambiaron los clientes de este código postal. Revisa y confirma con los datos nuevos.'
  }
  if (code && CODE_COPY[code]) return CODE_COPY[code]!

  if (status >= 500) return 'No se pudo confirmar la acción. Reintenta: se envía la misma acción.'
  if (status === 401) return CODE_COPY.UNAUTHORIZED!
  if (status === 403) return CODE_COPY.FORBIDDEN!
  if (status === 404) return CODE_COPY.NOT_FOUND!
  return 'No se pudo completar la acción. Intenta de nuevo.'
}

function isReadError(err: unknown): err is ChatbotRequestError {
  const record = asRecord(err)
  return !!record && 'fieldErrors' in record && 'current' in record && 'intoRequestId' in record
}

/**
 * Why an action is missing (`deniedActions[].code`, handoff 14 §14.4): the same codes the command
 * would answer, so the tooltip never disagrees with the server. `assignee` is the row's own.
 */
export function deniedActionReason(
  code: ChatbotRequestDeniedCode,
  assignee?: ChatbotRequestPerson | null,
): string {
  switch (code) {
    case 'INSUFFICIENT_PERMISSIONS':
      return 'No tienes permiso para hacerlo.'
    case 'REQUEST_CLAIMED_BY_OTHER':
      return `La atiende ${assignee?.displayName ?? 'otra persona'}.`
    case 'NOT_ASSIGNEE':
      return 'Solo quien la atiende puede hacerlo.'
    case 'CANCEL_NOT_ALLOWED':
      return 'Esta solicitud no se puede cancelar.'
    default:
      return 'No está disponible ahora.'
  }
}
