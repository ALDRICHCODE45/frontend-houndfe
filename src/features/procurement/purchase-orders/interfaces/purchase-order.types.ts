// Wire contract agreed with backend for O3b draft orders. Quantities and
// amounts are canonical decimal strings owned by the server; never reformat.
export type TaxBasis = 'INCLUDES_TAX' | 'EXCLUDES_TAX'
export type PurchaseOrderStatus = 'DRAFT'
export interface InformedUnitCost {
  amount: string | null
  currency: string | null
  unit: string | null
  taxBasis: TaxBasis | null
}
export interface OrderLine {
  lineId: string
  productId: string | null
  variantId: string | null
  orderedQuantity: string | null
  informedUnitCost: InformedUnitCost | null
}
export interface OrderInput {
  supplierId: string | null
  note: string | null
  location: { detail: string | null }
  lines: OrderLine[]
}
export interface ValidationIssue {
  path: string
  code: string
}
export interface PurchaseOrder extends OrderInput {
  id: string
  version: number
  status: PurchaseOrderStatus
  createdAt: string
  updatedAt: string
  supplierDisplaySnapshot: { id: string; displayName: string; status: 'ACTIVE' | 'ARCHIVED' } | null
  lineDisplaySnapshots: Array<{ lineId: string; productName: string | null; variantName: string | null; unit: string | null }>
  lineSubtotals: Array<{ lineId: string; subtotal: { amount: string; currency: string; taxBasis: TaxBasis } | null }>
  locationSnapshot: { tenantId: string; tenantName: string; detail: string | null }
  validation: { issues: ValidationIssue[] }
}
export interface SaveDraftInput {
  expectedVersion: number
  order: OrderInput
}
export interface PurchaseOrderListInput {
  supplierId?: string
  cursor?: string
  limit?: number
}
// Lightweight list row; the full document is read only through GET /:id.
export interface PurchaseOrderSummary {
  id: string
  version: number
  status: PurchaseOrderStatus
  supplierDisplaySnapshot: PurchaseOrder['supplierDisplaySnapshot']
  lineCount: number
  issueCount: number
  note: string | null
  locationDetail: string | null
  createdAt: string
  updatedAt: string
}
export interface PurchaseOrderPage {
  items: PurchaseOrderSummary[]
  nextCursor: string | null
}
