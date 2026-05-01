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
    <div v-if="isLoading && items.length === 0" class="grid grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="rounded-xl border border-default overflow-hidden">
        <USkeleton class="h-36 w-full" />
        <div class="p-3 space-y-2">
          <USkeleton class="h-3 w-20" />
          <USkeleton class="h-3.5 w-3/4" />
          <div class="flex items-center justify-between pt-1">
            <USkeleton class="h-4 w-20" />
            <USkeleton class="h-6 w-16 rounded-md" />
          </div>
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
    <div v-else class="grid grid-cols-2 xl:grid-cols-3 gap-4">
      <ProductSearchResultItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
