<script setup lang="ts">
import CatalogProductCard from './CatalogProductCard.vue'
import type { CatalogProductsState } from '../composables/useCatalogProducts'
import type { PublicCatalogProductDto } from '../interfaces/public-catalog-products.types'

defineProps<{
  selectionState: 'none' | 'invalid' | 'selected'
  products: PublicCatalogProductDto[]
  state: CatalogProductsState
}>()
const emit = defineEmits<{
  retry: []
  'open-detail': [productId: string, invoker: HTMLButtonElement]
}>()

function relayOpenDetail(productId: string, invoker: HTMLButtonElement) {
  emit('open-detail', productId, invoker)
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
    <section
      v-if="selectionState === 'none'"
      class="flex flex-col items-center justify-center gap-3 py-20 text-center"
      aria-live="polite"
    >
      <div class="flex size-16 items-center justify-center rounded-2xl bg-orange-100">
        <UIcon name="i-lucide-store" class="size-8 text-orange-400" />
      </div>
      <h1 class="text-lg font-semibold text-highlighted">
        Elige una sucursal para explorar el catálogo
      </h1>
      <p class="max-w-sm text-sm text-muted">
        Selecciona una sucursal publicada para ver sus productos.
      </p>
    </section>

    <section
      v-else-if="selectionState === 'invalid'"
      class="flex flex-col items-center justify-center gap-3 py-20 text-center"
      aria-live="polite"
    >
      <div class="flex size-16 items-center justify-center rounded-2xl bg-orange-100">
        <UIcon name="i-lucide-map-pin-off" class="size-8 text-orange-400" />
      </div>
      <h1 class="text-lg font-semibold text-highlighted">Esta sucursal no está disponible</h1>
      <p class="max-w-sm text-sm text-muted">
        Elige una de las sucursales publicadas para explorar el catálogo.
      </p>
    </section>

    <section
      v-else-if="state === 'loading' || state === 'retry-pending'"
      class="flex flex-col items-center justify-center gap-3 py-20 text-center"
      role="status"
      aria-live="polite"
      :aria-busy="true"
    >
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-orange-400" />
      <h1 class="text-lg font-semibold text-highlighted">
        {{ state === 'retry-pending' ? 'Reintentando productos…' : 'Cargando productos…' }}
      </h1>
    </section>

    <section v-else-if="state === 'populated'" aria-live="polite">
      <p class="sr-only" role="status">Productos cargados</p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      class="flex flex-col items-center justify-center gap-3 py-20 text-center"
      role="status"
      aria-live="polite"
    >
      <UIcon name="i-lucide-package-open" class="size-8 text-orange-400" />
      <h1 class="text-lg font-semibold text-highlighted">
        Esta sucursal todavía no tiene productos publicados
      </h1>
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
      v-else
      class="flex flex-col items-center justify-center gap-3 py-20 text-center"
      role="status"
      aria-live="polite"
    >
      <UIcon name="i-lucide-circle-alert" class="size-8 text-orange-400" />
      <h1 class="text-lg font-semibold text-highlighted">
        {{
          state === 'rate-limit'
            ? 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
            : state === 'network'
              ? 'No se pudo conectar. Revisa tu conexión.'
              : 'No pudimos cargar los productos.'
        }}
      </h1>
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
