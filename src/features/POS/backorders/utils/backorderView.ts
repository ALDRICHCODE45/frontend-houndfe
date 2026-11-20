/**
 * Display helpers for «Pedidos por reposición» (ODD restock-backorder S1, S3, S4). Pure: they
 * word what the API sent and never feed a display value back into a request. Never an id, never red
 * for a pending state.
 */
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { StatusBadgeTone } from '@/core/shared/utils/badge.utils'
import type { BackorderStaff, BackorderStatus } from '../interfaces/backorder.types'

/** Tabs in the owner's order (S1); `label` is the plural used by the tab, `badge` the singular. */
export const BACKORDER_TABS: ReadonlyArray<{ status: BackorderStatus; label: string; badge: string }> = [
  { status: 'WAITING', label: 'En espera', badge: 'En espera' },
  { status: 'RESERVED', label: 'Apartados', badge: 'Apartado' },
  { status: 'CONFIRMED', label: 'Confirmados', badge: 'Confirmado' },
  { status: 'EXPIRED', label: 'Vencidos', badge: 'Vencido' },
  { status: 'CANCELLED', label: 'Cancelados', badge: 'Cancelado' },
]

const STATUSES: ReadonlySet<string> = new Set(BACKORDER_TABS.map((tab) => tab.status))

export function isBackorderStatus(value: unknown): value is BackorderStatus {
  return typeof value === 'string' && STATUSES.has(value)
}

export function backorderStatusLabel(status: BackorderStatus): string {
  return BACKORDER_TABS.find((tab) => tab.status === status)?.badge ?? status
}

/** Pending (WAITING, RESERVED) is informational/warning, never danger (design system). */
export function backorderStatusTone(status: BackorderStatus): StatusBadgeTone {
  switch (status) {
    case 'WAITING':
      return 'info'
    case 'RESERVED':
      return 'warning'
    case 'CONFIRMED':
      return 'success'
    default:
      return 'neutral'
  }
}

/** Cancel only for WAITING / RESERVED (S5); the permission is checked by the caller. */
export function canCancelBackorder(backorder: Pick<BackorderStaff, 'status'>): boolean {
  return backorder.status === 'WAITING' || backorder.status === 'RESERVED'
}

export interface BackorderPriceView {
  final: string
  /** Reference («al agendar») and current prices, only when they differ from the final one. */
  notes: string[]
}

export function backorderPrice(
  backorder: Pick<BackorderStaff, 'referencePriceCents' | 'currentPriceCents' | 'finalPriceCents'>,
): BackorderPriceView {
  const notes: string[] = []
  if (backorder.referencePriceCents !== backorder.finalPriceCents) {
    notes.push(`Al agendar ${formatCentsMXN(backorder.referencePriceCents)}`)
  }
  if (backorder.currentPriceCents !== backorder.finalPriceCents) {
    notes.push(`Vigente ${formatCentsMXN(backorder.currentPriceCents)}`)
  }
  return { final: formatCentsMXN(backorder.finalPriceCents), notes }
}

export function productLabel(
  backorder: Pick<BackorderStaff, 'productName' | 'variantName'>,
): { name: string; variant: string | null } {
  return { name: backorder.productName, variant: backorder.variantName?.trim() || null }
}

export interface BackorderStatusInfo {
  lines: string[]
  /** A warning word (amber, never red). */
  warning: string | null
  link: { label: string; to: string } | null
}

const times = (count: number) => (count === 1 ? '1 vez' : `${count} veces`)

function cancelledWho(backorder: BackorderStaff): string {
  if (backorder.cancelledByKind === 'CUSTOMER') return 'el cliente'
  if (backorder.cancelledByKind === 'STAFF') return backorder.cancelledBy?.name?.trim() || 'el equipo'
  return backorder.cancelledBy?.name?.trim() || 'alguien del equipo'
}

/** The per-status cell of the list (S1) and the lead line of the detail. */
export function backorderStatusInfo(backorder: BackorderStaff, now?: Date): BackorderStatusInfo {
  const info: BackorderStatusInfo = { lines: [], warning: null, link: null }
  switch (backorder.status) {
    case 'WAITING':
      if (backorder.queuePosition !== null) info.lines.push(`#${backorder.queuePosition} en la fila`)
      if (backorder.passedOverCount > 0) info.warning = `Se lo saltaron ${times(backorder.passedOverCount)}`
      break
    case 'RESERVED':
      if (backorder.reservedUntil) {
        info.lines.push(`Apartado hasta ${formatShortDateTime(backorder.reservedUntil, { now })}`)
      }
      break
    case 'CONFIRMED':
      if (backorder.saleId) info.link = { label: 'Ver venta', to: `/pos/ventas/${backorder.saleId}` }
      break
    case 'EXPIRED':
      if (backorder.expiredAt) info.lines.push(`Venció el ${formatShortDateTime(backorder.expiredAt, { now })}`)
      break
    case 'CANCELLED':
      info.lines.push(`Canceló ${cancelledWho(backorder)}`)
      if (backorder.cancelReason?.trim()) info.lines.push(backorder.cancelReason.trim())
      break
  }
  return info
}

export interface BackorderTimelineEntry {
  key:
    | 'scheduledAt'
    | 'estimatedAt'
    | 'reservedAt'
    | 'reminderAt'
    | 'reservedUntil'
    | 'confirmedAt'
    | 'expiredAt'
    | 'cancelledAt'
  label: string
  at: string
  text: string
}

const TIMELINE: ReadonlyArray<[BackorderTimelineEntry['key'], string]> = [
  ['scheduledAt', 'Agendado'],
  ['estimatedAt', 'Llegada estimada'],
  ['reservedAt', 'Apartado'],
  ['reminderAt', 'Recordatorio al cliente'],
  ['reservedUntil', 'Vence el apartado'],
  ['confirmedAt', 'Confirmado'],
  ['expiredAt', 'Venció'],
  ['cancelledAt', 'Cancelado'],
]

/** The dates the order has, oldest first (ties keep the lifecycle order above). */
export function backorderTimeline(backorder: BackorderStaff, now?: Date): BackorderTimelineEntry[] {
  return TIMELINE.flatMap(([key, label]) => {
    const at = backorder[key]
    return at ? [{ key, label, at, text: formatShortDateTime(at, { now }) }] : []
  }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/** What the cancel dialog tells the person; RESERVED units pass to the next customer in line (S5). */
export function backorderCancelCopy(status: BackorderStatus): string {
  return status === 'RESERVED'
    ? 'Las unidades apartadas pasan al siguiente cliente en la fila. Esta acción no se puede deshacer.'
    : 'El cliente sale de la fila de espera. Esta acción no se puede deshacer.'
}
