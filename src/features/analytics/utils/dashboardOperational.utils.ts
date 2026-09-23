import type {
  PendingRefundMethod,
  PendingRefundReason,
} from '@/features/POS/sales/interfaces/pending-refund.types'

const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City'

const mexicoCityInstantFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: MEXICO_CITY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const REFUND_METHOD_LABELS: Record<PendingRefundMethod, string> = {
  cash: 'Efectivo',
  card_credit: 'Tarjeta de crédito',
  card_debit: 'Tarjeta de débito',
  transfer: 'Transferencia',
  credit: 'Crédito',
}

const REFUND_REASON_LABELS: Record<PendingRefundReason, string> = {
  CUSTOMER_REQUEST: 'Solicitud del cliente',
  ORDER_ERROR: 'Error en la venta',
  OUT_OF_STOCK: 'Sin existencias',
  DUPLICATE_SALE: 'Venta duplicada',
  OTHER: 'Otro',
}

/** Format one backend event instant in the dashboard's contractual timezone. */
export function formatDashboardInstant(iso: string): string {
  return mexicoCityInstantFormatter.format(new Date(iso))
}

/**
 * Preserve a backend logical calendar date without shifting it through the
 * browser timezone. Confirmed-sale due dates are UTC-midnight wire values.
 */
export function formatDashboardDueDate(iso: string): string {
  const date = new Date(iso)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getUTCFullYear()}`
}

export function pendingRefundMethodLabel(method: PendingRefundMethod): string {
  return REFUND_METHOD_LABELS[method]
}

export function pendingRefundReasonLabel(reason: PendingRefundReason): string {
  return REFUND_REASON_LABELS[reason]
}
