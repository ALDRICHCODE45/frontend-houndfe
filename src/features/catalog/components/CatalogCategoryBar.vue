<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
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
  /** The listing below already shows a failure: say it once, there, not here too. */
  combinedError?: boolean
}>()
const emit = defineEmits<{ select: [id: string | null]; retry: [] }>()
const resultTotalLabel = computed(() =>
  props.total === null ? null : `${props.total} ${props.total === 1 ? 'producto' : 'productos'}`,
)
const failed = computed(() =>
  ['unavailable', 'rate-limit', 'server', 'network'].includes(props.state),
)
const showError = computed(() => (failed.value || props.contextMismatch) && !props.combinedError)
const errorTitle = computed(() =>
  failed.value
    ? 'No pudimos cargar las categorías'
    : 'Las categorías no coinciden con la lista de precios actual.',
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
        <EmptyState
          v-if="showError"
          data-testid="catalog-category-error"
          class="catalog-category-error"
          kind="error"
          :title="errorTitle"
          action-label="Reintentar"
          action-test-id="catalog-retry-categories"
          @action="emit('retry')"
        />
        <div
          v-else-if="state === 'loading' || state === 'retry-pending'"
          role="status"
          aria-busy="true"
          class="catalog-category-skeleton"
        >
          <span class="sr-only">Cargando categorías…</span>
          <span v-for="n in 4" :key="n" class="catalog-skeleton catalog-skeleton-pill" aria-hidden="true" />
        </div>
      </div>
    </div>
  </div>
</template>
