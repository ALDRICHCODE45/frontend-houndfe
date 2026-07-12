<script setup lang="ts">
import { computed, ref } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import PromotionTargetSelectionModal from './PromotionTargetSelection/PromotionTargetSelectionModal.vue'
import ProductVariantSelector from './ProductVariantSelector.vue'
import type {
  PromotionTargetItemFormEntry,
  PromotionTargetType,
} from '../interfaces/promotion.types'
import { TARGET_TYPE_OPTIONS } from '../composables/usePromotionForm'
import { chipLabel } from '../utils/promotionChipLabel'

// ── Props & emits (INV-4 — FROZEN external contract) ─────────────────────────

const props = withDefaults(
  defineProps<{
    targetType: PromotionTargetType
    selectedItems: PromotionTargetItemFormEntry[]
    side?: 'DEFAULT' | 'BUY' | 'GET'
    label?: string
    // REQ-1: VARIANTS is only allowed for PRODUCT_DISCOUNT. The parent must
    // opt in explicitly; the default hides VARIANTS so the BUY_X_GET_Y /
    // ADVANCED instances don't need to know about promotion-type semantics.
    allowVariants?: boolean
  }>(),
  {
    side: 'DEFAULT',
    label: undefined,
    allowVariants: false,
  },
)

const emit = defineEmits<{
  'update:targetType': [type: PromotionTargetType]
  'update:selectedItems': [items: PromotionTargetItemFormEntry[]]
}>()

// ── Modal state (Slice 1: flat types only) ───────────────────────────────────
// Slice 2 routes VARIANTS through the same modal. Until then, VARIANTS still
// uses the inline ProductVariantSelector (build-safety).

const modalOpen = ref(false)

const targetTypeOptions = computed(() =>
  props.allowVariants
    ? TARGET_TYPE_OPTIONS
    : TARGET_TYPE_OPTIONS.filter((o) => o.value !== 'VARIANTS'),
)

const showFlatModalButton = computed(
  () =>
    props.targetType === 'CATEGORIES' ||
    props.targetType === 'BRANDS' ||
    props.targetType === 'PRODUCTS',
)

// ── Handlers ─────────────────────────────────────────────────────────────────

function onTargetTypeChange(type: PromotionTargetType) {
  emit('update:targetType', type)
  emit('update:selectedItems', [])
}

function openModal() {
  modalOpen.value = true
}

function onModalConfirm(items: PromotionTargetItemFormEntry[]) {
  // Merge: existing chips + confirmed new items. The modal already dedupes
  // its staged set against itself; we additionally dedupe against the
  // existing selectedItems so a confirmed chip that was already in the form
  // doesn't produce a duplicate.
  const existingIds = new Set(props.selectedItems.map((s) => s.targetId))
  const merged = [
    ...props.selectedItems,
    ...items.filter((entry) => !existingIds.has(entry.targetId)),
  ]
  emit('update:selectedItems', merged)
}

function removeItem(id: string) {
  emit(
    'update:selectedItems',
    props.selectedItems.filter((i) => i.targetId !== id),
  )
}

// ── Empty state text ─────────────────────────────────────────────────────────

const emptyStateLabel = computed(() => {
  const typeMap: Record<PromotionTargetType, string> = {
    CATEGORIES: 'categorías',
    BRANDS: 'marcas',
    PRODUCTS: 'productos',
    VARIANTS: 'variantes',
  }
  const noun = typeMap[props.targetType]
  return `Elige los ${noun} a los que aplicará la promoción`
})

defineExpose({ openModal, removeItem, onTargetTypeChange, onModalConfirm })
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Optional label -->
    <p v-if="label" class="text-sm font-medium text-toned">
      {{ label }}
    </p>

    <!-- Target type radio group (unchanged contract) -->
    <URadioGroup
      :model-value="targetType"
      :items="targetTypeOptions"
      value-key="value"
      label-key="label"
      orientation="horizontal"
      @update:model-value="onTargetTypeChange($event as PromotionTargetType)"
    />

    <!-- Flat types: "Agregar..." button → modal -->
    <div v-if="showFlatModalButton" class="flex items-center gap-2">
      <UButton
        color="primary"
        variant="solid"
        data-testid="open-target-modal"
        @click="openModal"
      >
        Agregar...
      </UButton>
    </div>

    <!-- VARIANTS: keep the existing two-step inline picker (build-safety).
         Slice 2 introduces VariantsPanel and retires this path. -->
    <ProductVariantSelector
      v-else-if="targetType === 'VARIANTS'"
      :selected-items="selectedItems"
      data-testid="variant-selector"
      @update:selected-items="(items) => emit('update:selectedItems', items)"
    />

    <!-- Selected items chips (all four types) -->
    <div
      v-if="selectedItems.length > 0"
      data-testid="selected-items"
      class="flex flex-wrap gap-2"
    >
      <AppBadge
        v-for="item in selectedItems"
        :key="item.targetId"
      >
        {{ chipLabel(item, targetType) }}
        <button
          type="button"
          data-testid="remove-chip"
          class="cursor-pointer ml-1 rounded-full hover:bg-elevated transition-colors"
          @click="removeItem(item.targetId)"
        >
          <UIcon name="i-lucide-x" class="h-3 w-3" />
        </button>
      </AppBadge>
    </div>

    <!-- Empty state -->
    <p
      v-if="selectedItems.length === 0"
      data-testid="empty-state"
      class="text-sm text-muted italic"
    >
      {{ emptyStateLabel }}
    </p>

    <!-- Transactional selection modal (flat types only in Slice 1) -->
    <PromotionTargetSelectionModal
      :open="modalOpen"
      :type="targetType"
      :selected-items="selectedItems"
      :allow-variants="allowVariants"
      @update:open="(v: boolean) => (modalOpen = v)"
      @confirm="onModalConfirm"
    />
  </div>
</template>
