<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { productApi } from '@/features/POS/products/api/product.api'
import { formatSaleDate } from '../utils/saleDate.utils'
import type { GlobalPriceList } from '@/features/POS/products/interfaces/product.types'
import type { SaleDetail } from '../interfaces/sale.types'

const props = defineProps<{
  sale: SaleDetail
}>()

// Resolve the price list name for the confirmed sale. PUBLICO is the
// system-wide default — null always means PUBLICO. We fetch once on mount
// instead of using useQuery to keep the component testable without
// requiring VueQueryPlugin in every parent test.
const priceLists = ref<GlobalPriceList[]>([])

onMounted(async () => {
  try {
    priceLists.value = await productApi.getGlobalPriceLists()
  } catch {
    // Silently degrade — the raw ID (or "PUBLICO") will be shown as fallback
  }
})

const priceListName = computed<string>(() => {
  const id = props.sale.globalPriceListId
  if (!id) return 'PUBLICO'
  return priceLists.value.find((l) => l.id === id)?.name ?? id
})
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

      <div class="grid grid-cols-2 gap-4">
        <span class="text-muted">Lista</span>
        <span class="font-medium">{{ priceListName }}</span>
      </div>
    </div>
  </UCard>
</template>