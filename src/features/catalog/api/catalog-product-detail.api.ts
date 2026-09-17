import type {
  PublicCatalogProductDetailAvailability,
  PublicCatalogProductDetailDto,
  PublicCatalogProductDetailStockPresentationDto,
} from '../interfaces/public-catalog-product-detail.types'

export type CatalogProductDetailErrorKind = 'not-found' | 'rate-limit' | 'server' | 'network'

export class CatalogProductDetailError extends Error {
  readonly kind: CatalogProductDetailErrorKind
  readonly status?: number

  constructor(kind: CatalogProductDetailErrorKind = 'server', status?: number) {
    super(
      kind === 'not-found'
        ? 'Product not found'
        : kind === 'rate-limit'
          ? 'Too many requests'
          : kind === 'network'
            ? 'Network failure'
            : 'Server failure',
    )
    this.name = 'CatalogProductDetailError'
    this.kind = kind
    if (status !== undefined) this.status = status
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const availabilityValues = new Set(['available', 'low_stock', 'out_of_stock'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0
}

function isAvailability(value: unknown): value is PublicCatalogProductDetailAvailability {
  return value === null || (typeof value === 'string' && availabilityValues.has(value))
}

function isPrice(value: unknown): boolean {
  if (!isRecord(value) || typeof value.hidden !== 'boolean') return false
  return value.hidden ? value.priceCents === null : isPositiveInteger(value.priceCents)
}

function isStockPresentation(
  value: unknown,
): value is PublicCatalogProductDetailStockPresentationDto {
  if (!isRecord(value)) return false

  switch (value.mode) {
    case 'SYSTEM_STATUS':
      return value.customQuantity === null && value.status !== null && isAvailability(value.status)
    case 'ABSTRACT_STATUS':
      return (
        value.customQuantity === null &&
        (value.status === 'available' || value.status === 'out_of_stock')
      )
    case 'CUSTOM_QUANTITY':
      return (
        (isNonNegativeInteger(value.customQuantity) &&
          (value.status === null || value.status === 'out_of_stock')) ||
        (value.customQuantity === null && value.status !== null && isAvailability(value.status))
      )
    case 'HIDDEN':
      return value.status === null && value.customQuantity === null
    default:
      return false
  }
}

function isCategory(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string')
  )
}

function isBrand(value: unknown): boolean {
  return value === null || (isRecord(value) && typeof value.name === 'string')
}

function isImages(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (image) =>
        isRecord(image) &&
        typeof image.id === 'string' &&
        typeof image.url === 'string' &&
        typeof image.isMain === 'boolean',
    )
  )
}

function isVariant(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.availabilityByBranch)) return false
  const stockPresentation = value.stockPresentation
  const selectedAvailability = value.availabilityByBranch

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNullableString(value.option) &&
    isNullableString(value.value) &&
    (value.image === null || (isRecord(value.image) && typeof value.image.url === 'string')) &&
    isPrice(value.price) &&
    isStockPresentation(stockPresentation) &&
    selectedAvailability.length === 1 &&
    selectedAvailability.every(
      (availability) =>
        isRecord(availability) &&
        typeof availability.branchId === 'string' &&
        typeof availability.branchName === 'string' &&
        typeof availability.branchSlug === 'string' &&
        isAvailability(availability.availability) &&
        availability.isSelected === true &&
        availability.availability === stockPresentation.status,
    )
  )
}

function isProductDetail(
  value: unknown,
  requestedPriceListId: string,
): value is PublicCatalogProductDetailDto {
  if (!isRecord(value) || !isRecord(value.priceContext)) return false
  const stockPresentation = value.stockPresentation
  const { priceContext } = value

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.slug === null &&
    isNullableString(value.description) &&
    isCategory(value.category) &&
    isBrand(value.brand) &&
    isImages(value.images) &&
    isPrice(value.price) &&
    isAvailability(value.availability) &&
    isStockPresentation(stockPresentation) &&
    value.availability === stockPresentation.status &&
    typeof value.hasVariants === 'boolean' &&
    Array.isArray(value.variants) &&
    value.variants.every(isVariant) &&
    value.rating === null &&
    value.featuredLabel === null &&
    typeof priceContext.priceListId === 'string' &&
    priceContext.priceListId === requestedPriceListId &&
    typeof priceContext.name === 'string' &&
    typeof priceContext.isCatalogDefault === 'boolean' &&
    value.excludedCount === 0
  )
}

export async function fetchCatalogProductDetail(
  tenantSlug: string,
  productId: string,
  priceListId: string,
  signal?: AbortSignal,
): Promise<PublicCatalogProductDetailDto> {
  let response: Response
  try {
    const init = signal
      ? { method: 'GET', credentials: 'omit' as const, signal }
      : { method: 'GET', credentials: 'omit' as const }
    const url = `${apiBase}/public/catalog/${encodeURIComponent(tenantSlug)}/products/${encodeURIComponent(productId)}?priceListId=${encodeURIComponent(priceListId)}`
    response = await fetch(url, init)
  } catch {
    throw new CatalogProductDetailError('network')
  }

  try {
    if (response.status === 404) throw new CatalogProductDetailError('not-found', 404)
    if (response.status === 429) throw new CatalogProductDetailError('rate-limit', 429)
    if (response.status !== 200) throw new CatalogProductDetailError('server', response.status)
    const body: unknown = await response.json()
    if (!isProductDetail(body, priceListId))
      throw new CatalogProductDetailError('server', response.status)
    return body
  } catch (error) {
    if (error instanceof CatalogProductDetailError) throw error
    throw new CatalogProductDetailError('server', response.status)
  }
}
