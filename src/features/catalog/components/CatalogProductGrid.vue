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
import CatalogProductCard from './CatalogProductCard.vue'
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
  }>(),
  { contextState: 'context-ready', branchesState: 'populated' },
)
const emit = defineEmits<{
  retry: []
  'retry-context': []
  'retry-branches': []
  'open-detail': [productId: string, invoker: HTMLButtonElement]
}>()

const branchesPending = computed(
  () => props.branchesState === 'loading' || props.branchesState === 'retry-pending',
)
const branchesCopy = computed(() => {
  switch (props.branchesState) {
    case 'loading':
    case 'retry-pending':
      return 'Cargando sucursales…'
    case 'empty':
      return 'No hay sucursales publicadas'
    case 'rate-limit':
      return 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
    case 'network':
      return 'No se pudo conectar. Revisa tu conexión.'
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
      return 'No se pudo conectar. Revisa tu conexión.'
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

function relayOpenDetail(productId: string, invoker: HTMLButtonElement) {
  emit('open-detail', productId, invoker)
}
</script>

<template>
  <div class="catalog-container py-6 lg:py-8">
    <section
      v-if="branchesState !== 'populated'"
      class="catalog-state"
      :data-kind="
        branchesPending ? 'loading' : branchesState === 'empty' ? 'empty' : 'error'
      "
      data-testid="catalog-state"
      role="status"
      aria-live="polite"
      :aria-busy="branchesPending"
    >
      <h2 class="catalog-state-title">{{ branchesCopy }}</h2>
      <p v-if="branchesState === 'empty'" class="catalog-state-note">
        El catálogo no está disponible en este momento. Vuelve a consultar más tarde.
      </p>
      <button
        v-if="!branchesPending"
        type="button"
        aria-label="Reintentar descubrimiento de sucursales"
        class="catalog-state-action"
        @click="emit('retry-branches')"
      >
        Actualizar
      </button>
    </section>

    <section
      v-else-if="selectionState === 'none'"
      class="catalog-state"
      data-kind="empty"
      data-testid="catalog-state"
      aria-live="polite"
    >
      <UIcon name="i-lucide-store" class="catalog-state-icon" />
      <h2 class="catalog-state-title">Elige una sucursal para explorar el catálogo</h2>
      <p class="catalog-state-note">Selecciona una sucursal publicada para ver sus productos.</p>
    </section>

    <section
      v-else-if="selectionState === 'invalid'"
      class="catalog-state"
      data-kind="empty"
      data-testid="catalog-state"
      aria-live="polite"
    >
      <UIcon name="i-lucide-map-pin-off" class="catalog-state-icon" />
      <h2 class="catalog-state-title">Esta sucursal no está disponible</h2>
      <p class="catalog-state-note">
        Elige una de las sucursales publicadas para explorar el catálogo.
      </p>
    </section>

    <section
      v-else-if="contextState !== 'context-ready'"
      class="catalog-state"
      :data-kind="
        contextState === 'context-loading'
          ? 'loading'
          : contextState === 'context-empty' || contextState === 'context-no-default'
            ? 'empty'
            : 'error'
      "
      data-testid="catalog-state"
      role="status"
      aria-live="polite"
      :aria-busy="contextState === 'context-loading'"
    >
      <UIcon
        :name="
          contextState === 'context-loading'
            ? 'i-lucide-loader-circle'
            : contextState === 'context-empty'
              ? 'i-lucide-tag'
              : contextState === 'context-no-default'
                ? 'i-lucide-tags'
                : 'i-lucide-circle-alert'
        "
        class="catalog-state-icon"
        :class="contextState === 'context-loading' ? 'animate-spin' : ''"
      />
      <h2 class="catalog-state-title">
        {{ contextState === 'context-loading' ? 'Cargando listas de precios…' : contextCopy }}
      </h2>
      <button
        v-if="contextRetryable"
        class="catalog-state-action"
        type="button"
        aria-label="Reintentar carga de listas de precios"
        @click="emit('retry-context')"
      >
        Reintentar
      </button>
    </section>

    <section
      v-else-if="state === 'loading' || state === 'retry-pending'"
      data-testid="catalog-product-skeleton"
      role="status"
      aria-live="polite"
      :aria-busy="true"
    >
      <h2 class="sr-only">
        {{ state === 'retry-pending' ? 'Reintentando productos…' : 'Cargando productos…' }}
      </h2>
      <div class="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5" aria-hidden="true">
        <div
          v-for="index in 10"
          :key="index"
          class="catalog-skeleton-card"
          data-testid="catalog-product-skeleton-card"
        >
          <span class="catalog-skeleton catalog-skeleton-media" />
          <span class="catalog-skeleton catalog-skeleton-line" />
          <span class="catalog-skeleton catalog-skeleton-line catalog-skeleton-line--short" />
          <span class="catalog-skeleton catalog-skeleton-price" />
        </div>
      </div>
    </section>

    <section v-else-if="state === 'populated'" aria-live="polite">
      <p class="sr-only" role="status">Productos cargados</p>
      <div data-testid="catalog-product-grid" class="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        <CatalogProductCard
          v-for="product in products"
          :key="product.id"
          :product="product"
          @open-detail="relayOpenDetail"
        />
      </div>
    </section>

    <section
      v-else-if="state === 'empty'"
      class="catalog-state"
      data-kind="empty"
      data-testid="catalog-state"
      role="status"
      aria-live="polite"
    >
      <UIcon name="i-lucide-package-open" class="catalog-state-icon" />
      <h2 class="catalog-state-title">No hay productos disponibles en este momento</h2>
      <button
        class="catalog-state-action"
        type="button"
        aria-label="Reintentar productos"
        @click="emit('retry')"
      >
        Actualizar
      </button>
    </section>

    <section
      v-else-if="state === 'unavailable'"
      class="catalog-state"
      data-kind="empty"
      data-testid="catalog-state"
      role="status"
      aria-live="polite"
    >
      <UIcon name="i-lucide-circle-alert" class="catalog-state-icon" />
      <h2 class="catalog-state-title">La lista de precios seleccionada no está disponible</h2>
      <p class="catalog-state-note">Elige otra lista de precios para ver el catálogo.</p>
    </section>

    <section
      v-else
      class="catalog-state"
      data-kind="error"
      data-testid="catalog-state"
      role="alert"
    >
      <UIcon name="i-lucide-triangle-alert" class="catalog-state-icon" />
      <h2 class="catalog-state-title">
        {{
          state === 'rate-limit'
            ? 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
            : state === 'network'
              ? 'No se pudo conectar. Revisa tu conexión.'
              : 'No pudimos cargar los productos.'
        }}
      </h2>
      <button
        class="catalog-state-action"
        type="button"
        aria-label="Reintentar productos"
        @click="emit('retry')"
      >
        Reintentar
      </button>
    </section>
  </div>
</template>
