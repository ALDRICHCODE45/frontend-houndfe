<script setup lang="ts">
/**
 * OnlineStockOverrideFields — WU6 redesigned nullable product/variant stock
 * override pair (REQ-13/REQ-16; reused by WU6). A null mode clears the
 * override: BOTH flat stock fields emit null (keys not omitted). Non-custom
 * modes serialize a null quantity; CUSTOM_QUANTITY keeps the non-negative
 * integer with 0 preserved and labeled "Mostrar 0".
 *
 * UI redesign: UFormField + USelectMenu (value-key) replace the native select;
 * UInput replaces the native number input. All props/emits contracts preserved.
 *
 * U8: `inheritanceScope` selects the contextual null-override copy — a product
 * inherits the tenant global configuration and a variant inherits its product.
 * Labels, the honest mode explanation, and the selected-mode preview come from
 * the shared `stockPresentationUi` module.
 */
import { computed } from 'vue'
import type { OnlineStockPresentationMode } from '@/features/system/catalog-settings/interfaces/catalog-settings.types'
import {
  buildStockOverrideOptions,
  getStockOverrideInheritanceCopy,
  getStockPresentationCopy,
  resolveStockOverridePreview,
  type StockOverrideScope,
} from '@/features/system/catalog-settings/utils/stockPresentationUi'

interface StockOverrideValue {
  mode: OnlineStockPresentationMode | null
  customQuantity: number | null
}

const props = defineProps<{
  value: StockOverrideValue
  /** Null-override inheritance target: product → tenant, variant → product. */
  inheritanceScope: StockOverrideScope
  disabled?: boolean
}>()

const emit = defineEmits<{ (event: 'change', value: StockOverrideValue): void }>()

const MODE_OPTIONS = computed(() => buildStockOverrideOptions(props.inheritanceScope))

/** Selected-mode explanation: inherited copy when null, mode copy otherwise. */
const selectedCopy = computed(() =>
  props.value.mode === null
    ? getStockOverrideInheritanceCopy(props.inheritanceScope)
    : getStockPresentationCopy(props.value.mode),
)
const selectedPreview = computed(() =>
  resolveStockOverridePreview(props.value.mode, props.value.customQuantity, props.inheritanceScope),
)

function onModeChange(next: OnlineStockPresentationMode | null) {
  if (next === null) {
    // Clear: emit BOTH nulls — flat keys, not omitted (REQ-16).
    emit('change', { mode: null, customQuantity: null })
    return
  }
  // Only CUSTOM_QUANTITY carries a quantity; others serialize null (REQ-8).
  emit('change', {
    mode: next,
    customQuantity: next === 'CUSTOM_QUANTITY' ? (props.value.customQuantity ?? 0) : null,
  })
}

// UInput emits the raw value via update:model-value, not an Event object.
function onQuantityInput(raw: string | number) {
  const parsed = Number.parseInt(String(raw), 10)
  // Non-negative integer; 0 preserved literally (REQ-8).
  const customQuantity = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
  emit('change', { mode: 'CUSTOM_QUANTITY', customQuantity })
}
</script>

<template>
  <UFormField
    label="Stock en catálogo"
    :help="
      props.value.mode === 'CUSTOM_QUANTITY' && props.value.customQuantity === 0
        ? 'Mostrar 0'
        : undefined
    "
    :disabled="props.disabled"
  >
    <USelectMenu
      :model-value="props.value.mode"
      :items="MODE_OPTIONS"
      value-key="value"
      label-key="label"
      data-testid="stock-override-mode"
      class="w-full sm:max-w-xs"
      :disabled="props.disabled"
      @update:model-value="onModeChange"
    />

    <!-- Selected-mode preview: inherited copy, or what the catalog shows. -->
    <div
      class="mt-3 rounded-lg border border-default bg-elevated/50 px-3 py-2"
      role="status"
      data-testid="stock-override-preview"
    >
      <p class="text-xs font-medium text-highlighted">{{ selectedCopy.label }}</p>
      <p class="mt-0.5 text-xs text-muted">{{ selectedCopy.description }}</p>
      <p class="mt-1.5 text-xs text-muted">
        Vista previa:
        <span class="font-medium text-default">{{ selectedPreview }}</span>
      </p>
    </div>

    <UFormField
      v-if="props.value.mode === 'CUSTOM_QUANTITY'"
      label="Cantidad a mostrar"
      :description="props.value.customQuantity === 0 ? 'Mostrar 0' : undefined"
      class="mt-2"
    >
      <UInput
        type="number"
        min="0"
        step="1"
        data-testid="stock-override-qty"
        class="w-32"
        :model-value="String(props.value.customQuantity ?? 0)"
        :disabled="props.disabled"
        @update:model-value="onQuantityInput"
      />
    </UFormField>
  </UFormField>
</template>
