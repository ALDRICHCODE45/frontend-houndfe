<script setup lang="ts">
import type { SalesListCounts, SaleDeliveryStatus } from '../interfaces/sale.types'
import { SALE_DELIVERY_STATUS } from '../constants/sale.constants'
import { pendingPaymentsBadge } from '../utils/salesListTabs.utils'

withDefaults(
  defineProps<{
    counts?: SalesListCounts
  }>(),
  {
    counts: () => ({ all: 0, pendingPayments: 0, notDelivered: 0 }),
  },
)

// Tab change payload: a discriminated object carrying the single filter the
// tab activates. The consumer merges this with the slideover-driven filter
// state (see `resolveDeliveryStatus` / `resolvePaymentStatus` in
// `useConfirmedSales.ts`). Widened in WU-D to admit the third "Pagos
// Pendientes" tab (REQ-19 MODIFIED + REQ-NEW-8).
export type SalesListTabChange = {
  deliveryStatus?: SaleDeliveryStatus
  paymentStatus?: string
}

const emit = defineEmits<{
  change: [payload: SalesListTabChange]
}>()

function clearAll(): SalesListTabChange {
  return { deliveryStatus: undefined, paymentStatus: undefined }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <UButton
      variant="soft"
      color="neutral"
      class="whitespace-nowrap"
      data-testid="sales-tab-all"
      @click="emit('change', clearAll())"
    >
      Todas ({{ counts.all }})
    </UButton>

    <UButton
      variant="soft"
      color="neutral"
      class="whitespace-nowrap"
      data-testid="sales-tab-pending-payments"
      @click="emit('change', { paymentStatus: 'PARTIAL,CREDIT' })"
    >
      <span>Pagos Pendientes</span>
      <span
        v-if="pendingPaymentsBadge(counts.pendingPayments).visible"
        class="ml-1.5"
        data-testid="sales-tab-pending-payments-badge"
      >
        ({{ pendingPaymentsBadge(counts.pendingPayments).text }})
      </span>
    </UButton>

    <UButton
      variant="soft"
      color="neutral"
      class="whitespace-nowrap"
      data-testid="sales-tab-pending-delivery"
      @click="emit('change', { deliveryStatus: SALE_DELIVERY_STATUS.PENDING })"
    >
      No Entregadas ({{ counts.notDelivered }})
    </UButton>
  </div>
</template>