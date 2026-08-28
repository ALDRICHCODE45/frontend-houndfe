export type SaleBadgeConfig = {
  label: string
  color: 'success' | 'warning' | 'error' | 'neutral'
}

export const paymentStatusBadgeMap: Record<string, SaleBadgeConfig> = {
  PAID: { label: 'Pagada', color: 'success' },
  PARTIAL: { label: 'Impaga', color: 'warning' },
  CREDIT: { label: 'Deuda', color: 'error' },
}

export const deliveryStatusBadgeMap: Record<string, SaleBadgeConfig> = {
  DELIVERED: { label: 'Entregados', color: 'success' },
  PENDING: { label: 'No Entregados', color: 'error' },
  // pos-sale-delivery S3 (CAP-DLV-3): in-transit sale status. Added after the
  // pre-existing entries to preserve them verbatim (design §2/Q2 spec-drift
  // guard — the existing PENDING/DELIVERED copy+color must NOT be renamed).
  SHIPPED: { label: 'En ruta', color: 'warning' },
  NOT_APPLICABLE: { label: 'No aplica', color: 'neutral' },
}

const unknownBadge: SaleBadgeConfig = { label: 'Desconocido', color: 'neutral' }

export function getPaymentStatusBadge(status: string): SaleBadgeConfig {
  return paymentStatusBadgeMap[status] ?? unknownBadge
}

export function getDeliveryStatusBadge(status: string): SaleBadgeConfig {
  return deliveryStatusBadgeMap[status] ?? unknownBadge
}
