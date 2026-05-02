export type SaleStatus = 'DRAFT'
export type SaleCurrency = 'MXN'
export type PriceSource = 'default' | 'price_list' | 'custom'

export interface SaleItem {
  id: string
  productId: string
  variantId: string | null
  productName: string
  variantName: string | null
  quantity: number
  unitPriceCents: number
  unitPriceCurrency: SaleCurrency
  originalPriceCents?: number | null
  priceSource?: PriceSource | null
  appliedPriceListId?: string | null
  customPriceCents?: number | null
  discountType?: 'amount' | 'percentage' | null
  discountValue?: number | null
  discountAmountCents?: number | null
  discountTitle?: string | null
  prePriceCentsBeforeDiscount?: number | null
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

export interface AvailablePriceOption {
  priceListId: string
  priceListName: string
  priceCents: number
  priceDecimal: number
  currency: SaleCurrency
  isCurrent: boolean
}

export interface AvailablePricesResponse {
  saleId: string
  itemId: string
  prices: AvailablePriceOption[]
}

export type OverrideItemPricePayload =
  | { priceListId: string; customPriceCents?: never }
  | { customPriceCents: number; priceListId?: never }

export type ApplyItemDiscountPayload =
  | { type: 'amount'; amountCents: number; title?: string }
  | { type: 'percentage'; percent: number; title?: string }

export type GlobalDiscountStrategy = 'replace' | 'skip'

export type ApplyGlobalDiscountPayload =
  | { type: 'amount'; amountCents: number; discountTitle?: string; strategy?: GlobalDiscountStrategy }
  | { type: 'percentage'; percent: number; discountTitle?: string; strategy?: GlobalDiscountStrategy }

export interface GlobalDiscountSkippedItem {
  itemId: string
  reason: string
}

export interface GlobalDiscountResponse {
  sale: Sale
  skippedItems: GlobalDiscountSkippedItem[]
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
