export type ProductStatus = 'active' | 'inactive' | 'out_of_stock'

export interface CategoryOption {
  id: string
  name: string
}

export interface CreateCategoryPayload {
  name: string
}

export interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  categoryId: string | null
  categoryName: string
  priceCents: number
  quantity: number
  minQuantity: number
  useStock: boolean
  hasVariants: boolean
  useLotsAndExpirations: boolean
  sellInPos: boolean
  includeInOnlineCatalog: boolean
  chargeProductTaxes: boolean
  status: ProductStatus
  createdAt: string
  updatedAt: string
}

export interface ProductDetail extends Product {
  description: string | null
  location: string | null
  satKey: string | null
  type: 'PRODUCT' | 'SERVICE'
  unit: string
  ivaRate: string
  iepsRate: string
}

export interface ProductVariant {
  id: string
  productId: string
  name: string
  sku: string | null
  barcode: string | null
  priceCents: number
  quantity: number
  createdAt: string
  updatedAt: string
}

export interface ProductLot {
  id: string
  productId: string
  lotNumber: string
  expirationDate: string | null
  quantity: number
  manufactureDate: string | null
  createdAt: string
  updatedAt: string
}

export interface ProductBackendListResponse {
  data: ProductBackendResponse[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ProductBackendResponse {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
  categoryId?: string | null
  category?: {
    id: string
    name: string
  } | null
  categoryName?: string | null
  quantity?: number
  minQuantity?: number
  useStock?: boolean
  useLotsAndExpirations?: boolean
  hasVariants?: boolean
  sellInPos?: boolean
  includeInOnlineCatalog?: boolean
  chargeProductTaxes?: boolean
  status?: string | null
  priceCents?: number
  price?: {
    priceCents?: number
  } | null
  description?: string | null
  location?: string | null
  satKey?: string | null
  type?: 'PRODUCT' | 'SERVICE'
  unit?: string
  ivaRate?: string
  iepsRate?: string
  createdAt: string
  updatedAt: string
}

export interface ProductVariantBackendResponse {
  id: string
  productId?: string
  name: string
  sku?: string | null
  barcode?: string | null
  priceCents?: number
  price?: {
    priceCents?: number
  } | null
  quantity?: number
  createdAt: string
  updatedAt: string
}

export interface ProductLotBackendResponse {
  id: string
  productId?: string
  lotNumber?: string
  lot?: string
  manufactureDate?: string | null
  expirationDate?: string | null
  expiresAt?: string | null
  quantity?: number
  costCents?: number | null
  cost?: {
    costCents?: number | null
  } | null
  createdAt: string
  updatedAt: string
}

export interface CreateProductPayload {
  name: string
  sku?: string
  barcode?: string
  categoryId?: string
  description?: string
  location?: string
  satKey?: string
  useStock: boolean
  quantity: number
  minQuantity: number
  sellInPos: boolean
  includeInOnlineCatalog: boolean
  chargeProductTaxes: boolean
  priceCents: number
}

export interface CreateVariantPayload {
  name: string
  sku?: string
  barcode?: string
  quantity: number
}

export type UpdateVariantPayload = Partial<CreateVariantPayload>

export interface CreateLotPayload {
  lotNumber: string
  quantity: number
  expirationDate: string
  manufactureDate?: string
}

export type UpdateLotPayload = Partial<CreateLotPayload>

export type UpdateProductPayload = Partial<CreateProductPayload>

export interface ProductFormInput {
  name: string
  sku: string
  barcode: string
  categoryId: string
  description: string
  location: string
  satKey: string
  price: string
  quantity: number
  minQuantity: number
  useStock: boolean
  sellInPos: boolean
  includeInOnlineCatalog: boolean
  chargeProductTaxes: boolean
}

export interface DomainApiError {
  statusCode?: number
  error?: string
  message?: string
}
