<script setup lang="ts">
import { formatCentsMXN } from '../utils/currency.utils'

defineProps<{
  subtotalCents: number
  discountCents: number
  totalCents: number
}>()
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
      <div v-if="discountCents > 0" class="flex items-center justify-between text-sm">
        <span class="text-muted">Descuentos</span>
        <span>{{ formatCentsMXN(discountCents) }}</span>
      </div>
      
      <USeparator />
      
      <div class="flex items-center justify-between">
        <span class="text-muted">Total</span>
        <span class="text-2xl font-bold">{{ formatCentsMXN(totalCents) }}</span>
      </div>
    </div>
  </UCard>
</template>
