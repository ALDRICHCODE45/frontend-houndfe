<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import type { PromotionTargetItemFormEntry } from '../interfaces/promotion.types'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  selectedItems: PromotionTargetItemFormEntry[]
}>()

const emit = defineEmits<{
  'update:selectedItems': [items: PromotionTargetItemFormEntry[]]
}>()

// ── Local state ───────────────────────────────────────────────────────────────

const searchQuery = ref('')
const pickedProductId = ref<string | null>(null)
const pickedProductName = ref<string | null>(null)

// ── Products query (client-side hasVariants filter, per design) ───────────────
//
// The /products endpoint does NOT accept `hasVariants` as a query param
// (whitelist = page/limit/search/q). We fetch the page once and filter
// locally — keeps the call signature compatible with the rest of the app.
const { data: allProducts } = useQuery({
  queryKey: ['promotions', 'products-for-variant-targeting'],
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    const result = await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 20,
      sorting: [{ id: 'name', desc: false }],
    })
    return result.data ?? []
  },
})

const filteredProducts = computed(() => {
  const rows = allProducts.value ?? []
  // Client-side hasVariants filter (REQ-3).
  const withVariants = rows.filter((p) => p.hasVariants === true)
  if (!searchQuery.value) return withVariants
  const q = searchQuery.value.toLowerCase().trim()
  return withVariants.filter((p) => p.name.toLowerCase().includes(q))
})

// ── Variants query (per picked product) ───────────────────────────────────────

const { data: variants, isFetching: isFetchingVariants } = useQuery({
  queryKey: computed(() => ['promotions', 'variants-by-product', pickedProductId.value] as const),
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    if (!pickedProductId.value) return []
    return productApi.getVariants(pickedProductId.value)
  },
  enabled: computed(() => pickedProductId.value !== null),
  staleTime: 60_000,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickProduct(productId: string, productName: string) {
  pickedProductId.value = productId
  pickedProductName.value = productName
  searchQuery.value = ''
}

function clearPickedProduct() {
  pickedProductId.value = null
  pickedProductName.value = null
}

function addVariant(variantId: string, variantName: string) {
  // De-dupe by variant id (targetId).
  if (props.selectedItems.some((i) => i.targetId === variantId)) return
  if (!pickedProductId.value || !pickedProductName.value) return
  emit('update:selectedItems', [
    ...props.selectedItems,
    {
      targetId: variantId,
      name: variantName,
      productId: pickedProductId.value,
      productName: pickedProductName.value,
    },
  ])
  // Collapse the variant list — user likely wants to pick from another product.
  clearPickedProduct()
}

function removeVariant(variantId: string) {
  emit(
    'update:selectedItems',
    props.selectedItems.filter((i) => i.targetId !== variantId),
  )
}

function chipLabel(item: PromotionTargetItemFormEntry): string {
  if (item.productName && item.name) return `${item.productName} · ${item.name}`
  return item.name || item.targetId
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- ── Product step (search → pick) ────────────────────────────────────── -->
    <UInput
      v-if="!pickedProductId"
      v-model="searchQuery"
      placeholder="Buscar productos con variantes..."
      leading-icon="i-lucide-search"
      data-testid="variant-product-search"
    />

    <div
      v-if="!pickedProductId && filteredProducts.length > 0"
      class="rounded-lg border border-default bg-default max-h-48 overflow-y-auto"
    >
      <button
        v-for="product in filteredProducts"
        :key="product.id"
        type="button"
        data-testid="product-row"
        class="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-elevated/60 transition-colors duration-150"
        @click="pickProduct(product.id, product.name)"
      >
        <span>{{ product.name }}</span>
        <UIcon name="i-lucide-chevron-right" class="h-4 w-4 text-dimmed" />
      </button>
    </div>

    <p
      v-if="!pickedProductId && filteredProducts.length === 0"
      class="text-sm text-muted italic"
    >
      No hay productos con variantes disponibles.
    </p>

    <!-- ── Variant step (selected product + its variants) ──────────────────── -->
    <div v-if="pickedProductId" class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium text-toned">
          {{ pickedProductName }}
        </p>
        <button
          type="button"
          class="text-xs text-primary hover:underline cursor-pointer"
          data-testid="change-product"
          @click="clearPickedProduct"
        >
          Cambiar producto
        </button>
      </div>

      <div
        v-if="isFetchingVariants"
        class="text-sm text-muted italic"
        data-testid="variants-loading"
      >
        Cargando variantes...
      </div>

      <div
        v-else-if="variants && variants.length > 0"
        class="rounded-lg border border-default bg-default max-h-48 overflow-y-auto"
      >
        <button
          v-for="variant in variants"
          :key="variant.id"
          type="button"
          data-testid="variant-row"
          class="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-elevated/60 transition-colors duration-150"
          @click="addVariant(variant.id, variant.name)"
        >
          <span>{{ variant.name }}</span>
          <UIcon name="i-lucide-plus" class="h-4 w-4 text-dimmed" />
        </button>
      </div>

      <p
        v-else
        class="text-sm text-muted italic"
        data-testid="variants-empty"
      >
        Este producto no tiene variantes disponibles.
      </p>
    </div>

    <!-- ── Selected chips (compact, semantic) ──────────────────────────────── -->
    <div
      v-if="selectedItems.length > 0"
      data-testid="variant-selected-items"
      class="flex flex-wrap gap-2"
    >
      <AppBadge v-for="item in selectedItems" :key="item.targetId">
        {{ chipLabel(item) }}
        <button
          type="button"
          data-testid="remove-chip"
          class="cursor-pointer ml-1 rounded-full hover:bg-elevated transition-colors"
          @click="removeVariant(item.targetId)"
        >
          <UIcon name="i-lucide-x" class="h-3 w-3" />
        </button>
      </AppBadge>
    </div>

    <!-- ── Empty state — neutral Spanish ───────────────────────────────────── -->
    <p
      v-if="selectedItems.length === 0 && !pickedProductId"
      data-testid="variant-empty-state"
      class="text-sm text-muted italic"
    >
      Elegí un producto para ver sus variantes
    </p>
  </div>
</template>
