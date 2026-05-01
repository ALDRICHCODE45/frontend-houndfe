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
    <div v-if="isLoading && items.length === 0" class="p-3 space-y-2">
      <div v-for="i in 8" :key="i" class="flex items-center gap-3 px-3 py-3">
        <USkeleton class="h-11 w-11 rounded-lg shrink-0" />
        <div class="flex-1 space-y-2">
          <USkeleton class="h-3.5 w-3/4" />
          <USkeleton class="h-3 w-1/3" />
        </div>
        <USkeleton class="h-4 w-16" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="isEmpty" class="flex flex-col items-center justify-center py-20 px-4">
      <div class="rounded-2xl bg-elevated p-5 mb-4">
        <UIcon name="i-lucide-package-x" class="h-10 w-10 text-dimmed" />
      </div>
      <p class="text-sm font-semibold text-highlighted mb-1">
        Sin resultados
      </p>
      <p class="text-xs text-muted text-center max-w-xs">
        {{ hasQuery
          ? 'No encontramos productos habilitados para POS con ese término'
          : 'No hay productos disponibles en el catálogo POS'
        }}
      </p>
    </div>

    <!-- Results list -->
    <div v-else>
      <ProductSearchResultItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
