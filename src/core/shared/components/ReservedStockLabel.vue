<script lang="ts">
/** True only when units are held for restock backorders; absent or 0 keeps today's stock UI. */
export function hasReservedStock(reserved: number | null | undefined): reserved is number {
  return typeof reserved === 'number' && reserved > 0
}

/** «Disponible 3 · Apartado 2»: what the counter can sell, then what backorders hold. */
export function reservedStockText(available: number, reserved: number): string {
  return `Disponible ${available} · Apartado ${reserved}`
}
</script>

<script setup lang="ts">
/**
 * ReservedStockLabel — available and reserved stock side by side, for a product or variant that has units
 * held for «pedidos por reposición». Warning tone for the reserved part, never red: the stock is not gone,
 * it is promised. Tabular figures so columns of these line up.
 */
defineProps<{
  available: number
  reserved: number
}>()
</script>

<template>
  <span class="hf-figure reserved-stock-label" data-testid="reserved-stock">
    <span>Disponible {{ available }}</span> · <span class="font-semibold text-(--hf-warning)">Apartado {{ reserved }}</span>
  </span>
</template>
