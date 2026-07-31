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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    class="group rounded-2xl border border-default bg-elevated overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-md dark:hover:shadow-none transition-all duration-200 flex flex-col"
    @click="emit('select', item)"
  >
    <!-- Image area (aspect-square, hero image fills the space) -->
    <div
      class="relative aspect-square w-full flex items-center justify-center overflow-hidden bg-linear-to-br from-elevated to-default"
    >
      <UIcon
        v-if="!item.mainImage || imageError"
        name="i-lucide-package"
        class="h-10 w-10 text-primary/25"
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

      <!-- 14a.2 (sales-screen-redesign — R7): stock badge reads `#N` (e.g.
           `#11`) and is gated on BOTH `useStock === true` AND `stock != null`.
           Old `N u` format is replaced; the unit suffix is implied by the
           #N convention used across the catalog UI. -->
      <span
        v-if="item.useStock && item.stock != null"
        :class="[
          'absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
          isLowStock(item)
            ? 'bg-(--brand-danger)/15 text-(--brand-danger)'
            : 'bg-default/80 text-muted',
        ]"
        data-testid="stock-badge"
      >
        #{{ item.stock.quantity }}
      </span>
    </div>

    <!-- Card body -->
    <div class="px-3 py-3 space-y-1.5 border-t border-default/50">
      <!-- Brand -->
      <p v-if="item.brand" class="text-[10px] text-dimmed uppercase tracking-wider font-medium truncate">
        {{ item.brand.name }}
      </p>
      <p v-else-if="item.sku" class="text-[11px] text-muted uppercase tracking-wider font-medium truncate" data-testid="sku-subtitle">
        {{ item.sku }}
      </p>

      <!-- Product name -->
      <p class="text-[13px] font-medium text-highlighted leading-snug line-clamp-2">
        {{ item.name }}
      </p>

      <!-- Price row + action -->
      <div class="flex items-center justify-between pt-1">
        <div>
          <p v-if="item.price" class="text-sm font-bold text-(--brand-accent) tabular-nums">
            {{ formatPrice(item.price.priceDecimal) }}
          </p>
          <p v-else class="text-xs text-toned flex items-center gap-0.5">
            Ver variantes
            <UIcon name="i-lucide-chevron-right" class="h-3 w-3" data-testid="chevron-icon" />
          </p>
        </div>

        <!-- "Agregar" badge: visible by default on touch, hover-revealed on pointer devices -->
        <span
          class="text-xs font-semibold text-primary flex items-center gap-0.5
                 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150"
        >
          <UIcon name="i-lucide-plus" class="h-3 w-3" />
          Agregar
        </span>
      </div>

      <!-- Variant count badge -->
      <p v-if="item.hasVariants && item.variants.length > 0" class="text-[11px] text-(--brand-primary) font-medium">
        {{ item.variants.length }} variantes
      </p>
    </div>
  </div>
</template>
