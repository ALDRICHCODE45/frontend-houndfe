import { statusBadgeTone, type StatusBadgeTone } from '@/core/shared/utils/badge.utils'
import { SALE_STATUS } from '../constants/sale.constants'
import type { ConfirmedSaleRow } from '../interfaces/sale.types'

export type SaleBadgeConfig = {
  label: string
  color: 'success' | 'warning' | 'error' | 'neutral'
}

export const paymentStatusBadgeMap: Record<string, SaleBadgeConfig> = {
  PAID: { label: 'Pagada', color: 'success' },
  PARTIAL: { label: 'Impaga', color: 'warning' },
  CREDIT: { label: 'Deuda', color: 'error' },
}

// The badge map is intentionally typed `Record<string, …>` (not
// `Record<SaleDeliveryStatus, …>`) so unknown runtime statuses the backend
// may add in the future resolve to `unknownBadge` via the `?? unknownBadge`
// fallback in `getDeliveryStatusBadge`. The three known rows below MUST
// cover the current `SaleDeliveryStatus` union — the S1a co-located spec
// file (`saleStatus.utils.spec.ts`) and the `SaleDeliveryStatus widening`
// spec in `sale.types.test.ts` freeze this contract.
export const deliveryStatusBadgeMap: Record<string, SaleBadgeConfig> = {
  // A badge describes one sale, so the labels agree with "venta": singular
  // feminine and sentence case (the filter options use the same words).
  DELIVERED: { label: 'Entregada', color: 'success' },
  // sdd delivery-routes S1a — REQ-SALES-DR-002: SHIPPED badge. Tone is
  // `warning` — in transit but not yet delivered.
  SHIPPED: { label: 'Enviada', color: 'warning' },
  PENDING: { label: 'No entregada', color: 'error' },
  // sdd delivery-routes S7 verify remediation — REQ-SALES-005: NOT_APPLICABLE
  // parity. Before this addition, instant-delivery / take-away sales (whose
  // `deliveryStatus` is `NOT_APPLICABLE`) fell through to the "Desconocido"
  // default — the spec mandates an explicit 'N/A' (neutral) entry so no key
  // in the union falls through. The label 'N/A' is intentionally short and
  // locale-neutral (no translation needed; matches industry convention).
  NOT_APPLICABLE: { label: 'N/A', color: 'neutral' },
}

const unknownBadge: SaleBadgeConfig = { label: 'Desconocido', color: 'neutral' }

export function getPaymentStatusBadge(status: string): SaleBadgeConfig {
  return paymentStatusBadgeMap[status] ?? unknownBadge
}

export function getDeliveryStatusBadge(status: string): SaleBadgeConfig {
  return deliveryStatusBadgeMap[status] ?? unknownBadge
}

/** Domain badge color → StatusBadge tone (`error` becomes `danger`). */
export function saleBadgeTone(color: SaleBadgeConfig['color']): StatusBadgeTone {
  return statusBadgeTone(color)
}

/** A row badge ready for `StatusBadge`: label, tone and the aria prefix that names what it says. */
export type SaleRowBadge = { label: string; tone: StatusBadgeTone; ariaPrefix: string }

// A canceled sale is neither paid nor pending delivery any more, so it shows one neutral state
// (design-system.md, Status badge: cancelled is neutral) in place of both badges, and no debt.
const canceledSaleBadge: SaleRowBadge = { label: 'Cancelada', tone: 'neutral', ariaPrefix: 'Estado:' }

export function isCanceledSale(sale: Pick<ConfirmedSaleRow, 'status'>): boolean {
  return sale.status === SALE_STATUS.CANCELED
}

/** Payment badge of a sale row; «Cancelada» for a canceled sale. */
export function salePaymentBadge(sale: Pick<ConfirmedSaleRow, 'status' | 'paymentStatus'>): SaleRowBadge {
  if (isCanceledSale(sale)) return canceledSaleBadge
  if (sale.paymentStatus == null) return { label: 'Sin estado', tone: 'neutral', ariaPrefix: 'Pago:' }
  const badge = getPaymentStatusBadge(sale.paymentStatus)
  return { label: badge.label, tone: saleBadgeTone(badge.color), ariaPrefix: 'Pago:' }
}

/** Delivery badge of a sale row; none for a canceled sale. */
export function saleDeliveryBadge(sale: Pick<ConfirmedSaleRow, 'status' | 'deliveryStatus'>): SaleRowBadge | null {
  if (isCanceledSale(sale)) return null
  const badge = getDeliveryStatusBadge(sale.deliveryStatus)
  return { label: badge.label, tone: saleBadgeTone(badge.color), ariaPrefix: 'Productos:' }
}

/** Debt a sale row shows; a canceled sale owes nothing. */
export function saleOpenDebtCents(sale: Pick<ConfirmedSaleRow, 'status' | 'debtCents'>): number {
  return isCanceledSale(sale) ? 0 : sale.debtCents
}
