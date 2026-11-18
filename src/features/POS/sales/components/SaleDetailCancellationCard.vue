<script setup lang="ts">
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
import { refundReasonLabel } from '@/features/POS/refunds/utils/refundLabels'
import { formatSaleDate } from '../utils/saleDate.utils'
import type { SaleDetail } from '../interfaces/sale.types'

// T20: the calm summary of a cancelled sale (handoff 06, «Cancelled sale detail»).
defineProps<{ sale: SaleDetail }>()
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
        <dd class="sale-detail-fact-value">{{ refundReasonLabel(sale.cancelReason) }}</dd>
      </div>
    </dl>
    <p v-if="sale.canceledBy" class="sale-detail-cancel-by">Cancelada por {{ sale.canceledBy.name }}</p>
  </HfSectionCard>
</template>
