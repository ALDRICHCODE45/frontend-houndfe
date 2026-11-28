/**
 * customerBulkErrors.ts — the failures of the two bulk routes (handoff 33) as Spanish sentences
 * plus what the screen can do next. The selection codes travel in `code` (same envelope as the
 * listing: `{ statusCode, code, message, field, details? }`); 403 carries its code in `error`, and
 * PDF_GENERATION_FAILED may arrive in `code`, `error` or `message`. The server message is never shown.
 */
import { customersListingError } from '../config/customersListingErrors'
import type { CustomerBulkKind } from './customerBulkSelection'

export interface CustomerBulkFailure {
  /** The documented code, `FORBIDDEN`, `INVALID_PERIOD` or `UNKNOWN`. */
  code: string
  message: string
  /** A plain «Reintentar» makes sense (transient failure; for 429 once the wait is over). */
  canRetry: boolean
  /** 404: the customers that no longer exist. */
  missingIds?: string[]
  /** 429: seconds to wait before retrying. */
  retryAfterSeconds?: number
  /** 400 TOO_LARGE / EMPTY: the table no longer matches the server, refetch it. */
  refetch?: boolean
}

const DEFAULT_RETRY_AFTER_SECONDS = 10
const PDF_FAILED = 'PDF_GENERATION_FAILED'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function bodyOf(error: unknown): { status?: number; data: Record<string, unknown> } {
  const response = isRecord(error) && isRecord(error.response) ? error.response : null
  const status = typeof response?.status === 'number' ? response.status : undefined
  const raw = response?.data
  const data = isRecord(raw) && isRecord(raw.error) ? raw.error : raw
  return { status, data: isRecord(data) ? data : {} }
}

const asText = (value: unknown) => (typeof value === 'string' ? value : null)

/** «busy» copy for a given number of seconds left (the screen re-renders it while counting down). */
export function customerBulkBusyMessage(seconds: number): string {
  return seconds > 0
    ? `Hay otra descarga en curso; reintenta en ${seconds} s.`
    : 'La otra descarga ya debió terminar; puedes reintentar.'
}

export function customerBulkFailure(error: unknown, kind: CustomerBulkKind): CustomerBulkFailure {
  const { status, data } = bodyOf(error)
  const details = isRecord(data.details) ? data.details : {}
  const code = asText(data.code) ?? (asText(data.error) === PDF_FAILED || asText(data.message) === PDF_FAILED ? PDF_FAILED : null)

  switch (code) {
    case 'BULK_CUSTOMERS_NOT_FOUND': {
      const missingIds = Array.isArray(details.missingIds)
        ? details.missingIds.filter((id): id is string => typeof id === 'string')
        : []
      const n = missingIds.length
      const message =
        n === 1 ? '1 cliente de la selección ya no existe.' : `${n} clientes de la selección ya no existen.`
      return { code, message, missingIds, canRetry: false }
    }
    case 'BULK_SELECTION_TOO_LARGE': {
      const count = typeof details.count === 'number' ? details.count : null
      const max = typeof details.max === 'number' ? details.max : null
      const unit = kind === 'statements' ? 'descarga' : 'exportación'
      const message =
        count !== null && max !== null
          ? `La selección tiene ${count.toLocaleString('en-US')} clientes y el máximo es ${max.toLocaleString('en-US')} por ${unit}. Quita algunos e intenta de nuevo.`
          : `La selección tiene demasiados clientes para una ${unit}. Quita algunos e intenta de nuevo.`
      return { code, message, canRetry: false, refetch: true }
    }
    case 'BULK_SELECTION_EMPTY':
      return { code, message: 'La selección ya no tiene clientes. Actualizamos la lista.', canRetry: false, refetch: true }
    case 'BULK_EXPORT_BUSY': {
      const seconds =
        typeof details.retryAfterSeconds === 'number' && details.retryAfterSeconds > 0
          ? Math.ceil(details.retryAfterSeconds)
          : DEFAULT_RETRY_AFTER_SECONDS
      return { code, message: customerBulkBusyMessage(seconds), canRetry: true, retryAfterSeconds: seconds }
    }
    case 'BULK_EXPORT_TIMEOUT':
      return { code, message: 'La descarga tardó demasiado; prueba con menos clientes.', canRetry: false }
    case PDF_FAILED:
      return { code, message: 'No se pudieron generar los estados de cuenta. Intenta de nuevo.', canRetry: true }
  }

  const listing = customersListingError(error)
  if (listing) return { code: listing.code, message: listing.message, canRetry: false }

  if (status === 403) {
    return {
      code: 'FORBIDDEN',
      message:
        kind === 'csv'
          ? 'No tienes permiso para exportar clientes.'
          : 'No tienes permiso para descargar estados de cuenta.',
      canRetry: false,
    }
  }
  if (status === 400 && kind === 'statements') {
    return { code: 'INVALID_PERIOD', message: 'Revisa el periodo: debe ser de 1 a 366 días.', canRetry: false }
  }
  return { code: 'UNKNOWN', message: 'No se pudo completar la descarga. Intenta de nuevo.', canRetry: true }
}
