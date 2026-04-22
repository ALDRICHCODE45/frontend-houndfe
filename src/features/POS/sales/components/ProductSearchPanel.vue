<script setup lang="ts">
import { ref } from 'vue'
import ProductSearchResults from './ProductSearchResults.vue'
import VariantPickerModal from './VariantPickerModal.vue'
import { useProductSearch } from '../composables/useProductSearch'
import type { SearchableProduct } from '../interfaces/sale.types'

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'add-product': [productId: string, variantId: string | null]
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const { query, results, isLoading, isEmpty } = useProductSearch()

const variantModalOpen = ref(false)
const selectedProduct = ref<SearchableProduct | null>(null)

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleProductSelect(product: SearchableProduct) {
  if (product.hasVariants) {
    selectedProduct.value = product
    variantModalOpen.value = true
  } else {
    emit('add-product', product.id, null)
  }
}

function handleAddVariant(productId: string, variantId: string) {
  emit('add-product', productId, variantId)
  variantModalOpen.value = false
  selectedProduct.value = null
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
      :results="results"
      :is-loading="isLoading"
      :is-empty="isEmpty"
      :has-query="query.length > 0"
      @select="handleProductSelect"
    />

    <!-- Variant picker modal -->
    <VariantPickerModal
      v-model:open="variantModalOpen"
      :product-id="selectedProduct?.id || null"
      :product-name="selectedProduct?.name || null"
      @add-variant="handleAddVariant"
    />
  </div>
</template>
