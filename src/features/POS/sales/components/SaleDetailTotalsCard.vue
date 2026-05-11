<script setup lang="ts">
import { formatCentsMXN } from '../utils/currency.utils'

defineProps<{
  subtotalCents: number
  discountCents: number
  totalCents: number
}>()
</script>

<template>
  <UCard>
    <h3 class="mb-4 text-sm font-semibold">Totales</h3>
    <div class="space-y-2 text-sm">
      <div class="flex items-center justify-between">
        <span>Subtotal</span>
        <span>{{ formatCentsMXN(subtotalCents) }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span>Descuentos</span>
        <span>{{ formatCentsMXN(discountCents) }}</span>
      </div>
      <div class="flex items-center justify-between font-semibold">
        <span>Total</span>
        <span>{{ formatCentsMXN(totalCents) }}</span>
      </div>
    </div>
  </UCard>
</template>
