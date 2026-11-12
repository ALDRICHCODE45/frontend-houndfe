/** Text of the inbox rows: age and the closing line of the closed tabs. */
import type { ChatbotRequestRow } from '../interfaces/chatbot-request.types'
import { cancelCauseLabel, formatWhen, type WhenOptions } from './requestLabels'

/** «5 min», «2 h 10 min», «3 d 4 h»; a dash for an invalid date. Never shorter than 1 min (clock skew reads «1 min»). */
export function formatAge(iso: string, now: Date = new Date()): string {
  const created = new Date(iso).getTime()
  if (Number.isNaN(created)) return '—'
  const minutes = Math.max(1, Math.round(Math.max(0, now.getTime() - created) / 60_000))
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${hours} h ${rest} min` : `${hours} h`
  }
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  return hours ? `${days} d ${hours} h` : `${days} d`
}

export interface ClosedLine {
  tone: 'resolved' | 'cancelled'
  title: string
  detail: string | null
}

/**
 * «Cierre» cell of the resolved and cancelled tabs. A merged-away request reads «Fusionada en
 * S-…» (from `mergedInto`); the other cancel causes use the shared labels.
 */
export function closedLine(
  row: ChatbotRequestRow,
  currentUserId: string | null,
  options: WhenOptions = {},
): ClosedLine {
  const when = formatWhen(row.closedAt, options)
  if (row.status === 'RESOLVED') {
    const person = row.resolvedBy
    return {
      tone: 'resolved',
      title: when ? `Resuelta ${when}` : 'Resuelta',
      detail: person ? `por ${person.id === currentUserId ? 'ti' : person.displayName}` : null,
    }
  }
  return {
    tone: 'cancelled',
    title: when ? `Cancelada ${when}` : 'Cancelada',
    detail: row.mergedInto ? `Fusionada en ${row.mergedInto.folio}` : cancelCauseLabel(row),
  }
}
