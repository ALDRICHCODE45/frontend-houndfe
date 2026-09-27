import {
  MEXICO_CITY_TIME_ZONE,
  parseMexicoCityCalendarDate,
} from '@/core/shared/utils/mexicoCityCalendar'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { AppBadgeTone } from '@/core/shared/utils/badge.utils'
import {
  SELLER_REPORT_ROW_LIMIT,
  type SellerReportFailure,
  type SellerReportPaymentStatus,
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

/** Render authoritative integer cents as MXN through the shared formatter. */
export function formatSellerReportCents(cents: number): string {
  return formatCentsMXN(cents)
}

/** Render an authoritative count with es-MX grouping. */
export function formatSellerReportCount(count: number): string {
  return countFormatter.format(count)
}

/** Spanish labels for the authoritative payment states. */
export const SELLER_REPORT_PAYMENT_STATUS_LABELS: Record<SellerReportPaymentStatus, string> = {
  PAID: 'Pagada',
  PARTIAL: 'Parcial',
  CREDIT: 'A crédito',
}

/** Badge tones for the authoritative payment states. */
export const SELLER_REPORT_PAYMENT_STATUS_TONES: Record<SellerReportPaymentStatus, AppBadgeTone> = {
  PAID: 'success',
  PARTIAL: 'warning',
  CREDIT: 'info',
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
  unknown: 'No pudimos cargar el reporte de ventas. Reintenta en unos segundos.',
}

/** Print-specific copy: the fresh refetch failed, so nothing was printed. */
export const SELLER_REPORT_PRINT_REFRESH_FAILURE_MESSAGE =
  'No pudimos actualizar el reporte para imprimirlo; no se imprimió nada. Inténtalo de nuevo.'

/** Print-specific copy: the isolated document or the print dialog failed. */
export const SELLER_REPORT_PRINT_DIALOG_FAILURE_MESSAGE =
  'No se pudo abrir el diálogo de impresión. Revisa los permisos del navegador e inténtalo de nuevo.'

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
