/**
 * customerStatementPeriod.ts — the period of the customer account statement (handoff 29 §1).
 *
 * `from`/`to` are `YYYY-MM-DD` days in America/Mexico_City, half-open `[from, to)` like the seller
 * report: all of November is `from=2026-11-01&to=2026-12-01`. Between 1 and 366 days. People read
 * the LAST INCLUDED day («1 – 30 nov 2026»), so the label subtracts one day from `to`; the wire
 * keeps the exclusive end. Pure calendar arithmetic: no JS `Date`, so no time zone shifts a day.
 */
import { CalendarDate, startOfMonth } from '@internationalized/date'
import {
  MAX_MEXICO_CITY_RANGE_DAYS,
  mexicoCityToday,
  parseMexicoCityCalendarDate,
} from '@/core/shared/utils/mexicoCityCalendar'

export type CustomerStatementPresetId = 'thisMonth' | 'previousMonth' | 'last3Months'

export interface CustomerStatementRange {
  /** First included day. */
  from: string
  /** Exclusive end (the day after the last included one); `''` while it is not picked. */
  to: string
}

export const CUSTOMER_STATEMENT_PRESETS: ReadonlyArray<{
  id: CustomerStatementPresetId
  label: string
}> = [
  { id: 'thisMonth', label: 'Este mes' },
  { id: 'previousMonth', label: 'Mes anterior' },
  { id: 'last3Months', label: 'Últimos 3 meses' },
]

export const CUSTOMER_STATEMENT_DEFAULT_PRESET: CustomerStatementPresetId = 'thisMonth'

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

const EMPTY_MESSAGE = 'Elige el primer y el último día del periodo.'
const REVERSED_MESSAGE = 'El último día no puede ser anterior al primero.'
const TOO_LONG_MESSAGE = `El periodo puede ser de hasta ${MAX_MEXICO_CITY_RANGE_DAYS} días.`

function range(from: CalendarDate, to: CalendarDate): CustomerStatementRange {
  return { from: from.toString(), to: to.toString() }
}

/** Whole calendar months around today in Mexico City; `to` is the first day after them. */
export function customerStatementPresetRange(
  id: CustomerStatementPresetId,
  nowMs: number = Date.now(),
): CustomerStatementRange {
  const monthStart = startOfMonth(mexicoCityToday(nowMs))
  const nextMonthStart = monthStart.add({ months: 1 })
  if (id === 'previousMonth') return range(monthStart.subtract({ months: 1 }), monthStart)
  if (id === 'last3Months') return range(monthStart.subtract({ months: 2 }), nextMonthStart)
  return range(monthStart, nextMonthStart)
}

function asCalendarDate(value: CalendarDate | string | null | undefined): CalendarDate | null {
  if (!value) return null
  return typeof value === 'string' ? parseMexicoCityCalendarDate(value) : value
}

/** Inclusive picked days → half-open range; `to` stays `''` until the last day is picked. */
export function customerStatementRangeFromDays(
  first: CalendarDate | string | null | undefined,
  last: CalendarDate | string | null | undefined,
): CustomerStatementRange {
  const start = asCalendarDate(first)
  const end = asCalendarDate(last)
  return {
    from: start?.toString() ?? '',
    to: end ? end.add({ days: 1 }).toString() : '',
  }
}

/** `null` when the range can be requested; otherwise the message to show. */
export function validateCustomerStatementRange(value: CustomerStatementRange): string | null {
  const from = parseMexicoCityCalendarDate(value.from)
  const to = parseMexicoCityCalendarDate(value.to)
  if (!from || !to) return EMPTY_MESSAGE
  const order = to.compare(from)
  if (order === 0) return EMPTY_MESSAGE
  if (order < 0) return REVERSED_MESSAGE
  if (to.compare(from.add({ days: MAX_MEXICO_CITY_RANGE_DAYS })) > 0) return TOO_LONG_MESSAGE
  return null
}

/** «1 – 30 nov 2026» (last included day); `null` for an empty, reversed or malformed range. */
export function formatCustomerStatementPeriod(from: string, to: string): string | null {
  const first = parseMexicoCityCalendarDate(from)
  const end = parseMexicoCityCalendarDate(to)
  if (!first || !end || end.compare(first) <= 0) return null
  const last = end.subtract({ days: 1 })
  const month = (date: CalendarDate) => SHORT_MONTHS[date.month - 1]
  if (last.compare(first) === 0) return `${first.day} ${month(first)} ${first.year}`
  if (first.year !== last.year) {
    return `${first.day} ${month(first)} ${first.year} – ${last.day} ${month(last)} ${last.year}`
  }
  if (first.month !== last.month) {
    return `${first.day} ${month(first)} – ${last.day} ${month(last)} ${last.year}`
  }
  return `${first.day} – ${last.day} ${month(last)} ${last.year}`
}
