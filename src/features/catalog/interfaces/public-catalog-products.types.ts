import type { PublicCatalogPriceContextDto } from './public-catalog-price-context.types'

/**
 * Public listing orders (handoff 15 §1). `newest` is the server default; a backend without
 * v0 support ignores the param. «Relevancia» is never offered: it behaves exactly like `newest`.
 */
export type CatalogProductsSort = 'newest' | 'price_asc' | 'price_desc'

/** Optional server listing inputs; absence keeps the original first-page request. */
export interface CatalogProductsOptions {
  q?: string
  categoryId?: string
  page?: number
  /** Attribute facet tokens `<definition code>:<option code>`, sent as repeated `facet` params. */
  facets?: string[]
  /** Sent as `sort` only when present; absence keeps the server default order. */
  sort?: CatalogProductsSort
}

/** Public response contract for GET /public/catalog/:tenantSlug/products. */
type PublicCatalogProductAvailability = 'available' | 'low_stock' | 'out_of_stock' | null
type PublicCatalogStockPresentationMode =
  | 'SYSTEM_STATUS'
  | 'ABSTRACT_STATUS'
  | 'CUSTOM_QUANTITY'
  | 'HIDDEN'
  | 'SYSTEM_STATUS_EXACT_LOW_STOCK'

interface PublicCatalogProductPriceDto {
  fromPriceCents: number | null
  priceCents: number | null
  hidden: boolean
}

interface PublicCatalogProductStockPresentationDto {
  mode: PublicCatalogStockPresentationMode
  status: PublicCatalogProductAvailability
  customQuantity: number | null
  /** Handoff 15 §3: the real quantity while `low_stock`, only under the opt-in exact mode. */
  exactQuantity?: number | null
}

interface PublicCatalogProductCategoryDto {
  id: string
  name: string
}

interface PublicCatalogProductBrandDto {
  name: string
}

interface PublicCatalogProductImageDto {
  url: string
}

export interface PublicCatalogProductDto {
  id: string
  name: string
  slug: string | null
  description: string | null
  category: PublicCatalogProductCategoryDto | null
  brand: PublicCatalogProductBrandDto | null
  image: PublicCatalogProductImageDto | null
  price: PublicCatalogProductPriceDto
  availability: PublicCatalogProductAvailability
  stockPresentation: PublicCatalogProductStockPresentationDto
  hasVariants: boolean
  rating: null
  featuredLabel: null
}

interface PublicCatalogProductsMetaDto {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PublicCatalogProductsCategoryFacetDto {
  id: string
  name: string
  count: number
}

export interface PublicCatalogAttributeFacetOptionDto {
  code: string
  label: string
  count: number
}

/** A choice facet definition; present only when the tenant shows published editorial data. */
export interface PublicCatalogAttributeFacetDto {
  code: string
  label: string
  options: PublicCatalogAttributeFacetOptionDto[]
}

export interface PublicCatalogProductsResponseDto {
  items: PublicCatalogProductDto[]
  meta: PublicCatalogProductsMetaDto
  facets: {
    categories: PublicCatalogProductsCategoryFacetDto[]
    attributes?: PublicCatalogAttributeFacetDto[]
  }
  excludedCount: number
  priceContext: PublicCatalogPriceContextDto
}
