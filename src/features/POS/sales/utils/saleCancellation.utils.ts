import {
  SALE_HOLD_EXPIRED_REASON,
  type ConfirmedSaleRow,
  type SaleDetail,
  type SaleDetailCancelReason,
} from '../interfaces/sale.types'
import { SALE_STATUS } from '../constants/sale.constants'

// Staff reasons keep the wording of the refunds labels (odd/handoff/06 §7); HOLD_EXPIRED reads
// «Plazo vencido», the owner's wording (hold-expire-now S1/S3).
const CANCEL_REASON_LABELS: Record<SaleDetailCancelReason, string> = {
  CUSTOMER_REQUEST: 'Solicitud del cliente',
  ORDER_ERROR: 'Error en el pedido',
  OUT_OF_STOCK: 'Sin existencias',
  DUPLICATE_SALE: 'Venta duplicada',
  OTHER: 'Otro',
  HOLD_EXPIRED: 'Plazo vencido',
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

/** The tag shown next to «Cancelada» on a sale the hold deadline cancelled (hold-expire-now S3). */
export const SALE_HOLD_EXPIRED_TAG = 'Plazo vencido'

/** Why a HOLD_EXPIRED sale was cancelled, in a sentence (detail card, list tag title). */
export const SALE_HOLD_EXPIRED_EXPLANATION = 'Cancelada porque venció el plazo del apartado sin pagarse'

/** Icon of the «Plazo vencido» tag, so the state is never told by colour alone. */
export const SALE_HOLD_EXPIRED_ICON = 'i-lucide-clock-alert'

/** A cancelled sale whose hold deadline passed unpaid (automatic sweep or «Vencer apartado ahora»). */
export function isSaleHoldExpiredCancel(sale: Pick<SaleDetail, 'status' | 'cancelReason'>): boolean {
  return sale.status === SALE_STATUS.CANCELED && sale.cancelReason === SALE_HOLD_EXPIRED_REASON
}

/**
 * The tag shown next to «Cancelada» on a list row: «Plazo vencido» only for a cancelled row whose
 * `cancelReason` is HOLD_EXPIRED; null otherwise (staff reasons and older payloads).
 */
export function saleRowCancelNote(
  sale: Pick<ConfirmedSaleRow, 'status' | 'cancelReason'>,
): { label: string; title: string } | null {
  if (sale.status !== SALE_STATUS.CANCELED || sale.cancelReason !== SALE_HOLD_EXPIRED_REASON) return null
  return { label: SALE_HOLD_EXPIRED_TAG, title: SALE_HOLD_EXPIRED_EXPLANATION }
}
