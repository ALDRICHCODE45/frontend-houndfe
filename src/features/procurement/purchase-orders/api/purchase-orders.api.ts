import { http } from '@/core/shared/api/http'
import type {
  OrderInput, OrderLine, PurchaseOrder, PurchaseOrderListInput, PurchaseOrderPage, SaveDraftInput,
} from '../interfaces/purchase-order.types'

const base = '/procurement/purchase-orders'
const path = (id: string) => base + '/' + encodeURIComponent(id)

// The backend rejects unknown fields, so every body is rebuilt from the
// contract's own keys; injected view state never reaches the wire.
function closedLine(line: OrderLine): OrderLine {
  const cost = line.informedUnitCost
  return {
    lineId: line.lineId, productId: line.productId, variantId: line.variantId, orderedQuantity: line.orderedQuantity,
    informedUnitCost: cost && { amount: cost.amount, currency: cost.currency, unit: cost.unit, taxBasis: cost.taxBasis },
  }
}
export function closedOrderInput(input: OrderInput): OrderInput {
  return {
    supplierId: input.supplierId, note: input.note, location: { detail: input.location.detail },
    lines: input.lines.map(closedLine),
  }
}

// Commands receive the immutable attempt's key and signal from their owner.
export const purchaseOrdersApi = {
  async list(input: PurchaseOrderListInput, signal?: AbortSignal): Promise<PurchaseOrderPage> {
    const { supplierId, search, cursor, limit } = input
    const response = await http.get<PurchaseOrderPage>(base, { params: { supplierId, search, cursor, limit }, signal })
    return response.data
  },
  async get(id: string, signal?: AbortSignal): Promise<PurchaseOrder> {
    const response = await http.get<PurchaseOrder>(path(id), { signal })
    return response.data
  },
  async create(input: OrderInput, key: string, signal?: AbortSignal): Promise<PurchaseOrder> {
    const response = await http.post<PurchaseOrder>(base, closedOrderInput(input), {
      headers: { 'Idempotency-Key': key }, signal,
    })
    return response.data
  },
  async saveDraft(id: string, input: SaveDraftInput, key: string, signal?: AbortSignal): Promise<PurchaseOrder> {
    const response = await http.put<PurchaseOrder>(path(id) + '/draft',
      { expectedVersion: input.expectedVersion, order: closedOrderInput(input.order) },
      { headers: { 'Idempotency-Key': key }, signal })
    return response.data
  },
  async delete(id: string, input: { expectedVersion: number }, key: string, signal?: AbortSignal): Promise<void> {
    await http.delete(path(id), {
      data: { expectedVersion: input.expectedVersion }, headers: { 'Idempotency-Key': key }, signal,
    })
  },
}
