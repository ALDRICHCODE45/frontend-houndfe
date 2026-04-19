export type ProductStatus = 'active' | 'inactive' | 'out_of_stock'

export interface CategoryOption {
  id: string
  name: string
}

export interface CreateCategoryPayload {
  name: string
}

export interface BrandOption {
  id: string
  name: string
}

export interface CreateBrandPayload {
  name: string
}

export interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  categoryId: string | null
  categoryName: string
  brandId: string | null
  brandName: string
  priceCents: number
  quantity: number
  minQuantity: number
  useStock: boolean
  hasVariants: boolean
  useLotsAndExpirations: boolean
  sellInPos: boolean
  includeInOnlineCatalog: boolean
  requiresPrescription: boolean
  chargeProductTaxes: boolean
  variantStockTotal: number | null
  variantCount: number | null
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
  purchaseCostMode: 'NET' | 'GROSS'
  purchaseNetCostCents: number
  purchaseGrossCostCents: number
}

export interface VariantPriceMargin {
  amountCents: number
  amountDecimal: number
  percent: number
}

export interface VariantTierPrice {
  id: string
  minQuantity: number
  priceCents: number
  priceDecimal?: number
  margin?: VariantPriceMargin
}

export interface VariantPrice {
  id: string
  variantId: string
  priceListId: string
  priceListName: string
  priceCents: number
  priceDecimal?: number
  margin?: VariantPriceMargin
  tierPrices: VariantTierPrice[]
}

