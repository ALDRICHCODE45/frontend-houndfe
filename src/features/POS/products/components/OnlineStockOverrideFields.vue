<script setup lang="ts">
/**
 * OnlineStockOverrideFields — WU5 shared nullable product/variant stock
 * override pair (REQ-13/REQ-16; reused by WU6). A null mode clears the
 * override: BOTH flat stock fields emit null (keys not omitted). Non-custom
 * modes serialize a null quantity; CUSTOM_QUANTITY keeps the non-negative
 * integer with 0 preserved and labeled "Mostrar 0".
 */
import type {
  OnlineStockPresentationMode,
} from '@/features/system/catalog-settings/interfaces/catalog-settings.types'

interface StockOverrideValue {
  mode: OnlineStockPresentationMode | null
  customQuantity: number | null
}

const props = defineProps<{
  value: StockOverrideValue
  disabled?: boolean
}>()

const emit = defineEmits<{ (event: 'change', value: StockOverrideValue): void }>()

const MODE_OPTIONS: Array<{ label: string; value: OnlineStockPresentationMode }> = [
  { label: 'Según estado del sistema', value: 'SYSTEM_STATUS' },
  { label: 'Según estado abstracto', value: 'ABSTRACT_STATUS' },
  { label: 'Cantidad personalizada', value: 'CUSTOM_QUANTITY' },
  { label: 'Oculto', value: 'HIDDEN' },
]

function onModeChange(event: Event) {
  const mode = (event.target as HTMLSelectElement).value
  if (mode === '') {
    // Clear: emit BOTH nulls — flat keys, not omitted (REQ-16).
    emit('change', { mode: null, customQuantity: null })
    return
  }
  // Only CUSTOM_QUANTITY carries a quantity; others serialize null (REQ-8).
  emit('change', {
    mode: mode as OnlineStockPresentationMode,
    customQuantity:
      mode === 'CUSTOM_QUANTITY' ? (props.value.customQuantity ?? 0) : null,
  })
}

function onQuantityInput(event: Event) {
  const parsed = Number.parseInt((event.target as HTMLInputElement).value, 10)
  // Non-negative integer; 0 preserved literally (REQ-8).
  emit('change', {
    mode: 'CUSTOM_QUANTITY',
    customQuantity: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed,
  })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm font-semibold text-default" for="stock-override-mode">
      Stock en catálogo
    </label>
    <select
      id="stock-override-mode"
      data-testid="stock-override-mode"
      class="rounded-lg border border-default px-2 py-1 text-sm"
      :disabled="props.disabled"
      :value="props.value.mode ?? ''"
      @change="onModeChange"
    >
      <option value="">Predeterminado del tenant</option>
      <option v-for="option in MODE_OPTIONS" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <template v-if="props.value.mode === 'CUSTOM_QUANTITY'">
      <input
        type="number"
        min="0"
        step="1"
        data-testid="stock-override-qty"
        class="rounded-lg border border-default px-2 py-1 text-sm"
        :value="props.value.customQuantity ?? 0"
        :disabled="props.disabled"
        @input="onQuantityInput"
      />
      <p v-if="props.value.customQuantity === 0" class="text-sm text-muted">
        Mostrar 0
      </p>
    </template>
  </div>
</template>
