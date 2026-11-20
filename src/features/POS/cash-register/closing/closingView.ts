/**
 * Display helpers for the corte (frozen snapshot, handoff 25 §6) and the
 * «Cortes» filters. Pure; never feed a display value back into a request.
 */
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { CashClosingHandover, CashClosingSnapshot } from '../interfaces/cash.types'

/**
 * A cash difference worded the same in the corte and the «Cortes» list:
 * negative = faltante, positive = sobrante, zero = cuadra; no number = «—».
 */
export function closingDifferenceLabel(cents: number | null | undefined): string {
  if (typeof cents !== 'number') return '—'
  if (cents === 0) return `${formatCentsMXN(0)} · cuadra`
  return `${formatCentsMXN(cents)} · ${cents < 0 ? 'faltante' : 'sobrante'}`
}

/** Snapshot handovers have no guaranteed order: by `declaredAt`, then id. Never mutates. */
export function sortedClosingHandovers(handovers: readonly CashClosingHandover[]): CashClosingHandover[] {
  return [...handovers].sort((a, b) => {
    const byTime = Date.parse(a.declaredAt) - Date.parse(b.declaredAt)
    if (byTime !== 0 && !Number.isNaN(byTime)) return byTime
    return a.handoverId < b.handoverId ? -1 : a.handoverId > b.handoverId ? 1 : 0
  })
}

/** Name of a person the snapshot knows (cashier, verifier, closer); never an id. */
export function closingPersonName(
  snapshot: Pick<
    CashClosingSnapshot,
    | 'cashierUserId'
    | 'cashierName'
    | 'verifierUserId'
    | 'verifierName'
    | 'closedByUserId'
    | 'closedByName'
  >,
  userId: string | null | undefined,
): string {
  if (!userId) return '—'
  const known: Array<[string | null, string | null]> = [
    [snapshot.cashierUserId, snapshot.cashierName],
    [snapshot.verifierUserId, snapshot.verifierName],
    [snapshot.closedByUserId, snapshot.closedByName],
  ]
  const match = known.find(([id, name]) => id === userId && name?.trim())
  return match?.[1]?.trim() ?? 'Otra persona'
}

/**
 * Who received a handover, by name (never an id): the receipt actor's name when
 * that id exists, else the receiver's name when that id exists. A missing or
 * blank name falls back to {@link closingPersonName}; no ids at all → «—».
 */
export function closingHandoverReceiverName(
  snapshot: Parameters<typeof closingPersonName>[0],
  handover: Pick<
    CashClosingHandover,
    'receiptActorUserId' | 'receiverUserId' | 'receiptActorName' | 'receiverName'
  >,
): string {
  const id = handover.receiptActorUserId || handover.receiverUserId || null
  if (!id) return '—'
  const name = handover.receiptActorUserId ? handover.receiptActorName : handover.receiverName
  return name?.trim() || closingPersonName(snapshot, id)
}

const LEGACY_UUID_FOLIO = /^CC-([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Folio as shown on screen: old `CC-<uuid>` → `CC-<8 chars>` (like the PDF); anything else unchanged. */
export function displayClosingFolio(folio: string): string {
  const match = LEGACY_UUID_FOLIO.exec(folio)
  return match ? `CC-${match[1]}` : folio
}

export const CASH_HANDOVER_KIND_LABELS = {
  WITHDRAWAL: 'Retiro',
  FLOAT: 'Fondo siguiente turno',
} as const

function localMidnightISO(localDate: string, addDays = 0): string | undefined {
  const [year, month, day] = localDate.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day + addDays).toISOString()
}

/**
 * Local calendar days → the ISO range the list accepts (explicit timezone,
 * `from` inclusive, `to` exclusive: the day after the last chosen day).
 */
export function closingDateRange(fromDate: string, toDate: string): { from?: string; to?: string } {
  const range: { from?: string; to?: string } = {}
  const from = fromDate ? localMidnightISO(fromDate) : undefined
  const to = toDate ? localMidnightISO(toDate, 1) : undefined
  if (from) range.from = from
  if (to) range.to = to
  return range
}
