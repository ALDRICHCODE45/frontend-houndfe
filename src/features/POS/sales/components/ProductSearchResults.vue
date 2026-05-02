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
  <div class="overflow-y-auto flex-1 px-5 py-4">
    <!-- Loading state (card grid skeleton) -->
    <div v-if="isLoading && items.length === 0" class="grid grid-cols-3 xl:grid-cols-4 gap-3">
      <div v-for="i in 8" :key="i" class="rounded-xl border border-default overflow-hidden">
        <USkeleton class="aspect-square w-full" />
        <div class="px-3 py-2.5 space-y-1.5 border-t border-default/50">
          <USkeleton class="h-2.5 w-16" />
          <USkeleton class="h-3 w-full" />
          <USkeleton class="h-3.5 w-20 mt-1" />
        </div>
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

    <!-- Results card grid -->
    <div v-else class="grid grid-cols-3 xl:grid-cols-4 gap-3">
      <ProductSearchResultItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
