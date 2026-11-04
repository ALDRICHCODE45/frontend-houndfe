import { http } from '@/core/shared/api/http'
import type {
  AdjustmentInput, AdjustmentResult, AdjustmentTarget, MovementPage, MovementsQuery, StockSnapshot,
} from '../interfaces/inventory.types'

const base = '/inventory'

// The backend rejects unknown keys (tenantId included), so the body is rebuilt
// from the contract's own keys; injected view state never reaches the wire.
function closedTarget(target: AdjustmentTarget): AdjustmentTarget {
  return {
    productId: target.productId,
    ...(target.lotId !== undefined && { lotId: target.lotId }),
    ...(target.variantId !== undefined && { variantId: target.variantId }),
  }
}
function closedAdjustment(input: AdjustmentInput): AdjustmentInput {
  return {
    target: closedTarget(input.target), expectedVersion: input.expectedVersion, delta: input.delta,
    reason: input.reason, ...(input.note !== undefined && { note: input.note }),
  }
}

export const inventoryApi = {
  async getStock(productId: string, signal?: AbortSignal): Promise<StockSnapshot> {
    const response = await http.get<StockSnapshot>(base + '/products/' + encodeURIComponent(productId) + '/stock', { signal })
    return response.data
  },
  async listMovements(query: MovementsQuery, signal?: AbortSignal): Promise<MovementPage> {
    const { productId, variantId, lotId, cursor, limit } = query
    const response = await http.get<MovementPage>(base + '/movements', {
      params: { productId, variantId, lotId, cursor, limit }, signal,
    })
    return response.data
  },
  // One key per user submission; the owner reuses it only to retry the same body.
  async adjust(input: AdjustmentInput, key: string, signal?: AbortSignal): Promise<AdjustmentResult> {
    const response = await http.post<AdjustmentResult>(base + '/adjustments', closedAdjustment(input), {
      headers: { 'Idempotency-Key': key }, signal,
    })
    return response.data
  },
}
