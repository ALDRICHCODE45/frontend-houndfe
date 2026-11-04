import type { PublicCatalogPriceContextDto } from './public-catalog-price-context.types'

/** Optional server listing inputs; absence keeps the original first-page request. */
export interface CatalogProductsOptions {
  q?: string
  categoryId?: string
  page?: number
}

/** Public response contract for GET /public/catalog/:tenantSlug/products. */
type PublicCatalogProductAvailability = 'available' | 'low_stock' | 'out_of_stock' | null
type PublicCatalogStockPresentationMode =
  | 'SYSTEM_STATUS'
  | 'ABSTRACT_STATUS'
  | 'CUSTOM_QUANTITY'
  | 'HIDDEN'

interface PublicCatalogProductPriceDto {
  fromPriceCents: number | null
  priceCents: number | null
  hidden: boolean
}

interface PublicCatalogProductStockPresentationDto {
  mode: PublicCatalogStockPresentationMode
  status: PublicCatalogProductAvailability
  customQuantity: number | null
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

export interface PublicCatalogProductsResponseDto {
  items: PublicCatalogProductDto[]
  meta: PublicCatalogProductsMetaDto
  facets: {
    categories: PublicCatalogProductsCategoryFacetDto[]
  }
  excludedCount: number
  priceContext: PublicCatalogPriceContextDto
}
