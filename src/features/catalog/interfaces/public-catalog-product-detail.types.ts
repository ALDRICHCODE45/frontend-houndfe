/** Public response contract for GET /public/catalog/:tenantSlug/products/:productId. */
export type PublicCatalogProductDetailAvailability =
  | 'available'
  | 'low_stock'
  | 'out_of_stock'
  | null
export type PublicCatalogProductDetailStockPresentationMode =
  | 'SYSTEM_STATUS'
  | 'ABSTRACT_STATUS'
  | 'CUSTOM_QUANTITY'
  | 'HIDDEN'

export interface PublicCatalogProductDetailPriceDto {
  priceCents: number | null
  hidden: boolean
}

export interface PublicCatalogProductDetailStockPresentationDto {
  mode: PublicCatalogProductDetailStockPresentationMode
  status: PublicCatalogProductDetailAvailability
  customQuantity: number | null
}

export interface PublicCatalogProductDetailCategoryDto {
  id: string
  name: string
}

export interface PublicCatalogProductDetailBrandDto {
  name: string
}

export interface PublicCatalogProductDetailImageDto {
  id: string
  url: string
  isMain: boolean
}

export interface PublicCatalogProductDetailVariantAvailabilityDto {
  branchId: string
  branchName: string
  branchSlug: string
  availability: PublicCatalogProductDetailAvailability
  isSelected: boolean
}

export interface PublicCatalogProductDetailVariantDto {
  id: string
  name: string
  option: string | null
  value: string | null
  image: { url: string } | null
  price: PublicCatalogProductDetailPriceDto
  availabilityByBranch: PublicCatalogProductDetailVariantAvailabilityDto[]
  stockPresentation: PublicCatalogProductDetailStockPresentationDto
}

export interface PublicCatalogProductDetailPriceContextDto {
  priceListId: string
  name: string
  isCatalogDefault: boolean
}

export interface PublicCatalogProductDetailDto {
  id: string
  name: string
  slug: null
  description: string | null
  category: PublicCatalogProductDetailCategoryDto | null
  brand: PublicCatalogProductDetailBrandDto | null
  images: PublicCatalogProductDetailImageDto[]
  price: PublicCatalogProductDetailPriceDto
  availability: PublicCatalogProductDetailAvailability
  stockPresentation: PublicCatalogProductDetailStockPresentationDto
  hasVariants: boolean
  variants: PublicCatalogProductDetailVariantDto[]
  rating: null
  featuredLabel: null
  priceContext: PublicCatalogProductDetailPriceContextDto
  excludedCount: 0
}
