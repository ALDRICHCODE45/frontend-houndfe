<script setup lang="ts">
import { computed } from 'vue'
import type { CatalogProductsState } from '../composables/useCatalogProducts'
import type { PublicCatalogProductsCategoryFacetDto } from '../interfaces/public-catalog-products.types'

const props = defineProps<{
  categories: PublicCatalogProductsCategoryFacetDto[]
  total: number | null
  allTotal: number | null
  selectedId: string | null
  hasCategory: boolean
  ready: boolean
  state: CatalogProductsState
  contextMismatch: boolean
}>()
const emit = defineEmits<{ select: [id: string | null]; retry: [] }>()
const resultTotalLabel = computed(() =>
  props.total === null ? null : `${props.total} ${props.total === 1 ? 'producto' : 'productos'}`,
)
const failed = computed(() =>
  ['unavailable', 'rate-limit', 'server', 'network'].includes(props.state),
)
</script>

<template>
  <div data-testid="catalog-category-bar" class="catalog-categories">
    <div data-testid="catalog-category-toolbar" class="catalog-category-toolbar">
      <h2>Nuestro catálogo</h2>
      <span v-if="resultTotalLabel !== null" data-testid="catalog-result-total">{{
        resultTotalLabel
      }}</span>
      <div
        v-if="ready"
        class="catalog-category-controls"
        role="group"
        aria-label="Filtrar por categoría"
      >
        <button
          v-if="allTotal !== null && !failed"
          type="button"
          class="catalog-filter-button"
          aria-label="Todas las categorías"
          :aria-pressed="!hasCategory"
          @click="emit('select', null)"
        >
          Todas <span>{{ allTotal }}</span>
        </button>
        <template v-if="!failed">
          <button
            v-for="category in categories"
            :key="category.id"
            type="button"
            class="catalog-filter-button"
            :aria-label="`Categoría ${category.name}`"
            :aria-pressed="selectedId === category.id"
            @click="emit('select', category.id)"
          >
            {{ category.name }} <span>{{ category.count }}</span>
          </button>
        </template>
        <button
          v-if="hasCategory"
          type="button"
          class="catalog-filter-button"
          @click="emit('select', null)"
        >
          Limpiar categoría
        </button>
        <p v-if="failed" role="status">No pudimos cargar las categorías.</p>
        <p v-else-if="contextMismatch" role="status">
          Las categorías no coinciden con la lista de precios actual.
        </p>
        <button
          v-if="failed || contextMismatch"
          type="button"
          class="catalog-filter-button"
          @click="emit('retry')"
        >
          Reintentar categorías
        </button>
        <p v-else-if="state === 'loading' || state === 'retry-pending'" role="status">
          Cargando categorías…
        </p>
      </div>
    </div>
  </div>
</template>
