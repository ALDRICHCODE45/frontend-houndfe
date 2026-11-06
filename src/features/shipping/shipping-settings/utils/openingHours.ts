/**
 * Weekly opening hours (handoff §7). The editor keeps a week as ranges per
 * day; the client checks the same rules as the backend (HH:mm, open before
 * close, no overlap or touch, which also rules out crossing midnight) and the
 * summary line is built here, since the store API does not return it. The
 * time zone is fixed (S7).
 */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import {
  WEEKDAYS,
  type OpeningDay,
  type OpeningHoursBody,
  type OpeningRange,
  type Weekday,
} from '../interfaces/shipping-settings.types'

export const OPENING_HOURS_TIME_ZONE = 'America/Mexico_City'
export const MAX_RANGES_PER_DAY = 6

export const DAY_LABELS: Record<Weekday, { long: string; short: string }> = {
  MONDAY: { long: 'Lunes', short: 'Lun' },
  TUESDAY: { long: 'Martes', short: 'Mar' },
  WEDNESDAY: { long: 'Miércoles', short: 'Mié' },
  THURSDAY: { long: 'Jueves', short: 'Jue' },
  FRIDAY: { long: 'Viernes', short: 'Vie' },
  SATURDAY: { long: 'Sábado', short: 'Sáb' },
  SUNDAY: { long: 'Domingo', short: 'Dom' },
}

export type Week = Record<Weekday, OpeningRange[]>
/** Per day, the message of each range by its index in the editor. */
export type WeekErrors = Partial<Record<Weekday, Record<number, string>>>

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const FORMAT_ERROR = 'Escribe las horas como 09:00, entre 00:00 y 23:59.'
const ORDER_ERROR = 'La apertura debe ser antes del cierre; un horario no puede pasar de medianoche.'
const OVERLAP_ERROR = 'Se encima o se toca con otro horario del día; únelos en uno solo.'

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

export function closedWeek(): Week {
  // SAFETY: the entries cover every Weekday, so the object is a complete Week.
  return Object.fromEntries(WEEKDAYS.map((day) => [day, []])) as unknown as Week
}

export function weekFromDays(days: readonly OpeningDay[] | null | undefined): Week {
  const week = closedWeek()
  for (const entry of days ?? []) week[entry.day] = entry.ranges.map((range) => ({ ...range }))
  return week
}

/** `9:00` → `09:00`, `930` → `09:30`; anything else is returned trimmed for validation. */
export function normalizeTimeText(text: string): string {
  const raw = text.trim()
  const match = raw.match(/^(\d{1,2}):?(\d{2})$/)
  return match ? `${match[1]!.padStart(2, '0')}:${match[2]}` : raw
}

const sortedRanges = (ranges: readonly OpeningRange[]) =>
  [...ranges].sort((a, b) => minutes(a.open) - minutes(b.open))

export function weekToBody(week: Week): OpeningHoursBody {
  return {
    timeZone: OPENING_HOURS_TIME_ZONE,
    days: WEEKDAYS.map((day) => ({ day, ranges: sortedRanges(week[day]).map((range) => ({ ...range })) })),
  }
}

function validateDay(ranges: readonly OpeningRange[]): Record<number, string> {
  const errors: Record<number, string> = {}
  ranges.forEach((range, index) => {
    if (!TIME.test(range.open) || !TIME.test(range.close)) errors[index] = FORMAT_ERROR
    else if (minutes(range.open) >= minutes(range.close)) errors[index] = ORDER_ERROR
  })
  if (Object.keys(errors).length > 0) return errors
  // Same order as the backend: by opening time; the later range takes the message.
  const order = ranges.map((range, index) => ({ range, index })).sort((a, b) => minutes(a.range.open) - minutes(b.range.open))
  for (let i = 1; i < order.length; i++) {
    if (minutes(order[i]!.range.open) <= minutes(order[i - 1]!.range.close)) errors[order[i]!.index] = OVERLAP_ERROR
  }
  return errors
}

export function validateWeek(week: Week): WeekErrors {
  const errors: WeekErrors = {}
  for (const day of WEEKDAYS) {
    const dayErrors = validateDay(week[day])
    if (Object.keys(dayErrors).length > 0) errors[day] = dayErrors
  }
  return errors
}

function rangesText(ranges: readonly OpeningRange[]): string {
  if (ranges.length === 0) return 'cerrado'
  return ranges
    .map((range) => `${range.open}–${range.close}`)
    .join(', ')
    .replace(/, ([^,]*)$/, ' y $1')
}

/** «Lun–Vie 09:00–14:00 y 16:00–19:30 · Sáb 09:00–14:00 · Dom cerrado». */
export function openingHoursSummary(days: readonly OpeningDay[]): string {
  const week = weekFromDays(days)
  if (WEEKDAYS.every((day) => week[day].length === 0)) return 'Cerrado toda la semana'
  const groups: Array<{ first: Weekday; last: Weekday; text: string }> = []
  for (const day of WEEKDAYS) {
    const text = rangesText(sortedRanges(week[day]))
    const previous = groups[groups.length - 1]
    if (previous && previous.text === text) previous.last = day
    else groups.push({ first: day, last: day, text })
  }
  return groups
    .map(({ first, last, text }) => {
      const label = first === last ? DAY_LABELS[first].short : `${DAY_LABELS[first].short}–${DAY_LABELS[last].short}`
      return `${label} ${text}`
    })
    .join(' · ')
}

const DAY_PREFIX = new RegExp(`^(${WEEKDAYS.join('|')})\\b`)
const GENERIC_DAY_ERROR = 'Revisa los horarios de este día.'

function dayMessage(message: string): string {
  if (/open must be before close/i.test(message)) return 'La apertura debe ser antes del cierre.'
  if (/overlap or touch/i.test(message)) return 'Hay horarios que se enciman o se tocan; únelos en uno solo.'
  if (/HH:mm/.test(message)) return FORMAT_ERROR
  return GENERIC_DAY_ERROR
}

/**
 * `INVALID_OPENING_HOURS` names the day at the start of its message
 * (`FRIDAY: open must be before close`), so it is shown next to that day.
 */
export function mapOpeningHoursError(err: unknown): {
  days: Partial<Record<Weekday, string>>
  message: string | null
} {
  const envelope = readApiErrorEnvelope(err)
  if (envelope.code === 'INVALID_OPENING_HOURS') {
    const text = envelope.message ?? ''
    const day = text.match(DAY_PREFIX)?.[1] as Weekday | undefined
    if (day) return { days: { [day]: dayMessage(text) }, message: null }
    if (/weekday is required/i.test(text)) return { days: {}, message: 'Revisa el horario: falta algún día de la semana.' }
    if (/time ?zone/i.test(text)) return { days: {}, message: 'La zona horaria del horario no es válida.' }
    return { days: {}, message: 'Revisa el horario de la semana.' }
  }
  if (envelope.status === 400) {
    const days: Partial<Record<Weekday, string>> = {}
    for (const path of Object.keys(envelope.fieldErrors)) {
      const index = path.match(/^days\.(\d+)/)?.[1]
      const day = index === undefined ? undefined : WEEKDAYS[Number(index)]
      if (day) days[day] = GENERIC_DAY_ERROR
    }
    if (Object.keys(days).length > 0) return { days, message: null }
    return { days, message: 'Revisa el horario de la semana.' }
  }
  if (envelope.status === 403) return { days: {}, message: 'No tienes permiso para cambiar el horario.' }
  return { days: {}, message: 'No se pudo guardar el horario. Intenta de nuevo.' }
}
