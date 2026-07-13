<script setup lang="ts">
import { computed, ref } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import PromotionTargetSelectionModal from './PromotionTargetSelection/PromotionTargetSelectionModal.vue'
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

// ── Target type card metadata (Slice 1.5 visual polish) ─────────────────────
// Icon map is LOCAL to the section so we don't mutate the shared
// TARGET_TYPE_OPTIONS shape (a unit test asserts it stays {label,value}[]).
// Icons chosen to match the project's existing i-lucide-* conventions and
// verified against icon usage elsewhere in the codebase (see the visual-
// polish commit message for the source mappings).
const TARGET_TYPE_CARDS: Record<PromotionTargetType, { icon: string; noun: string }> = {
  CATEGORIES: { icon: 'i-lucide-layout-grid', noun: 'categorías' },
  BRANDS: { icon: 'i-lucide-tag', noun: 'marcas' },
  PRODUCTS: { icon: 'i-lucide-package', noun: 'productos' },
  VARIANTS: { icon: 'i-lucide-git-branch', noun: 'variantes' },
}

// ── Modal state ───────────────────────────────────────────────────────────────
// All four target types route through the same transactional modal (Slice 2
// retires the legacy ProductVariantSelector; VariantsPanel handles VARIANTS
// inside the modal).

const modalOpen = ref(false)

const targetTypeOptions = computed(() =>
  props.allowVariants
    ? TARGET_TYPE_OPTIONS
    : TARGET_TYPE_OPTIONS.filter((o) => o.value !== 'VARIANTS'),
)

// Dynamic "Agregar <tipo>" label (Slice 1.5 visual polish — full-width,
// prominent, type-aware). Reuses the same noun map as the empty-state so
// the wording stays consistent across the section.
const addButtonLabel = computed(() => {
  const noun = TARGET_TYPE_CARDS[props.targetType]?.noun ?? 'items'
  return `Agregar ${noun}`
})

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
  const noun = TARGET_TYPE_CARDS[props.targetType]?.noun ?? 'items'
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

    <!-- Target type selector — icon-cards matching the AUTOMATIC/MANUAL
         method cards in PromotionForm.vue (Slice 1.5 visual polish).
         Visual language (border, ring, hover, transition) is shared so
         the two card selectors in this form look consistent. -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <button
        v-for="opt in targetTypeOptions"
        :key="opt.value"
        type="button"
        :data-testid="`target-card-${opt.value}`"
        class="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-all duration-200"
        :class="
          targetType === opt.value
            ? 'border-primary bg-primary/15 ring-1 ring-primary/35'
            : 'border-default bg-elevated/20 hover:border-primary/40 hover:bg-elevated/60'
        "
        @click="onTargetTypeChange(opt.value)"
      >
        <UIcon :name="TARGET_TYPE_CARDS[opt.value]!.icon" class="h-5 w-5 text-toned" />
        <span class="text-sm font-medium text-highlighted">{{ opt.label }}</span>
      </button>
    </div>

    <!-- All four target types: prominent, full-width "Agregar <tipo>" button
         → modal. The modal routes internally to FlatChecklistPanel for the
         three flat types and to VariantsPanel for VARIANTS (Slice 2). -->
    <div class="flex">
      <UButton
        color="primary"
        variant="solid"
        size="lg"
        icon="i-lucide-plus"
        block
        data-testid="open-target-modal"
        @click="openModal"
      >
        {{ addButtonLabel }}
      </UButton>
    </div>

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

    <!-- Transactional selection modal — handles ALL four target types via
         FlatChecklistPanel (CATEGORIES|BRANDS|PRODUCTS) + VariantsPanel
         (VARIANTS). Cancel/Esc/backdrop never emits `confirm`. -->
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