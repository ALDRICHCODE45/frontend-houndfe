/**
 * Client mirror of the server rules (handoff 16 §3-§4). The server answers `400 VALIDATION_ERROR`
 * without saying which field, so everything is checked here first. Keys:
 * `h:<DAY>` `h:week` `h:tz` · `d:list` · `r:<DATE>` · `s:<SUBTYPE>:claim|resolve` · `x:margin` `x:window`
 * `x:template` `x:templateCost` · `c:slot` `c:offered` `c:max`.
 */
import type { ChatbotOpeningRange, ChatbotSettings } from '../interfaces/chatbot-settings.types'
import { MAX_RANGES_PER_DAY } from './settingsLabels'
import { formatDuration } from './settingsUnits'

export type SettingsErrors = Record<string, string>

export const MAX_CLOSED_DATES = 400
export const MAX_REASON_LENGTH = 80
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const TEMPLATE = /^[a-z0-9_]{1,512}$/

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function dayError(ranges: readonly ChatbotOpeningRange[]): string | null {
  if (ranges.length > MAX_RANGES_PER_DAY) return `Máximo ${MAX_RANGES_PER_DAY} horarios por día.`
  if (ranges.some((r) => !TIME.test(r.open) || !TIME.test(r.close))) {
    return 'Completa la hora de apertura y de cierre con una hora válida (de 00:00 a 23:59).'
  }
  const bad = ranges.find((r) => minutes(r.close) <= minutes(r.open))
  if (bad) return `El cierre (${bad.close}) debe ser después de la apertura (${bad.open}).`
  const sorted = [...ranges].sort((a, b) => minutes(a.open) - minutes(b.open))
  for (let i = 1; i < sorted.length; i++) {
    if (minutes(sorted[i]!.open) <= minutes(sorted[i - 1]!.close)) {
      const a = sorted[i - 1]!
      const b = sorted[i]!
      return `${a.open}–${a.close} y ${b.open}–${b.close} se empalman o se tocan. Únelos en un solo horario.`
    }
  }
  return null
}

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value)
const inRange = (value: unknown, lo: number, hi: number) => isInt(value) && value >= lo && value <= hi

export function validateSettings(settings: ChatbotSettings): SettingsErrors {
  const errors: SettingsErrors = {}

  if (!settings.openingHours.timeZone) errors['h:tz'] = 'Elige la zona horaria del horario.'
  let anyOpen = false
  for (const day of settings.openingHours.days) {
    if (day.ranges.length) anyOpen = true
    const message = dayError(day.ranges)
    if (message) errors[`h:${day.day}`] = message
  }
  if (!anyOpen) errors['h:week'] = 'Deja al menos un día con horario abierto.'

  const dates = settings.closedDates
  if (dates.length > MAX_CLOSED_DATES) errors['d:list'] = `Máximo ${MAX_CLOSED_DATES} fechas cerradas.`
  else if (dates.some((d) => !isRealDate(d))) errors['d:list'] = 'Hay una fecha cerrada que no es una fecha válida.'
  else if (new Set(dates).size !== dates.length) errors['d:list'] = 'Hay una fecha cerrada repetida.'

  // Reasons: 1 to 80 characters once trimmed; blank means «no reason»; a reason of an absent date is never sent.
  for (const date of dates) {
    const reason = settings.closedDateReasons?.[date]?.trim()
    if (reason && reason.length > MAX_REASON_LENGTH) errors[`r:${date}`] = `El motivo admite hasta ${MAX_REASON_LENGTH} caracteres.`
  }

  for (const sla of settings.slas) {
    const bound = 'Usa un número entre 1 min y 168 h.'
    const claimBad = sla.claimMinutes !== null && !inRange(sla.claimMinutes, 1, 10080)
    const resolveBad = sla.resolveMinutes !== null && !inRange(sla.resolveMinutes, 1, 10080)
    if (sla.subtype === 'TRANSFER_RECEIPT') {
      if (sla.resolveMinutes !== null) errors['s:TRANSFER_RECEIPT:resolve'] = 'Los comprobantes vencen por regla de cierre; no llevan plazo de resolver.'
      continue
    }
    if (claimBad) errors[`s:${sla.subtype}:claim`] = bound
    if (resolveBad) errors[`s:${sla.subtype}:resolve`] = bound
    if (!claimBad && !resolveBad && sla.claimMinutes !== null && sla.resolveMinutes !== null && sla.resolveMinutes < sla.claimMinutes) {
      errors[`s:${sla.subtype}:resolve`] = `Resolver no puede ser antes que atender (${formatDuration(sla.claimMinutes)}).`
    }
  }

  const span = 'Usa un valor entre 0 min y 24 h.'
  if (!inRange(settings.receiptCloseMarginMinutes, 0, 1440)) errors['x:margin'] = span
  if (!inRange(settings.windowWarningMinutes, 0, 1440)) errors['x:window'] = span
  if (settings.templateName !== null && !TEMPLATE.test(settings.templateName)) {
    errors['x:template'] = 'Solo minúsculas, números y guion bajo (_), hasta 512 caracteres.'
  }
  const cost = settings.templateCostText.length
  if (cost < 1 || cost > 200) errors['x:templateCost'] = 'Escribe un texto de 1 a 200 caracteres.'

  if (!inRange(settings.scheduling.slotMinutes, 5, 240)) errors['c:slot'] = 'Entre 5 y 240 minutos.'
  if (!inRange(settings.scheduling.slotsOffered, 1, 10)) errors['c:offered'] = 'Entre 1 y 10 horarios.'
  if (!inRange(settings.scheduling.maxScheduledPerSlot, 1, 50)) errors['c:max'] = 'Entre 1 y 50 conversaciones.'
  return errors
}

export type ErrorSection = 'hours' | 'dates' | 'sla' | 'extras' | 'sched'

export function sectionOfError(key: string): ErrorSection {
  if (key === 'x:margin') return 'sla'
  switch (key[0]) {
    case 'h': return 'hours'
    case 's': return 'sla'
    case 'x': return 'extras'
    case 'c': return 'sched'
    default: return 'dates'
  }
}
