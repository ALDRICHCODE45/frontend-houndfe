import type { PublicCatalogAttributeFacetDto } from '../interfaces/public-catalog-products.types'

export interface MergedFacetOption {
  label: string
  /** Every `<definition code>:<option code>` token behind this label, in server order. */
  tokens: string[]
  count: number
}

/**
 * One chip per label within a definition. Some definitions carry one option code per species with
 * the same label (`life.dog.adult`, `life.cat.adult` → «Adulto»); they read as a single choice.
 * The chip keeps the position of the first option with that label and selects all its codes (the
 * server ORs options within a definition). The count is the sum of the per-code counts: the
 * listing only counts unique products per code, so a product carrying two same-label codes is
 * counted twice. That is accepted because per-species codes are disjoint for almost every
 * product, which makes the sum exact where the maximum would undercount.
 */
export function mergeFacetOptions(definition: PublicCatalogAttributeFacetDto): MergedFacetOption[] {
  const byLabel = new Map<string, MergedFacetOption>()
  for (const option of definition.options) {
    const token = `${definition.code}:${option.code}`
    const merged = byLabel.get(option.label)
    if (merged) {
      merged.tokens.push(token)
      merged.count += option.count
    } else {
      byLabel.set(option.label, { label: option.label, tokens: [token], count: option.count })
    }
  }
  return [...byLabel.values()]
}
