<script setup lang="ts">
/**
 * VariantsPanel — accordion of products for VARIANTS target selection.
 *
 * Behaviors (REQ-4 + REQ-5):
 *   - Product list = getPaginated({ globalFilter }) for SERVER search.
 *   - Client-side hasVariants filter strips products with no variants.
 *   - Per-row expand fires a lazy getVariants(productId) (owned by the row).
 *   - Per-row "Seleccionar todas" awaits fetch via ensureQueryData and
 *     stages every variant id, showing a spinner in-flight.
 *   - Variants from multiple products coexist in the staged array.
 *   - Chip label "{productName} · {name}", fallback to name or targetId.
 *
 * Contract with parent (PromotionTargetSelectionModal):
 *   - props: staged (current entries, may include variants from any product)
 *   - emits: update:staged (full new array — modal re-seeds from latest)
 */
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import VariantAccordionRow from './VariantAccordionRow.vue'
import type { PromotionTargetItemFormEntry } from '../../interfaces/promotion.types'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  staged: PromotionTargetItemFormEntry[]
}>()

const emit = defineEmits<{
  'update:staged': [items: PromotionTargetItemFormEntry[]]
}>()

// ── Search state (debounced, matches FlatChecklistPanel convention) ───────────

const search = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const debouncedSearch = ref('')

watch(search, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = value
  }, 200)
})

// ── Products query (server-side search via getPaginated) ─────────────────────

const { data: products } = useQuery({
  queryKey: computed(
    () => ['promotions', 'variants-products', debouncedSearch.value] as const,
  ),
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    const result = await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 20,
      sorting: [{ id: 'name', desc: false }],
      globalFilter: debouncedSearch.value || undefined,
    })
    return result.data ?? []
  },
})

// ── Client-side hasVariants filter (REQ-4) ───────────────────────────────────
// The /products endpoint does NOT accept `hasVariants` as a query param
// (whitelist = page/limit/search/q), so we filter locally — same pattern the
// pre-VariantsPanel picker used.

const filteredProducts = computed(() => {
  return (products.value ?? []).filter((p) => p.hasVariants === true)
})

// ── Staged helpers ───────────────────────────────────────────────────────────

function stagedIdsSet(): Set<string> {
  return new Set(props.staged.map((s) => s.targetId))
}

function onToggleVariant(entry: PromotionTargetItemFormEntry) {
  // Toggle: if already staged, remove; otherwise add.
  const ids = stagedIdsSet()
  if (ids.has(entry.targetId)) {
    emit(
      'update:staged',
      props.staged.filter((s) => s.targetId !== entry.targetId),
    )
    return
  }
  emit('update:staged', [...props.staged, entry])
}

function onSelectAllStaged(newEntries: PromotionTargetItemFormEntry[]) {
  // Merge (de-duped by row side, but row already filtered against current staged).
  emit('update:staged', [...props.staged, ...newEntries])
}

function removeChip(variantId: string) {
  emit(
    'update:staged',
    props.staged.filter((s) => s.targetId !== variantId),
  )
}

function chipLabel(item: PromotionTargetItemFormEntry): string {
  if (item.productName && item.name) return `${item.productName} · ${item.name}`
  return item.name || item.targetId
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="variants-panel">
    <!-- Search input — debounced 200ms to match the rest of the app -->
    <UInput
      v-model="search"
      placeholder="Buscar productos con variantes..."
      leading-icon="i-lucide-search"
      data-testid="variants-search"
    />

    <!-- Empty state when no products with variants -->
    <p
      v-if="filteredProducts.length === 0"
      class="text-sm text-muted italic"
      data-testid="variants-empty-list"
    >
      No hay productos con variantes disponibles.
    </p>

    <!-- Product accordion -->
    <div v-else class="flex flex-col gap-2">
      <VariantAccordionRow
        v-for="product in filteredProducts"
        :key="product.id"
        :product-id="product.id"
        :product-name="product.name"
        :staged="staged"
        @toggle-variant="onToggleVariant"
        @select-all-staged="onSelectAllStaged"
      />
    </div>

    <!-- Staged chips (all products) -->
    <div
      v-if="staged.length > 0"
      data-testid="selected-items"
      class="flex flex-wrap gap-2"
    >
      <AppBadge v-for="item in staged" :key="item.targetId">
        {{ chipLabel(item) }}
        <button
          type="button"
          data-testid="remove-chip"
          class="ml-1 cursor-pointer rounded-full transition-colors hover:bg-elevated"
          @click="removeChip(item.targetId)"
        >
          <UIcon name="i-lucide-x" class="h-3 w-3" />
        </button>
      </AppBadge>
    </div>
  </div>
</template>