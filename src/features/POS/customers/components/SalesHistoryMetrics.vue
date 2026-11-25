<script setup lang="ts">
/**
 * Sales history redesign T1: the metric strip of the customer history, from the customer-wide
 * `summary` and `counts` (pet, status and search filters never change it, customer pets S6).
 * «Ticket promedio» comes from `summary.averageTicketCents` (handoff 28 §2.2); an older payload
 * without it keeps the three-cell strip.
 */
import { computed } from 'vue'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import type { SaleListSummary, SalesListCounts } from '@/features/POS/sales/interfaces/sale.types'

const props = defineProps<{ summary: SaleListSummary; counts?: SalesListCounts }>()

const hasDebt = computed(() => props.summary.outstandingDebtCents > 0)
const averageTicketCents = computed(() => props.summary.averageTicketCents)
const hasAverage = computed(() => typeof averageTicketCents.value === 'number')
const notDeliveredNote = computed(() => {
  const count = props.counts?.notDelivered ?? 0
  return count > 0 ? `${count} sin entregar` : null
})
const debtNote = computed(() => {
  if (!hasDebt.value) return props.summary.salesCount > 0 ? 'Al corriente' : null
  const count = props.counts?.pendingPayments ?? 0
  if (count <= 0) return null
  return `${count} ${count === 1 ? 'venta' : 'ventas'} por cobrar`
})
</script>

<template>
  <dl
    aria-label="Resumen del cliente"
    class="grid min-w-0 grid-cols-2 overflow-hidden rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)]"
    :class="hasAverage ? 'sm:grid-cols-4' : 'sm:grid-cols-3'"
  >
    <div class="grid min-w-0 content-start gap-0.5 px-4 py-3">
      <dt class="whitespace-nowrap text-xs font-medium text-[var(--hf-muted)]">Ventas confirmadas</dt>
      <dd class="min-w-0">
        <span class="hf-figure block whitespace-nowrap text-base font-semibold text-[var(--hf-heading)]">{{ summary.salesCount }}</span>
        <small v-if="notDeliveredNote" class="block text-xs font-medium text-[var(--hf-muted)]">{{ notDeliveredNote }}</small>
      </dd>
    </div>

    <div class="grid min-w-0 content-start gap-0.5 border-l border-[var(--hf-border)] px-4 py-3">
      <dt class="whitespace-nowrap text-xs font-medium text-[var(--hf-muted)]">Total vendido</dt>
      <dd class="min-w-0">
        <span class="hf-figure block whitespace-nowrap text-base font-semibold text-[var(--hf-heading)]">{{ formatCentsMXN(summary.totalSoldCents) }}</span>
        <small class="block text-xs font-medium text-[var(--hf-muted)]">todas sus ventas</small>
      </dd>
    </div>

    <div
      data-testid="metric-debt"
      class="grid min-w-0 content-start gap-0.5 border-t border-[var(--hf-border)] px-4 py-3 sm:border-t-0"
      :class="[
        hasAverage ? 'sm:border-l' : 'col-span-2 sm:col-span-1 sm:border-l',
        { 'bg-[var(--hf-warning-soft)]': hasDebt },
      ]"
    >
      <dt class="whitespace-nowrap text-xs font-medium text-[var(--hf-muted)]">Saldo pendiente</dt>
      <dd
        class="min-w-0"
        :class="hasDebt ? 'text-[var(--hf-warning)]' : 'text-[var(--hf-heading)]'"
        :aria-live="hasDebt ? 'polite' : undefined"
      >
        <span class="hf-figure block whitespace-nowrap text-base font-semibold">{{ formatCentsMXN(summary.outstandingDebtCents) }}</span>
        <small
          v-if="debtNote"
          class="block text-xs font-medium"
          :class="hasDebt ? 'text-[var(--hf-warning)]' : 'text-[var(--hf-success)]'"
        >{{ debtNote }}</small>
      </dd>
    </div>

    <div
      v-if="hasAverage"
      data-testid="metric-average-ticket"
      class="grid min-w-0 content-start gap-0.5 border-l border-t border-[var(--hf-border)] px-4 py-3 sm:border-t-0"
    >
      <dt class="whitespace-nowrap text-xs font-medium text-[var(--hf-muted)]">Ticket promedio</dt>
      <dd class="min-w-0">
        <span class="hf-figure block whitespace-nowrap text-base font-semibold text-[var(--hf-heading)]">{{ formatCentsMXN(averageTicketCents ?? 0) }}</span>
        <small class="block text-xs font-medium text-[var(--hf-muted)]">por venta</small>
      </dd>
    </div>
  </dl>
</template>
