import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Format an instant-in-time (e.g. `confirmedAt`, `payment.paidAt`).
 * Uses the user's local timezone, which is correct for events that
 * happened at a specific moment.
 */
export function formatSaleDate(iso: string): string {
  const date = new Date(iso)

  if (isToday(date)) {
    return `Hoy a las ${format(date, 'HH:mm', { locale: es })}`
  }

  if (isYesterday(date)) {
    return `Ayer a las ${format(date, 'HH:mm', { locale: es })}`
  }

  return format(date, 'dd/MM/yyyy HH:mm:ss', { locale: es })
}

/**
 * Format a logical calendar date (e.g. `dueDate`). The backend stores
 * dueDate as a UTC timestamp at midnight, but semantically it's a
 * day-of-calendar, not an instant. Reading it via the local timezone
 * would shift the day backwards in negative-offset zones (e.g. UTC-6
 * shows "2026-05-30T00:00:00Z" as "29/05/2026 18:00:00").
 *
 * This helper extracts the UTC year/month/day so the rendered date
 * matches what the user picked, regardless of browser timezone, and
 * omits the time component entirely (a due date has no meaningful hour).
 */
export function formatSaleDueDate(iso: string): string {
  const d = new Date(iso)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}`
}

export function endOfDayUTC(date: Date | string): string {
  const value = new Date(date)
  const yyyy = value.getUTCFullYear()
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(value.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T23:59:59.999Z`
}
