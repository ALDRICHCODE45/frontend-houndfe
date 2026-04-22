export type SaleStatus = 'DRAFT'
export type SaleCurrency = 'MXN'

export interface SaleItem {
  id: string
  productId: string
  variantId: string | null
  productName: string
  variantName: string | null
  quantity: number
  unitPriceCents: number
  unitPriceCurrency: SaleCurrency
}

export interface Sale {
  id: string
  userId: string
  status: SaleStatus
  items: SaleItem[]
  createdAt: string
  updatedAt: string
}

export interface AddItemPayload {
  productId: string
  variantId?: string | null
  quantity: number
}

export interface UpdateQtyPayload {
  quantity: number
}

export interface SearchableProduct {
  id: string
  name: string
  imageUrl: string | null
  priceCents: number
  stock: number
  sellInPos: boolean
  hasVariants: boolean
  variantCount: number
}
