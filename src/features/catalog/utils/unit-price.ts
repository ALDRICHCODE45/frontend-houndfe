import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { PublicProductAttribute } from '../interfaces/public-catalog-product-detail.types'

/**
 * Net content attributes of the published vocabulary, in priority order: mass, volume, count.
 * Dimensions and fit numbers are never a content, so they never produce a unit price.
 */
const CONTENT_CODES = ['measure.net_mass', 'measure.net_volume', 'measure.content_count'] as const

export interface UnitPriceInput {
  id: string
  name: string
  priceCents: number | null
  /** The presentation's attributes already merged with the product's. */
  attributes: readonly PublicProductAttribute[]
}

export interface UnitPrice {
  /** «$93.63 / kg». */
  label: string
  /** Set on a bigger presentation that is cheaper per unit than the smallest priced one. */
  saving: { percent: number; versus: string } | null
}

interface Content {
  value: number
  unitCode: string
  unitLabel: string
}

function contentOf(attributes: readonly PublicProductAttribute[], code: string): Content | null {
  const attribute = attributes.find((entry) => entry.code === code)
  const value = attribute?.value
  if (!value || value.type !== 'number') return null
  const amount = value.value
  const unit = value.unit as { code?: unknown; label?: unknown } | null | undefined
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null
  if (!unit || typeof unit.code !== 'string' || typeof unit.label !== 'string') return null
  return { value: amount, unitCode: unit.code, unitLabel: unit.label }
}

/**
 * Price per unit for each priced presentation, keyed by id. Computed only when every presentation
 * publishes the same content attribute in the same unit; otherwise the result is empty, so nothing
 * is ever shown from a partial or mixed comparison.
 */
export function computeUnitPrices(items: readonly UnitPriceInput[]): Record<string, UnitPrice> {
  if (items.length === 0) return {}
  for (const code of CONTENT_CODES) {
    const contents = items.map((item) => contentOf(item.attributes, code))
    if (contents.some((content) => content === null)) continue
    const known = contents as Content[]
    const unitCode = known[0]!.unitCode
    if (known.some((content) => content.unitCode !== unitCode)) return {}

    const priced = items
      .map((item, index) => ({ item, content: known[index]! }))
      .filter((entry): entry is { item: UnitPriceInput & { priceCents: number }; content: Content } =>
        entry.item.priceCents !== null,
      )
      .map((entry) => ({ ...entry, perUnit: entry.item.priceCents / entry.content.value }))
    if (priced.length === 0) return {}

    const unitLabel = known[0]!.unitLabel.toLocaleLowerCase('es-MX')
    const smallest = priced.reduce((a, b) => (b.content.value < a.content.value ? b : a))
    const result: Record<string, UnitPrice> = {}
    for (const entry of priced) {
      const percent =
        entry.content.value > smallest.content.value
          ? Math.round((1 - entry.perUnit / smallest.perUnit) * 100)
          : 0
      result[entry.item.id] = {
        label: `${formatCentsMXN(Math.round(entry.perUnit))} / ${unitLabel}`,
        saving: percent >= 1 ? { percent, versus: smallest.item.name } : null,
      }
    }
    return result
  }
  return {}
}
