<script setup lang="ts">
/**
 * ProductMarginFigure — Margin (percent) or gain (money) of a sale price over
 * the purchase cost. Shows `--` until both are known, and reads in
 * `--hf-danger` text when the price is below the cost. Presentational only.
 */
import { computed } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'

const props = defineProps<{
  priceCents: number
  costCents: number
  kind: 'percent' | 'gain'
}>()

const known = computed(() => props.costCents > 0 && props.priceCents > 0)
const covered = computed(() => props.priceCents >= props.costCents)
const text = computed(() =>
  props.kind === 'percent'
    ? `${Math.round(((props.priceCents - props.costCents) / props.priceCents) * 100)}%`
    : formatCentsMXN(props.priceCents - props.costCents),
)
</script>

<template>
  <span
    v-if="known"
    class="hf-figure font-semibold"
    :class="covered ? 'text-success' : 'text-error'"
  >
    {{ text }}
  </span>
  <span v-else class="text-muted">--</span>
</template>
