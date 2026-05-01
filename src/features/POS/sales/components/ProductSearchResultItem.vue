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
    class="flex items-center gap-3 mx-3 my-1 px-3 py-2.5 rounded-lg hover:bg-elevated/50 cursor-pointer transition-colors duration-150"
    @click="emit('select', item)"
  >
    <!-- Image or styled placeholder -->
    <div
      class="h-11 w-11 shrink-0 rounded-lg flex items-center justify-center overflow-hidden"
      :class="!item.mainImage || imageError ? 'bg-primary/8 border border-primary/15' : 'bg-elevated border border-default'"
    >
      <UIcon
        v-if="!item.mainImage || imageError"
        name="i-lucide-package"
        class="h-5 w-5 text-primary/60"
        data-testid="placeholder-icon"
      />
      <img
        v-else
        :src="item.mainImage"
        :alt="item.name"
        class="h-full w-full object-cover"
        loading="lazy"
        @error="handleImageError"
      />
    </div>

    <!-- Product info -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-highlighted truncate">
        {{ item.name }}
      </p>
      <div class="flex items-center gap-1.5 mt-0.5">
        <span v-if="item.brand" class="text-xs text-muted uppercase tracking-wide">
          {{ item.brand.name }}
        </span>
        <span v-else-if="item.sku" class="text-xs text-muted" data-testid="sku-subtitle">
          {{ item.sku }}
        </span>
        <span v-if="(item.brand || item.sku) && item.price" class="text-xs text-dimmed">&middot;</span>
        <span v-if="item.price" class="text-xs text-toned font-medium">
          {{ formatPrice(item.price.priceDecimal) }}
        </span>
        <span v-else class="text-xs text-toned flex items-center gap-0.5">
          Ver variantes
          <UIcon name="i-lucide-chevron-right" class="h-3 w-3" data-testid="chevron-icon" />
        </span>
      </div>
    </div>

    <!-- Price (right-aligned, prominent) -->
    <div class="shrink-0 text-right">
      <p v-if="item.price" class="text-sm font-semibold text-highlighted">
        {{ formatPrice(item.price.priceDecimal) }}
      </p>
      <p v-if="item.hasVariants && item.variants.length > 0" class="text-[11px] text-muted mt-0.5">
        {{ item.variants.length }} variantes
      </p>
    </div>
  </div>
</template>
