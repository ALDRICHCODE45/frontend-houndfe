<script lang="ts">
export const STOCK_ADJUST_HINT = 'Se ajusta desde Inventario'
</script>

<script setup lang="ts">
import ReservedStockLabel, { hasReservedStock } from '@/core/shared/components/ReservedStockLabel.vue'

/**
 * ReadOnlyStock — the stock of a saved product, variant or lot. Quantity is
 * create-only (O1 S1); on edit it changes through an adjustment, so this shows
 * the figure with the one-line hint next to it.
 */
const props = defineProps<{
  value: number
  /** Names the figure for assistive tech, e.g. `Existencias de Chico · Azul`. */
  label?: string
  /** Right-aligns the figure and its hint, for a table cell. */
  compact?: boolean
  /** A table says the hint once in its heading instead of on every row. */
  hideHint?: boolean
  /** Units held for restock backorders: shown next to the available figure only when above 0. */
  reserved?: number | null
}>()
</script>

<template>
  <div :class="compact ? 'ml-auto flex flex-col items-end' : 'flex flex-col'" :aria-label="label">
    <ReservedStockLabel
      v-if="hasReservedStock(props.reserved)"
      class="text-sm text-highlighted"
      :available="value"
      :reserved="props.reserved"
    />
    <span v-else class="hf-figure text-sm font-semibold text-highlighted">{{ value }}</span>
    <span v-if="!hideHint" class="text-xs text-muted">{{ STOCK_ADJUST_HINT }}</span>
  </div>
</template>
