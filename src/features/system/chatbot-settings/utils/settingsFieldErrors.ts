/**
 * Maps the server's `fieldErrors` ([{path, code}], handoff 16 §4) to the keys the form already uses
 * (`h:<DAY>`, `s:<SUBTYPE>:claim|resolve`, `d:list`, `r:<DATE>`, `x:*`, `c:*`) with es-MX messages per code.
 * `path` is relative to the body that was sent and its indexes are positions in that request, so days and
 * subtypes are resolved against the sent body, not the draft. A path the form has no field for, and a bad
 * index, count as `unmapped`; the caller then also shows the generic message. An unknown code on a known
 * path still marks the field with a generic text (new codes may be added later).
 */
import type { ChatbotSettingsPutBody } from '../interfaces/chatbot-settings.types'
import type { SettingsFieldError } from './settingsErrors'
import { MAX_RANGES_PER_DAY } from './settingsLabels'
import {
  MAX_CLOSED_DATES,
  MAX_REASON_LENGTH,
  START_TIMEOUT_TEXT,
  TEMPLATE_LANGUAGE_TEXT,
  type SettingsErrors,
} from './settingsValidation'

const SCALAR_KEYS: Record<string, string> = {
  'openingHours.timeZone': 'h:tz',
  'openingHours.days': 'h:week',
  windowWarningMinutes: 'x:window',
  receiptCloseMarginMinutes: 'x:margin',
  templateName: 'x:template',
  templateCostText: 'x:templateCost',
  startTimeoutSeconds: 'x:startTimeout',
  templateLanguageCode: 'x:templateLanguage',
  'scheduling.slotMinutes': 'c:slot',
  'scheduling.slotsOffered': 'c:offered',
  'scheduling.maxScheduledPerSlot': 'c:max',
}

/** `OUT_OF_RANGE` says the limit of the field it points at. */
const RANGE_TEXT: Record<string, string> = {
  'x:window': 'Usa un valor entre 0 min y 24 h.',
  'x:margin': 'Usa un valor entre 0 min y 24 h.',
  'x:startTimeout': START_TIMEOUT_TEXT,
  'c:slot': 'Entre 5 y 240 minutos.',
  'c:offered': 'Entre 1 y 10 horarios.',
  'c:max': 'Entre 1 y 50 conversaciones.',
}

const LENGTH_TEXT = (key: string) =>
  key.startsWith('r:')
    ? `Escribe un motivo de 1 a ${MAX_REASON_LENGTH} caracteres.`
    : key === 'x:templateCost'
      ? 'Escribe un texto de 1 a 200 caracteres.'
      : 'El texto es demasiado corto o demasiado largo.'

const MESSAGES: Record<string, string> = {
  REQUIRED: 'Falta este valor.',
  INVALID_TYPE: 'El valor no tiene el formato correcto.',
  INVALID_VALUE: 'Elige un valor permitido.',
  UNKNOWN_FIELD: 'Este campo no se acepta.',
  INVALID_TEXT: 'Escribe solo texto, sin caracteres especiales.',
  INVALID_LANGUAGE_CODE: TEMPLATE_LANGUAGE_TEXT,
  INVALID_TEMPLATE_NAME: 'Solo minúsculas, números y guion bajo (_), hasta 512 caracteres.',
  INVALID_TIME: 'Usa una hora válida (de 00:00 a 23:59).',
  CROSSES_MIDNIGHT: 'Un horario no puede cruzar la medianoche. Divídelo entre dos días.',
  EMPTY_RANGE: 'La apertura y el cierre no pueden ser la misma hora.',
  OVERLAP: 'Este horario se empalma o se toca con otro del mismo día. Únelos en uno solo.',
  TOO_MANY_RANGES: `Máximo ${MAX_RANGES_PER_DAY} horarios por día.`,
  INVALID_TIMEZONE: 'Elige una zona horaria válida.',
  INVALID_DAY: 'El día no es válido. Recarga la pantalla e inténtalo de nuevo.',
  DUPLICATE_DAY: 'El día está repetido. Recarga la pantalla e inténtalo de nuevo.',
  NO_OPEN_RANGE: 'Deja al menos un día con horario abierto.',
  INVALID_DATE: 'Hay una fecha cerrada que no es una fecha válida.',
  TOO_MANY_DATES: `Máximo ${MAX_CLOSED_DATES} fechas cerradas.`,
  REASON_WITHOUT_DATE: 'Hay un motivo sin su fecha cerrada. Agrega la fecha o quita el motivo.',
  MUST_BE_NULL: 'Los comprobantes vencen por regla de cierre; no llevan plazo de resolver.',
  RESOLVE_BELOW_CLAIM: 'Resolver no puede ser antes que atender.',
}
const GENERIC = 'Este valor no es válido.'

function messageFor(code: string, key: string): string {
  if (code === 'OUT_OF_RANGE') {
    if (key.startsWith('s:')) return 'Usa un número entre 1 min y 168 h.'
    return RANGE_TEXT[key] ?? 'El número está fuera del rango permitido.'
  }
  if (code === 'INVALID_LENGTH') return LENGTH_TEXT(key)
  return MESSAGES[code] ?? GENERIC
}

function keyOf(path: string, body: ChatbotSettingsPutBody): string | null {
  const scalar = SCALAR_KEYS[path]
  if (scalar) return scalar

  const day = /^openingHours\.days\[(\d+)\](?:\.|\[|$)/.exec(path)
  if (day) {
    const name = body.openingHours.days[Number(day[1])]?.day
    return name ? `h:${name}` : null
  }

  if (path === 'closedDates' || /^closedDates\[\d+\]$/.test(path)) return 'd:list'

  const reason = /^closedDateReasons\["([^"]*)"\]$/.exec(path)
  if (reason) {
    const date = reason[1]!
    return body.closedDates.includes(date) ? `r:${date}` : 'd:list'
  }
  if (path === 'closedDateReasons') return 'd:list'

  const sla = /^slas\[(\d+)\]\.(claimMinutes|resolveMinutes)$/.exec(path)
  if (sla) {
    const subtype = body.slas[Number(sla[1])]?.subtype
    return subtype ? `s:${subtype}:${sla[2] === 'claimMinutes' ? 'claim' : 'resolve'}` : null
  }
  return null
}

export interface MappedFieldErrors {
  /** Form key → message. The first error of a field wins. */
  errors: SettingsErrors
  /** How many entries have no field in the form (unknown path, subtype lists, bad index). */
  unmapped: number
  /** Key of the first located error, in the order of the response. */
  first: string | null
}

export function mapFieldErrors(fieldErrors: readonly SettingsFieldError[], sent: ChatbotSettingsPutBody): MappedFieldErrors {
  const errors: SettingsErrors = {}
  let unmapped = 0
  let first: string | null = null
  for (const { path, code } of fieldErrors) {
    const key = keyOf(path, sent)
    if (!key) {
      unmapped++
      continue
    }
    first ??= key
    errors[key] ??= messageFor(code, key)
  }
  return { errors, unmapped, first }
}
