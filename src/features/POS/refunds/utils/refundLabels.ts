import type {
  PendingRefundMethod,
  PendingRefundReason,
} from '@/features/POS/sales/interfaces/pending-refund.types'
import { PENDING_REFUND_METHODS } from '@/features/POS/sales/interfaces/pending-refund.types'

// Copy hints of odd/handoff/06-refund-settlements.md §7. «Reembolso» names the debt and
// «devolución» each return of money (user decision, T19).
const METHOD_LABELS: Record<PendingRefundMethod, string> = {
  cash: 'Efectivo',
  card_credit: 'Tarjeta de crédito',
  card_debit: 'Tarjeta de débito',
  transfer: 'Transferencia',
  credit: 'Saldo a favor / crédito',
}

const REASON_LABELS: Record<PendingRefundReason, string> = {
  CUSTOMER_REQUEST: 'Solicitud del cliente',
  ORDER_ERROR: 'Error en el pedido',
  OUT_OF_STOCK: 'Sin existencias',
  DUPLICATE_SALE: 'Venta duplicada',
  OTHER: 'Otro',
}

export function refundMethodLabel(method: PendingRefundMethod): string {
  return METHOD_LABELS[method]
}

export function refundReasonLabel(reason: PendingRefundReason): string {
  return REASON_LABELS[reason]
}

/** Options of the «Método de devolución» combobox, in contract order. */
export const SETTLEMENT_METHOD_ITEMS: { label: string; value: PendingRefundMethod }[] =
  PENDING_REFUND_METHODS.map((value) => ({ value, label: METHOD_LABELS[value] }))

const DAY_MS = 24 * 60 * 60 * 1000

/** How long the debt has been open: `Hoy`, `1 día`, `14 días`. */
export function refundAgeLabel(createdAt: string, now: Date = new Date()): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY_MS))
  if (days === 0) return 'Hoy'
  return days === 1 ? '1 día' : `${days} días`
}

/** Short day of the cancellation (`21 oct`; the year only when it is not this year). */
export function refundCanceledDay(createdAt: string, now: Date = new Date()): string {
  const date = new Date(createdAt)
  const sameYear = date.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
    .format(date)
    .replace('.', '')
}
