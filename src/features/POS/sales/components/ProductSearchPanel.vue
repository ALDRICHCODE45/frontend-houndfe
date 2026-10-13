<script setup lang="ts">
import { hasSalesEntryToken } from '../utils/salesEntryPortal'
import { ref, computed } from 'vue'
import ProductSearchResults from './ProductSearchResults.vue'
import VariantPickerModal from './VariantPickerModal.vue'
import ProductDetailModal from './ProductDetailModal.vue'
import { useProductSearch } from '../composables/useProductSearch'
import type { PosCatalogItem } from '../interfaces/sale.types'

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'add-product': [productId: string, variantId: string | null, imageUrl: string | null]
}>()

/**
 * Optional teleport boundary marker forwarded to the nested variant modal,
 * which owns the real popup root. Absent by default, so existing consumers
 * keep their original presentation and behavior.
 */
const props = defineProps<{
  portalClass?: string
}>()

// S8 (fidelity): the exact `sales-entry-portal` token is the sale-only opt-in.
// Quotations (and every other consumer) render the panel without it, so the
// new catalog title row, the search label and the controls surface never
// appear outside the Venta workspace.
const isSaleWorkspace = computed(
  () => hasSalesEntryToken(props.portalClass),
)

// ── State ─────────────────────────────────────────────────────────────────────

const { query, items, isLoading, isEmpty, hasQuery, categoryId, categories, totalUnfiltered } = useProductSearch()

// Real catalog count already exposed by the composable — the title row never
// invents a prototype literal or a second query.
const productCountLabel = computed(
  () => `${totalUnfiltered.value} ${totalUnfiltered.value === 1 ? 'producto' : 'productos'}`,
)

const isMac = computed(() =>
  typeof globalThis.navigator !== 'undefined' && globalThis.navigator.platform?.includes('Mac'),
)

const variantModalOpen = ref(false)
const selectedItem = ref<PosCatalogItem | null>(null)

// S12: Venta cards open the existing product detail from their image/name.
const detailOpen = ref(false)
const detailProductId = ref<string | null>(null)

function handleViewDetail(item: PosCatalogItem) {
  detailProductId.value = item.id
  detailOpen.value = true
}

// 14a.1 (sales-screen-redesign — R6): template ref + expose so SalesView's
// global Ctrl+K / ⌘K handler can request focus on the search input.
const searchInputRef = ref<HTMLInputElement | { focus: () => void } | null>(null)
defineExpose({ searchInputRef })

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
  <div class="h-full flex flex-col">
    <!-- Header section (sticky) -->
    <div
      class="sticky top-0 z-10 bg-(--light-surface-page)/80 dark:bg-coco-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-(--light-surface-page)/70 dark:supports-[backdrop-filter]:bg-coco-neutral-950/70 border-b border-default sales-pos-catalog-controls-surface"
    >
      <div class="px-5 py-4 space-y-3.5 sales-pos-catalog-controls">
        <!-- S8 (fidelity): the accepted v0 controls title row. Sale opt-in only. -->
        <div v-if="isSaleWorkspace" class="flex items-baseline justify-between gap-3">
          <h2 class="text-sm font-semibold text-highlighted sales-pos-catalog-title">
            Catálogo de productos
          </h2>
          <span class="text-xs text-muted tabular-nums sales-pos-catalog-count">
            {{ productCountLabel }}
          </span>
        </div>
        <label
          v-if="isSaleWorkspace"
          for="sales-pos-product-search"
          class="block text-xs text-muted sales-pos-catalog-search-label"
        >
          Buscar producto
        </label>
        <!-- Search input (full width) -->
        <div class="flex items-center gap-3">
          <UInput
            :id="isSaleWorkspace ? 'sales-pos-product-search' : undefined"
            ref="searchInputRef"
            v-model="query"
            icon="i-lucide-search"
            placeholder="Buscar por nombre, SKU o código de barras..."
            size="lg"
            class="flex-1 sales-pos-catalog-search"
            :ui="{ base: 'rounded-xl' }"
          />
          <div class="flex items-center gap-1 text-xs text-muted shrink-0">
            <UKbd>{{ isMac ? '⌘' : 'Ctrl' }}</UKbd>
            <UKbd>K</UKbd>
          </div>
        </div>

        <!-- Category filter chips (derived from unfiltered catalog) -->
        <div
          v-if="categories.length > 0"
          class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 sales-pos-categories"
        >
          <button
            :class="[
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer border',
              !activeCategory
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-elevated/50 text-muted border-default hover:bg-elevated hover:text-highlighted',
            ]"
            data-testid="category-chip-todo"
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
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer border',
              activeCategory === cat.id
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-elevated/50 text-muted border-default hover:bg-elevated hover:text-highlighted',
            ]"
            :data-testid="`category-chip-${cat.id}`"
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
      :composition="isSaleWorkspace"
      @select="handleItemSelect"
      @view-detail="handleViewDetail"
    />

    <!-- S12: catalog product detail (Venta opt-in only). -->
    <ProductDetailModal
      v-if="isSaleWorkspace && detailProductId"
      v-model:open="detailOpen"
      :product-id="detailProductId"
      :variant-id="null"
      :portal-class="portalClass"
    />

    <!-- Variant picker modal -->
    <VariantPickerModal
      v-model:open="variantModalOpen"
      :product-id="selectedItem?.id || null"
      :product-name="selectedItem?.name || ''"
      :variants="selectedItem?.variants || []"
      :portal-class="portalClass"
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
