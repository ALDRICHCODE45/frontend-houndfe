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
    <template #header>
      <h3 class="text-base font-semibold text-muted">Totales</h3>
    </template>
    
    <div class="space-y-3 text-right">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted">Subtotal</span>
        <span>{{ formatCentsMXN(subtotalCents) }}</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted">Descuentos</span>
        <span>{{ formatCentsMXN(discountCents) }}</span>
      </div>
      
      <hr class="border-t border-gray-200" />
      
      <div class="flex items-center justify-between">
        <span class="text-muted">Total</span>
        <span class="text-2xl font-bold">{{ formatCentsMXN(totalCents) }}</span>
      </div>
    </div>
  </UCard>
</template>
