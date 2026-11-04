import type { PurchaseOrder } from '../interfaces/purchase-order.types'
import { unitLabel } from './order-quantities'

// Readable view of the frozen line snapshots; raw wire strings, no recalculation.
export function describeLines(order: PurchaseOrder) {
  return order.lines.map(line => {
    const display = order.lineDisplaySnapshots.find(item => item.lineId === line.lineId)
    const cost = line.informedUnitCost
    return {
      lineId: line.lineId,
      product: display?.productName || 'Sin producto',
      variant: display?.variantName || null,
      quantity: line.orderedQuantity ?? '—',
      unit: unitLabel(display?.unit ?? cost?.unit) ?? '',
      cost,
      subtotal: order.lineSubtotals.find(item => item.lineId === line.lineId)?.subtotal ?? null,
    }
  })
}
export function locationLabel(order: PurchaseOrder): string {
  const { tenantName, detail } = order.locationSnapshot
  return detail ? `${tenantName} · ${detail}` : tenantName
}
