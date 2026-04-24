<script setup lang="ts">
import { ref } from 'vue'
import type { PosCatalogItem } from '../interfaces/sale.types'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  item: PosCatalogItem
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  select: [item: PosCatalogItem]
}>()

// ── Image Error Handling ──────────────────────────────────────────────────────

const imageError = ref(false)

function handleImageError() {
  imageError.value = true
}

// ── Computed ──────────────────────────────────────────────────────────────────

function formatPrice(priceDecimal: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceDecimal)
}

function isLowStock(item: PosCatalogItem): boolean {
  return item.stock != null && item.stock.quantity <= item.stock.minQuantity
}
</script>

<template>
  <div
    class="flex items-center gap-3 px-3 py-3 hover:bg-elevated/60 cursor-pointer transition-colors duration-150 border-b border-default last:border-b-0"
    @click="emit('select', item)"
  >
    <!-- Image or placeholder -->
    <div
      class="h-12 w-12 shrink-0 rounded-lg bg-elevated border border-default flex items-center justify-center overflow-hidden"
    >
      <UIcon
        v-if="!item.mainImage || imageError"
        name="i-lucide-image"
        class="h-6 w-6 text-dimmed"
        data-testid="placeholder-icon"
      />
      <img
        v-else
        :src="item.mainImage"
        :alt="item.name"
        class="h-full w-full object-cover rounded-lg"
        loading="lazy"
        @error="handleImageError"
      />
    </div>

    <!-- Product info -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-highlighted truncate mb-0.5">
        {{ item.name }}
      </p>
      <p v-if="item.sku" class="text-xs text-dimmed truncate mb-0.5" data-testid="sku-subtitle">
        {{ item.sku }}
      </p>
      <!-- Price or variant indicator -->
      <div class="flex items-center gap-1">
        <p v-if="item.price" class="text-sm text-toned">
          {{ formatPrice(item.price.priceDecimal) }}
        </p>
        <p v-else class="text-sm text-toned flex items-center gap-1">
          Ver variantes
          <UIcon name="i-lucide-chevron-right" class="h-4 w-4" data-testid="chevron-icon" />
        </p>
      </div>
    </div>

    <!-- Stock badge and variant count -->
    <div class="shrink-0 flex flex-col items-end gap-1">
      <UBadge
        v-if="item.stock != null"
        :color="isLowStock(item) ? 'warning' : 'success'"
        variant="subtle"
        size="xs"
        :label="`${item.stock.quantity} unidades`"
        data-testid="stock-badge"
      />
      <p v-if="item.hasVariants && item.variants.length > 0" class="text-xs text-dimmed">
        {{ item.variants.length }} variantes
      </p>
    </div>
  </div>
</template>
