<script setup lang="ts">
import { ref } from 'vue'
import ProductSearchResults from './ProductSearchResults.vue'
import VariantPickerModal from './VariantPickerModal.vue'
import { useProductSearch } from '../composables/useProductSearch'
import type { PosCatalogItem } from '../interfaces/sale.types'

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'add-product': [productId: string, variantId: string | null]
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const { query, items, isLoading, isEmpty } = useProductSearch()

const variantModalOpen = ref(false)
const selectedItem = ref<PosCatalogItem | null>(null)

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleItemSelect(item: PosCatalogItem) {
  if (item.hasVariants) {
    selectedItem.value = item
    variantModalOpen.value = true
  } else {
    emit('add-product', item.id, null)
  }
}

function handleAddVariant(productId: string, variantId: string) {
  emit('add-product', productId, variantId)
  variantModalOpen.value = false
  selectedItem.value = null
}
</script>

<template>
  <div class="h-full flex flex-col bg-elevated/20">
    <!-- Header section (sticky) -->
    <div class="sticky top-0 z-10 bg-elevated/40 border-b border-default">
      <!-- Title -->
      <div class="px-4 py-4">
        <h2 class="text-lg font-semibold text-highlighted">
          Buscar productos
        </h2>
      </div>
      
      <!-- Search input -->
      <div class="px-4 pb-4">
        <UInput
          v-model="query"
          icon="i-lucide-search"
          placeholder="Buscar por nombre, SKU..."
          size="md"
        />
      </div>
    </div>

    <!-- Results -->
    <ProductSearchResults
      :items="items"
      :is-loading="isLoading"
      :is-empty="isEmpty"
      :has-query="query.length > 0"
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
