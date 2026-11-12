/**
 * Pure operations on the settings draft (a deep copy of the last accepted `GET`/`PUT` body).
 * The `PUT` is a full replacement, so everything the screen does not edit travels back untouched.
 */
import type {
  ChatbotSettings,
  ChatbotSettingsPutBody,
  ChatbotWeekday,
} from '../interfaces/chatbot-settings.types'
import { CHATBOT_SETTINGS_SUBTYPES, CHATBOT_WEEKDAYS } from '../interfaces/chatbot-settings.types'
import { DAY_LABELS, MAX_RANGES_PER_DAY, SUBTYPE_COPY } from './settingsLabels'
import { deepCopy } from './deepCopy'
import { isRealDate, MAX_CLOSED_DATES } from './settingsValidation'

export const cloneSettings = (settings: ChatbotSettings): ChatbotSettings =>
  deepCopy(settings)

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const pad = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

/** The `PUT` body: whitelist of the contract, `expectedVersion` instead of `version`, no `recompute`. */
export function toPutBody(draft: ChatbotSettings, expectedVersion: number): ChatbotSettingsPutBody {
  const copy = cloneSettings(draft)
  const body: ChatbotSettingsPutBody = {
    expectedVersion,
    openingHours: {
      timeZone: copy.openingHours.timeZone,
      days: copy.openingHours.days.map((day) => ({
        day: day.day,
        ranges: [...day.ranges].sort((a, b) => toMinutes(a.open) - toMinutes(b.open)),
      })),
    },
    closedDates: [...copy.closedDates].sort(),
    slas: copy.slas,
    windowWarningMinutes: copy.windowWarningMinutes,
    templateName: copy.templateName === '' ? null : copy.templateName,
    templateCostText: copy.templateCostText,
    enabledSubtypes: copy.enabledSubtypes,
    receiptCloseMarginMinutes: copy.receiptCloseMarginMinutes,
    scheduling: copy.scheduling,
  }
  if (copy.branchOpeningHours) body.branchOpeningHours = copy.branchOpeningHours
  return body
}

export type DiffSection = 'hours' | 'dates' | 'sla' | 'extras' | 'sched'
export interface DiffItem {
  sec: DiffSection
  key: string
  label: string
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b) && !Number.isNaN(a) && !Number.isNaN(b)
const dayRanges = (settings: ChatbotSettings, day: ChatbotWeekday) =>
  settings.openingHours.days.find((d) => d.day === day)?.ranges ?? []
const slaOf = (settings: ChatbotSettings, subtype: string) => settings.slas.find((s) => s.subtype === subtype)

/** What changed between two settings, for the save bar and the 409 comparison. Read-only fields never count. */
export function diffItems(a: ChatbotSettings, b: ChatbotSettings): DiffItem[] {
  const out: DiffItem[] = []
  for (const day of CHATBOT_WEEKDAYS) {
    if (!same(dayRanges(a, day), dayRanges(b, day))) out.push({ sec: 'hours', key: `h:${day}`, label: DAY_LABELS[day].long })
  }
  if (a.openingHours.timeZone !== b.openingHours.timeZone) out.push({ sec: 'hours', key: 'tz', label: 'Zona horaria' })
  if (!same(a.closedDates, b.closedDates)) out.push({ sec: 'dates', key: 'dates', label: 'Fechas cerradas' })
  for (const subtype of CHATBOT_SETTINGS_SUBTYPES) {
    const x = slaOf(a, subtype)
    const y = slaOf(b, subtype)
    if (!x || !y) continue
    if (!Object.is(x.claimMinutes, y.claimMinutes) || !Object.is(x.resolveMinutes, y.resolveMinutes)) {
      out.push({ sec: 'sla', key: `s:${subtype}`, label: `Plazo de ${SUBTYPE_COPY[subtype].name.toLowerCase()}` })
    }
  }
  const scalars: Array<[keyof ChatbotSettings, string, DiffSection]> = [
    ['receiptCloseMarginMinutes', 'Margen de comprobantes', 'sla'],
    ['windowWarningMinutes', 'Aviso de ventana', 'extras'],
    ['templateName', 'Nombre de plantilla', 'extras'],
    ['templateCostText', 'Texto de costo', 'extras'],
  ]
  for (const [field, label, sec] of scalars) {
    if (!Object.is(a[field], b[field])) out.push({ sec, key: `x:${field}`, label })
  }
  if (!same(a.scheduling, b.scheduling)) out.push({ sec: 'sched', key: 'sched', label: 'Conversaciones agendadas' })
  return out
}

function day(draft: ChatbotSettings, name: ChatbotWeekday) {
  return draft.openingHours.days.find((d) => d.day === name)
}

