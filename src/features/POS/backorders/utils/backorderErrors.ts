/**
 * Errors of `GET /backorders/:id` and `POST /backorders/:id/cancel` (S5) → es-MX copy. Switches
 * on `code`, never on `message`; a server string is never shown.
 *
 * ASSUMPTION (ODD restock-backorder L4): the backend T5 handoff (frontend-handoff/26) is not
 * published yet and promised «la misma forma que los 409 actuales». So the codes are read with the
 * shared envelope reader (`error` → shape A, `code` → shape B) and the typed extras of S5
 * (`status` of BACKORDER_NOT_CANCELLABLE, `currentVersion` of VERSION_CONFLICT) are read from the
 * same body, also under `current` like the chatbot inbox. Re-check against handoff 26 and :3003.
 */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import type { BackorderStatus } from '../interfaces/backorder.types'
import { backorderStatusLabel, isBackorderStatus } from './backorderView'

export type BackorderErrorCode =
  | 'VERSION_CONFLICT'
  | 'BACKORDER_NOT_CANCELLABLE'
  | 'BACKORDER_NOT_FOUND'
  | 'BACKORDER_RETRY_REQUIRED'

export interface BackorderErrorInfo {
  status: number | null
  code: string | null
  message: string
  /** The order changed under the user: refetch it (and the list) so the page shows the truth. */
  refetch: boolean
  notFound: boolean
  /** `BACKORDER_NOT_CANCELLABLE {status}`: the state the order is in now. */
  currentStatus: BackorderStatus | null
  /** `VERSION_CONFLICT {currentVersion}`. */
  currentVersion: number | null
}

export const VERSION_CONFLICT_COPY = 'Otro usuario modificó este pedido; revisa los datos y vuelve a intentar.'
const NOT_FOUND_COPY = 'Este pedido ya no existe en esta sucursal.'
/** 503 `BACKORDER_RETRY_REQUIRED` (handoff 26 §7): a transient serialisation conflict; nothing changed. */
export const RETRY_REQUIRED_CODE = 'BACKORDER_RETRY_REQUIRED'
const RETRY_REQUIRED_COPY = 'No se pudo cancelar por un conflicto momentáneo. Intenta de nuevo.'
const GENERIC_COPY = 'No pudimos cancelar el pedido. Intenta de nuevo.'
const NETWORK_COPY = 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** An extra of the body, at the top level or under `current`. */
function extra(body: Record<string, unknown> | null, key: string): unknown {
  return body?.[key] ?? asRecord(body?.current)?.[key]
}

function notCancellableCopy(status: BackorderStatus | null): string {
  return status
    ? `Este pedido ya no se puede cancelar: está ${backorderStatusLabel(status).toLowerCase()}. Actualizamos los datos.`
    : 'Este pedido ya no se puede cancelar. Actualizamos los datos.'
}

export function readBackorderError(err: unknown): BackorderErrorInfo {
  const envelope = readApiErrorEnvelope(err)
  const body = asRecord(asRecord(asRecord(err)?.response)?.data)
  const rawStatus = extra(body, 'status')
  const currentStatus = isBackorderStatus(rawStatus) ? rawStatus : null
  const rawVersion = extra(body, 'currentVersion')
  const currentVersion = typeof rawVersion === 'number' ? rawVersion : null
  const base = { status: envelope.status, code: envelope.code, currentStatus, currentVersion }

  if (envelope.code === 'VERSION_CONFLICT') {
    return { ...base, message: VERSION_CONFLICT_COPY, refetch: true, notFound: false }
  }
  if (envelope.code === 'BACKORDER_NOT_CANCELLABLE') {
    return { ...base, message: notCancellableCopy(currentStatus), refetch: true, notFound: false }
  }
  if (envelope.code === RETRY_REQUIRED_CODE) {
    return { ...base, message: RETRY_REQUIRED_COPY, refetch: false, notFound: false }
  }
  if (envelope.code === 'BACKORDER_NOT_FOUND' || envelope.status === 404) {
    return { ...base, message: NOT_FOUND_COPY, refetch: false, notFound: true }
  }
  return {
    ...base,
    message: envelope.status === null ? NETWORK_COPY : GENERIC_COPY,
    refetch: false,
    notFound: false,
  }
}
