/**
 * customers-module T6: how the customers table and its mobile card write the listing dates.
 */
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatSaleDueDate } from '@/features/POS/sales/utils/saleDate.utils'

const EMPTY = '—'

/**
 * A calendar day ('YYYY-MM-DD', e.g. `oldestOverdueDueDate`) as dd/mm/yyyy, like the due dates of
 * Ventas: only the first 10 characters, read as UTC, so the day never moves with the timezone.
 */
export function formatListingDay(value: string | null | undefined): string {
  if (!value) return EMPTY
  return formatSaleDueDate(value.slice(0, 10))
}

/** An instant (`lastPurchaseAt`, `createdAt`) as «22 nov 2026» in local time. */
export function formatListingInstant(value: string | null | undefined): string {
  if (!value) return EMPTY
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY
  return format(date, 'd MMM yyyy', { locale: es })
}
