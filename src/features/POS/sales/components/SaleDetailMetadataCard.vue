<script setup lang="ts">
import { formatSaleDate } from '../utils/saleDate.utils'
import type { SaleDetail } from '../interfaces/sale.types'

defineProps<{
  sale: SaleDetail
}>()
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">Detalles</h3>
    </template>
    
    <div class="grid gap-y-2 text-sm">
      <div class="grid grid-cols-2 gap-4">
        <span class="text-muted">Fecha</span>
        <UTooltip :text="formatSaleDate(sale.confirmedAt)">
          <span class="font-medium">{{ formatSaleDate(sale.confirmedAt) }}</span>
        </UTooltip>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <span class="text-muted">Canal</span>
        <span class="font-medium">Punto de Venta</span>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <span class="text-muted">Caja</span>
        <span class="font-medium">{{ sale.register }}</span>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <span class="text-muted">Cajero</span>
        <span class="font-medium">{{ sale.cashier.name }}</span>
      </div>
    </div>
  </UCard>
</template>