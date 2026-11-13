/** Comparison of three versions for the 409 dialog: what only I changed, what only they changed, what both did. */
import type { ChatbotSettings, ChatbotWeekday } from '../interfaces/chatbot-settings.types'
import { diffItems, type DiffItem } from './settingsDraft'
import { plural } from './settingsLabels'
import { formatDuration } from './settingsUnits'

export interface ConflictGroups {
  onlyMine: DiffItem[]
  onlyTheirs: DiffItem[]
  both: DiffItem[]
}

/** `base` is the version the user started from, `mine` the draft, `theirs` the version that was saved first. */
export function conflictGroups(base: ChatbotSettings, mine: ChatbotSettings, theirs: ChatbotSettings): ConflictGroups {
  const mineItems = diffItems(base, mine)
  const theirItems = diffItems(base, theirs)
  const both = mineItems.filter((m) => theirItems.some((t) => t.key === m.key))
  return {
    both,
    onlyMine: mineItems.filter((m) => !both.some((b) => b.key === m.key)),
    onlyTheirs: theirItems.filter((t) => !both.some((b) => b.key === t.key)),
  }
}

const rangesText = (settings: ChatbotSettings, day: string) => {
  const ranges = settings.openingHours.days.find((d) => d.day === (day as ChatbotWeekday))?.ranges ?? []
  return ranges.length ? ranges.map((r) => `${r.open}–${r.close}`).join(' y ') : 'Cerrado'
}

/** Short human text of one changed entry in the given version («atender 20 min, resolver 4 h»). */
export function describeValue(settings: ChatbotSettings, changed: string): string {
  const [kind, name] = changed.split(':')
  if (kind === 'h' && name) return rangesText(settings, name)
  if (changed === 'tz') return settings.openingHours.timeZone
  if (changed === 'dates') return plural(settings.closedDates.length, 'fecha', 'fechas')
  if (kind === 's' && name) {
    const sla = settings.slas.find((s) => s.subtype === name)
    return sla ? `atender ${formatDuration(sla.claimMinutes)}, resolver ${formatDuration(sla.resolveMinutes)}` : ''
  }
  if (changed === 'sched') {
    const s = settings.scheduling
    return `${s.enabled ? 'activadas' : 'desactivadas'}, ${s.slotMinutes} min, ${s.slotsOffered} horarios, ${s.maxScheduledPerSlot} por horario`
  }
  if (changed === 'x:receiptCloseMarginMinutes') return formatDuration(settings.receiptCloseMarginMinutes)
  if (changed === 'x:windowWarningMinutes') return formatDuration(settings.windowWarningMinutes)
  if (changed === 'x:templateName') return settings.templateName ?? 'Sin configurar'
  if (changed === 'x:templateCostText') return `«${settings.templateCostText}»`
  if (changed === 'x:templateLanguageCode') return settings.templateLanguageCode
  if (changed === 'x:startTimeoutSeconds') return `${settings.startTimeoutSeconds} segundos`
  return ''
}
