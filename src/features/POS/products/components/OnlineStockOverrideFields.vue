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
 */
import type { OnlineStockPresentationMode } from '@/features/system/catalog-settings/interfaces/catalog-settings.types'

interface StockOverrideValue {
  mode: OnlineStockPresentationMode | null
  customQuantity: number | null
}

const props = defineProps<{
  value: StockOverrideValue
  disabled?: boolean
}>()

const emit = defineEmits<{ (event: 'change', value: StockOverrideValue): void }>()

const MODE_OPTIONS: Array<{ label: string; value: OnlineStockPresentationMode | null }> = [
  { label: 'Predeterminado del tenant', value: null },
  { label: 'Según estado del sistema', value: 'SYSTEM_STATUS' },
  { label: 'Según estado abstracto', value: 'ABSTRACT_STATUS' },
  { label: 'Cantidad personalizada', value: 'CUSTOM_QUANTITY' },
  { label: 'Oculto', value: 'HIDDEN' },
]

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
