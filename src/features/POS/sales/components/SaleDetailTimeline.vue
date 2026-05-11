<script setup lang="ts">
import { computed } from 'vue'
import type { SaleDetailPayment, SaleTimelineEvent } from '../interfaces/sale.types'
import { formatCentsMXN } from '../utils/currency.utils'
import { formatPaymentMethod } from '../utils/salePaymentMethod.utils'
import { formatSaleDate } from '../utils/saleDate.utils'

const props = defineProps<{
  timeline: SaleTimelineEvent[]
  payments: SaleDetailPayment[]
}>()

const orderedTimeline = computed(() => [...props.timeline].sort((a, b) => b.at.localeCompare(a.at)))

function eventLabel(event: SaleTimelineEvent): string {
  if (event.type === 'SALE_REGISTERED') return 'Venta Registrada'
  if (event.type === 'PRODUCTS_DELIVERED') return 'Entrega de Productos'

  const payment = props.payments[0]
  if (!payment) return 'Cobro recibido'
  return `Cobro de ${formatCentsMXN(payment.amountCents)} en ${formatPaymentMethod(payment.method)}`
}
</script>

<template>
  <UCard>
    <h3 class="mb-4 text-sm font-semibold">Timeline</h3>

    <div class="space-y-3">
      <div
        v-for="event in orderedTimeline"
        :key="`${event.type}-${event.at}`"
        data-testid="timeline-event"
        class="flex items-start gap-3"
      >
        <UIcon name="i-lucide-circle" class="mt-1 size-4" />
        <div>
          <p class="text-sm font-medium">{{ eventLabel(event) }}</p>
          <p class="text-xs text-muted">{{ formatSaleDate(event.at) }}</p>
        </div>
      </div>
    </div>
  </UCard>
</template>
