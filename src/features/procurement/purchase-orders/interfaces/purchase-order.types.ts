// Wire contract agreed with backend for O3b draft orders. Quantities and
// amounts are canonical decimal strings owned by the server; never reformat.
export type TaxBasis = 'INCLUDES_TAX' | 'EXCLUDES_TAX'
export type PurchaseOrderStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
interface InformedUnitCost {
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
// Server-computed checklist summary, additive: absent on responses from a backend that predates it. Never recomputed here.
export interface IssueSummary { cost: number; quantity: number; reference: number; order: string[] }
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
  issueSummary?: IssueSummary
  checklistItemCount?: number
  // O3c: opaque confirmation expectations, sent back verbatim; never computed here.
  supplierCurrentVersion: number | null
  referenceToken: string | null
  canConfirm: boolean
  confirmedAt: string | null
  confirmedBy: { displayName: string } | null
  cancelledAt: string | null
  cancelledBy: { displayName: string } | null
}
export interface ConfirmOrderInput {
  expectedVersion: number
  expectedSupplierVersion: number | null
  expectedReferenceToken: string | null
}
export interface SaveDraftInput {
  expectedVersion: number
  order: OrderInput
}
export interface PurchaseOrderListInput {
  search?: string
  supplierId?: string
  status?: PurchaseOrderStatus
  cursor?: string
  limit?: number
}
// One server-computed total per tax basis (EXCLUDES_TAX first); the client never sums or converts them.
export interface OrderTotal { amount: string; currency: 'MXN'; taxBasis: TaxBasis }
// Lightweight list row; the full document is read only through GET /:id.
export interface PurchaseOrderSummary {
  id: string
  version: number
  status: PurchaseOrderStatus
  supplierDisplaySnapshot: PurchaseOrder['supplierDisplaySnapshot']
  lineCount: number
  issueCount: number
  issueSummary?: IssueSummary
  // Items the issue checklist shows; the list marker reads it as «N avisos».
  checklistItemCount?: number
  note: string | null
  locationDetail: string | null
  // null when any line lacks a subtotal or there are no lines; 2 entries when the tax bases are mixed.
  totals: OrderTotal[] | null
  createdAt: string
  updatedAt: string
}
export interface PurchaseOrderPage {
  items: PurchaseOrderSummary[]
  nextCursor: string | null
}
