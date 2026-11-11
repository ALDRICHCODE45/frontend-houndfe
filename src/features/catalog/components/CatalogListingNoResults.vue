<script setup lang="ts">
import { computed } from 'vue'
import type { PublicCatalogProductsCategoryFacetDto } from '../interfaces/public-catalog-products.types'

/**
 * No results (artboard 05): says what was searched and where, and offers the ways out —
 * clear everything, drop the one filter or the search, or explore a real category.
 * No WhatsApp here until the business number exists (T4).
 */
const props = defineProps<{
  /** The committed search, '' without one. */
  search: string
  /** Labels of the active non-search filters, in chip order. */
  filterLabels: string[]
  /** Baseline categories with their real counts. */
  categories: PublicCatalogProductsCategoryFacetDto[]
  selectedCategoryId: string | null
}>()
const emit = defineEmits<{
  'clear-all': []
  'remove-filter': []
  'clear-search': []
  'select-category': [id: string]
}>()

const filters = computed(() => props.filterLabels)
const title = computed(() => {
  const { search } = props
  const single = filters.value.length === 1 ? filters.value[0] : null
  if (search && single) return `No encontramos «${search}» en ${single}`
  if (search && filters.value.length > 1) return `No encontramos «${search}» con estos filtros`
  if (search) return `No encontramos «${search}»`
  if (single) return `No hay productos en ${single}`
  return 'No encontramos productos con estos filtros'
})
const description = computed(() =>
  props.search
    ? 'Prueba con otras palabras o quita un filtro.'
    : 'Prueba quitando un filtro.',
)
const singleFilter = computed(() =>
  props.search && filters.value.length === 1 ? filters.value[0]! : null,
)
const offerClearSearch = computed(() => props.search !== '' && filters.value.length > 1)
const suggestions = computed(() =>
  [...props.categories]
    .filter((category) => category.id !== props.selectedCategoryId && category.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3),
)
</script>

<template>
  <section data-testid="catalog-no-results" class="catalog-listing-state" role="status">
    <span class="catalog-listing-state-icon"><UIcon name="i-lucide-search-x" class="size-5" aria-hidden="true" /></span>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <div class="catalog-listing-state-actions">
      <button
        v-if="filters.length === 0"
        type="button"
        class="catalog-button catalog-button--primary"
        @click="emit('clear-search')"
      >
        Limpiar búsqueda
      </button>
      <button
        v-else
        type="button"
        class="catalog-button catalog-button--primary"
        @click="emit('clear-all')"
      >
        Limpiar todo
      </button>
      <button
        v-if="singleFilter"
        type="button"
        class="catalog-button"
        @click="emit('remove-filter')"
      >
        Quitar «{{ singleFilter }}»
      </button>
      <button
        v-else-if="offerClearSearch"
        type="button"
        class="catalog-button"
        @click="emit('clear-search')"
      >
        Quitar búsqueda
      </button>
    </div>
    <div
      v-if="suggestions.length > 0"
      class="catalog-listing-state-suggestions"
      role="group"
      aria-label="Explora por categoría"
    >
      <b>Explora por categoría</b>
      <div class="catalog-chips">
        <button
          v-for="category in suggestions"
          :key="category.id"
          type="button"
          class="catalog-chip catalog-chip--quiet"
          @click="emit('select-category', category.id)"
        >
          {{ category.name }} · {{ category.count }}
        </button>
      </div>
    </div>
  </section>
</template>
