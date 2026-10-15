<script setup lang="ts">
import { computed } from 'vue'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatDashboardDueDate, formatDashboardInstant } from '../utils/dashboardOperational.utils'

const props = defineProps<{
  sale: ConfirmedSaleRow
  kind: 'recent' | 'debt'
}>()

const customerName = computed(() => props.sale.customer?.name ?? 'Público en General')
const folio = computed(() => props.sale.folio ?? 'Sin folio')
const confirmedAt = computed(() =>
  props.sale.confirmedAt ? formatDashboardInstant(props.sale.confirmedAt) : 'Fecha no disponible',
)
const dueDate = computed(() =>
  props.sale.dueDate
    ? `Vence ${formatDashboardDueDate(props.sale.dueDate)}`
    : 'Sin fecha de vencimiento',
)
const isDebt = computed(() => props.kind === 'debt')
const amount = computed(() =>
  formatCentsMXN(isDebt.value ? props.sale.debtCents : props.sale.totalCents),
)
</script>

<template>
  <li class="dashboard-operation-row" data-testid="dashboard-sale-row">
    <div class="dashboard-row-main">
      <div class="dashboard-row-description">
        <strong>Folio {{ folio }}</strong>
        <span>{{ customerName }}</span>
        <p v-if="isDebt" class="dashboard-row-date">{{ dueDate }}</p>
        <p v-else class="dashboard-row-date">
          <time v-if="sale.confirmedAt" :datetime="sale.confirmedAt">{{ confirmedAt }}</time>
          <span v-else>{{ confirmedAt }}</span>
        </p>
      </div>

      <div
        data-testid="dashboard-sale-row-amount"
        class="dashboard-row-amount"
        :class="isDebt ? 'text-warning' : 'text-highlighted'"
      >
        <p class="dashboard-row-status" :class="{ 'dashboard-status-warning': isDebt }">
          {{ isDebt ? 'Deuda pendiente' : 'Venta confirmada' }}
        </p>
        <strong>{{ amount }}</strong>
      </div>
    </div>
  </li>
</template>
