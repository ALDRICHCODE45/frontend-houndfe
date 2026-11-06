<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { productApi } from '@/features/POS/products/api/product.api'
import type { GlobalPriceList } from '@/features/POS/products/interfaces/product.types'
import { formatPaymentMethod } from '../utils/salePaymentMethod.utils'
import type { SaleDetail } from '../interfaces/sale.types'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import SaleAddressSourceNotice from '@/core/shared/components/SaleAddressSourceNotice.vue'

const props = defineProps<{
  sale: SaleDetail
  /** A cancelled sale is read-only: the seller cannot change (422 SALE_CANCELED). */
  locked?: boolean
}>()
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

// The sale's own address (sale-time snapshot), never the customer's live one.
const shippingAddressText = computed(() =>
  props.sale.shippingAddress ? formatAddress(props.sale.shippingAddress) : '',
)

function openAssignSeller() {
  emit('assign-seller')
}
</script>

<template>
  <UCard data-testid="sidebar-data-reflow">
    <template #header>
      <h3 class="sale-detail-section-title">
        <UIcon name="i-lucide-clipboard-list" class="size-4" />
        Datos de la venta
      </h3>
    </template>
    <dl class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      <div data-testid="reflow-cajero">
        <dt class="sale-detail-fact-label">Cajero</dt>
        <dd class="sale-detail-fact-value">{{ sale.cashier.name }}</dd>
      </div>
      <div data-testid="reflow-vendedor">
        <dt class="sale-detail-fact-label">Vendedor</dt>
        <dd class="sale-detail-fact-value flex flex-wrap items-center gap-x-2">
          <span v-if="sale.seller">{{ sale.seller.name }}</span>
          <span v-else class="text-(--hf-muted)">Sin asignar</span>
          <span v-if="locked" class="sale-detail-fact-note" data-testid="seller-locked">La venta está cancelada.</span>
          <UButton
            v-else
            variant="link"
            color="neutral"
            size="sm"
            class="sale-detail-fact-action p-0"
            data-testid="assign-seller"
            @click="openAssignSeller"
          >
            {{ sale.seller ? 'Cambiar' : 'Asignar vendedor' }}
          </UButton>
        </dd>
      </div>
      <div data-testid="reflow-cliente">
        <dt class="sale-detail-fact-label">Cliente</dt>
        <dd class="sale-detail-fact-value">{{ sale.customer?.name ?? 'Público en general' }}</dd>
      </div>
      <div v-if="shippingAddressText" class="sm:col-span-2" data-testid="reflow-shipping-address">
        <dt class="sale-detail-fact-label">Dirección de envío</dt>
        <dd class="sale-detail-fact-value flex flex-col gap-1">
          <span class="break-words" data-testid="sale-shipping-address">{{ shippingAddressText }}</span>
          <SaleAddressSourceNotice :address="sale.shippingAddress" />
        </dd>
      </div>
      <div data-testid="reflow-price-list">
        <dt class="sale-detail-fact-label">Lista de precios</dt>
        <dd class="sale-detail-fact-value">{{ priceListName }}</dd>
      </div>
      <div class="sm:col-span-2" data-testid="reflow-payment-methods">
        <dt class="sale-detail-fact-label">Métodos de pago</dt>
        <dd v-if="uniquePaymentMethods.length === 0" class="sale-detail-fact-value text-(--hf-muted)">—</dd>
        <dd v-else class="sale-detail-fact-value">{{ uniquePaymentMethods.join(' · ') }}</dd>
      </div>
    </dl>
  </UCard>
</template>
