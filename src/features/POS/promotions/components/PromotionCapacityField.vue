<script setup lang="ts">
/**
 * PromotionCapacityField — optional, accessible cap editor (PCA-1).
 *
 * Single responsibility: let the merchant express the capacity tri-state
 * (unlimited / limited / untouched-and-preserved) with existing Nuxt UI
 * controls, and surface the server-owned consumption as read-only context.
 *
 * The component never serializes anything and never derives a remaining
 * counter; it only emits the intent (`update:modelValue`) and the raw number
 * (`update:maxProductUnits`). `usePromotionForm` owns the create/update mapping
 * and the backend stays the final authority on the cap-vs-consumption guard.
 */
import { computed } from 'vue'
import {
  MAX_PRODUCT_UNITS_LIMIT,
  PROMOTION_CAPACITY_MODE,
  type PromotionCapacityMode,
} from '../interfaces/promotion.types'
import PromotionCapacityStatus from './PromotionCapacityStatus.vue'

const props = withDefaults(
  defineProps<{
    /** Tri-state intent: unchanged (preserve) / unlimited (null) / limited. */
    modelValue: PromotionCapacityMode
    /** The finite limit when limited; the server value for context otherwise. */
    maxProductUnits?: number | null
    /** Server-owned consumption, read-only context for the guard. */
    consumedProductUnits?: number | null
    /** Server-owned remaining, read-only context. Never derived. */
    remainingProductUnits?: number | null
    /** Edit mode: show consumed context and the server snapshot. */
    editing?: boolean
    disabled?: boolean
  }>(),
  {
    maxProductUnits: null,
    consumedProductUnits: null,
    remainingProductUnits: null,
    editing: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [mode: PromotionCapacityMode]
  'update:maxProductUnits': [value: number | null]
}>()

/**
 * Switch position. `unchanged` reflects the server snapshot so an untouched
 * edit renders truthfully; toggling always commits an explicit intent.
 */
const hasCapacity = computed(() => {
  if (props.modelValue === PROMOTION_CAPACITY_MODE.LIMITED) return true
  if (props.modelValue === PROMOTION_CAPACITY_MODE.UNLIMITED) return false
  return props.maxProductUnits != null
})

/** Never suggest a limit below what the server already consumed. */
const minAllowed = computed(() => {
  const consumed = props.consumedProductUnits
  return consumed != null && consumed > 1 ? consumed : 1
})

const limitBelowConsumed = computed(
  () =>
    hasCapacity.value &&
    props.consumedProductUnits != null &&
    props.maxProductUnits != null &&
    props.maxProductUnits < props.consumedProductUnits,
)

function onToggleLimited(value: boolean) {
  emit(
    'update:modelValue',
    value ? PROMOTION_CAPACITY_MODE.LIMITED : PROMOTION_CAPACITY_MODE.UNLIMITED,
  )
}

function onNumberChange(value: number | null | undefined) {
  emit('update:maxProductUnits', value ?? null)
  // Editing the number from an untouched snapshot is an explicit "limited".
  if (props.modelValue !== PROMOTION_CAPACITY_MODE.LIMITED) {
    emit('update:modelValue', PROMOTION_CAPACITY_MODE.LIMITED)
  }
}
</script>

<template>
  <UFormField label="Cupo de unidades" name="maxProductUnits" hint="Opcional">
    <div class="flex flex-col gap-3">
      <div class="flex min-h-11 items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm font-medium text-toned">Limitar la cantidad de unidades</p>
          <p class="text-xs text-muted">La promoción deja de aplicarse cuando se agota el cupo.</p>
        </div>
        <USwitch
          data-testid="capacity-switch"
          :model-value="hasCapacity"
          :disabled="disabled"
          aria-label="Limitar la cantidad de unidades de la promoción"
          @update:model-value="onToggleLimited"
        />
      </div>

      <div v-if="hasCapacity" class="flex flex-col gap-2">
        <!-- PCA-5: `size="lg"` alone rendered the real spinbutton at 36px, so the
             44px touch target (min-h-11) is pushed onto the input itself via the
             Nuxt UI `ui.base` slot — same convention as BranchSalesSummaryFilters. -->
        <UInputNumber
          data-testid="capacity-input"
          :model-value="maxProductUnits"
          :min="minAllowed"
          :max="MAX_PRODUCT_UNITS_LIMIT"
          :step="1"
          size="lg"
          :ui="{ base: 'min-h-11' }"
          :disabled="disabled"
          placeholder="Ej.: 100"
          aria-label="Límite de unidades"
          @update:model-value="onNumberChange"
        />

        <p
          v-if="editing && consumedProductUnits != null"
          data-testid="capacity-consumed-context"
          class="text-xs text-muted"
        >
          Consumo actual: {{ consumedProductUnits }} unidades. Solo la confirmación de venta consume
          unidades.
        </p>

        <p
          v-if="limitBelowConsumed"
          data-testid="capacity-limit-error"
          class="text-xs font-medium text-error"
        >
          El límite no puede ser menor al consumo actual ({{ consumedProductUnits }} unidades).
        </p>
      </div>

      <!-- Server-owned snapshot stays visible in edit mode for BOTH finite and
           unlimited caps. The finite-cap input must never hide the remaining
           count behind it. -->
      <PromotionCapacityStatus
        v-if="editing"
        :max-product-units="maxProductUnits"
        :consumed-product-units="consumedProductUnits"
        :remaining-product-units="remainingProductUnits"
        compact
      />
    </div>
  </UFormField>
</template>
