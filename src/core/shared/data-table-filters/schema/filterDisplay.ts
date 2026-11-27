import type { FilterDefinition } from './types'

/**
 * Up to this many choices (the «sin valor» one included) a multi-enum renders as toggle chips in
 * the filters sheet (docs/design-system.md: filters are toggle chips); more keeps the dropdown.
 */
export const FILTER_CHIPS_MAX_OPTIONS = 8

/**
 * Whether the filters sheet renders this field as toggle chips. Only multi-enums qualify: async
 * lists (colonia, clientes…) and searchable enums keep the searchable dropdown. A field `display`
 * wins over the threshold.
 */
export function usesToggleChips(field: FilterDefinition, maxOptions: number = FILTER_CHIPS_MAX_OPTIONS): boolean {
  if (field.kind !== 'multi-enum') return false
  if (field.display) return field.display === 'chips'
  if (field.searchable) return false
  const choices = field.options.length + (field.includeNull ? 1 : 0)
  return choices <= maxOptions
}
