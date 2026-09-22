<script setup lang="ts">
/**
 * BranchSalesSummaryMetrics — presentational rendering of the eight authoritative
 * summary metrics.
 *
 * Every amount is formatted with the canonical shared `formatCentsMXN`; each value
 * is rendered exactly as the backend supplied it. Nothing is summed, netted or
 * derived, and sales / refund flows stay in separate labelled sections. Positive
 * debt and pending refund obligations carry an icon + visible text status cue,
 * never color alone.
 */
import { computed, useId } from 'vue'
import { CURRENCY_CONFIG, formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { BranchSalesSummaryResponse } from '../interfaces/branch-sales-summary.types'

const props = defineProps<{ summary: BranchSalesSummaryResponse }>()

/** Counts are counts: locale grouping only, never a currency format. */
const countFormatter = new Intl.NumberFormat(CURRENCY_CONFIG.locale)

const hasDebt = computed(() => props.summary.outstandingDebtCents > 0)
const hasPendingRefundObligations = computed(() => props.summary.pendingRefundObligationsCents > 0)

const uid = useId()
const salesHeadingId = `${uid}-sales-heading`
const refundsHeadingId = `${uid}-refunds-heading`
</script>

<template>
  <div data-testid="branch-summary-metrics" class="flex min-w-0 flex-col gap-4">
    <section
      data-testid="branch-summary-sales-section"
      :aria-labelledby="salesHeadingId"
      class="flex min-w-0 flex-col gap-2"
    >
      <h2 :id="salesHeadingId" class="text-sm font-semibold text-highlighted">Ventas</h2>
      <dl class="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div
          class="flex min-w-0 flex-col gap-1 rounded-lg border border-default bg-elevated/50 p-3"
        >
          <dt class="text-xs font-medium leading-tight text-muted">Ventas netas</dt>
          <dd class="tabular-nums text-2xl font-semibold leading-tight text-highlighted">
            {{ formatCentsMXN(props.summary.netSalesCents) }}
          </dd>
        </div>

        <div
          class="flex min-w-0 flex-col gap-1 rounded-lg border border-default bg-elevated/50 p-3"
        >
          <dt class="text-xs font-medium leading-tight text-muted">Ventas brutas</dt>
          <dd class="tabular-nums text-lg font-semibold leading-tight text-highlighted">
            {{ formatCentsMXN(props.summary.grossSalesCents) }}
          </dd>
        </div>

        <div
          class="flex min-w-0 flex-col gap-1 rounded-lg border border-default bg-elevated/50 p-3"
        >
          <dt class="text-xs font-medium leading-tight text-muted">Cobrado</dt>
          <dd class="tabular-nums text-lg font-semibold leading-tight text-highlighted">
            {{ formatCentsMXN(props.summary.collectedCents) }}
          </dd>
        </div>

        <div
          class="flex min-w-0 flex-col gap-1 rounded-lg border border-default bg-elevated/50 p-3"
          :class="hasDebt ? 'border-error/30' : undefined"
        >
          <dt class="text-xs font-medium leading-tight text-muted">Deuda pendiente</dt>
          <dd
            class="flex min-w-0 flex-wrap items-baseline gap-2 tabular-nums text-lg font-semibold leading-tight text-highlighted"
          >
            <span>{{ formatCentsMXN(props.summary.outstandingDebtCents) }}</span>
            <span
              v-if="hasDebt"
              data-testid="branch-summary-debt-status"
              class="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-error"
            >
              <UIcon name="i-lucide-alert-circle" aria-hidden="true" class="size-4 shrink-0" />
              Con deuda pendiente
            </span>
          </dd>
        </div>

        <div
          class="flex min-w-0 flex-col gap-1 rounded-lg border border-default bg-elevated/50 p-3"
        >
          <dt class="text-xs font-medium leading-tight text-muted">Cantidad de ventas</dt>
          <dd class="tabular-nums text-lg font-semibold leading-tight text-highlighted">
            {{ countFormatter.format(props.summary.saleCount) }}
          </dd>
        </div>

        <div
          class="flex min-w-0 flex-col gap-1 rounded-lg border border-default bg-elevated/50 p-3"
        >
          <dt class="text-xs font-medium leading-tight text-muted">Ticket promedio</dt>
          <dd class="tabular-nums text-lg font-semibold leading-tight text-highlighted">
            {{ formatCentsMXN(props.summary.averageTicketCents) }}
          </dd>
        </div>
      </dl>
    </section>

    <section
      data-testid="branch-summary-refunds-section"
      :aria-labelledby="refundsHeadingId"
      class="flex min-w-0 flex-col gap-2"
    >
      <h2 :id="refundsHeadingId" class="text-sm font-semibold text-highlighted">Reembolsos</h2>
      <dl class="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <div
          class="flex min-w-0 flex-col gap-1 rounded-lg border border-default bg-elevated/50 p-3"
        >
          <dt class="text-xs font-medium leading-tight text-muted">Reembolsos liquidados</dt>
          <dd class="tabular-nums text-lg font-semibold leading-tight text-highlighted">
            {{ formatCentsMXN(props.summary.settledRefundsCents) }}
          </dd>
        </div>

        <div
          class="flex min-w-0 flex-col gap-1 rounded-lg border border-default bg-elevated/50 p-3"
          :class="hasPendingRefundObligations ? 'border-error/30' : undefined"
        >
          <dt class="text-xs font-medium leading-tight text-muted">
            Obligaciones de reembolso pendientes
          </dt>
          <dd
            class="flex min-w-0 flex-wrap items-baseline gap-2 tabular-nums text-lg font-semibold leading-tight text-highlighted"
          >
            <span>{{ formatCentsMXN(props.summary.pendingRefundObligationsCents) }}</span>
            <span
              v-if="hasPendingRefundObligations"
              data-testid="branch-summary-pending-refund-status"
              class="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-error"
            >
              <UIcon name="i-lucide-alert-circle" aria-hidden="true" class="size-4 shrink-0" />
              Reembolsos pendientes
            </span>
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
