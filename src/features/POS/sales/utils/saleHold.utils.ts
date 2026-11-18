/**
 * Pay-in-store hold («Apartado») helpers, BE handoff 24 §1 (display rule) and §2 (deadline edit
 * errors). Display only: never feed a formatted string back into a request.
 */
import { isAxiosError } from 'axios'
import { MEXICO_CITY_TIME_ZONE } from '@/core/shared/utils/mexicoCityCalendar'
import { SALE_PAYMENT_STATUS, SALE_STATUS } from '../constants/sale.constants'
import type { SaleHold, SalePaymentStatus, SaleStatus } from '../interfaces/sale.types'

export interface SaleHoldDisplayOptions {
  /** Sucursal IANA zone; defaults to Mexico City (the app's zone). */
  timeZone?: string
  /** Injected "current" instant (tests); decides whether the year is shown. */
  now?: Date
}

function expiryParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((p) => p.type === type)?.value ?? '').replace(/\.$/, '')
  return {
    weekday: part('weekday'),
    day: part('day'),
    month: part('month'),
    year: part('year'),
    time: `${part('hour')}:${part('minute')}`,
  }
}

/** «vie 19 nov, 12:30» in the sucursal zone; the year only when it is not the current one. */
export function formatSaleHoldExpiry(iso: string, options: SaleHoldDisplayOptions = {}): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const timeZone = options.timeZone ?? MEXICO_CITY_TIME_ZONE
  const shown = expiryParts(date, timeZone)
  const current = expiryParts(options.now ?? new Date(), timeZone)
  const year = shown.year === current.year ? '' : ` ${shown.year}`
  return `${shown.weekday} ${shown.day} ${shown.month}${year}, ${shown.time}`
}

export interface SaleHoldSubject {
  hold?: SaleHold | null
  status: SaleStatus
  paymentStatus: SalePaymentStatus | null
}

/**
 * §1 display rule: the hold is live while `hold !== null && status === CONFIRMED &&
 * paymentStatus === CREDIT`. Any payment or a cancellation ends it (the object stays as history).
 * The same condition makes it editable with PATCH /hold (plus `update:Sale`, checked by the UI).
 */
export function isSaleHoldLive(sale: SaleHoldSubject): sale is SaleHoldSubject & { hold: SaleHold } {
  return (
    sale.hold != null
    && sale.status === SALE_STATUS.CONFIRMED
    && sale.paymentStatus === SALE_PAYMENT_STATUS.CREDIT
  )
}

/** «Apartado · pagar en tienda · vence {fecha}», or `null` when the badge must be hidden. */
export function saleHoldLine(sale: SaleHoldSubject, options: SaleHoldDisplayOptions = {}): string | null {
  if (!isSaleHoldLive(sale)) return null
  const expiry = formatSaleHoldExpiry(sale.hold.expiresAt, options)
  return expiry ? `Apartado · pagar en tienda · vence ${expiry}` : null
}

// ─── PATCH /sales/:id/hold errors (§2) ──────────────────────────────────────

export const SALE_HOLD_ERROR_CODES = [
  'HOLD_VERSION_CONFLICT',
  'HOLD_EXPIRY_NOT_FUTURE',
  'SALE_NOT_PAY_IN_STORE',
  'SALE_HOLD_NOT_EDITABLE',
  'SALE_NOT_FOUND',
  'FORBIDDEN',
  'VALIDATION',
  'NETWORK',
  'UNKNOWN',
] as const

export type SaleHoldErrorCode = (typeof SALE_HOLD_ERROR_CODES)[number]

const DOMAIN_CODES: ReadonlySet<string> = new Set([
  'HOLD_VERSION_CONFLICT',
  'HOLD_EXPIRY_NOT_FUTURE',
  'SALE_NOT_PAY_IN_STORE',
  'SALE_HOLD_NOT_EDITABLE',
  'SALE_NOT_FOUND',
])

/** Classifies a failed `saleApi.updateHold` (sales envelope `{ statusCode, error, message }`). */
export function decodeSaleHoldError(error: unknown): SaleHoldErrorCode {
  if (!isAxiosError(error)) return 'UNKNOWN'
  const response = error.response
  if (!response || response.status >= 500) return 'NETWORK'
  const code = (response.data as { error?: unknown } | undefined)?.error
  if (typeof code === 'string' && DOMAIN_CODES.has(code)) return code as SaleHoldErrorCode
  if (response.status === 403) return 'FORBIDDEN'
  if (response.status === 400) return 'VALIDATION'
  return 'UNKNOWN'
}

const ERROR_MESSAGES: Record<SaleHoldErrorCode, string> = {
  HOLD_VERSION_CONFLICT:
    'Alguien más cambió la fecha límite. Actualizamos la venta; revisa y vuelve a intentar.',
  HOLD_EXPIRY_NOT_FUTURE: 'Elige una fecha y hora en el futuro.',
  SALE_NOT_PAY_IN_STORE: 'Esta venta no tiene un apartado para pagar en tienda.',
  SALE_HOLD_NOT_EDITABLE:
    'El apartado ya terminó: la venta se pagó o se canceló. Actualizamos la venta.',
  SALE_NOT_FOUND: 'No encontramos esta venta.',
  FORBIDDEN: 'No tienes permiso para cambiar la fecha límite.',
  VALIDATION: 'Revisa la fecha y hora límite.',
  NETWORK: 'No pudimos guardar la fecha límite. Revisa tu conexión e intenta de nuevo.',
  UNKNOWN: 'No pudimos guardar la fecha límite. Intenta de nuevo.',
}

/** es-MX copy of a deadline edit error; a server string is never shown. */
export function saleHoldErrorMessage(code: SaleHoldErrorCode): string {
  return ERROR_MESSAGES[code]
}

const RELOAD_CODES: ReadonlySet<SaleHoldErrorCode> = new Set([
  'HOLD_VERSION_CONFLICT',
  'SALE_NOT_PAY_IN_STORE',
  'SALE_HOLD_NOT_EDITABLE',
  'SALE_NOT_FOUND',
])

/** The sale changed under the user: refetch the detail (and list) before retrying. */
export function saleHoldErrorNeedsReload(code: SaleHoldErrorCode): boolean {
  return RELOAD_CODES.has(code)
}
