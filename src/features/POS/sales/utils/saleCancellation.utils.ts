import {
  SALE_HOLD_EXPIRED_REASON,
  type ConfirmedSaleRow,
  type SaleDetail,
  type SaleDetailCancelReason,
} from '../interfaces/sale.types'
import { SALE_STATUS } from '../constants/sale.constants'

// Staff reasons keep the wording of the refunds labels (odd/handoff/06 §7); HOLD_EXPIRED is the
// wording of BE handoff 24 §4.
const CANCEL_REASON_LABELS: Record<SaleDetailCancelReason, string> = {
  CUSTOMER_REQUEST: 'Solicitud del cliente',
  ORDER_ERROR: 'Error en el pedido',
  OUT_OF_STOCK: 'Sin existencias',
  DUPLICATE_SALE: 'Venta duplicada',
  OTHER: 'Otro',
  HOLD_EXPIRED: 'Apartado vencido (no se pagó a tiempo)',
}

/** Spanish label of a cancelled sale's reason, the system HOLD_EXPIRED included. */
export function saleCancelReasonLabel(reason: SaleDetailCancelReason): string {
  return CANCEL_REASON_LABELS[reason]
}

/** What the system shows as the canceller of a HOLD_EXPIRED sale (no person, BE handoff 24 §4). */
export const SALE_SYSTEM_ACTOR_LABEL = 'Sistema'

/**
 * Who cancelled the sale: the person's name, «Sistema» for the deadline sweep (HOLD_EXPIRED with
 * `canceledBy: null`), and `null` when a staff cancellation's user no longer exists.
 */
export function saleCanceledByLabel(sale: Pick<SaleDetail, 'cancelReason' | 'canceledBy'>): string | null {
  if (sale.canceledBy) return sale.canceledBy.name
  return sale.cancelReason === SALE_HOLD_EXPIRED_REASON ? SALE_SYSTEM_ACTOR_LABEL : null
}

/** Short list note of a sale the deadline sweep cancelled (BE handoff 24 §1 list labels). */
export const SALE_HOLD_EXPIRED_LIST_NOTE = 'Apartado vencido'

/**
 * The note shown next to «Cancelada» on a list row: «Apartado vencido» only for a cancelled row
 * whose `cancelReason` is HOLD_EXPIRED; null otherwise (staff reasons and older payloads).
 */
export function saleRowCancelNote(
  sale: Pick<ConfirmedSaleRow, 'status' | 'cancelReason'>,
): { label: string; title: string } | null {
  if (sale.status !== SALE_STATUS.CANCELED || sale.cancelReason !== SALE_HOLD_EXPIRED_REASON) return null
  return { label: SALE_HOLD_EXPIRED_LIST_NOTE, title: saleCancelReasonLabel(sale.cancelReason) }
}
