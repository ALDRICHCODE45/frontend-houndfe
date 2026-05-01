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

const { query, items, isLoading, isEmpty, hasQuery, categoryId } = useProductSearch()

const isMac = computed(() =>
  typeof globalThis.navigator !== 'undefined' && globalThis.navigator.platform?.includes('Mac'),
)

const variantModalOpen = ref(false)
const selectedItem = ref<PosCatalogItem | null>(null)

// ── Category filters (derived from current items) ─────────────────────────────

const activeCategory = ref<string | null>(null)

const categoryChips = computed(() => {
  // Build unique categories from the loaded items
  const catMap = new Map<string, { id: string; name: string; count: number }>()
  for (const item of items.value) {
    if (item.category) {
      const existing = catMap.get(item.category.id)
      if (existing) {
        existing.count++
      } else {
        catMap.set(item.category.id, { id: item.category.id, name: item.category.name, count: 1 })
      }
    }
  }
  return Array.from(catMap.values()).sort((a, b) => b.count - a.count)
})

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
      <div class="px-5 py-4 space-y-3">
        <!-- Search input (full width) -->
        <div class="flex items-center gap-3">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            placeholder="Buscar por nombre, SKU o código..."
            size="lg"
            class="flex-1"
          />
          <div class="flex items-center gap-1 text-xs text-muted shrink-0">
            <UKbd>{{ isMac ? '⌘' : 'Ctrl' }}</UKbd>
            <UKbd>K</UKbd>
          </div>
        </div>

        <!-- Category filter chips -->
        <div v-if="categoryChips.length > 0" class="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer',
              !activeCategory
                ? 'bg-primary text-white'
                : 'bg-elevated text-muted hover:bg-elevated/80 hover:text-highlighted',
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
              {{ items.length }}
            </span>
          </button>

          <button
            v-for="cat in categoryChips"
            :key="cat.id"
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer',
              activeCategory === cat.id
                ? 'bg-primary text-white'
                : 'bg-elevated text-muted hover:bg-elevated/80 hover:text-highlighted',
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
