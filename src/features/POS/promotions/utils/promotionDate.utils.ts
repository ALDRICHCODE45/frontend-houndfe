import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Format ISO date string to human-readable format (timezone-safe).
 * Extracts the date part (YYYY-MM-DD) to avoid timezone offset issues
 * where "2026-04-01T00:00:00.000Z" could display as March 31 in local time.
 *
 * @param isoString - ISO date string or null
 * @returns Formatted date (e.g., "1 de abr 2026") or "—" if null
 */
export function formatPromotionDate(isoString: string | null): string {
  if (!isoString) return '—'
  try {
    const datePart = isoString.slice(0, 10)
    const [year, month, day] = datePart.split('-').map(Number)
    if (!year || !month || !day) return '—'
    // Use noon to avoid any timezone boundary issues
    const date = new Date(year, month - 1, day, 12, 0, 0)
    return format(date, "d 'de' MMM yyyy", { locale: es })
  } catch {
    return '—'
  }
}