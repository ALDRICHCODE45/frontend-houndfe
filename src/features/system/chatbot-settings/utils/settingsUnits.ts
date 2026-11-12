/**
 * Business minutes ↔ the units people read. The stored value is always minutes; the field shows
 * minutes or hours (hours take up to two decimals). `NaN` means «text that is not a number»: it
 * stays in the draft so validation can say so, instead of becoming a silent zero.
 */
export type DurationUnit = 'min' | 'h'

/** Blank → `null` (no deadline); unparsable → `NaN`. */
export function parseDuration(text: string, unit: DurationUnit): number | null {
  const raw = text.trim().replace(',', '.')
  if (raw === '') return null
  if (unit === 'h') return /^\d+(\.\d{1,2})?$/.test(raw) ? Math.round(parseFloat(raw) * 60) : Number.NaN
  return /^\d+$/.test(raw) ? parseInt(raw, 10) : Number.NaN
}

export const isInvalidDuration = (value: number | null): boolean =>
  typeof value === 'number' && Number.isNaN(value)

/** «Sin plazo», «45 min», «4 h», «1 h 30 min». */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Sin plazo'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export const initialUnit = (minutes: number | null): DurationUnit =>
  minutes !== null && minutes >= 60 && minutes % 60 === 0 ? 'h' : 'min'

export function textForUnit(minutes: number | null, unit: DurationUnit): string {
  if (minutes === null || Number.isNaN(minutes)) return ''
  return unit === 'h' ? String(Math.round((minutes / 60) * 100) / 100) : String(minutes)
}
