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
  DELIVERED: { label: 'Entregados', color: 'success' },
  // sdd delivery-routes S1a — REQ-SALES-DR-002: SHIPPED badge. Was rendering
  // "Desconocido" before this addition. Plural label 'Enviados' for tab/row
  // consistency with 'Entregados' / 'No Entregados'; the filter schema uses
  // the singular-feminine 'Enviada' (singular-feminine matches its siblings
  // 'Pendiente' / 'Entregada' in the filter options list). Tone is `warning`
  // — in transit but not yet delivered.
  SHIPPED: { label: 'Enviados', color: 'warning' },
  PENDING: { label: 'No Entregados', color: 'error' },
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
