// Wire contract of the backend O1 inventory journal (handoff 01). Quantities
// are integers; the stock snapshot and every movement are server-owned.
export type StockBucket = 'PRODUCT_UNTRACKED' | 'LOT' | 'VARIANT'

export interface StockLot {
  id: string
  lotNumber: string
  expirationDate: string | null
  quantity: number
  expired: boolean
  version: number
}
export interface StockVariant {
  id: string
  label: string
  quantity: number
  version: number
}
export interface StockSnapshot {
  product: {
    id: string
    name: string
    useStock: boolean
    quantity: number
    untracked: { quantity: number; version: number }
    sellable: number | null
  }
  lots: StockLot[]
  variants: StockVariant[]
}

export type MovementType = 'OPENING' | 'INITIAL' | 'ADJUSTMENT' | 'SALE' | 'SALE_CANCELLATION' | 'REMOVAL'
export type RemovalCause = 'PRODUCT_DELETED' | 'VARIANT_DELETED' | 'FIRST_VARIANT_ZEROING'
export type AdjustmentReason = 'PHYSICAL_COUNT' | 'DAMAGE' | 'EXPIRED' | 'THEFT_LOSS' | 'DATA_ENTRY_CORRECTION' | 'OTHER'

export interface StockMovement {
  id: string
  type: MovementType
  bucket: StockBucket
  productId: string
  variantId: string | null
  lotId: string | null
  labels: { product: string; variant: string | null; lot: string | null }
  delta: number
  balanceAfter: number
  productBalanceAfter: number
  reason: AdjustmentReason | null
  note: string | null
  removalCause: RemovalCause | null
  group: { type: 'SALE' | 'ADJUSTMENT' | 'PRODUCT'; id: string } | null
  actor: { displayName: string }
  createdAt: string
}
export interface MovementPage {
  items: StockMovement[]
  nextCursor: string | null
}
export interface MovementsQuery {
  productId: string
  variantId?: string
  lotId?: string
  cursor?: string
  limit?: number
}

export interface AdjustmentTarget {
  productId: string
  lotId?: string
  variantId?: string
}
export interface AdjustmentInput {
  target: AdjustmentTarget
  expectedVersion: number
  delta: number
  reason: AdjustmentReason
  note?: string
}
export interface AdjustmentResult {
  movement: StockMovement
  stock: StockSnapshot
}
