<script setup lang="ts">
/**
 * CatalogStockPresentationField — WU3B tenant stock-presentation default field
 * (REQ-8). Renders the closed four-mode set; switching to a non-CUSTOM mode
 * forces `customQuantity: null`; CUSTOM_QUANTITY keeps the non-negative
 * integer with 0 preserved and labeled "Mostrar 0".
 *
 * UI redesign: UFormField + USelectMenu (value-key) replace the native select;
 * UInput replaces the native number input. All props/emits contracts are
 * preserved; the emitted value shape is unchanged.
 *
 * U8: labels, the honest mode explanation, and the selected-mode preview come
 * from the shared `stockPresentationUi` module, so the tenant default and the
 * product/variant overrides can never drift apart.
 */
import { computed } from 'vue'
import type {
  CatalogStockPresentationDefaultDto,
  OnlineStockPresentationMode,
} from '../interfaces/catalog-settings.types'
import {
  buildStockPresentationModeOptions,
  getStockPresentationCopy,
  resolveStockPresentationPreview,
} from '../utils/stockPresentationUi'

const props = withDefaults(
  defineProps<{
    stockDefault: CatalogStockPresentationDefaultDto
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  (event: 'change', value: CatalogStockPresentationDefaultDto): void
}>()

const MODE_OPTIONS = buildStockPresentationModeOptions()

const selectedCopy = computed(() => getStockPresentationCopy(props.stockDefault.mode))
const selectedPreview = computed(() =>
  resolveStockPresentationPreview(props.stockDefault.mode, props.stockDefault.customQuantity),
)

function onModeChange(next: OnlineStockPresentationMode | null) {
  if (!next) return
  // REQ-8: only CUSTOM_QUANTITY carries a quantity; others serialize null.
  emit('change', {
    mode: next,
    customQuantity: next === 'CUSTOM_QUANTITY' ? (props.stockDefault.customQuantity ?? 0) : null,
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
      props.stockDefault.mode === 'CUSTOM_QUANTITY' && props.stockDefault.customQuantity === 0
        ? 'Mostrar 0'
        : undefined
    "
    :disabled="props.disabled"
  >
    <USelectMenu
      :model-value="props.stockDefault.mode"
      :items="MODE_OPTIONS"
      value-key="value"
      label-key="label"
      data-testid="stock-mode-select"
      class="w-full"
      :disabled="props.disabled"
      @update:model-value="onModeChange"
    />

    <!-- Selected-mode preview: what the public catalog shows, and why. -->
    <div
      class="mt-3 rounded-lg border border-default bg-elevated/50 px-3 py-2"
      role="status"
      data-testid="stock-mode-preview"
    >
      <p class="text-xs font-medium text-highlighted">{{ selectedCopy.label }}</p>
      <p class="mt-0.5 text-xs text-muted">{{ selectedCopy.description }}</p>
      <p class="mt-1.5 text-xs text-muted">
        Vista previa:
        <span class="font-medium text-default">{{ selectedPreview }}</span>
      </p>
    </div>

    <UFormField
      v-if="props.stockDefault.mode === 'CUSTOM_QUANTITY'"
      label="Cantidad a mostrar"
      :description="props.stockDefault.customQuantity === 0 ? 'Mostrar 0' : undefined"
      class="mt-2"
    >
      <UInput
        type="number"
        min="0"
        step="1"
        data-testid="stock-quantity-input"
        class="w-32"
        :model-value="String(props.stockDefault.customQuantity ?? 0)"
        :disabled="props.disabled"
        @update:model-value="onQuantityInput"
      />
    </UFormField>
  </UFormField>
</template>
