<script lang="ts">
/**
 * Context gate states the view resolves before any product request is attempted.
 * They are deliberately separate from product states so a context problem never
 * reads as a product failure.
 */
export type CatalogProductContextState =
  | 'context-ready'
  | 'context-loading'
  | 'context-empty'
  | 'context-unavailable'
  | 'context-no-default'
  | 'context-rate-limit'
  | 'context-network'
  | 'context-server'
</script>

<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import CatalogProductCard from './CatalogProductCard.vue'
import CatalogListingBranchUnavailable from './CatalogListingBranchUnavailable.vue'
import type { PublicBranchDto } from '../interfaces/catalog.types'
import type { CatalogBranchesState } from '../composables/useCatalogBranches'
import type { CatalogProductsState } from '../composables/useCatalogProducts'
import type { PublicCatalogProductDto } from '../interfaces/public-catalog-products.types'

const props = withDefaults(
  defineProps<{
    selectionState: 'none' | 'invalid' | 'selected'
    products: PublicCatalogProductDto[]
    state: CatalogProductsState
    contextState?: CatalogProductContextState
    branchesState?: CatalogBranchesState
    /** Published branches offered when the URL names a branch without a catalog. */
    branches?: PublicBranchDto[]
  }>(),
  { contextState: 'context-ready', branchesState: 'populated', branches: () => [] },
)
const emit = defineEmits<{
  retry: []
  'retry-context': []
  'retry-branches': []
  'select-branch': [slug: string]
}>()

const branchesPending = computed(
  () => props.branchesState === 'loading' || props.branchesState === 'retry-pending',
)
const branchesCopy = computed(() => {
  switch (props.branchesState) {
    case 'empty':
      return 'No hay sucursales publicadas'
    case 'rate-limit':
      return 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
    case 'network':
      return 'No se pudo conectar. Inténtalo de nuevo en un momento.'
    default:
      return 'No pudimos cargar las sucursales.'
  }
})

const contextCopy = computed(() => {
  switch (props.contextState) {
    case 'context-empty':
      return 'Este catálogo todavía no tiene listas de precios publicadas'
    case 'context-unavailable':
      return 'La lista de precios seleccionada no está disponible'
    case 'context-no-default':
      return 'Elige una lista de precios para ver productos'
    case 'context-rate-limit':
      return 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
    case 'context-network':
      return 'No se pudo conectar. Inténtalo de nuevo en un momento.'
    default:
      return 'No pudimos cargar las listas de precios.'
  }
})
const contextRetryable = computed(
  () =>
    props.contextState === 'context-empty' ||
    props.contextState === 'context-rate-limit' ||
    props.contextState === 'context-network' ||
    props.contextState === 'context-server',
)

/**
 * The one loading shape: the listing's own cards. Which request is pending only
 * changes the announced label; the order mirrors the state chain below.
 */
const skeletonLabel = computed<string | null>(() => {
  if (props.branchesState !== 'populated') {
    return branchesPending.value ? 'Cargando sucursales…' : null
  }
  if (props.selectionState !== 'selected') return null
  if (props.contextState !== 'context-ready') {
    return props.contextState === 'context-loading' ? 'Cargando listas de precios…' : null
  }
  if (props.state === 'loading' || props.state === 'retry-pending') {
    return props.state === 'retry-pending' ? 'Reintentando productos…' : 'Cargando productos…'
  }
  return null
})
/** Artboard 05: the filters and the search survive a failure; a rate limit asks to wait. */
const productsError = computed(() =>
  props.state === 'rate-limit'
    ? { title: 'Demasiadas consultas seguidas', description: 'Espera unos segundos y vuelve a intentarlo.' }
    : {
        title: 'No pudimos cargar el catálogo',
        description:
          'Revisa tu conexión e inténtalo de nuevo. Tus filtros y tu búsqueda se conservan.',
      },
)
const gridClass = 'grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4'
</script>

