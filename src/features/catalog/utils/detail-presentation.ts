import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { catalogAvailabilityConfig, type CatalogAvailabilityTone } from './availability'
import type {
  PublicCatalogProductDetailAvailability,
  PublicCatalogProductDetailStockPresentationDto,
  PublicProductAttribute,
} from '../interfaces/public-catalog-product-detail.types'

/** A formatted public price, or null when the price is hidden or absent («Consultar precio»). */
export function displayPrice(price: { priceCents: number | null; hidden: boolean }): string | null {
  return !price.hidden && price.priceCents !== null ? formatCentsMXN(price.priceCents) : null
}

/** «N unidades» only when the business chose to publish a custom quantity. */
export function displayQuantity(
  presentation: PublicCatalogProductDetailStockPresentationDto,
): string | null {
  return presentation.mode === 'CUSTOM_QUANTITY' && presentation.customQuantity !== null
    ? `${presentation.customQuantity} unidades`
    : null
}

export interface DisplayAvailability {
  label: string
  tone: CatalogAvailabilityTone
  isOut: boolean
}

/** The written status, or null when the business hides stock or the status is unknown. */
export function displayAvailability(
  presentation: PublicCatalogProductDetailStockPresentationDto,
  availability: PublicCatalogProductDetailAvailability,
): DisplayAvailability | null {
  if (presentation.mode === 'HIDDEN' || availability === null) return null
  const config = catalogAvailabilityConfig[availability]
  return { label: config.label, tone: config.tone, isOut: availability === 'out_of_stock' }
}

export interface AttributeGroup {
  id: string
  label: string | null
  attributes: PublicProductAttribute[]
}

/**
 * Groups attributes by their published form section, in the order each section first appears
 * (the server already sends sections, then positions). A null section is its own unlabelled group.
 */
export function groupAttributesBySection(
  attributes: readonly PublicProductAttribute[],
): AttributeGroup[] {
  const groups = new Map<string, AttributeGroup>()
  for (const attribute of attributes) {
    const code = attribute.section?.code ?? ''
    const group = groups.get(code)
    if (group) group.attributes.push(attribute)
    else
      groups.set(code, {
        id: code === '' ? 'section:none' : `section:${code}`,
        label: attribute.section?.label ?? null,
        attributes: [attribute],
      })
  }
  return [...groups.values()]
}

/**
 * The characteristics of one presentation: the product-wide attributes, with the presentation's own
 * value replacing a product value of the same code, then the attributes only the presentation has.
 * Nothing is invented: an attribute neither level publishes is simply absent.
 */
export function presentationAttributes(
  productAttributes: readonly PublicProductAttribute[],
  variantAttributes: readonly PublicProductAttribute[],
): PublicProductAttribute[] {
  const byCode = new Map(variantAttributes.map((attribute) => [attribute.code, attribute]))
  const merged = productAttributes.map((attribute) => byCode.get(attribute.code) ?? attribute)
  const productCodes = new Set(productAttributes.map((attribute) => attribute.code))
  return [...merged, ...variantAttributes.filter((attribute) => !productCodes.has(attribute.code))]
}

/** The presentation selected on arrival: the first one in stock, or the first one when all are out. */
export function defaultPresentationId<T extends { id: string; isOut: boolean }>(
  presentations: readonly T[],
): string | null {
  return (presentations.find((presentation) => !presentation.isOut) ?? presentations[0])?.id ?? null
}
