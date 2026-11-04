<script setup lang="ts">
import EmptyState from '@/core/shared/components/EmptyState.vue'
import ProductSearchResultItem from './ProductSearchResultItem.vue'
import type { PosCatalogItem } from '../interfaces/sale.types'

// ── Props ─────────────────────────────────────────────────────────────────────

defineProps<{
  items: PosCatalogItem[]
  isLoading: boolean
  isEmpty: boolean
  hasQuery: boolean
  /** The catalog request failed; only shown while there is nothing to list. */
  isError?: boolean
  /** S12: Venta-only v0 card opt-in, forwarded to every result card. */
  composition?: boolean
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  select: [item: PosCatalogItem]
  'view-detail': [item: PosCatalogItem]
  retry: []
}>()
</script>

<template>
  <div class="overflow-y-auto flex-1 px-3 sm:px-5 py-3 sm:py-4 no-scrollbar sales-pos-results">
    <!-- Cards sit directly on the page surface (no intermediary tint layer).
         no-scrollbar hides the native track that otherwise shows as an
         always-visible bar at the panel's right edge. Scroll still works
         via wheel/trackpad/keys. -->
    <!-- Loading skeleton mirrors horizontal cards on mobile and vertical cards from sm. -->
    <div
      v-if="isLoading && items.length === 0"
      class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-4 sales-pos-product-grid"
    >
      <div v-for="i in 8" :key="i" class="rounded-2xl border border-default bg-default overflow-hidden shadow-sm flex sm:flex-col sales-pos-product-card">
        <USkeleton class="h-28 w-28 sm:h-32 sm:w-full shrink-0 sales-pos-product-media" />
        <div class="flex-1 min-w-0 px-3 py-2.5 space-y-1.5 sm:border-t sm:border-default/50">
          <USkeleton class="h-2.5 w-16" />
          <USkeleton class="h-3 w-full" />
          <USkeleton class="h-3.5 w-20 mt-1" />
          <USkeleton class="h-8 w-full mt-2 rounded-xl sm:hidden" />
        </div>
      </div>
    </div>

    <!-- Error: a failed request never reads as an empty catalog. -->
    <EmptyState
      v-else-if="isError && items.length === 0"
      kind="error"
      title="No se pudo cargar el catálogo"
      action-label="Reintentar"
      action-test-id="catalog-retry"
      data-testid="catalog-error-state"
      class="py-20 sales-pos-catalog-error"
      @action="emit('retry')"
    />

    <!-- Nothing yet, or nothing matches the search. -->
    <EmptyState
      v-else-if="isEmpty"
      :kind="hasQuery ? 'no-match' : 'empty'"
      :title="hasQuery ? 'Ningún resultado' : 'Aún no hay productos para vender'"
      :description="hasQuery ? 'No hay productos habilitados para POS con ese término' : 'Los productos habilitados para el punto de venta aparecen aquí.'"
      class="py-20 sales-pos-catalog-empty"
    />

    <!-- Results card grid — horizontal single-column cards on mobile. -->
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-4 sales-pos-product-grid"
    >
      <ProductSearchResultItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        :composition="composition"
        @select="emit('select', $event)"
        @view-detail="emit('view-detail', $event)"
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
