<script setup lang="ts">
import { computed } from 'vue'
import type { PendingRefundRow } from '@/features/POS/sales/interfaces/pending-refund.types'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import {
  MEXICO_CITY_TIME_ZONE,
  pendingRefundMethodLabel,
  pendingRefundReasonLabel,
} from '../utils/dashboardOperational.utils'

const props = defineProps<{
  refund: PendingRefundRow
}>()

const methodLabel = computed(() => pendingRefundMethodLabel(props.refund.method))
const reasonLabel = computed(() => pendingRefundReasonLabel(props.refund.reason))
const createdAt = computed(() =>
  formatShortDateTime(props.refund.createdAt, { timeZone: MEXICO_CITY_TIME_ZONE }),
)
</script>

<template>
  <li class="dashboard-operation-row" data-testid="dashboard-refund-row">
    <div class="dashboard-row-main">
      <div class="dashboard-row-description">
        <!-- The payload carries no customer or seller, so the row is named by when it arose. -->
        <strong>
          <time :datetime="refund.createdAt">Reembolso del {{ createdAt }}</time>
        </strong>
        <span>{{ methodLabel }} · {{ reasonLabel }}</span>
      </div>

      <div class="dashboard-row-amount">
        <StatusBadge label="Pendiente" tone="warning" />
        <strong>{{ formatCentsMXN(refund.outstandingCents) }}</strong>
      </div>
    </div>
  </li>
</template>
