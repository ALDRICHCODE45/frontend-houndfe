<script setup lang="ts">
/**
 * CatalogStockPresentationField — WU3B tenant stock-presentation default field
 * (REQ-8). Renders the closed four-mode set; switching to a non-CUSTOM mode
 * forces `customQuantity: null`; CUSTOM_QUANTITY keeps the non-negative
 * integer with 0 preserved and labeled "Mostrar 0".
 */
import type {
  CatalogStockPresentationDefaultDto,
  OnlineStockPresentationMode,
} from '../interfaces/catalog-settings.types'

const props = defineProps<{
  stockDefault: CatalogStockPresentationDefaultDto
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'change', value: CatalogStockPresentationDefaultDto): void
}>()

const MODE_OPTIONS: Array<{ label: string; value: OnlineStockPresentationMode }> = [
  { label: 'Según estado del sistema', value: 'SYSTEM_STATUS' },
  { label: 'Según estado abstracto', value: 'ABSTRACT_STATUS' },
  { label: 'Cantidad personalizada', value: 'CUSTOM_QUANTITY' },
  { label: 'Oculto', value: 'HIDDEN' },
]

function onModeChange(event: Event) {
  const mode = (event.target as HTMLSelectElement).value as OnlineStockPresentationMode
  // REQ-8: only CUSTOM_QUANTITY carries a quantity; others serialize null.
  emit('change', {
    mode,
    customQuantity:
      mode === 'CUSTOM_QUANTITY' ? (props.stockDefault.customQuantity ?? 0) : null,
  })
}

function onQuantityInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  const parsed = Number.parseInt(raw, 10)
  // Non-negative integer; 0 preserved literally (REQ-8).
  const customQuantity = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
  emit('change', { mode: 'CUSTOM_QUANTITY', customQuantity })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm font-semibold text-default" for="catalog-stock-mode">
      Stock en catálogo
    </label>
    <select
      id="catalog-stock-mode"
      data-testid="stock-mode-select"
      class="rounded-lg border border-default px-2 py-1 text-sm"
      :disabled="props.disabled"
      :value="props.stockDefault.mode"
      @change="onModeChange"
    >
      <option v-for="option in MODE_OPTIONS" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <template v-if="props.stockDefault.mode === 'CUSTOM_QUANTITY'">
      <input
        type="number"
        min="0"
        step="1"
        data-testid="stock-quantity-input"
        class="rounded-lg border border-default px-2 py-1 text-sm"
        :value="props.stockDefault.customQuantity ?? 0"
        :disabled="props.disabled"
        @input="onQuantityInput"
      />
      <p v-if="props.stockDefault.customQuantity === 0" class="text-sm text-muted">
        Mostrar 0
      </p>
    </template>
  </div>
</template>
