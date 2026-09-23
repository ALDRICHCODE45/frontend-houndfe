import type { PublicCatalogPriceContextDto } from './public-catalog-price-context.types'

/** Public response contract for GET /public/catalog/:tenantSlug/products. */
export type PublicCatalogProductAvailability = 'available' | 'low_stock' | 'out_of_stock' | null
export type PublicCatalogStockPresentationMode =
  | 'SYSTEM_STATUS'
  | 'ABSTRACT_STATUS'
  | 'CUSTOM_QUANTITY'
  | 'HIDDEN'

export interface PublicCatalogProductPriceDto {
  fromPriceCents: number | null
  priceCents: number | null
  hidden: boolean
}

export interface PublicCatalogProductStockPresentationDto {
  mode: PublicCatalogStockPresentationMode
  status: PublicCatalogProductAvailability
  customQuantity: number | null
}

export interface PublicCatalogProductCategoryDto {
  id: string
  name: string
}

export interface PublicCatalogProductBrandDto {
  name: string
}

export interface PublicCatalogProductImageDto {
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

export interface PublicCatalogProductsMetaDto {
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

export type { PublicCatalogPriceContextDto }

export interface PublicCatalogProductsResponseDto {
  items: PublicCatalogProductDto[]
  meta: PublicCatalogProductsMetaDto
  facets: {
    categories: PublicCatalogProductsCategoryFacetDto[]
  }
  excludedCount: number
  priceContext: PublicCatalogPriceContextDto
}
