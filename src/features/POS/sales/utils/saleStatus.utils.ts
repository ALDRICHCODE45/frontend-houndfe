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
}

const unknownBadge: SaleBadgeConfig = { label: 'Desconocido', color: 'neutral' }

export function getPaymentStatusBadge(status: string): SaleBadgeConfig {
  return paymentStatusBadgeMap[status] ?? unknownBadge
}

export function getDeliveryStatusBadge(status: string): SaleBadgeConfig {
  return deliveryStatusBadgeMap[status] ?? unknownBadge
}
