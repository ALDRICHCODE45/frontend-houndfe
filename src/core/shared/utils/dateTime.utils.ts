/**
 * Display-only short date-time ("3 nov, 20:43"): es-MX, 24h clock, and the
 * year only when it differs from the current one ("3 nov 2025, 20:43").
 * Never feed the result back into a request; keep the wire value for that.
 */

export interface ShortDateTimeOptions {
  /** IANA zone used for display and for the year comparison. Defaults to the runtime zone. */
  timeZone?: string
  /** Injected "current" instant (tests); defaults to `new Date()`. */
  now?: Date
}

const EMPTY = '—'

function partsOf(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    day: part('day'),
    month: part('month').replace(/\.$/, ''),
    year: part('year'),
    hour: part('hour'),
    minute: part('minute'),
  }
}

export function formatShortDateTime(
  value: string | Date | null | undefined,
  options: ShortDateTimeOptions = {},
): string {
  if (value === null || value === undefined || value === '') return EMPTY
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY

  const shown = partsOf(date, options.timeZone)
  const current = partsOf(options.now ?? new Date(), options.timeZone)
  const year = shown.year === current.year ? '' : ` ${shown.year}`
  return `${shown.day} ${shown.month}${year}, ${shown.hour}:${shown.minute}`
}
