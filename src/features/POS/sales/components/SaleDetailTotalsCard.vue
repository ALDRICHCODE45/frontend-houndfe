<script setup lang="ts">
import { computed } from 'vue'
import { formatCentsMXN } from '../utils/currency.utils'

const props = defineProps<{
  subtotalCents: number
  discountCents: number
  totalCents: number
}>()

// Discount is a positive number coming from the backend (e.g. 14000 ==
// $140.00). We render it with a leading minus so it reads as a deduction,
// matching the POS draft footer convention ("Descuentos -$140.00").
const discountLabel = computed(() => `-${formatCentsMXN(props.discountCents)}`)
</script>

<template>
  <UCard class="space-y-2">
    <template #header>
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">Totales</h3>
    </template>

    <div class="space-y-2 text-right">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted">Subtotal</span>
        <span>{{ formatCentsMXN(subtotalCents) }}</span>
      </div>
      <div
        v-if="discountCents > 0"
        data-testid="totals-discount-row"
        class="flex items-center justify-between text-sm"
      >
        <span class="text-muted">Descuentos</span>
        <span data-testid="totals-discount-value">{{ discountLabel }}</span>
      </div>

      <USeparator />

      <div class="flex items-center justify-between">
        <span class="text-muted">Total</span>
        <span class="text-2xl font-bold">{{ formatCentsMXN(totalCents) }}</span>
      </div>
    </div>
  </UCard>
</template>
