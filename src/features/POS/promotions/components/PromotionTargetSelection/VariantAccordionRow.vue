<script setup lang="ts">
/**
 * VariantAccordionRow — internal child of VariantsPanel.
 *
 * Owns ONE product's expand state and its variants query. The parent owns
 * the product list, the search input, and the staged chip list.
 *
 * Why a child component? `useQuery` is a hook and cannot be called inside
 * a v-for. Each row needs its own observer bound to a `productId`-keyed
 * query, so we isolate it here. The lazy-load contract is `enabled: isExpanded`
 * — `getVariants` does not fire until the user expands the row.
 *
 * Select-all uses `queryClient.ensureQueryData` so it works even when the
 * row is not yet expanded (per design decision Q-c). `ensureQueryData`
 * ignores `enabled: false` because it bypasses the observer; the data
 * it caches will then be visible to the observer when the row expands.
 */
import { computed, ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type { ProductVariant } from '@/features/POS/products/interfaces/product.types'
import type { PromotionTargetItemFormEntry } from '../../interfaces/promotion.types'

const props = defineProps<{
  productId: string
  productName: string
  staged: PromotionTargetItemFormEntry[]
}>()

const emit = defineEmits<{
  /** Forward a single variant toggle to the parent (toggle on/off by id). */
  toggleVariant: [entry: PromotionTargetItemFormEntry]
  /** Stage every variant of this product in one go (de-duped vs current staged). */
  'select-all-staged': [entries: PromotionTargetItemFormEntry[]]
}>()

// ── Accordion state ───────────────────────────────────────────────────────────

const isExpanded = ref(false)
const isSelectingAll = ref(false)
const queryClient = useQueryClient()

// ── Lazy variants query (REQ-4 — fires ONLY on expand) ────────────────────────

const { data: variants, isFetching: isFetchingVariants } = useQuery({
  queryKey: computed(() => ['promotions', 'variants-by-product', props.productId] as const),
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    return productApi.getVariants(props.productId)
  },
  enabled: computed(() => isExpanded.value),
  staleTime: 60_000,
})

// ── Handlers ─────────────────────────────────────────────────────────────────

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function isStaged(variantId: string): boolean {
  return props.staged.some((s) => s.targetId === variantId)
}

function onToggleVariant(variant: ProductVariant) {
  emit('toggleVariant', {
    targetId: variant.id,
    name: variant.name,
    productId: props.productId,
    productName: props.productName,
  })
}

async function onSelectAll() {
  if (isSelectingAll.value) return
  isSelectingAll.value = true
  try {
    // ensureQueryData bypasses the observer's `enabled` flag, so select-all
    // works even before the row is expanded. The fetched data is cached
    // under the same queryKey the observer uses, so expanding later will
    // render the variants immediately.
    const result = await queryClient.ensureQueryData({
      queryKey: ['promotions', 'variants-by-product', props.productId] as const,
      queryFn: async () => {
        const { productApi } = await import('@/features/POS/products/api/product.api')
        return productApi.getVariants(props.productId)
      },
      staleTime: 60_000,
    })
    const stagedIds = new Set(props.staged.map((s) => s.targetId))
    const newEntries: PromotionTargetItemFormEntry[] = result
      .filter((v: ProductVariant) => !stagedIds.has(v.id))
      .map((v: ProductVariant) => ({
        targetId: v.id,
        name: v.name,
        productId: props.productId,
        productName: props.productName,
      }))
    if (newEntries.length > 0) {
      emit('select-all-staged', newEntries)
    }
  } finally {
    isSelectingAll.value = false
  }
}
</script>

<template>
  <div
    class="flex flex-col gap-1"
    :data-testid="`product-row-${productId}`"
    :data-product-id="productId"
  >
    <!-- Header row: product name (toggle) + select-all -->
    <div
      class="flex items-center justify-between gap-2 rounded-lg border border-default bg-default px-3 py-2"
    >
      <button
        type="button"
        class="flex flex-1 cursor-pointer items-center gap-2 text-left text-sm font-medium"
        :data-testid="`product-toggle-${productId}`"
        @click="toggleExpand"
      >
        <UIcon
          :name="isExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="h-4 w-4 text-dimmed"
        />
        <span>{{ productName }}</span>
      </button>
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline disabled:opacity-60"
        :data-testid="`select-all-${productId}`"
        :disabled="isSelectingAll"
        @click="onSelectAll"
      >
        <span
          v-if="isSelectingAll"
          data-testid="select-all-spinner"
          class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        Seleccionar todas
      </button>
    </div>

    <!-- Expanded: variants list (lazy) -->
    <div
      v-if="isExpanded"
      class="ml-3 mt-1 flex flex-col gap-1"
      :data-testid="`variants-list-${productId}`"
    >
      <p
        v-if="isFetchingVariants"
        class="text-sm text-muted italic"
        data-testid="variants-loading"
      >
        Cargando variantes...
      </p>
      <div
        v-else-if="variants && variants.length > 0"
        class="rounded-lg border border-default bg-default max-h-48 overflow-y-auto"
      >
        <div
          v-for="variant in variants"
          :key="variant.id"
          class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-elevated/60 transition-colors duration-150"
          :data-testid="`variant-row-${productId}`"
          :data-variant-id="variant.id"
        >
          <UCheckbox
            :model-value="isStaged(variant.id)"
            :aria-label="variant.name"
            @update:model-value="() => onToggleVariant(variant)"
          />
          <button
            type="button"
            class="flex-1 cursor-pointer text-left"
            :data-testid="`variant-row-button-${productId}`"
            @click="onToggleVariant(variant)"
          >
            {{ variant.name }}
          </button>
        </div>
      </div>
      <p
        v-else
        class="text-sm text-muted italic"
        data-testid="variants-empty"
      >
        Este producto no tiene variantes disponibles.
      </p>
    </div>
  </div>
</template>