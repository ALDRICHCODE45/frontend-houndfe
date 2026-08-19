<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { productApi } from '@/features/POS/products/api/product.api'
import type { GlobalPriceList } from '@/features/POS/products/interfaces/product.types'
import { formatPaymentMethod } from '../utils/salePaymentMethod.utils'
import type { SaleDetail } from '../interfaces/sale.types'

const props = defineProps<{ sale: SaleDetail }>()
const emit = defineEmits<{ 'assign-seller': [] }>()

// pos-price-list-tiers: resolve the active price list name. Mirrors the
// pattern previously used by the deleted SaleDetailMetadataCard — fetch
// once on mount so the inline label is decoupled from the network round
// trip.
const priceLists = ref<GlobalPriceList[]>([])
const priceListsLoading = ref(true)
onMounted(async () => {
  try {
    priceLists.value = await productApi.getGlobalPriceLists()
  } catch {
    // Silently degrade — the raw ID (or "PUBLICO") will be shown as fallback.
  } finally {
    priceListsLoading.value = false
  }
})

const priceListName = computed<string>(() => {
  const id = props.sale.globalPriceListId
  if (!id) return 'PUBLICO'
  if (priceListsLoading.value) return '...'
  return priceLists.value.find((l) => l.id === id)?.name ?? id
})

const uniquePaymentMethods = computed<string[]>(() => {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const p of props.sale.payments) {
    if (!seen.has(p.method)) {
      seen.add(p.method)
      ordered.push(formatPaymentMethod(p.method))
    }
  }
  return ordered
})

function openAssignSeller() {
  emit('assign-seller')
}
</script>

<template>
  <UCard data-testid="sidebar-data-reflow">
    <template #header>
      <h3 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        <UIcon name="i-lucide-clipboard-list" class="size-4" />
        Datos de la venta
      </h3>
    </template>
    <div class="grid gap-3 sm:grid-cols-2">
      <div
        class="rounded-lg shadow-sm bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3"
        data-testid="reflow-cajero"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">Cajero</p>
        <p class="font-medium">{{ sale.cashier.name }}</p>
      </div>
      <div
        role="button"
        tabindex="0"
        class="cursor-pointer rounded-lg shadow-sm bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3 transition-colors hover:bg-elevated/50"
        data-testid="reflow-vendedor"
        @click="openAssignSeller"
        @keydown.enter.prevent="openAssignSeller"
        @keydown.space.prevent="openAssignSeller"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">Vendedor</p>
        <p class="font-medium" :class="{ 'text-muted': !sale.seller }">
          {{ sale.seller?.name ?? 'Sin asignar — click para asignar' }}
        </p>
      </div>
      <div
        class="rounded-lg shadow-sm bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3"
        data-testid="reflow-cliente"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">Cliente</p>
        <p class="font-medium">{{ sale.customer?.name ?? 'Público en General' }}</p>
      </div>
      <div
        class="rounded-lg shadow-sm bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3"
        data-testid="reflow-price-list"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">Lista de precios</p>
        <p class="font-medium">{{ priceListName }}</p>
      </div>
      <div
        class="rounded-lg shadow-sm bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3 sm:col-span-2"
        data-testid="reflow-payment-methods"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">Métodos de pago</p>
        <p v-if="uniquePaymentMethods.length === 0" class="font-medium text-muted">—</p>
        <p v-else class="font-medium">{{ uniquePaymentMethods.join(' · ') }}</p>
      </div>
    </div>
  </UCard>
</template>
