<script setup lang="ts">
import type { SalesListCounts, SaleDeliveryStatus } from '../interfaces/sale.types'
import { SALE_DELIVERY_STATUS } from '../constants/sale.constants'
import { pendingPaymentsBadge } from '../utils/salesListTabs.utils'

// Which quick tab is selected; the list owns it (it also drives the no-match state).
export type SalesListTab = 'all' | 'pending-payments' | 'pending-delivery'

withDefaults(
  defineProps<{
    counts?: SalesListCounts
    active?: SalesListTab
    /** Off while there is nothing to count (no sales yet), so no stale numbers show. */
    showCounts?: boolean
  }>(),
  {
    counts: () => ({ all: 0, pendingPayments: 0, notDelivered: 0 }),
    active: 'all',
    showCounts: true,
  },
)

// Tab change payload: a discriminated object carrying the single filter the
// tab activates. The consumer merges this with the slideover-driven filter
// state (see `resolveDeliveryStatus` / `resolvePaymentStatus` in
// `useConfirmedSales.ts`). Widened in WU-D to admit the third "Pagos
// pendientes" tab (REQ-19 MODIFIED + REQ-NEW-8).
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
      :variant="active === 'all' ? 'soft' : 'ghost'"
      color="neutral"
      class="sales-status-tab whitespace-nowrap"
      data-testid="sales-tab-all"
      :data-active="active === 'all'"
      :aria-pressed="active === 'all'"
      @click="emit('change', clearAll())"
    >
      Todas<template v-if="showCounts"> ({{ counts.all }})</template>
    </UButton>

    <UButton
      :variant="active === 'pending-payments' ? 'soft' : 'ghost'"
      color="neutral"
      class="sales-status-tab whitespace-nowrap"
      data-testid="sales-tab-pending-payments"
      :data-active="active === 'pending-payments'"
      :aria-pressed="active === 'pending-payments'"
      @click="emit('change', { paymentStatus: 'PARTIAL,CREDIT' })"
    >
      <span>Pagos pendientes</span>
      <span
        v-if="showCounts && pendingPaymentsBadge(counts.pendingPayments).visible"
        class="ml-1.5"
        data-testid="sales-tab-pending-payments-badge"
      >
        ({{ pendingPaymentsBadge(counts.pendingPayments).text }})
      </span>
    </UButton>

    <UButton
      :variant="active === 'pending-delivery' ? 'soft' : 'ghost'"
      color="neutral"
      class="sales-status-tab whitespace-nowrap"
      data-testid="sales-tab-pending-delivery"
      :data-active="active === 'pending-delivery'"
      :aria-pressed="active === 'pending-delivery'"
      @click="emit('change', { deliveryStatus: SALE_DELIVERY_STATUS.PENDING })"
    >
      No entregadas<template v-if="showCounts"> ({{ counts.notDelivered }})</template>
    </UButton>
  </div>
</template>