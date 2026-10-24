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
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      role="status"
      aria-live="polite"
      :aria-busy="branchesPending"
    >
      <h2 class="text-lg font-semibold text-highlighted">{{ branchesCopy }}</h2>
      <p v-if="branchesState === 'empty'" class="max-w-sm text-sm text-muted">
        El catálogo no está disponible en este momento. Vuelve a consultar más tarde.
      </p>
      <button
        v-if="!branchesPending"
        type="button"
        aria-label="Reintentar descubrimiento de sucursales"
        class="min-h-11 text-sm font-medium text-primary focus-visible:ring-2 focus-visible:ring-primary"
        @click="emit('retry-branches')"
      >
        Actualizar
      </button>
    </section>

    <section
      v-else-if="selectionState === 'none'"
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      aria-live="polite"
    >
      <div
        class="flex size-14 items-center justify-center rounded-2xl bg-coco-50 ring-1 ring-coco-100 dark:bg-coco-950 dark:ring-coco-900"
      >
        <UIcon name="i-lucide-store" class="size-7 text-primary" />
      </div>
      <h2 class="text-lg font-semibold text-highlighted">
        Elige una sucursal para explorar el catálogo
      </h2>
      <p class="max-w-sm text-sm text-muted">
        Selecciona una sucursal publicada para ver sus productos.
      </p>
    </section>

    <section
      v-else-if="selectionState === 'invalid'"
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      aria-live="polite"
    >
      <div
        class="flex size-14 items-center justify-center rounded-2xl bg-coco-50 ring-1 ring-coco-100 dark:bg-coco-950 dark:ring-coco-900"
      >
        <UIcon name="i-lucide-map-pin-off" class="size-7 text-primary" />
      </div>
      <h2 class="text-lg font-semibold text-highlighted">Esta sucursal no está disponible</h2>
      <p class="max-w-sm text-sm text-muted">
        Elige una de las sucursales publicadas para explorar el catálogo.
      </p>
    </section>

    <section
      v-else-if="contextState !== 'context-ready'"
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
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
        class="size-8 text-primary"
        :class="contextState === 'context-loading' ? 'animate-spin' : ''"
      />
      <h2 class="text-lg font-semibold text-highlighted">
        {{ contextState === 'context-loading' ? 'Cargando listas de precios…' : contextCopy }}
      </h2>
      <button
        v-if="contextRetryable"
        class="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        type="button"
        aria-label="Reintentar carga de listas de precios"
        @click="emit('retry-context')"
      >
        Reintentar
      </button>
    </section>

    <section
      v-else-if="state === 'loading' || state === 'retry-pending'"
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      role="status"
      aria-live="polite"
      :aria-busy="true"
    >
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
      <h2 class="text-lg font-semibold text-highlighted">
        {{ state === 'retry-pending' ? 'Reintentando productos…' : 'Cargando productos…' }}
      </h2>
    </section>

    <section v-else-if="state === 'populated'" aria-live="polite">
      <p class="sr-only" role="status">Productos cargados</p>
      <div
        data-testid="catalog-product-grid"
        class="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5"
      >
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
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <UIcon name="i-lucide-package-open" class="size-8 text-primary" />
      <h2 class="text-lg font-semibold text-highlighted">
        No hay productos disponibles en este momento
      </h2>
      <button
        class="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        type="button"
        aria-label="Reintentar productos"
        @click="emit('retry')"
      >
        Actualizar
      </button>
    </section>

    <section
      v-else-if="state === 'unavailable'"
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <UIcon name="i-lucide-circle-alert" class="size-8 text-primary" />
      <h2 class="text-lg font-semibold text-highlighted">
        La lista de precios seleccionada no está disponible
      </h2>
      <p class="max-w-sm text-sm text-muted">Elige otra lista de precios para ver el catálogo.</p>
    </section>

    <section
      v-else
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <UIcon name="i-lucide-circle-alert" class="size-8 text-primary" />
      <h2 class="text-lg font-semibold text-highlighted">
        {{
          state === 'rate-limit'
            ? 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
            : state === 'network'
              ? 'No se pudo conectar. Revisa tu conexión.'
              : 'No pudimos cargar los productos.'
        }}
      </h2>
      <button
        class="text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        type="button"
        aria-label="Reintentar productos"
        @click="emit('retry')"
      >
        Reintentar
      </button>
    </section>
  </div>
</template>
