/**
 * mexicoCityCalendar.ts — pure fixed-zone calendar helpers for the backend
 * sales-summary window contract.
 *
 * Locked contract (ODD branch-sales-summary A2):
 *   - Endpoint boundaries are exact `YYYY-MM-DD` calendar strings in
 *     `America/Mexico_City`; they are NEVER parsed as UTC/browser instants,
 *     because that shifts calendar days across zones.
 *   - An epoch millisecond may enter ONLY as an injected/current absolute
 *     instant used to resolve "today" in Mexico City. Everything else is
 *     calendar arithmetic.
 *   - Ranges are `[from, to)`: `from` inclusive, `to` exclusive, `to > from`,
 *     at most 366 calendar days apart. Exactly 366 days is valid.
 */

import {
  CalendarDate,
  fromAbsolute,
  parseDate,
  startOfMonth,
  toCalendarDate,
} from '@internationalized/date'

/** The only calendar zone these helpers resolve dates in. */
export const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City' as const

/** Inclusive lower and exclusive upper `YYYY-MM-DD` calendar boundaries. */
export interface MexicoCityDateRange {
  /** Inclusive boundary (`YYYY-MM-DD`). */
  from: string
  /** Exclusive boundary (`YYYY-MM-DD`). */
  to: string
}

/** Inclusive span limit: `to - from` must not exceed this many calendar days. */
export const MAX_MEXICO_CITY_RANGE_DAYS = 366

/** Exact canonical shape; rejects loose padding, timestamps, offsets and signs. */
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Parse an exact `YYYY-MM-DD` Gregorian date, or return `null`.
 *
 * Rejects: non-canonical shapes (`2025-1-1`), timestamps and offsets
 * (`2025-01-01T00:00:00Z`), empty values, the year `0000`, and impossible
 * dates (`2025-02-30`, `2026-02-29`). The round-trip equality check catches
 * every string the parser would silently normalize instead of rejecting.
 */
export function parseMexicoCityCalendarDate(value: string | null | undefined): CalendarDate | null {
  if (typeof value !== 'string' || !CALENDAR_DATE_PATTERN.test(value)) {
    return null
  }
  // The ISO parser folds `0000` into year 1; reject it explicitly.
  if (value.startsWith('0000-')) {
    return null
  }

  try {
    const parsed = parseDate(value)
    return parsed.toString() === value ? parsed : null
  } catch {
    return null
  }
}

/** True when `value` is an exact, real `YYYY-MM-DD` Gregorian calendar date. */
export function isValidCalendarDateString(value: string | null | undefined): boolean {
  return parseMexicoCityCalendarDate(value) !== null
}

/**
 * Resolve "today" in Mexico City from an absolute instant.
 *
 * `nowMs` defaults to the real clock; tests inject a fixed epoch so a UTC
 * instant whose Mexico City day differs stays observable.
 */
export function mexicoCityToday(nowMs: number = Date.now()): CalendarDate {
  return toCalendarDate(fromAbsolute(nowMs, MEXICO_CITY_TIME_ZONE))
}

/**
 * Validate an exact `[from, to)` range: both boundaries real calendar dates,
 * `to > from`, and at most 366 calendar days apart. Equal, inverted,
 * malformed or over-366-day ranges are invalid; exactly 366 days is valid.
 */
export function isValidMexicoCityDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  const fromDate = parseMexicoCityCalendarDate(from)
  const toDate = parseMexicoCityCalendarDate(to)
  if (!fromDate || !toDate) return false
  if (fromDate.compare(toDate) >= 0) return false

  // Pure calendar arithmetic: no Date, no zone, so leap days stay exact.
  return toDate.compare(fromDate.add({ days: MAX_MEXICO_CITY_RANGE_DAYS })) <= 0
}

function toRange(from: CalendarDate, to: CalendarDate): MexicoCityDateRange {
  return { from: from.toString(), to: to.toString() }
}

/**
 * Preset: today only — today through tomorrow (`[today, today + 1)`).
 */
export function mexicoCityTodayRange(nowMs: number = Date.now()): MexicoCityDateRange {
  const today = mexicoCityToday(nowMs)
  return toRange(today, today.add({ days: 1 }))
}

/**
 * Preset: the seven calendar days ending today — today-6 through tomorrow.
 */
export function mexicoCityLast7DaysRange(nowMs: number = Date.now()): MexicoCityDateRange {
  const today = mexicoCityToday(nowMs)
  return toRange(today.subtract({ days: 6 }), today.add({ days: 1 }))
}

/**
 * Preset: month to date — first day of the current month through tomorrow.
 */
export function mexicoCityThisMonthRange(nowMs: number = Date.now()): MexicoCityDateRange {
  const today = mexicoCityToday(nowMs)
  return toRange(startOfMonth(today), today.add({ days: 1 }))
}

/**
 * Preset: the full previous calendar month — its first day through the first
 * day of the current month.
 */
export function mexicoCityPreviousMonthRange(nowMs: number = Date.now()): MexicoCityDateRange {
  const today = mexicoCityToday(nowMs)
  const thisMonthStart = startOfMonth(today)
  return toRange(startOfMonth(thisMonthStart.subtract({ days: 1 })), thisMonthStart)
}

/** Identifiers for the deterministic range presets, in display order. */
export type MexicoCityRangePresetId = 'today' | 'last7Days' | 'thisMonth' | 'previousMonth'

const PRESET_RESOLVERS: Record<MexicoCityRangePresetId, (nowMs: number) => MexicoCityDateRange> = {
  today: mexicoCityTodayRange,
  last7Days: mexicoCityLast7DaysRange,
  thisMonth: mexicoCityThisMonthRange,
  previousMonth: mexicoCityPreviousMonthRange,
}

/** Every preset id, in display order. */
export const MEXICO_CITY_RANGE_PRESET_IDS: readonly MexicoCityRangePresetId[] = [
  'today',
  'last7Days',
  'thisMonth',
  'previousMonth',
]

/** Resolve one preset's `[from, to)` boundaries in Mexico City. */
export function getMexicoCityRangePreset(
  id: MexicoCityRangePresetId,
  nowMs: number = Date.now(),
): MexicoCityDateRange {
  return PRESET_RESOLVERS[id](nowMs)
}
