import type {
  PendingRefundMethod,
  PendingRefundReason,
} from '@/features/POS/sales/interfaces/pending-refund.types'
import { refundMethodLabel, refundReasonLabel } from '@/features/POS/refunds/utils/refundLabels'

/** Contractual zone of every dashboard event instant. */
export const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City'

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

// One vocabulary with «Reembolsos pendientes» (contract copy hints, handoff 06 §7).
export function pendingRefundMethodLabel(method: PendingRefundMethod): string {
  return refundMethodLabel(method)
}

export function pendingRefundReasonLabel(reason: PendingRefundReason): string {
  return refundReasonLabel(reason)
}
