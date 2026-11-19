/**
 * Spanish copy for the enabled subset of `CASH_*` backend rules.
 *
 * The backend stays authoritative and returns `422` with a `CASH_*` code (or a
 * plain `400` DTO failure). This module maps the codes the enabled UI can
 * actually trigger; anything unmapped falls back to the generic neutral
 * Mexican Spanish copy so a raw axios string is never surfaced to the cashier.
 *
 * It also carries the two LOCAL identity outcomes, which are not backend errors:
 * a command attempted with no active principal, and a command whose result was
 * discarded because the principal changed mid-flight.
 */
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'

export const CASH_GENERIC_ERROR = 'No pudimos completar la operación.'

export type CashIdentityReason = 'inactive' | 'changed'

/** No active tenant/user: the command must not be sent at all. */
export const CASH_IDENTITY_INACTIVE = 'Tu sesión no está activa. Inicia sesión de nuevo.'

/** The principal (or its permissions) changed while the command was in flight. */
export const CASH_IDENTITY_CHANGED =
  'Tu sesión cambió mientras se ejecutaba la operación. Revisa el estado antes de reintentar.'

/**
 * Local error for a command refused (`inactive`) or abandoned (`changed`)
 * because of the session identity. The reason lets a caller tell "this was never
 * sent" from "this succeeded but belongs to the previous principal", so a stale
 * result can be discarded silently instead of shown to the new user.
 */
export class CashIdentityError extends Error {
  readonly reason: CashIdentityReason

  constructor(reason: CashIdentityReason) {
    super(reason === 'inactive' ? CASH_IDENTITY_INACTIVE : CASH_IDENTITY_CHANGED)
    this.name = 'CashIdentityError'
    this.reason = reason
  }
}

/** Another cash command is still in flight: overlapping entry is refused. */
export const CASH_COMMAND_IN_PROGRESS =
  'Ya hay una operación de caja en curso. Espera a que termine antes de reintentar.'

/**
 * Local error for an overlapping command. Refused BEFORE any key is generated or
 * request dispatched, so a duplicate click can never start a second command or
 * consume a fresh idempotency key.
 */
export class CashCommandBusyError extends Error {
  constructor() {
    super(CASH_COMMAND_IN_PROGRESS)
    this.name = 'CashCommandBusyError'
  }
}

