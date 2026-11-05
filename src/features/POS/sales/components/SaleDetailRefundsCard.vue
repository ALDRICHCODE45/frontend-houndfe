<script setup lang="ts">
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { refundMethodLabel } from '@/features/POS/refunds/utils/refundLabels'
import { formatCentsMXN } from '../utils/currency.utils'
import type { SaleDetailRefund } from '../interfaces/sale.types'
import '@/features/POS/refunds/styles/refunds-visual.css'

// T20: the refunds of a cancelled sale, oldest first, fully returned ones included. «Liquidar»
// asks the view to open the refunds settle slideover; this card never records anything.
defineProps<{
  refunds: SaleDetailRefund[]
  /** `userCan('update', 'SaleRefund')`. */
  canSettle: boolean
}>()

const emit = defineEmits<{ settle: [refundId: string] }>()

const progress = (refund: SaleDetailRefund) =>
  refund.amountCents > 0 ? Math.round((refund.settledCents / refund.amountCents) * 100) : 0
</script>

<template>
  <UCard data-testid="sale-detail-refunds">
    <template #header>
      <h3 class="sale-detail-section-title">
        <UIcon name="i-lucide-hand-coins" class="size-4" aria-hidden="true" />
        Reembolsos
      </h3>
    </template>

    <p v-if="refunds.length === 0" class="text-sm text-(--hf-muted)">No hay dinero por devolver.</p>

    <ul v-else class="sale-detail-refunds">
      <li v-for="refund in refunds" :key="refund.id" class="sale-detail-refund" data-testid="sale-refund">
        <div class="sale-detail-refund__top">
          <span class="sale-detail-refund__method">{{ refundMethodLabel(refund.method) }}</span>
          <StatusBadge
            v-if="refund.outstandingCents === 0"
            label="Devuelto"
            tone="success"
            aria-prefix="Reembolso:"
          />
          <UButton
            v-else-if="canSettle"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-hand-coins"
            :aria-label="`Liquidar reembolso en ${refundMethodLabel(refund.method).toLocaleLowerCase('es-MX')}`"
            data-testid="sale-refund-settle"
            @click="emit('settle', refund.id)"
          >
            Liquidar
          </UButton>
        </div>

        <dl class="sale-detail-refund__figures">
          <div>
            <dt>Total</dt>
            <dd class="hf-figure">{{ formatCentsMXN(refund.amountCents) }}</dd>
          </div>
          <div>
            <dt>Devuelto</dt>
            <dd class="hf-figure">{{ refund.settledCents ? formatCentsMXN(refund.settledCents) : '—' }}</dd>
          </div>
          <div>
            <dt>Pendiente</dt>
            <dd class="hf-figure" :class="{ 'refund-owe': refund.outstandingCents > 0 }">
              {{ refund.outstandingCents ? formatCentsMXN(refund.outstandingCents) : '—' }}
            </dd>
          </div>
        </dl>

        <div
          class="refund-settle__bar"
          role="progressbar"
          aria-label="Devuelto del total"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progress(refund)"
        >
          <span :style="{ width: `${progress(refund)}%` }" />
        </div>
      </li>
    </ul>
  </UCard>
</template>
