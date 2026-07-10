<script setup lang="ts">
import { computed } from 'vue'
import type { ConfirmedSaleRow } from '../interfaces/sale.types'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { formatSaleDate, formatSaleDueDate } from '../utils/saleDate.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import { getDeliveryStatusBadge } from '../utils/saleStatus.utils'
import { formatPaymentMethod } from '../utils/salePaymentMethod.utils'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'

const props = defineProps<{ sale: ConfirmedSaleRow }>()

const customerName = computed(() => props.sale.customer?.name ?? 'Público en General')
const hasDebt = computed(() => props.sale.debtCents > 0)
const firstPaymentMethod = computed(() => props.sale.paymentMethods[0] ?? null)

function statusColor(status: ConfirmedSaleRow['status']) {
  if (status === 'CONFIRMED') return 'success'
  if (status === 'DRAFT') return 'warning'
  return 'error'
}
</script>

<template>
  <RouterLink :to="`/pos/ventas/${sale.id}`" class="block focus:outline-none">
    <UCard class="rounded-xl border border-default bg-default" :ui="{ body: 'p-4' }">
          <article class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-primary">#{{ extractFolioNumber(sale.folio) }}</p>
              <StatusDotBadge :tone="statusColor(sale.status)" :label="sale.status" />
            </div>

            <div class="space-y-1">
              <p class="text-sm text-highlighted">{{ customerName }}</p>
              <p class="text-xs text-muted">{{ formatSaleDate(sale.confirmedAt) }}</p>
            </div>

            <p class="text-xl font-semibold text-highlighted">{{ formatCentsMXN(sale.totalCents) }}</p>

            <div v-if="hasDebt" data-testid="sale-card-debt" class="flex items-center justify-between text-warning">
              <p>{{ formatCentsMXN(sale.debtCents) }}</p>
              <p v-if="sale.dueDate" data-testid="sale-card-due-date" class="text-xs">
                Vence: {{ formatSaleDueDate(sale.dueDate) }}
              </p>
            </div>

            <div class="flex items-center justify-between">
              <p class="text-sm text-muted">
                {{ firstPaymentMethod ? formatPaymentMethod(firstPaymentMethod) : 'Sin método' }}
              </p>
              <StatusDotBadge
                :tone="getDeliveryStatusBadge(sale.deliveryStatus).color"
                :label="getDeliveryStatusBadge(sale.deliveryStatus).label"
              />
            </div>
          </article>
    </UCard>
  </RouterLink>
</template>
