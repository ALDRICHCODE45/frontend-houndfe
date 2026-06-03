<script setup lang="ts">
import { useCatalogStore } from '../composables/useCatalogStore'
import CatalogProductCard from './CatalogProductCard.vue'

const catalog = useCatalogStore()
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
    <!-- Empty state -->
    <div
      v-if="catalog.products.length === 0"
      class="flex flex-col items-center justify-center gap-3 py-20 text-center"
    >
      <div class="flex size-16 items-center justify-center rounded-2xl bg-orange-100">
        <UIcon name="i-lucide-search-x" class="size-8 text-orange-400" />
      </div>
      <h3 class="text-lg font-semibold text-highlighted">Sin resultados</h3>
      <p class="max-w-sm text-sm text-muted">
        No encontramos productos con esos filtros. Intenta con otra busqueda o categoria.
      </p>
    </div>

    <!-- Product grid -->
    <div
      v-else
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <CatalogProductCard
        v-for="(product, idx) in catalog.products"
        :key="product.id"
        :product="product"
        :index="idx"
        @select="catalog.openProductDetail($event)"
      />
    </div>
  </div>
</template>
