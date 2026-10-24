<script setup lang="ts">
import { computed } from 'vue'
import type { PublicCatalogProductsCategoryFacetDto } from '../interfaces/public-catalog-products.types'

const props = defineProps<{
  categories: PublicCatalogProductsCategoryFacetDto[]
  /** Unknown totals are never presented as zero. Facets are not fake filter controls. */
  total: number | null
}>()
const resultTotalLabel = computed(() =>
  props.total === null ? null : `${props.total} ${props.total === 1 ? 'producto' : 'productos'}`,
)
</script>

<template>
  <div data-testid="catalog-category-bar" class="catalog-categories">
    <div data-testid="catalog-category-toolbar" class="catalog-category-toolbar">
      <h2>Nuestro catálogo</h2>
      <span v-if="resultTotalLabel !== null" data-testid="catalog-result-total">{{
        resultTotalLabel
      }}</span>
    </div>
  </div>
</template>
