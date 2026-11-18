<script setup lang="ts">
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
import { computed } from 'vue'
import { formatSaleDate } from '../utils/saleDate.utils'
import {
  SALE_HOLD_EXPIRED_EXPLANATION,
  isSaleHoldExpiredCancel,
  saleCancelReasonLabel,
  saleCanceledByLabel,
} from '../utils/saleCancellation.utils'
import type { SaleDetail } from '../interfaces/sale.types'

// T20: the calm summary of a cancelled sale (handoff 06, «Cancelled sale detail»). BE handoff 24
// §4: HOLD_EXPIRED was cancelled by the system, shown as «Sistema» (or the person who made it
// expire); hold-expire-now S3 explains it in a sentence.
const props = defineProps<{ sale: SaleDetail }>()
const canceledBy = computed(() => saleCanceledByLabel(props.sale))
const holdExpired = computed(() => isSaleHoldExpiredCancel(props.sale))
</script>

<template>
  <HfSectionCard title="Cancelación" data-testid="sale-detail-cancellation">
    <dl class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      <div v-if="sale.canceledAt">
        <dt class="sale-detail-fact-label">Fecha</dt>
        <dd class="sale-detail-fact-value hf-figure">{{ formatSaleDate(sale.canceledAt) }}</dd>
      </div>
      <div v-if="sale.cancelReason">
        <dt class="sale-detail-fact-label">Motivo</dt>
        <dd class="sale-detail-fact-value">{{ saleCancelReasonLabel(sale.cancelReason) }}</dd>
      </div>
    </dl>
    <p v-if="holdExpired" class="sale-detail-cancel-explanation" data-testid="sale-detail-cancel-explanation">
      {{ SALE_HOLD_EXPIRED_EXPLANATION }}
    </p>
    <p v-if="canceledBy" class="sale-detail-cancel-by">Cancelada por {{ canceledBy }}</p>
  </HfSectionCard>
</template>
