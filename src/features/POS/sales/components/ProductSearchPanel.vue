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

const { query, items, isLoading, isEmpty, hasQuery, categoryId, categories, totalUnfiltered } = useProductSearch()

const isMac = computed(() =>
  typeof globalThis.navigator !== 'undefined' && globalThis.navigator.platform?.includes('Mac'),
)

const variantModalOpen = ref(false)
const selectedItem = ref<PosCatalogItem | null>(null)

// ── Category filters ──────────────────────────────────────────────────────────

const activeCategory = ref<string | null>(null)

function handleCategoryClick(catId: string) {
  if (activeCategory.value === catId) {
    activeCategory.value = null
    categoryId.value = undefined
  } else {
    activeCategory.value = catId
    categoryId.value = catId
  }
}

function clearCategoryFilter() {
  activeCategory.value = null
  categoryId.value = undefined
}

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
  const variant = selectedItem.value?.variants.find((v) => v.id === variantId)
  const imageUrl = variant?.mainImage ?? selectedItem.value?.mainImage ?? null
  emit('add-product', productId, variantId, imageUrl)
  variantModalOpen.value = false
  selectedItem.value = null
}
</script>

<template>
  <div class="h-full flex flex-col bg-default">
    <!-- Header section (sticky) -->
    <div class="sticky top-0 z-10 bg-default/95 backdrop-blur supports-[backdrop-filter]:bg-default/80 border-b border-default">
      <div class="px-5 py-4 space-y-3.5">
        <!-- Search input (full width) -->
        <div class="flex items-center gap-3">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            placeholder="Buscar por nombre, SKU o código..."
            size="lg"
            class="flex-1"
            :ui="{ base: 'rounded-xl' }"
          />
          <div class="flex items-center gap-1 text-xs text-muted shrink-0">
            <UKbd>{{ isMac ? '⌘' : 'Ctrl' }}</UKbd>
            <UKbd>K</UKbd>
          </div>
        </div>

        <!-- Category filter chips (derived from unfiltered catalog) -->
        <div v-if="categories.length > 0" class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            :class="[
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer border',
              !activeCategory
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-elevated/50 text-muted border-default hover:bg-elevated hover:text-highlighted',
            ]"
            @click="clearCategoryFilter"
          >
            Todo
            <span
              :class="[
                'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md text-[10px] font-semibold tabular-nums',
                !activeCategory ? 'bg-white/20 text-white' : 'bg-default text-muted',
              ]"
            >
              {{ totalUnfiltered }}
            </span>
          </button>

          <button
            v-for="cat in categories"
            :key="cat.id"
            :class="[
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer border',
              activeCategory === cat.id
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-elevated/50 text-muted border-default hover:bg-elevated hover:text-highlighted',
            ]"
            @click="handleCategoryClick(cat.id)"
          >
            {{ cat.name }}
            <span
              :class="[
                'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md text-[10px] font-semibold tabular-nums',
                activeCategory === cat.id ? 'bg-white/20 text-white' : 'bg-default text-muted',
              ]"
            >
              {{ cat.count }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Results (card grid) -->
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

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