export function toggleDay(draft: ChatbotSettings, name: ChatbotWeekday): void {
  const target = day(draft, name)
  if (target) target.ranges = target.ranges.length ? [] : [{ open: '09:00', close: '19:00' }]
}

export function addRange(draft: ChatbotSettings, name: ChatbotWeekday): void {
  const ranges = day(draft, name)?.ranges
  if (!ranges || ranges.length >= MAX_RANGES_PER_DAY) return
  const last = ranges[ranges.length - 1]
  const start = last && /^\d{2}:\d{2}$/.test(last.close) ? Math.min(toMinutes(last.close) + 60, 22 * 60) : 9 * 60
  ranges.push({ open: pad(start), close: pad(Math.min(start + 120, 23 * 60 + 59)) })
}

export function removeRange(draft: ChatbotSettings, name: ChatbotWeekday, index: number): void {
  day(draft, name)?.ranges.splice(index, 1)
}

export function setRangeTime(
  draft: ChatbotSettings,
  name: ChatbotWeekday,
  index: number,
  part: 'open' | 'close',
  value: string,
): void {
  const range = day(draft, name)?.ranges[index]
  if (range) range[part] = value
}

/** Replaces the target days with copies of the source day's ranges. */
export function copyDayRanges(draft: ChatbotSettings, from: ChatbotWeekday, to: readonly ChatbotWeekday[]): void {
  const source = day(draft, from)
  if (!source) return
  for (const name of to) {
    if (name === from) continue
    const target = day(draft, name)
    if (target) target.ranges = source.ranges.map((r) => ({ ...r }))
  }
}

/** «Copiar horario de recolección»: loads the pickup week into the editor (saved with the normal PUT). */
export function copyPickupHours(draft: ChatbotSettings): boolean {
  if (!draft.branchOpeningHours) return false
  draft.openingHours = deepCopy(draft.branchOpeningHours)
  return true
}

/** Adds a closed date (sorted, unique); returns the message when it cannot. */
export function addClosedDate(draft: ChatbotSettings, value: string): string | null {
  if (!value) return 'Elige una fecha.'
  if (!isRealDate(value)) return 'Elige una fecha válida.'
  if (draft.closedDates.includes(value)) return 'Esa fecha ya está en la lista.'
  if (draft.closedDates.length >= MAX_CLOSED_DATES) return `Llegaste al máximo de ${MAX_CLOSED_DATES} fechas.`
  draft.closedDates = [...draft.closedDates, value].sort()
  return null
}

export function removeClosedDate(draft: ChatbotSettings, value: string): void {
  draft.closedDates = draft.closedDates.filter((d) => d !== value)
}

/** Drops dates before `today` (a `YYYY-MM-DD` in the branch zone); returns how many. */
export function removePastClosedDates(draft: ChatbotSettings, today: string): number {
  const before = draft.closedDates.length
  draft.closedDates = draft.closedDates.filter((d) => d >= today)
  return before - draft.closedDates.length
}

/**
 * Three-way merge after a `409`: starts from the other person's version and re-applies only what
 * the user changed against the version they started from (`base`). Where both changed the same entry,
 * the user's value wins (the dialog says so). Read-only fields (`enabledSubtypes`, `branchOpeningHours`)
 * always come from `theirs`.
 */
export function rebaseDraft(base: ChatbotSettings, mine: ChatbotSettings, theirs: ChatbotSettings): ChatbotSettings {
  const out = cloneSettings(theirs)
  for (const { key: changed } of diffItems(base, mine)) {
    const [kind, name] = changed.split(':') as [string, string | undefined]
    if (kind === 'h' && name) {
      const target = out.openingHours.days.find((d) => d.day === name)
      if (target) target.ranges = deepCopy(dayRanges(mine, name as ChatbotWeekday))
    } else if (changed === 'tz') out.openingHours.timeZone = mine.openingHours.timeZone
    else if (changed === 'dates') out.closedDates = [...mine.closedDates]
    else if (kind === 's' && name) {
      const sla = slaOf(mine, name)
      const index = out.slas.findIndex((s) => s.subtype === name)
      if (sla && index >= 0) out.slas[index] = { ...sla }
    } else if (changed === 'sched') out.scheduling = { ...mine.scheduling }
    else if (changed === 'x:receiptCloseMarginMinutes') out.receiptCloseMarginMinutes = mine.receiptCloseMarginMinutes
    else if (changed === 'x:windowWarningMinutes') out.windowWarningMinutes = mine.windowWarningMinutes
    else if (changed === 'x:templateName') out.templateName = mine.templateName
    else if (changed === 'x:templateCostText') out.templateCostText = mine.templateCostText
  }
  return out
}
