/**
 * Group-level derivations of the inbox list. Nothing here applies SLA thresholds: the tone of a
 * row comes from the backend `slaLevel`, `slaPaused` and `scheduledFor`, the same way
 * `SlaIndicator` reads them.
 */
import type {
  ChatbotRequestGroup,
  ChatbotRequestGroupCustomer,
  ChatbotRequestRow,
} from '../interfaces/chatbot-request.types'
import type { RequestsListTab } from './list-query'

export type SlaTone = 'bad' | 'warn' | 'ok' | 'sched' | 'pause' | 'none'

const isOpen = (row: Pick<ChatbotRequestRow, 'status'>) => row.status === 'NEW' || row.status === 'IN_PROGRESS'

/** Traffic-light tone of one open row (`null` for a closed one). Mirrors `SlaIndicator`. */
export function rowTone(row: ChatbotRequestRow, now: Date = new Date()): SlaTone | null {
  if (!isOpen(row)) return null
  if (row.slaLevel === 'OVERDUE') return 'bad'
  const scheduledAt = row.scheduledFor ? new Date(row.scheduledFor).getTime() : Number.NaN
  if (scheduledAt > now.getTime()) return 'sched'
  if (row.slaPaused) return 'pause'
  switch (row.slaLevel) {
    case 'OK':
      return 'ok'
    case 'HALF':
      return 'warn'
    case 'ESCALATION':
      return 'bad'
    default:
      return 'none'
  }
}

const TONE_RANK: Record<SlaTone, number> = { bad: 0, warn: 1, ok: 2, sched: 3, pause: 4, none: 5 }

/** The most urgent tone among the open rows of a group. */
export function groupTone(rows: ChatbotRequestRow[], now: Date = new Date()): SlaTone {
  let best: SlaTone = 'none'
  for (const row of rows) {
    const tone = rowTone(row, now)
    if (tone && TONE_RANK[tone] < TONE_RANK[best]) best = tone
  }
  return best
}

/** Open rows that went overdue (`overdueAt` / `EXPIRED`); closed rows never count. */
export function overdueCount(rows: ChatbotRequestRow[]): number {
  return rows.filter((row) => isOpen(row) && (row.overdueAt !== null || row.displayStatus === 'EXPIRED')).length
}

/** The rows already on screen first, then the ones «Ver las N restantes» brought, without repeats. */
export function mergeGroupRows(first: ChatbotRequestRow[], fetched: ChatbotRequestRow[]): ChatbotRequestRow[] {
  const seen = new Set(first.map((row) => row.id))
  const merged = [...first]
  for (const row of fetched) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  return merged
}

/** «11 abiertas» on the open tabs (the customer's open total); «14 resueltas» on the closed ones. */
export function groupCountLabel(group: ChatbotRequestGroup, tab: RequestsListTab, loaded: number): string {
  if (tab === 'resolved' || tab === 'cancelled') {
    const total = loaded + group.moreRequests
    const noun = tab === 'resolved' ? 'resuelta' : 'cancelada'
    return `${total} ${noun}${total === 1 ? '' : 's'}`
  }
  return `${group.openCount} ${group.openCount === 1 ? 'abierta' : 'abiertas'}`
}

export function groupDisplayName(customer: ChatbotRequestGroupCustomer): string {
  return customer.displayName?.trim() || 'Cliente sin vincular'
}

/** As the server sent it (masked unless `read:CustomerPhone`); never masked or unmasked here. */
export function groupPhone(customer: ChatbotRequestGroupCustomer): string {
  return customer.phone?.trim() || 'Sin teléfono'
}

/** Out-of-hours state of the visible open rows: `slaPaused` is the same for all of them. */
export function pausedResumeAt(rows: ChatbotRequestRow[]): { paused: boolean; resumesAt: string | null } {
  const paused = rows.filter((row) => isOpen(row) && row.slaPaused)
  if (paused.length === 0) return { paused: false, resumesAt: null }
  return { paused: true, resumesAt: paused.find((row) => row.slaResumesAt)?.slaResumesAt ?? null }
}