export interface ProductVariant {
  id: string
  productId: string
  name: string
  option: string | null
  value: string | null
  sku: string | null
  barcode: string | null
  priceCents: number
  quantity: number
  minQuantity: number
  purchaseNetCostCents: number | null
  purchaseNetCostDecimal: number | null
  variantPrices: VariantPrice[]
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

export interface PurchaseCostResponse {
  mode: string
  netCents: number
  grossCents: number
  netDecimal: number
  grossDecimal: number
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
  brandId?: string | null
  brand?: {
    id: string
    name: string
  } | null
  brandName?: string | null
  quantity?: number
  minQuantity?: number
  useStock?: boolean
  useLotsAndExpirations?: boolean
  hasVariants?: boolean
  sellInPos?: boolean
  includeInOnlineCatalog?: boolean
  requiresPrescription?: boolean
  chargeProductTaxes?: boolean
  variantStockTotal?: number | null
  variantCount?: number | null
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
  purchaseCost?: PurchaseCostResponse | null
  purchaseCostMode?: string
  purchaseNetCostCents?: number
  purchaseGrossCostCents?: number
  createdAt: string
  updatedAt: string
}

export interface ProductVariantBackendResponse {
  id: string
  productId?: string
  name: string
  option?: string | null
  value?: string | null
  sku?: string | null
  barcode?: string | null
  priceCents?: number
  price?: {
    priceCents?: number
  } | null
  quantity?: number
  minQuantity?: number | null
  purchaseNetCostCents?: number | null
  purchaseNetCostDecimal?: number | null
  variantPrices?: VariantPrice[]
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

export interface PurchaseCostPayload {
  mode: 'NET' | 'GROSS'
  valueCents: number
}

export interface CreateProductPayload {
  name: string
  type?: 'PRODUCT' | 'SERVICE'
  sku?: string
  barcode?: string
  categoryId?: string
  brandId?: string | null
  description?: string
  location?: string
  satKey?: string
  unit?: string
  useStock: boolean
  useLotsAndExpirations?: boolean
  hasVariants?: boolean
  quantity: number
  minQuantity: number
  sellInPos: boolean
  includeInOnlineCatalog: boolean
  requiresPrescription: boolean
  chargeProductTaxes: boolean
  ivaRate?: string
  iepsRate?: string
  purchaseCost?: PurchaseCostPayload
  priceCents: number
  variants?: CreateVariantInline[]
  lots?: CreateLotInline[]
  priceLists?: CreatePriceListInline[]
  images?: CreateImageInline[]
}

// ── Inline sub-resources for atomic product creation ─────────

export interface CreateVariantInline {
  option?: string
  value?: string
  name?: string
  sku?: string
  barcode?: string
  quantity?: number
  minQuantity?: number
  purchaseNetCostCents?: number | null
}

export interface CreateLotInline {
  lotNumber: string
  quantity?: number
  expirationDate: string
  manufactureDate?: string
}

export interface CreatePriceListInline {
  priceListId: string
  priceCents: number
  tierPrices?: {
    minQuantity: number
    priceCents: number
  }[]
}

export interface CreateImageInline {
  url: string
  isMain?: boolean
  sortOrder?: number
}

// ── Pending items for local create-mode state ────────────────

export interface PendingVariant {
  _localId: string
  option: string
  value: string
  sku: string
  barcode: string
  quantity: number
  minQuantity: number
  purchaseNetCostCents: number | null
  publicPriceCents: number
  variantPrices: PendingVariantPrice[]
}

export interface PendingVariantPrice {
  priceListId: string
  priceListName: string
  priceCents: number
  tierPrices: { minQuantity: number; priceCents: number }[]
}

export interface PendingLot {
  _localId: string
  lotNumber: string
  quantity: number
  expirationDate: string
  manufactureDate: string
}

export interface PendingPriceList {
  _localId: string
  priceListId: string
  priceListName: string
  priceCents: number
  tierPrices: { minQuantity: number; priceCents: number }[]
}

export interface CreateVariantPayload {
  name?: string
  option?: string
  value?: string
  sku?: string
  barcode?: string
  quantity: number
  minQuantity?: number
  purchaseNetCostCents?: number
}

export type UpdateVariantPayload = Partial<CreateVariantPayload>

// ── Variant Pricing ──────────────────────────────────────────

export interface VariantTierPriceInput {
  minQuantity: number
  priceCents: number
}

export interface UpsertVariantPricePayload {
  priceCents: number
  tierPrices?: VariantTierPriceInput[]
}

export interface BulkVariantPriceItem {
  priceListId: string
  priceCents: number
  tierPrices?: VariantTierPriceInput[]
}

export interface BulkUpsertVariantPricesPayload {
  prices: BulkVariantPriceItem[]
}

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
  type: 'PRODUCT' | 'SERVICE'
  sku: string
  barcode: string
  categoryId: string
  brandId: string
  description: string
  location: string
  satKey: string
  unit: string
  price: string
  quantity: number
  minQuantity: number
  useStock: boolean
  useLotsAndExpirations: boolean
  hasVariants: boolean
  sellInPos: boolean
  includeInOnlineCatalog: boolean
  requiresPrescription: boolean
  chargeProductTaxes: boolean
  ivaRate: string
  iepsRate: string
  purchaseCostMode: 'NET' | 'GROSS'
  purchaseCost: string
}

// ── Global Price Lists ──────────────────────────────────────

export interface GlobalPriceList {
  id: string
  name: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateGlobalPriceListPayload {
  name: string
}

// ── Price Lists (per product) ───────────────────────────────

export interface TierPriceMargin {
  amountCents: number
  amountDecimal: number
  percent: number
}

export interface TierPrice {
  id: string
  minQuantity: number
  priceCents: number
  priceDecimal?: number
  margin?: TierPriceMargin
}

export interface PriceListMargin {
  amountCents: number
  amountDecimal: number
  percent: number
}

export interface PriceList {
  id: string
  productId: string
  name: string
  priceCents: number
  priceDecimal?: number
  margin?: PriceListMargin
  tierPrices: TierPrice[]
  createdAt: string
  updatedAt: string
}

export interface TierPriceInput {
  minQuantity: number
  priceCents: number
}

export interface CreatePriceListPayload {
  name: string
  priceCents: number
  tierPrices?: TierPriceInput[]
}

export interface UpdatePriceListPayload {
  priceCents?: number
  tierPrices?: TierPriceInput[]
}

// ── Images ───────────────────────────────────────────────────

export interface ProductImage {
  id: string
  productId: string
  variantId: string | null
  url: string
  isMain: boolean
  sortOrder: number
  createdAt: string
}

export interface CreateImagePayload {
  url: string
  isMain?: boolean
  sortOrder?: number
  variantId?: string
}
