import type { PublicCatalogBranchHours } from '../interfaces/public-catalog-branch.types'

export interface BranchHoursLine {
  /** `today` is computed from the day's ranges; `summary` is the backend's own text. */
  kind: 'today' | 'summary'
  text: string
}

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

/** The weekday code (`MONDAY` …) of an instant in the given IANA zone, or null for an invalid zone. */
function weekdayIn(timeZone: string, now: Date): string | null {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' })
      .format(now)
      .toUpperCase()
    return WEEKDAYS.includes(name) ? name : null
  } catch {
    return null
  }
}

/**
 * «Abierto hoy 09:00–18:00» for the branch's own today (its time zone, never the visitor's);
 * the backend summary when today is closed, unknown or unreadable; null when there is nothing to say.
 */
export function todayHoursLine(
  hours: PublicCatalogBranchHours | null,
  now: Date = new Date(),
): BranchHoursLine | null {
  if (!hours) return null
  const summary = hours.summary.trim()
  const fallback: BranchHoursLine | null = summary ? { kind: 'summary', text: summary } : null
  const weekday = weekdayIn(hours.timeZone, now)
  const today = weekday ? hours.days.find((day) => day.day === weekday) : undefined
  if (!today || today.closed || today.ranges.length === 0) return fallback
  const ranges = today.ranges.map((range) => `${range.open}–${range.close}`).join(' y ')
  return { kind: 'today', text: `Abierto hoy ${ranges}` }
}
