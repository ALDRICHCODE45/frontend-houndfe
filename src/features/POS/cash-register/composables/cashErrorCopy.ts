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

export const CASH_GENERIC_ERROR = 'No pudimos completar la operación. Reintenta.'

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
    'El monto de apertura debe coincidir con el FLOAT recibido por la persona que abre.',
  CASH_OPENING_FLOAT_REUSE: 'Ese FLOAT ya fue usado para abrir otra sesión.',
  CASH_OPENING_HANDOVER_NOT_FOUND: 'No encontramos el FLOAT recibido indicado.',
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
