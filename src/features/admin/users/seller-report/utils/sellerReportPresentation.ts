import {
  MEXICO_CITY_TIME_ZONE,
  parseMexicoCityCalendarDate,
} from '@/core/shared/utils/mexicoCityCalendar'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { AppBadgeTone } from '@/core/shared/utils/badge.utils'
import { paymentStatusBadgeMap } from '@/features/POS/sales/utils/saleStatus.utils'
import {
  SELLER_REPORT_ROW_LIMIT,
  type SellerReportCustomer,
  type SellerReportFailure,
  type SellerReportPaymentStatus,
  type SellerReportPreviousPeriod,
} from '../interfaces/seller-report.types'

/**
 * sellerReportPresentation.ts — every display transformation the seller report
 * performs, in one place.
 *
 * Rules:
 *   - Instants (`confirmedAt`, `canceledAt`, `generatedAt`) are ISO-8601 UTC
 *     wire values, so they are ALWAYS rendered in `America/Mexico_City`: the
 *     reader must see the local business day and hour the backend filtered on,
 *     not the browser's zone.
 *   - Calendar boundaries (`from`, `to`) are NOT instants. They are formatted
 *     from their own digits, so a `YYYY-MM-DD` day can never shift through a
 *     timezone.
 *   - Money goes through the shared MXN formatter and is never recomputed here.
 *   - Failure copy never exposes a backend code, status number or raw payload:
 *     the reader gets an actionable Spanish sentence.
 */

/** Human label for the only zone this report is expressed in. */
export const SELLER_REPORT_TIME_ZONE_LABEL = 'Hora del centro de México (America/Mexico_City)'

const instantFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: MEXICO_CITY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const countFormatter = new Intl.NumberFormat('es-MX')

/** Render an ISO-8601 UTC instant as `dd/mm/yyyy, hh:mm` in Mexico City. */
export function formatSellerReportInstant(instant: string): string {
  return instantFormatter.format(new Date(instant))
}

/**
 * Render a backend calendar boundary (`YYYY-MM-DD`) as `dd/mm/yyyy` without
 * ever constructing a `Date`. An unparseable value is returned untouched rather
 * than silently normalized.
 */
export function formatSellerReportCalendarDate(date: string): string {
  const parsed = parseMexicoCityCalendarDate(date)
  if (!parsed) return date
  const day = String(parsed.day).padStart(2, '0')
  const month = String(parsed.month).padStart(2, '0')
  return `${day}/${month}/${parsed.year}`
}

const SHORT_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

/**
 * Sales history redesign T2: the period with its LAST INCLUDED day («1 – 30 nov 2026») for a
 * `[from, to)` window. Display only: `to` stays the exclusive boundary sent to the server. The day
 * before `to` comes from calendar arithmetic, never from a JS `Date`. An empty, reversed or
 * unparseable window returns `null` instead of a made-up label.
 */
export function formatSellerReportPeriod(from: string, to: string): string | null {
  const first = parseMexicoCityCalendarDate(from)
  const end = parseMexicoCityCalendarDate(to)
  if (!first || !end || end.compare(first) <= 0) return null
  const last = end.subtract({ days: 1 })
  const month = (date: typeof first) => SHORT_MONTHS[date.month - 1]
  if (last.compare(first) === 0) return `${first.day} ${month(first)} ${first.year}`
  if (first.year !== last.year) {
    return `${first.day} ${month(first)} ${first.year} – ${last.day} ${month(last)} ${last.year}`
  }
  if (first.month !== last.month) {
    return `${first.day} ${month(first)} – ${last.day} ${month(last)} ${last.year}`
  }
  return `${first.day} – ${last.day} ${month(last)} ${last.year}`
}

/** Sales history backend data T2 (S7): a calendar day as «3 nov», from its digits. */
export function formatSellerReportShortDay(date: string): string {
  const parsed = parseMexicoCityCalendarDate(date)
  if (!parsed) return date
  return `${parsed.day} ${SHORT_MONTHS[parsed.month - 1]}`
}

/** A calendar day as «3 nov 2026», from its digits; an unparseable value is returned untouched. */
export function formatSellerReportDay(date: string): string {
  const parsed = parseMexicoCityCalendarDate(date)
  if (!parsed) return date
  return `${parsed.day} ${SHORT_MONTHS[parsed.month - 1]} ${parsed.year}`
}

/** Render authoritative integer cents as MXN through the shared formatter. */
export function formatSellerReportCents(cents: number): string {
  return formatCentsMXN(cents)
}

/** Render an authoritative count with es-MX grouping. */
export function formatSellerReportCount(count: number): string {
  return countFormatter.format(count)
}

/** «1 venta» / «3 ventas». */
export function formatSellerReportSaleCount(count: number): string {
  return `${countFormatter.format(count)} ${count === 1 ? 'venta' : 'ventas'}`
}

/** «1 unidad» / «12 unidades». */
export function formatSellerReportUnits(count: number): string {
  return `${countFormatter.format(count)} ${count === 1 ? 'unidad' : 'unidades'}`
}

/** Handoff 28 §5.1: a row without customer is a público-en-general sale. */
export const SELLER_REPORT_NO_CUSTOMER_LABEL = 'Público en general'

/**
 * Sales history backend data T2 (S5): the row's customer line. `null` (or a blank
 * name, as the PDF does) reads «Público en general»; `undefined` means an older
 * backend sent no customer at all, so there is no line (never a guessed label).
 */
