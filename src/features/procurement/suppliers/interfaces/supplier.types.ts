export type SupplierStatus = 'ACTIVE' | 'ARCHIVED'
export interface SupplierInput {
  displayName: string
  termsText: string | null
  status: SupplierStatus
}
export interface Supplier extends SupplierInput {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}
export interface SupplierPatch {
  expectedVersion: number
  changes: Partial<SupplierInput>
}
export interface SupplierListInput {
  status: SupplierStatus | 'ALL'
  search?: string
  cursor?: string
  limit?: number
}
export interface SupplierPage {
  items: Supplier[]
  nextCursor: string | null
}
