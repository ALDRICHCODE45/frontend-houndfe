<script setup lang="ts">
import type { SearchableProduct } from '../interfaces/sale.types'
import { formatCentsMXN } from '../utils/currency.utils'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  product: SearchableProduct
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  select: [product: SearchableProduct]
}>()

// ── Computed ──────────────────────────────────────────────────────────────────

function getStockBadgeText(product: SearchableProduct): string {
  if (product.hasVariants) {
    return `${product.stock} unidades en ${product.variantCount} variantes`
  }
  return `${product.stock} unidades`
}
</script>

<template>
  <div
    class="flex items-center gap-3 px-3 py-3 hover:bg-elevated/60 cursor-pointer transition-colors duration-150 border-b border-default last:border-b-0"
    @click="emit('select', product)"
  >
    <!-- Image or placeholder -->
    <div class="h-12 w-12 shrink-0 rounded-lg bg-elevated border border-default flex items-center justify-center overflow-hidden">
      <UIcon
        v-if="!product.imageUrl"
        name="i-lucide-image"
        class="h-6 w-6 text-dimmed"
        data-testid="placeholder-icon"
      />
      <img v-else :src="product.imageUrl" :alt="product.name" class="h-full w-full object-cover rounded-lg" />
    </div>

    <!-- Product info -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-highlighted truncate mb-0.5">
        {{ product.name }}
      </p>
      <p class="text-sm text-toned">
        {{ formatCentsMXN(product.priceCents) }}
      </p>
    </div>

    <!-- Stock badge -->
    <div class="shrink-0">
      <UBadge
        color="success"
        variant="subtle"
        size="xs"
        :label="getStockBadgeText(product)"
      />
    </div>
  </div>
</template>
