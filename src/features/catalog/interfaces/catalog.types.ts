// public-catalog.types.ts
// Generated from backend SDD public-online-catalog (v1).

export type PublicStockStatus = 'available' | 'low_stock' | 'out_of_stock'

export type PublicSortOption =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'rating_desc'

export type CartWarningCode =
  | 'PRICE_CHANGED'
  | 'OUT_OF_STOCK'
  | 'LOW_STOCK'
  | 'PRICE_HIDDEN'
  | 'NOT_FOUND'
  | 'NOT_IN_CATALOG'
  | 'VARIANT_NOT_FOUND'

/** GET /public/catalog/branches */
export type PublicBranchDto = {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
}

/** GET /public/catalog/:tenantSlug/products — query */
export type ListProductsQuery = {
  branchId?: string
  q?: string
  categoryId?: string
  sort?: PublicSortOption
  page?: number
  limit?: number
}

/** GET /public/catalog/:tenantSlug/products — item */
export type PublicCatalogProductCard = {
  id: string
  name: string
  slug: string | null
  description: string | null
  category: { id: string; name: string } | null
  brand: { name: string } | null
  image: { url: string } | null
  price: {
    fromPriceCents: number | null
    priceCents: number | null
    hidden: boolean
  }
  availability: PublicStockStatus
  hasVariants: boolean
  rating: number | null // null in v1, mock for demo
  featuredLabel: string | null // null in v1, mock for demo
}

export type PublicCatalogCategoryFacet = {
  id: string
  name: string
  count: number
}

export type PublicProductListResponse = {
  items: PublicCatalogProductCard[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  facets: {
    categories: PublicCatalogCategoryFacet[]
  }
}

/** GET /public/catalog/:tenantSlug/products/:productId */
export type PublicVariantAvailability = {
  branchId: string
  branchName: string
  branchSlug: string
  availability: PublicStockStatus
  isSelected: boolean
}

export type PublicVariantDto = {
  id: string
  name: string
  option: string | null
  value: string | null
  image: { url: string } | null
  price: {
    priceCents: number | null
    hidden: boolean
  }
  availabilityByBranch: PublicVariantAvailability[]
}

export type PublicCatalogProductDetail = {
  id: string
  name: string
  slug: string | null
  description: string | null
  category: { id: string; name: string } | null
  brand: { name: string } | null
  images: Array<{ id: string; url: string; isMain: boolean }>
  price: {
    priceCents: number | null
    hidden: boolean
  }
  availability: PublicStockStatus
  hasVariants: boolean
  variants: PublicVariantDto[]
  rating: number | null
  featuredLabel: string | null
}

/** POST /public/catalog/:tenantSlug/cart/validate — request */
export type ValidateCartItem = {
  productId: string
  variantId?: string
  quantity: number
}

export type ValidateCartBody = {
  items: ValidateCartItem[]
  customer?: {
    globalPriceListId?: string
  }
}

/** POST /public/catalog/:tenantSlug/cart/validate — response */
export type CartValidatedItem = {
  productId: string
  variantId: string | null
  productName: string
  variantName: string | null
  image: { url: string } | null
  quantity: number
  unitPriceCents: number | null
  lineTotalCents: number | null
  availability: PublicStockStatus
  priceHidden: boolean
  warnings: CartWarningCode[]
}

export type CartValidationResponse = {
  valid: boolean
  items: CartValidatedItem[]
  totalCents: number | null
  warnings: CartWarningCode[]
}

// ─── Frontend-only types for cart state ──────────────────────────────────────

export type CatalogCartItem = {
  productId: string
  variantId: string | null
  productName: string
  brandName: string | null
  variantName: string | null
  unitPriceCents: number | null
  priceHidden: boolean
  quantity: number
  availability: PublicStockStatus
  /** Pastel color key for the placeholder */
  colorKey: string
}

export type CatalogCategory = {
  id: string
  name: string
  emoji: string
}
