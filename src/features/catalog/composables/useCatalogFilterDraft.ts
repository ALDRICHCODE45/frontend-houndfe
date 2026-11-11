import { computed, shallowRef } from 'vue'
import { toggleFacetTokens } from '../utils/filter-model'

export interface CatalogFilterSelection {
  categoryId: string | null
  tokens: string[]
}

/**
 * Draft of the mobile filter sheet: a copy of the committed selection that changes freely and
 * only reaches the URL when the visitor confirms. The source is never mutated.
 */
export function useCatalogFilterDraft() {
  const categoryId = shallowRef<string | null>(null)
  const tokens = shallowRef<string[]>([])
  const committed = shallowRef<CatalogFilterSelection>({ categoryId: null, tokens: [] })

  function reset(source: CatalogFilterSelection) {
    committed.value = { categoryId: source.categoryId, tokens: [...source.tokens] }
    categoryId.value = source.categoryId
    tokens.value = [...source.tokens]
  }
  /** Category is a single choice: pressing the selected one unselects it. */
  function toggleCategory(id: string) {
    categoryId.value = categoryId.value === id ? null : id
  }
  function toggleFacet(optionTokens: string[]) {
    tokens.value = toggleFacetTokens(tokens.value, optionTokens)
  }
  function removeTokens(removed: string[]) {
    tokens.value = tokens.value.filter((token) => !removed.includes(token))
  }
  function clear() {
    categoryId.value = null
    tokens.value = []
  }
  /** The category counts once; `facetChipCount` is the number of facet chips (merged options count once). */
  function activeCount(facetChipCount: number) {
    return (categoryId.value === null ? 0 : 1) + facetChipCount
  }
  const isDirty = computed(
    () =>
      categoryId.value !== committed.value.categoryId ||
      tokens.value.length !== committed.value.tokens.length ||
      tokens.value.some((token) => !committed.value.tokens.includes(token)),
  )

  return {
    categoryId,
    tokens,
    isDirty,
    reset,
    toggleCategory,
    toggleFacet,
    removeTokens,
    clear,
    activeCount,
  }
}