<template>
  <div class="catalog-container py-6 lg:py-8">
    <section
      v-if="skeletonLabel"
      data-testid="catalog-product-skeleton"
      role="status"
      aria-live="polite"
      :aria-busy="true"
    >
      <h2 class="sr-only">{{ skeletonLabel }}</h2>
      <div :class="gridClass" aria-hidden="true">
        <div
          v-for="index in 8"
          :key="index"
          class="catalog-skeleton-card"
          data-testid="catalog-product-skeleton-card"
        >
          <span class="catalog-skeleton catalog-skeleton-media" />
          <span class="catalog-skeleton-body">
            <span class="catalog-skeleton catalog-skeleton-brand" />
            <span class="catalog-skeleton catalog-skeleton-line" />
            <span class="catalog-skeleton catalog-skeleton-line catalog-skeleton-line--short" />
            <span class="catalog-skeleton catalog-skeleton-price" />
            <span class="catalog-skeleton catalog-skeleton-action" />
          </span>
        </div>
      </div>
    </section>

    <template v-else-if="branchesState !== 'populated'">
      <EmptyState
        v-if="branchesState === 'empty'"
        data-testid="catalog-state"
        kind="empty"
        title="No hay sucursales publicadas"
        description="El catálogo no está disponible en este momento. Vuelve a consultar más tarde."
        action-label="Actualizar"
        action-test-id="catalog-retry-branches"
        @action="emit('retry-branches')"
      />
      <EmptyState
        v-else
        data-testid="catalog-state"
        kind="error"
        :title="branchesCopy"
        action-label="Reintentar"
        action-test-id="catalog-retry-branches"
        @action="emit('retry-branches')"
      />
    </template>

    <EmptyState
      v-else-if="selectionState === 'none'"
      data-testid="catalog-state"
      kind="empty"
      icon="i-lucide-store"
      title="Elige una sucursal para explorar el catálogo"
      description="Selecciona una sucursal publicada para ver sus productos."
    />

    <CatalogListingBranchUnavailable
      v-else-if="selectionState === 'invalid' && branches.length > 0"
      :branches="branches"
      @select="emit('select-branch', $event)"
    />

    <EmptyState
      v-else-if="selectionState === 'invalid'"
      data-testid="catalog-state"
      kind="empty"
      icon="i-lucide-map-pin-off"
      title="Esta sucursal no está disponible"
      description="Elige una de las sucursales publicadas para explorar el catálogo."
    />

    <EmptyState
      v-else-if="contextState !== 'context-ready'"
      data-testid="catalog-state"
      :kind="
        contextState === 'context-empty' || contextState === 'context-no-default'
          ? 'empty'
          : 'error'
      "
      :icon="
        contextState === 'context-empty'
          ? 'i-lucide-tag'
          : contextState === 'context-no-default'
            ? 'i-lucide-tags'
            : undefined
      "
      :title="contextCopy"
      :action-label="contextRetryable ? 'Reintentar' : undefined"
      action-test-id="catalog-retry-context"
      @action="emit('retry-context')"
    />

    <section v-else-if="state === 'populated'" aria-live="polite">
      <p class="sr-only" role="status">Productos cargados</p>
      <div data-testid="catalog-product-grid" :class="gridClass">
        <CatalogProductCard v-for="product in products" :key="product.id" :product="product" />
      </div>
    </section>

    <EmptyState
      v-else-if="state === 'empty'"
      data-testid="catalog-state"
      kind="empty"
      icon="i-lucide-package-open"
      title="No hay productos disponibles en este momento"
      action-label="Actualizar"
      action-icon="i-lucide-rotate-cw"
      action-test-id="catalog-retry-products"
      @action="emit('retry')"
    />

    <EmptyState
      v-else-if="state === 'unavailable'"
      data-testid="catalog-state"
      kind="empty"
      icon="i-lucide-circle-alert"
      title="La lista de precios seleccionada no está disponible"
      description="Elige otra lista de precios para ver el catálogo."
    />

    <EmptyState
      v-else
      data-testid="catalog-state"
      kind="error"
      :title="productsError.title"
      :description="productsError.description"
      action-label="Reintentar"
      action-test-id="catalog-retry-products"
      @action="emit('retry')"
    />
  </div>
</template>
