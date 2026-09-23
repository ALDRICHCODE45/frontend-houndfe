<script setup lang="ts">
import { computed } from 'vue'
import type { PendingRefundRow } from '@/features/POS/sales/interfaces/pending-refund.types'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import {
  formatDashboardInstant,
  pendingRefundMethodLabel,
  pendingRefundReasonLabel,
} from '../utils/dashboardOperational.utils'

const props = defineProps<{
  refund: PendingRefundRow
}>()

const methodLabel = computed(() => pendingRefundMethodLabel(props.refund.method))
const reasonLabel = computed(() => pendingRefundReasonLabel(props.refund.reason))
const createdAt = computed(() => formatDashboardInstant(props.refund.createdAt))
</script>

<template>
  <li class="min-w-0 py-3 first:pt-0 last:pb-0" data-testid="dashboard-refund-row">
    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="flex items-start gap-2 text-sm font-medium text-highlighted">
          <UIcon
            name="i-lucide-rotate-ccw"
            class="mt-0.5 size-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <span class="min-w-0 break-all">Venta {{ refund.saleId }}</span>
        </p>
        <p class="mt-1 text-xs text-muted">
          <time :datetime="refund.createdAt">{{ createdAt }}</time>
        </p>
      </div>

      <div class="min-w-0 text-left text-warning sm:shrink-0 sm:text-right">
        <p class="text-xs font-medium">Pendiente</p>
        <p class="mt-1 break-words text-base font-semibold tabular-nums">
          {{ formatCentsMXN(refund.outstandingCents) }}
        </p>
      </div>
    </div>

    <dl class="mt-3 grid min-w-0 grid-cols-1 gap-2 text-xs sm:grid-cols-2">
      <div class="min-w-0 rounded-lg bg-elevated px-3 py-2">
        <dt class="text-muted">Método</dt>
        <dd class="mt-1 break-words font-medium text-default">{{ methodLabel }}</dd>
      </div>
      <div class="min-w-0 rounded-lg bg-elevated px-3 py-2">
        <dt class="text-muted">Motivo</dt>
        <dd class="mt-1 break-words font-medium text-default">{{ reasonLabel }}</dd>
      </div>
    </dl>
  </li>
</template>