export function sellerReportCustomerLabel(
  customer: SellerReportCustomer | null | undefined,
): string | null {
  if (customer === undefined) return null
  const name = customer?.name.trim() ?? ''
  return name || SELLER_REPORT_NO_CUSTOMER_LABEL
}

/** Direction of the net-sales change, for the icon beside the comparison text. */
export type SellerReportTrend = 'up' | 'down' | 'flat' | 'none'

export interface SellerReportPreviousPeriodComparison {
  label: string
  trend: SellerReportTrend
  /** The previous range (last included day) and its backend figures. */
  title: string
}

/**
 * Sales history backend data T2 (S8): «+12% vs. período anterior» on the net sales
 * metric. A DISPLAY ratio of two backend figures (`confirmed.summary.netSalesCents`
 * and `previousPeriod.netSalesCents`), never a sum of rows. A zero previous period
 * has no percentage (handoff 28 §5.4 guard); a real difference that rounds to 0%
 * reads «<1%» instead of claiming no change.
 */
export function sellerReportPreviousPeriodComparison(
  currentNetSalesCents: number,
  previous: SellerReportPreviousPeriod,
): SellerReportPreviousPeriodComparison {
  const range =
    formatSellerReportPeriod(previous.from, previous.to) ?? `${previous.from} – ${previous.to}`
  const title =
    `Período anterior: ${range} · ${formatSellerReportSaleCount(previous.saleCount)} · ` +
    formatSellerReportCents(previous.netSalesCents)

  if (previous.netSalesCents === 0) {
    return { label: 'Sin ventas en el período anterior', trend: 'none', title }
  }
  const difference = currentNetSalesCents - previous.netSalesCents
  if (difference === 0) {
    return { label: 'Igual que el período anterior', trend: 'flat', title }
  }

  const sign = difference > 0 ? '+' : '−'
  const percent = Math.round((Math.abs(difference) / previous.netSalesCents) * 100)
  const amount = percent === 0 ? '<1' : countFormatter.format(percent)
  return {
    label: `${sign}${amount}% vs. período anterior`,
    trend: difference > 0 ? 'up' : 'down',
    title,
  }
}

/**
 * Spanish labels for the authoritative payment states — the same words and
 * tones as the rest of the POS (Ventas list, sale detail, customer history),
 * taken from the shared payment badge map so the screens never drift apart.
 */
export const SELLER_REPORT_PAYMENT_STATUS_LABELS: Record<SellerReportPaymentStatus, string> = {
  PAID: paymentStatusBadgeMap.PAID!.label,
  PARTIAL: paymentStatusBadgeMap.PARTIAL!.label,
  CREDIT: paymentStatusBadgeMap.CREDIT!.label,
}

/** Badge tones for the authoritative payment states (shared badge map). */
export const SELLER_REPORT_PAYMENT_STATUS_TONES: Record<SellerReportPaymentStatus, AppBadgeTone> = {
  PAID: paymentStatusBadgeMap.PAID!.color,
  PARTIAL: paymentStatusBadgeMap.PARTIAL!.color,
  CREDIT: paymentStatusBadgeMap.CREDIT!.color,
}

const ROW_LIMIT_MESSAGE =
  `El reporte supera el límite de ${countFormatter.format(SELLER_REPORT_ROW_LIMIT)} filas por periodo. ` +
  'Reduce el periodo e inténtalo de nuevo.'

/** Load-state copy per failure kind. */
export const SELLER_REPORT_FAILURE_MESSAGES: Record<SellerReportFailure['kind'], string> = {
  'seller-not-found':
    'El vendedor ya no existe en este negocio. Actualiza la lista de usuarios e inténtalo de nuevo.',
  'row-limit-exceeded': ROW_LIMIT_MESSAGE,
  forbidden: 'No tienes permiso para consultar el reporte de ventas de este vendedor.',
  unauthorized: 'Tu sesión expiró. Inicia sesión de nuevo para consultar el reporte.',
  'invalid-request':
    'El servidor rechazó el periodo solicitado. Ajusta las fechas e inténtalo de nuevo.',
  'pdf-generation-failed':
    'No se pudo generar el PDF del reporte. Inténtalo de nuevo en unos segundos.',
  unknown: 'Puede ser un problema temporal del servidor.',
}

/**
 * Download-specific copy for a failure that is not a mapped domain error: a
 * network drop or a response that was not a PDF at all (never downloaded).
 */
export const SELLER_REPORT_DOWNLOAD_FAILURE_MESSAGE =
  'No pudimos descargar el PDF del reporte. Inténtalo de nuevo en unos segundos.'

/**
 * Actionable Spanish copy for a normalized failure.
 *
 * The row-cap message carries the reported limit and count when the backend
 * provided them, so the reader knows how far over the window is instead of
 * being told to "reduce the period" blindly.
 */
export function sellerReportFailureMessage(failure: SellerReportFailure): string {
  if (failure.kind === 'row-limit-exceeded') {
    const limit = countFormatter.format(failure.rowLimit ?? SELLER_REPORT_ROW_LIMIT)
    if (failure.rowCount === null) {
      return (
        `El reporte supera el límite de ${limit} filas por periodo. ` +
        'Reduce el periodo e inténtalo de nuevo.'
      )
    }
    return (
      `El reporte supera el límite de ${limit} filas: el periodo tiene ` +
      `${countFormatter.format(failure.rowCount)} ventas. Reduce el periodo e inténtalo de nuevo.`
    )
  }

  return SELLER_REPORT_FAILURE_MESSAGES[failure.kind]
}
