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
  <li class="min-w-0 py-3 first:pt-0 last:pb-0" data-testid="dashboard-sale-row">
    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="flex items-center gap-2 text-sm font-medium text-highlighted">
          <UIcon
            :name="isDebt ? 'i-lucide-hand-coins' : 'i-lucide-receipt-text'"
            class="size-4 shrink-0 text-toned"
            aria-hidden="true"
          />
          <span class="break-words">Folio {{ folio }}</span>
        </p>
        <p class="mt-1 break-words text-sm text-default">{{ customerName }}</p>
        <p v-if="isDebt" class="mt-1 text-xs text-muted">{{ dueDate }}</p>
        <p v-else class="mt-1 text-xs text-muted">
          <time v-if="sale.confirmedAt" :datetime="sale.confirmedAt">{{ confirmedAt }}</time>
          <span v-else>{{ confirmedAt }}</span>
        </p>
      </div>

      <div
        data-testid="dashboard-sale-row-amount"
        class="min-w-0 text-left sm:shrink-0 sm:text-right"
        :class="isDebt ? 'text-warning' : 'text-highlighted'"
      >
        <p class="text-xs font-medium">
          {{ isDebt ? 'Deuda pendiente' : 'Venta confirmada' }}
        </p>
        <p class="mt-1 break-words text-base font-semibold tabular-nums">{{ amount }}</p>
      </div>
    </div>
  </li>
</template>