const CASH_ERROR_COPY: Record<string, string> = {
  CASH_IDEMPOTENCY_KEY_REQUIRED: 'Falta la clave de intento. Reintenta la operación.',
  CASH_IDEMPOTENCY_KEY_TOO_LONG: 'La clave de intento es demasiado larga. Reintenta la operación.',
  INVALID_IDEMPOTENCY_KEY: 'Clave de intento inválida. Reintenta la operación.',
  CASH_IDEMPOTENCY_CONFLICT:
    'Ese intento ya se usó con otros datos. Revisa la operación antes de reintentar.',
  CASH_PERMISSION_DENIED: 'No tienes permiso para esta acción.',
  CASH_REGISTER_NOT_FOUND: 'La caja no existe en esta sucursal.',
  CASH_REGISTER_INACTIVE: 'La caja está inactiva.',
  CASH_REGISTER_NAME_CONFLICT: 'Ya existe una caja con ese nombre.',
  CASH_REGISTER_UNRELEASED_SESSION:
    'Esa caja ya tiene una sesión sin liberar. Libera el cajón antes de abrir otra.',
  CASH_SESSION_NOT_FOUND: 'La sesión de caja no existe en esta sucursal.',
  CASH_SESSION_NOT_OWNED: 'Esa sesión pertenece a otra persona.',
  CASH_SESSION_NOT_WRITABLE: 'La sesión está congelada: no admite movimientos.',
  CASH_OPENING_NOT_CONFIRMED: 'Confirma explícitamente el fondo inicial para abrir.',
  CASH_OPENING_FUNDS_MISMATCH:
    'El monto de apertura debe coincidir con el fondo recibido por la persona que abre.',
  CASH_OPENING_FLOAT_REUSE: 'Ese fondo ya fue usado para abrir otra sesión.',
  CASH_OPENING_HANDOVER_NOT_FOUND: 'No encontramos el fondo recibido indicado.',
  CASH_OPENING_SOURCE_DRAWER_NOT_RELEASED:
    'La caja de origen todavía no liberó su cajón. Prueba en otra caja o espera la liberación.',
  CASH_DECLARATION_ALREADY_SUBMITTED:
    'La declaración ya fue enviada: solo puedes agregar notas explicativas.',
  CASH_DECLARATION_NOT_FOUND: 'Todavía no hay una declaración enviada.',
  CASH_ANNOTATION_BLOCKED: 'No se pueden agregar notas en este estado.',
  CASH_COUNT_EMPTY: 'El conteo no puede estar vacío: declara cada canal, incluso en cero.',
  CASH_COUNT_MISSING_CHANNEL: 'Falta declarar uno de los canales congelados.',
  CASH_COUNT_DUPLICATE_CHANNEL: 'Un canal aparece repetido en el conteo.',
  CASH_COUNT_UNKNOWN_CHANNEL: 'El conteo incluye un canal que no está congelado.',
  CASH_DENOMINATION_INVALID: 'El detalle de denominaciones es inválido.',
  CASH_DENOMINATION_SUM_MISMATCH:
    'El detalle de denominaciones debe sumar exactamente el total de Efectivo.',
  CASH_DENOMINATION_CASH_LINE_REQUIRED: 'El detalle de denominaciones requiere el canal Efectivo.',
  CASH_DISCREPANCY_NOTES_REQUIRED:
    'Hay una diferencia entre lo declarado y lo esperado: agrega una nota que la explique.',
  CASH_ALREADY_VERIFIED: 'La sesión ya fue verificada.',
  CASH_VERIFICATION_REQUIRED: 'La sesión todavía no fue verificada.',
  CASH_SELF_VERIFICATION_FORBIDDEN:
    'No puedes verificar tu propia sesión: debe hacerlo otra persona.',
  CASH_HANDOVER_NOT_FOUND: 'No encontramos esa entrega de custodia.',
  CASH_HANDOVER_RECIPIENT_INVALID:
    'Solo la persona destinataria puede recibir esta entrega. Inicia sesión con esa persona.',
  CASH_HANDOVER_ALREADY_RECEIVED: 'Esa entrega ya fue recibida.',
  CASH_HANDOVER_ALLOCATION_MISMATCH:
    'Las entregas declaradas deben sumar exactamente el efectivo contado.',
  CASH_HANDOVER_ALLOCATION_EXCEEDED: 'Las entregas superan el efectivo contado.',
  CASH_HANDOVER_SELF_WITHDRAWAL: 'No puedes declarar un retiro para ti misma o ti mismo.',
  CASH_CUSTODY_NOT_RECEIVED: 'Todavía hay entregas sin recibir.',
  CASH_DRAWER_NOT_RELEASED: 'Primero libera el cajón físico.',
  CASH_DRAWER_ALREADY_RELEASED: 'El cajón ya fue liberado.',
  // Listing filters, closings and recipients (handoff 25 §1–§3).
  LISTING_INVALID_ENUM_VALUE: 'Uno de los filtros no es válido. Quita los filtros y vuelve a buscar.',
  CASH_QUERY_INVALID_PAGE: 'Esa página no existe. Vuelve a la primera página.',
  CASH_QUERY_DATE_INVALID: 'Una de las fechas del filtro no es válida. Elige la fecha de nuevo.',
  CASH_QUERY_RANGE_INVALID: 'La fecha final debe ser posterior a la inicial.',
  CASH_CLOSING_NOT_FOUND: 'Ese corte no existe en esta sucursal.',
  CASH_CLOSING_SNAPSHOT_INVALID:
    'El corte guardado está dañado y no se puede mostrar. Avisa a un administrador del sistema.',
  INSUFFICIENT_PERMISSIONS: 'No tienes permiso para esta acción. Pídelo a un administrador.',
  CASH_ACTOR_INACTIVE: 'Tu usuario está inactivo: un administrador debe reactivarlo.',
  CASH_TENANT_MEMBERSHIP_REQUIRED:
    'No perteneces a esta sucursal: un administrador debe agregarte.',
}

export interface CashErrorInfo {
  code?: string
  message: string
}

/** Map an axios/unknown error to a Spanish sentence plus its `CASH_*` code. */
export function cashErrorInfo(error: unknown, fallback = CASH_GENERIC_ERROR): CashErrorInfo {
  // Local outcomes (identity, busy) carry their own actionable copy.
  if (error instanceof CashIdentityError || error instanceof CashCommandBusyError) {
    return { message: error.message }
  }
  const normalized = normalizeApiError(error, fallback)
  const code = normalized.code
  if (code && CASH_ERROR_COPY[code]) {
    return { code, message: CASH_ERROR_COPY[code] }
  }
  return { code, message: normalized.message }
}

// ─── Close (handoff 25 §5) ───────────────────────────────────────────────────

export const CASH_CLOSE_GENERIC_ERROR = 'No pudimos cerrar la caja.'

const CASH_CLOSE_INCONSISTENT =
  'No pudimos cerrar la caja por un dato inconsistente de la sesión. Avisa a un administrador del sistema.'

/**
 * Close copy, in the backend check order (§5 rows 1–17). Each message says what
 * is missing and who has to do it. These override the generic copy only for the
 * close command: the same codes keep their existing copy in the other flows.
 */
