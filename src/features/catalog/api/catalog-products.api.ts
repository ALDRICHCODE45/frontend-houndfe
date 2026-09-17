import type {
  PublicCatalogProductDto,
  PublicCatalogProductsResponseDto,
} from '../interfaces/public-catalog-products.types'

export type CatalogProductsErrorKind = 'rate-limit' | 'server' | 'network'

export class CatalogProductsError extends Error {
  readonly kind: CatalogProductsErrorKind
  readonly status?: number

  constructor(kind: CatalogProductsErrorKind = 'server', status?: number) {
    super(
      kind === 'rate-limit'
        ? 'Too many requests'
        : kind === 'network'
          ? 'Network failure'
          : 'Server failure',
    )
    this.name = 'CatalogProductsError'
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0
}

function isAvailability(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && availabilityValues.has(value))
}

function isPrice(value: unknown): boolean {
  if (!isRecord(value) || typeof value.hidden !== 'boolean') return false
  if (value.hidden) return value.fromPriceCents === null && value.priceCents === null
  return (
    isPositiveInteger(value.fromPriceCents) &&
    (value.priceCents === null || isPositiveInteger(value.priceCents))
  )
}

function isStockPresentation(
  value: unknown,
): value is Record<string, unknown> & { status: unknown } {
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

function isProduct(value: unknown): value is PublicCatalogProductDto {
  if (!isRecord(value)) return false
  const category = value.category
  const brand = value.brand
  const image = value.image
  const price = value.price
  const stockPresentation = value.stockPresentation

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNullableString(value.slug) &&
    isNullableString(value.description) &&
    (category === null ||
      (isRecord(category) &&
        typeof category.id === 'string' &&
        typeof category.name === 'string')) &&
    (brand === null || (isRecord(brand) && typeof brand.name === 'string')) &&
    (image === null || (isRecord(image) && typeof image.url === 'string')) &&
    isPrice(price) &&
    isAvailability(value.availability) &&
    isStockPresentation(stockPresentation) &&
    value.availability === stockPresentation?.status &&
    typeof value.hasVariants === 'boolean' &&
    value.rating === null &&
    value.featuredLabel === null
  )
}

function isProductsResponse(value: unknown): value is PublicCatalogProductsResponseDto {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isProduct)) return false
  if (!isRecord(value.meta) || !isRecord(value.facets) || !Array.isArray(value.facets.categories))
    return false
  if (!isRecord(value.priceContext)) return false

  const { meta, priceContext } = value
  return (
    isPositiveInteger(meta.page) &&
    isPositiveInteger(meta.limit) &&
    isNonNegativeInteger(meta.total) &&
    isNonNegativeInteger(meta.totalPages) &&
    isNonNegativeInteger(value.excludedCount) &&
    typeof priceContext.priceListId === 'string' &&
    typeof priceContext.name === 'string' &&
    typeof priceContext.isCatalogDefault === 'boolean' &&
    value.facets.categories.every(
      (category) =>
        isRecord(category) &&
        typeof category.id === 'string' &&
        typeof category.name === 'string' &&
        isNonNegativeInteger(category.count),
    )
  )
}

export async function fetchCatalogProducts(
  tenantSlug: string,
  signal?: AbortSignal,
): Promise<PublicCatalogProductsResponseDto> {
  let response: Response
  try {
    const init = signal
      ? { method: 'GET', credentials: 'omit' as const, signal }
      : { method: 'GET', credentials: 'omit' as const }
    response = await fetch(
      `${apiBase}/public/catalog/${encodeURIComponent(tenantSlug)}/products`,
      init,
    )
  } catch {
    throw new CatalogProductsError('network')
  }

  try {
    if (response.status === 429) throw new CatalogProductsError('rate-limit', 429)
    if (response.status !== 200) throw new CatalogProductsError('server', response.status)
    const body: unknown = await response.json()
    if (!isProductsResponse(body)) throw new CatalogProductsError('server', response.status)
    return body
  } catch (error) {
    if (error instanceof CatalogProductsError) throw error
    throw new CatalogProductsError('server', response.status)
  }
}
