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
  <div class="overflow-y-auto flex-1 px-3 sm:px-5 py-3 sm:py-4 no-scrollbar">
    <!-- Cards sit directly on the page surface (no intermediary tint layer).
         no-scrollbar hides the native track that otherwise shows as an
         always-visible bar at the panel's right edge. Scroll still works
         via wheel/trackpad/keys. -->
    <!-- Loading state (card grid skeleton) -->
    <div
      v-if="isLoading && items.length === 0"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-4"
    >
      <div v-for="i in 8" :key="i" class="rounded-2xl border border-default bg-default overflow-hidden shadow-sm">
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
      <div class="rounded-2xl bg-elevated/70 border border-default p-5 mb-4">
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

    <!-- Results card grid — 2 cols mobile, 3 sm, 4 on md+ -->
    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-4"
    >
      <ProductSearchResultItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
/* Hide the native vertical scrollbar track — same convention as the
   horizontal chip rows (ProductSearchPanel .no-scrollbar). The catalog
   always overflows and the unstyled track shows as a white rectangle at
   the panel's right edge, right next to the cart card. */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
