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

// POS Catalog types — match backend contract exactly
export interface PosCatalogPrice {
  priceCents: number
  priceDecimal: number
  priceListName: string
}

export interface PosCatalogStock {
  quantity: number
  minQuantity: number
}

export interface PosCatalogVariant {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  mainImage: string | null
  price: PosCatalogPrice | null
  stock: PosCatalogStock | null
}

export interface PosCatalogItem {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  unit: string | null
  hasVariants: boolean
  useStock: boolean
  category: { id: string; name: string } | null
  brand: { id: string; name: string } | null
  mainImage: string | null
  images: string[]
  price: PosCatalogPrice | null
  stock: PosCatalogStock | null
  variants: PosCatalogVariant[]
}

export interface PosCatalogResponse {
  items: PosCatalogItem[]
  total: number
  limit: number
  offset: number
}

export interface PosCatalogSearchParams {
  q?: string
  limit?: number
  offset?: number
  categoryId?: string
  brandId?: string
}
