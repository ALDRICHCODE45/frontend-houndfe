import type { OrderPickerProduct } from '../api/purchase-order-products.api'
import type { OrderInput, PurchaseOrder, TaxBasis } from '../interfaces/purchase-order.types'
import { isValidOrderAmount, validateOrderQuantity } from './order-quantities'

export interface LineBuffer {
  lineId: string; productId: string | null; variantId: string | null
  name: string; variantName: string | null; unit: string | null; hasVariants: boolean | null
  quantity: string; amount: string; taxBasis: TaxBasis | ''; hasCost: boolean
}
export interface OrderBuffer { supplierId: string | null; note: string; locationDetail: string; lines: LineBuffer[] }
export function replaceLineProduct(product: OrderPickerProduct | null): LineBuffer {
  return { lineId: crypto.randomUUID(), productId: product?.id ?? null, variantId: null, name: product?.name ?? '', variantName: null,
    unit: product?.unit ?? null, hasVariants: product?.hasVariants ?? null, quantity: '', amount: '', taxBasis: '', hasCost: false }
}
export function createOrderBuffer(order: PurchaseOrder | null): OrderBuffer {
  return { supplierId: order?.supplierId ?? null, note: order?.note ?? '', locationDetail: order?.location.detail ?? '',
    lines: order?.lines.map(line => {
      const snapshot = order.lineDisplaySnapshots.find(item => item.lineId === line.lineId)
      return { lineId: line.lineId, productId: line.productId, variantId: line.variantId, name: snapshot?.productName ?? '', variantName: snapshot?.variantName ?? null,
        unit: snapshot?.unit ?? null, hasVariants: null, quantity: line.orderedQuantity ?? '', amount: line.informedUnitCost?.amount ?? '',
        taxBasis: line.informedUnitCost?.taxBasis ?? '', hasCost: line.informedUnitCost !== null }
    }) ?? [] }
}
export function serializeOrderBuffer(buffer: OrderBuffer): OrderInput {
  return { supplierId: buffer.supplierId, note: buffer.note || null, location: { detail: buffer.locationDetail || null },
    lines: buffer.lines.map(line => ({ lineId: line.lineId, productId: line.productId, variantId: line.variantId, orderedQuantity: line.quantity || null,
      informedUnitCost: line.hasCost || line.amount !== '' || line.taxBasis !== '' ? { amount: line.amount || null, currency: 'MXN', unit: line.unit, taxBasis: line.taxBasis || null } : null })) }
}
export function bufferErrors(buffer: OrderBuffer): Array<{ path: string; message: string }> {
  const errors: Array<{ path: string; message: string }> = []
  if ([...buffer.note].length > 2000) errors.push({ path: '/note', message: 'La nota admite hasta 2000 caracteres.' })
  if ([...buffer.locationDetail].length > 500) errors.push({ path: '/location/detail', message: 'El detalle admite hasta 500 caracteres.' })
  if (buffer.lines.length > 200) errors.push({ path: '/lines', message: 'Puedes guardar hasta 200 renglones.' })
  buffer.lines.forEach((line, index) => {
    if (line.quantity && validateOrderQuantity(line.quantity, line.unit) === 'invalid') errors.push({ path: `/lines/${index}/orderedQuantity`, message: 'Escribe una cantidad positiva con el formato de esta unidad.' })
    if (line.amount && !isValidOrderAmount(line.amount)) errors.push({ path: `/lines/${index}/informedUnitCost/amount`, message: 'Escribe un importe sin separadores, con hasta cuatro decimales.' })
  })
  return errors
}
