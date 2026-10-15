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
  <li class="dashboard-operation-row" data-testid="dashboard-refund-row">
    <div class="dashboard-row-main">
      <div class="dashboard-row-description">
        <strong>Venta {{ refund.saleId }}</strong>
        <p class="dashboard-row-date">
          <time :datetime="refund.createdAt">{{ createdAt }}</time>
        </p>
      </div>

      <div class="dashboard-row-amount text-warning">
        <p class="dashboard-row-status dashboard-status-warning">Pendiente</p>
        <strong>{{ formatCentsMXN(refund.outstandingCents) }}</strong>
      </div>
    </div>

    <dl class="dashboard-refund-facts">
      <div><dt>Método</dt><dd>{{ methodLabel }}</dd></div>
      <div><dt>Motivo</dt><dd>{{ reasonLabel }}</dd></div>
    </dl>
  </li>
</template>
