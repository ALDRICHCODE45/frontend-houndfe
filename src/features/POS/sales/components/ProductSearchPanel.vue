<script setup lang="ts">
import { ref, computed } from 'vue'
import ProductSearchResults from './ProductSearchResults.vue'
import VariantPickerModal from './VariantPickerModal.vue'
import { useProductSearch } from '../composables/useProductSearch'
import type { PosCatalogItem } from '../interfaces/sale.types'

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'add-product': [productId: string, variantId: string | null, imageUrl: string | null]
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const { query, items, isLoading, isEmpty, hasQuery } = useProductSearch()

const isMac = computed(() =>
  typeof globalThis.navigator !== 'undefined' && globalThis.navigator.platform?.includes('Mac'),
)

const variantModalOpen = ref(false)
const selectedItem = ref<PosCatalogItem | null>(null)

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleItemSelect(item: PosCatalogItem) {
  if (item.hasVariants) {
    selectedItem.value = item
    variantModalOpen.value = true
  } else {
    emit('add-product', item.id, null, item.mainImage)
  }
}

function handleAddVariant(productId: string, variantId: string) {
  // Find the selected variant to get its image
  const variant = selectedItem.value?.variants.find((v) => v.id === variantId)
  const imageUrl = variant?.mainImage ?? selectedItem.value?.mainImage ?? null
  emit('add-product', productId, variantId, imageUrl)
  variantModalOpen.value = false
  selectedItem.value = null
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header section (sticky) -->
    <div class="sticky top-0 z-10 bg-default border-b border-default">
      <div class="p-4 space-y-3">
        <!-- Title row -->
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-highlighted">
            Buscar productos
          </h2>
          <div class="flex items-center gap-1.5 text-xs text-muted">
            <UKbd>{{ isMac ? '⌘' : 'Ctrl' }}</UKbd>
            <UKbd>K</UKbd>
          </div>
        </div>

        <!-- Search input -->
        <UInput
          v-model="query"
          icon="i-lucide-search"
          placeholder="Buscar por nombre, SKU o código"
          size="lg"
          :ui="{ base: 'w-full' }"
        />
      </div>
    </div>

    <!-- Section label when browsing catalog -->
    <div v-if="!hasQuery && items.length > 0" class="px-4 pt-3 pb-1">
      <p class="text-xs font-medium text-muted uppercase tracking-wider">
        Productos recientes
      </p>
    </div>

    <!-- Results -->
    <ProductSearchResults
      :items="items"
      :is-loading="isLoading"
      :is-empty="isEmpty"
      :has-query="hasQuery"
      @select="handleItemSelect"
    />

    <!-- Variant picker modal -->
    <VariantPickerModal
      v-model:open="variantModalOpen"
      :product-id="selectedItem?.id || null"
      :product-name="selectedItem?.name || ''"
      :variants="selectedItem?.variants || []"
      @add-variant="handleAddVariant"
    />
  </div>
</template>
