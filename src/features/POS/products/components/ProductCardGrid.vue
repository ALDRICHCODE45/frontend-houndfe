<script setup lang="ts">
import ProductCard from './ProductCard.vue'
import type { Product } from '../interfaces/product.types'

const props = defineProps<{
  products: Product[]
  currencyFormatter: Intl.NumberFormat
  loading?: boolean
  empty?: string
  canRead?: boolean
  canUpdate?: boolean
  canDelete?: boolean
}>()

const emit = defineEmits<{
  details: [product: Product]
  edit: [product: Product]
  delete: [product: Product]
  'card-click': [product: Product]
}>()

// S2 pilot available-width grid convention (design §4): the nested list
// width, not the viewport, decides the column count. Duplicated by design
// across the three pilot grids — no shared wrapper.
const gridClasses =
  'grid w-full min-w-0 max-w-full grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3'
</script>

<template>
  <div
    v-if="props.loading && !props.products.length"
        :class="gridClasses"
        data-testid="product-cards-skeleton"
      >
    <div
      v-for="index in 8"
      :key="index"
      class="h-56 animate-pulse rounded-xl border border-default bg-elevated"
    />
  </div>

  <div
    v-else-if="!props.products.length"
    class="flex w-full min-w-0 max-w-full flex-col items-center justify-center gap-3 py-16 text-center"
    data-testid="product-cards-empty"
  >
    <UIcon name="i-lucide-package-search" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ props.empty ?? 'No se encontraron productos' }}</p>
  </div>

  <div
    v-else
    data-testid="product-cards-grid"
    :class="gridClasses"
  >
    <ProductCard
      v-for="product in props.products"
      :key="product.id"
      :product="product"
      :currency-formatter="props.currencyFormatter"
      :can-read="props.canRead"
      :can-update="props.canUpdate"
      :can-delete="props.canDelete"
      @details="emit('details', $event)"
      @edit="emit('edit', $event)"
      @delete="emit('delete', $event)"
      @click="emit('card-click', $event)"
    />
  </div>
</template>
