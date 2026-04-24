<script setup lang="ts">
import ProductSearchResultItem from './ProductSearchResultItem.vue'
import type { PosCatalogItem } from '../interfaces/sale.types'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  items: PosCatalogItem[]
  isLoading: boolean
  isEmpty: boolean
  hasQuery: boolean
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  select: [item: PosCatalogItem]
}>()
</script>

<template>
  <div class="overflow-y-auto flex-1">
    <!-- Loading state -->
    <div v-if="isLoading" class="space-y-3 p-3">
      <USkeleton v-for="i in 6" :key="i" class="h-16 w-full rounded-lg" />
    </div>

    <!-- Idle state -->
    <div v-else-if="!hasQuery" class="flex flex-col items-center justify-center py-16 px-4">
      <div class="rounded-full bg-primary/10 p-5 mb-4">
        <UIcon name="i-lucide-search" class="h-10 w-10 text-primary/60" />
      </div>
      <p class="text-sm font-medium text-highlighted mb-1">
        Empezá a buscar
      </p>
      <p class="text-sm text-muted text-center max-w-xs">
        Escribí el nombre o SKU del producto que querés agregar
      </p>
    </div>

    <!-- Empty state -->
    <div v-else-if="isEmpty" class="flex flex-col items-center justify-center py-16 px-4">
      <div class="rounded-full bg-elevated p-5 mb-4">
        <UIcon name="i-lucide-package-x" class="h-10 w-10 text-dimmed" />
      </div>
      <p class="text-sm font-medium text-highlighted mb-1">
        Sin resultados
      </p>
      <p class="text-sm text-muted text-center max-w-xs">
        No encontramos productos habilitados para POS con ese término
      </p>
    </div>

    <!-- Results list -->
    <div v-else class="py-2">
      <ProductSearchResultItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