const CASH_CLOSE_ERROR_COPY: Record<string, string> = {
  Unauthorized: 'Tu sesión expiró. Inicia sesión de nuevo para cerrar la caja.',
  INSUFFICIENT_PERMISSIONS:
    'No tienes el permiso «Cerrar caja». Pídelo a un administrador.',
  'Bad Request':
    'La nota de cierre no es válida: escribe un texto de hasta 2000 caracteres o déjala vacía.',
  INVALID_IDEMPOTENCY_KEY:
    'No pudimos identificar este intento de cierre. Recarga la sesión e inténtalo de nuevo.',
  CASH_IDEMPOTENCY_CONFLICT:
    'Este intento de cierre ya se usó con otra nota. Recarga la sesión antes de cerrar de nuevo.',
  CASH_ACTOR_INACTIVE:
    'Tu usuario está inactivo: un administrador debe reactivarlo antes de cerrar la caja.',
  CASH_TENANT_MEMBERSHIP_REQUIRED:
    'No perteneces a esta sucursal: un administrador debe agregarte antes de cerrar la caja.',
  CASH_SESSION_NOT_FOUND:
    'Esta sesión de caja no existe en esta sucursal. Recarga la lista de sesiones.',
  CASH_PERMISSION_DENIED:
    'No tienes el permiso «Cerrar caja» para esta sesión. Pídelo a un administrador.',
  CASH_SELF_CLOSING_FORBIDDEN:
    'No puedes cerrar una caja que abriste: debe cerrarla otra persona con permiso de cierre.',
  CASH_DRAWER_NOT_RELEASED:
    'Falta liberar el cajón: la persona que abrió la caja debe liberarlo antes del cierre.',
  CASH_VERIFICATION_REQUIRED:
    'Falta la verificación: otra persona, distinta de quien abrió la caja, debe recontar y verificar antes del cierre.',
  CASH_CUSTODY_NOT_RECEIVED:
    'Falta recibir una entrega de efectivo: la persona destinataria debe confirmarla en «Por recibir» antes del cierre.',
}

/** Defensive codes the normal flow cannot reach (§5, after the table). */
const CASH_CLOSE_DEFENSIVE = new Set([
  'CASH_DECLARATION_NOT_FOUND',
  'CASH_COUNT_MISSING_CHANNEL',
  'CASH_HANDOVER_DUPLICATE_ALLOCATION',
  'CASH_CENTS_OUT_OF_RANGE',
  'CASH_ARITHMETIC_OVERFLOW',
  'CASH_SNAPSHOT_SESSION_NOT_CLOSED',
  'CASH_FOLIO_REQUIRED',
  'CASH_IDENTITY_REQUIRED',
  'CASH_DATE_INVALID',
  'CASH_IDEMPOTENCY_KEY_REQUIRED',
  'CASH_IDEMPOTENCY_KEY_TOO_LONG',
])

/** Top-level detail keys of the guard/domain envelope (never the message). */
function errorDetails(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') return {}
  const response = (error as { response?: { data?: unknown } }).response
  const data = response?.data
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {}
}

function centsDetail(value: unknown): string | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? formatCentsMXN(value) : null
}

function closeCopy(code: string, details: Record<string, unknown>): string | undefined {
  switch (code) {
    case 'CASH_SESSION_NOT_WRITABLE':
      if (details.status === 'CLOSED') {
        return 'Esta caja ya está cerrada: consulta su corte en «Cortes».'
      }
      if (details.status === 'OPEN' || details.status === 'COUNTING') {
        return 'Falta la declaración: la persona que abrió la caja debe contar y enviar su declaración antes del cierre.'
      }
      return CASH_CLOSE_INCONSISTENT
    case 'CASH_DISCREPANCY_NOTES_REQUIRED':
      return details.stage === 'VERIFICATION'
        ? 'Falta explicar la diferencia de la verificación: quien verificó debe dejar una nota antes del cierre.'
        : 'Falta explicar la diferencia: la persona que abrió la caja debe agregar una nota a su declaración antes del cierre.'
    case 'CASH_HANDOVER_ALLOCATION_MISMATCH': {
      const allocated = centsDetail(details.allocatedCents)
      const declared = centsDetail(details.declaredCents)
      const amounts =
        allocated && declared
          ? `Las entregas suman ${allocated} y el efectivo declarado es ${declared}`
          : 'Las entregas no suman el efectivo declarado'
      return `${amounts}: la persona que abrió la caja debe declarar las entregas que faltan antes del cierre.`
    }
    default:
      if (CASH_CLOSE_DEFENSIVE.has(code)) return CASH_CLOSE_INCONSISTENT
      return CASH_CLOSE_ERROR_COPY[code]
  }
}

/**
 * Map a close failure to one Spanish sentence plus its code. Switches on the
 * envelope `error` (and its detail keys), never on `message`; an unknown code or
 * a network failure falls back to {@link CASH_CLOSE_GENERIC_ERROR}.
 */
export function cashCloseErrorInfo(error: unknown): CashErrorInfo {
  if (error instanceof CashIdentityError || error instanceof CashCommandBusyError) {
    return { message: error.message }
  }
  if (error instanceof RangeError) {
    return { message: CASH_CLOSE_ERROR_COPY['Bad Request']! }
  }
  const normalized = normalizeApiError(error, CASH_CLOSE_GENERIC_ERROR)
  const code = normalized.code
  if (!code) return { message: CASH_CLOSE_GENERIC_ERROR }
  return { code, message: closeCopy(code, errorDetails(error)) ?? CASH_CLOSE_GENERIC_ERROR }
}
