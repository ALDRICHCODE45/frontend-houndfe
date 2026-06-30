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
</script>

<template>
  <div
    v-if="props.loading && !props.products.length"
    class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
  >
    <div
      v-for="index in 8"
      :key="index"
      class="h-56 animate-pulse rounded-xl border border-default bg-elevated"
    />
  </div>

  <div
    v-else-if="!props.products.length"
    class="flex flex-col items-center justify-center gap-3 py-16 text-center"
  >
    <UIcon name="i-lucide-package-search" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ props.empty ?? 'No se encontraron productos' }}</p>
  </div>

  <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
