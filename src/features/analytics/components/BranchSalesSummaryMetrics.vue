<script setup lang="ts">
/**
 * BranchSalesSummaryMetrics — presentational rendering of the eight authoritative
 * summary metrics, arranged in a reference-inspired dashboard hierarchy.
 *
 * The six sales aggregates live in one "Ventas" section: the net-sales aggregate
 * is the dominant hero card and the other five form a compact KPI grid. The two
 * refund aggregates sit in a distinct "Reembolsos" section. Every amount is
 * formatted with the canonical shared `formatCentsMXN`; each value is rendered
 * exactly as the backend supplied it. Nothing is summed, netted, compared or
 * derived. Positive debt and pending refund obligations carry an icon + visible
 * text status cue, never color alone.
 */
import { computed, useId } from 'vue'
import { CURRENCY_CONFIG, formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { BranchSalesSummaryResponse } from '../interfaces/branch-sales-summary.types'

const props = defineProps<{ summary: BranchSalesSummaryResponse }>()

/** Counts are counts: locale grouping only, never a currency format. */
const countFormatter = new Intl.NumberFormat(CURRENCY_CONFIG.locale)

const hasDebt = computed(() => props.summary.outstandingDebtCents > 0)
const hasPendingRefundObligations = computed(() => props.summary.pendingRefundObligationsCents > 0)

interface SummaryKpi {
  /** Stable render key. */
  key: string
  /** Visible metric label, byte-identical to the wire contract. */
  label: string
  /** Decorative lucide glyph for the icon well. */
  icon: string
  /** Pre-formatted value: canonical MXN for cents, locale grouping for counts. */
  value: string
  /** Non-color attention cue, present only while the obligation is outstanding. */
  status?: { testId: string; text: string }
}

/**
 * The five secondary sales KPIs. The net-sales aggregate is rendered separately
 * as the hero, so the sales section still carries six one-to-one metrics.
 */
const salesKpis = computed<SummaryKpi[]>(() => [
  {
    key: 'gross-sales',
    label: 'Ventas brutas',
    icon: 'i-lucide-receipt-text',
    value: formatCentsMXN(props.summary.grossSalesCents),
  },
  {
    key: 'collected',
    label: 'Cobrado',
    icon: 'i-lucide-circle-dollar-sign',
    value: formatCentsMXN(props.summary.collectedCents),
  },
  {
    key: 'outstanding-debt',
    label: 'Deuda pendiente',
    icon: 'i-lucide-hand-coins',
    value: formatCentsMXN(props.summary.outstandingDebtCents),
    status: hasDebt.value
      ? { testId: 'branch-summary-debt-status', text: 'Con deuda pendiente' }
      : undefined,
  },
  {
    key: 'sale-count',
    label: 'Cantidad de ventas',
    icon: 'i-lucide-shopping-bag',
    value: countFormatter.format(props.summary.saleCount),
  },
  {
    key: 'average-ticket',
    label: 'Ticket promedio',
    icon: 'i-lucide-receipt',
    value: formatCentsMXN(props.summary.averageTicketCents),
  },
])

/** The two refund-flow KPIs, isolated from the sales aggregates. */
const refundKpis = computed<SummaryKpi[]>(() => [
  {
    key: 'settled-refunds',
    label: 'Reembolsos liquidados',
    icon: 'i-lucide-rotate-ccw',
    value: formatCentsMXN(props.summary.settledRefundsCents),
  },
  {
    key: 'pending-refund-obligations',
    label: 'Obligaciones de reembolso pendientes',
    icon: 'i-lucide-clock-alert',
    value: formatCentsMXN(props.summary.pendingRefundObligationsCents),
    status: hasPendingRefundObligations.value
      ? { testId: 'branch-summary-pending-refund-status', text: 'Reembolsos pendientes' }
      : undefined,
  },
])

const uid = useId()
const salesHeadingId = `${uid}-sales-heading`
const refundsHeadingId = `${uid}-refunds-heading`
</script>

<template>
  <div data-testid="branch-summary-metrics" class="flex min-w-0 flex-col gap-6">
    <section
      data-testid="branch-summary-sales-section"
      :aria-labelledby="salesHeadingId"
      class="flex min-w-0 flex-col gap-3"
    >
      <h2 :id="salesHeadingId" class="text-sm font-semibold text-highlighted">Ventas</h2>

      <dl class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <!-- Dominant net-sales hero: the highest-signal aggregate leads the layout. -->
        <div
          data-testid="branch-summary-net-sales-hero"
          class="flex min-w-0 flex-col gap-3 rounded-2xl bg-gradient-to-br from-coco-500 via-coco-600 to-coco-700 p-5 text-white shadow-md ring-1 ring-inset ring-white/15 sm:col-span-2 xl:col-span-3"
        >
          <dt class="flex min-w-0 flex-col gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white"
            >
              <UIcon name="i-lucide-wallet" aria-hidden="true" class="size-5" />
            </span>
            <span class="text-sm font-medium text-coco-100">Ventas netas</span>
          </dt>
          <dd class="break-words tabular-nums text-3xl font-semibold leading-tight sm:text-4xl">
            {{ formatCentsMXN(props.summary.netSalesCents) }}
          </dd>
        </div>

        <!-- Five secondary sales KPIs complete the six-aggregate sales section. -->
        <div
          v-for="kpi in salesKpis"
          :key="kpi.key"
          data-testid="branch-summary-kpi-card"
          class="flex min-w-0 flex-col gap-3 rounded-xl border bg-elevated p-4 shadow-sm"
          :class="kpi.status ? 'border-error/30' : 'border-default'"
        >
          <dt class="flex min-w-0 flex-col gap-2">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-coco-500/10 text-coco-500 dark:bg-coco-500/20 dark:text-coco-300"
            >
              <UIcon :name="kpi.icon" aria-hidden="true" class="size-4" />
            </span>
            <span class="text-xs font-medium leading-tight text-muted">{{ kpi.label }}</span>
          </dt>
          <dd
            class="flex min-w-0 flex-wrap items-baseline gap-2 tabular-nums text-xl font-semibold leading-tight text-highlighted"
          >
            <span class="min-w-0 break-words">{{ kpi.value }}</span>
            <span
              v-if="kpi.status"
              :data-testid="kpi.status.testId"
              class="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-error"
            >
              <UIcon name="i-lucide-alert-circle" aria-hidden="true" class="size-4 shrink-0" />
              {{ kpi.status.text }}
            </span>
          </dd>
        </div>
      </dl>
    </section>

    <section
      data-testid="branch-summary-refunds-section"
      :aria-labelledby="refundsHeadingId"
      class="flex min-w-0 flex-col gap-3"
    >
      <h2 :id="refundsHeadingId" class="text-sm font-semibold text-highlighted">Reembolsos</h2>

      <dl class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          v-for="kpi in refundKpis"
          :key="kpi.key"
          data-testid="branch-summary-refund-card"
          class="flex min-w-0 flex-col gap-3 rounded-xl border bg-elevated p-4 shadow-sm"
          :class="kpi.status ? 'border-error/30' : 'border-default'"
        >
          <dt class="flex min-w-0 flex-col gap-2">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-coco-500/10 text-coco-500 dark:bg-coco-500/20 dark:text-coco-300"
            >
              <UIcon :name="kpi.icon" aria-hidden="true" class="size-4" />
            </span>
            <span class="text-xs font-medium leading-tight text-muted">{{ kpi.label }}</span>
          </dt>
          <dd
            class="flex min-w-0 flex-wrap items-baseline gap-2 tabular-nums text-xl font-semibold leading-tight text-highlighted"
          >
            <span class="min-w-0 break-words">{{ kpi.value }}</span>
            <span
              v-if="kpi.status"
              :data-testid="kpi.status.testId"
              class="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-error"
            >
              <UIcon name="i-lucide-alert-circle" aria-hidden="true" class="size-4 shrink-0" />
              {{ kpi.status.text }}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
