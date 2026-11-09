/** Public response contract for GET /public/catalog/:tenantSlug/products/:productId. */
export type PublicCatalogProductDetailAvailability =
  | 'available'
  | 'low_stock'
  | 'out_of_stock'
  | null
type PublicCatalogProductDetailStockPresentationMode =
  | 'SYSTEM_STATUS'
  | 'ABSTRACT_STATUS'
  | 'CUSTOM_QUANTITY'
  | 'HIDDEN'

interface PublicCatalogProductDetailPriceDto {
  priceCents: number | null
  hidden: boolean
}

export interface PublicCatalogProductDetailStockPresentationDto {
  mode: PublicCatalogProductDetailStockPresentationMode
  status: PublicCatalogProductDetailAvailability
  customQuantity: number | null
}

interface PublicCatalogProductDetailCategoryDto {
  id: string
  name: string
}

interface PublicCatalogProductDetailBrandDto {
  name: string
}

interface PublicCatalogProductDetailImageDto {
  id: string
  url: string
  isMain: boolean
}

interface PublicCatalogProductDetailVariantAvailabilityDto {
  branchId: string
  branchName: string
  branchSlug: string
  availability: PublicCatalogProductDetailAvailability
  isSelected: boolean
}

interface PublicProductAttributeCodedLabel {
  code: string
  label: string
}

/**
 * Published attribute value. The type set is closed today, but unknown types are data: the UI
 * always shows `display` and never branches on `value.type` to decide whether to render.
 */
type PublicProductAttributeValue =
  | { type: 'text'; text: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'single'; option: PublicProductAttributeCodedLabel }
  | { type: 'multi'; options: PublicProductAttributeCodedLabel[] }
  | { type: 'number'; value: number; unit: PublicProductAttributeCodedLabel | null }
  | { type: 'range'; min: number; max: number; unit: PublicProductAttributeCodedLabel }
  | { type: string; [key: string]: unknown }

/** A known published attribute; present only while the tenant shows published editorial data. */
export interface PublicProductAttribute {
  code: string
  label: string
  facet: boolean
  section: PublicProductAttributeCodedLabel | null
  value: PublicProductAttributeValue
  /** Ready-to-show es-MX text. */
  display: string
}

interface PublicCatalogProductDetailVariantDto {
  id: string
  name: string
  option: string | null
  value: string | null
  image: { url: string } | null
  price: PublicCatalogProductDetailPriceDto
  availabilityByBranch: PublicCatalogProductDetailVariantAvailabilityDto[]
  stockPresentation: PublicCatalogProductDetailStockPresentationDto
  attributes?: PublicProductAttribute[]
}

interface PublicCatalogProductDetailPriceContextDto {
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
  attributes?: PublicProductAttribute[]
  priceContext: PublicCatalogProductDetailPriceContextDto
  excludedCount: 0
}
