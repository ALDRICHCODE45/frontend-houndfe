<script setup lang="ts">
/** Backend-owned values only. This block opens no query and never repairs buckets. */
import { computed, useId } from 'vue'
import { usePreferredReducedMotion, useTransition } from '@vueuse/core'
import { VisArea, VisLine, VisXYContainer } from '@unovis/vue'
import { CURRENCY_CONFIG, formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { BranchSalesSummaryResponse } from '../interfaces/branch-sales-summary.types'
import type { BranchSalesTimeseriesPoint } from '../interfaces/branch-sales-timeseries.types'
import { formatBranchSalesTimeseriesDate, type BranchSalesTimeseriesMetricKey } from '../utils/branchSalesTimeseries.utils'
import { BRANCH_SALES_SUMMARY_METRIC_KEYS, type BranchSalesSummaryMetricKey } from '../utils/branchSalesSummary.utils'
import '../styles/dashboard-metrics.css'

const props = defineProps<{ summary: BranchSalesSummaryResponse; points?: BranchSalesTimeseriesPoint[] }>()
const reducedMotion = usePreferredReducedMotion()
const values = computed(() => BRANCH_SALES_SUMMARY_METRIC_KEYS.map(key => props.summary[key]))
// Initial values remain exact (as in Amount); subsequent backend updates tween.
const animated = useTransition(values, {
  duration: 500,
  disabled: computed(() => reducedMotion.value === 'reduce'),
})
const countFormatter = new Intl.NumberFormat(CURRENCY_CONFIG.locale, { maximumFractionDigits: 0 })
function amount(key: BranchSalesSummaryMetricKey) {
  const value = animated.value[BRANCH_SALES_SUMMARY_METRIC_KEYS.indexOf(key)]!
  return key === 'saleCount' ? countFormatter.format(value) : formatCentsMXN(value)
}

const salesKpis = [
  { key: 'grossSalesCents', label: 'Ventas brutas', icon: 'i-lucide-receipt-text' },
  { key: 'collectedCents', label: 'Cobrado', icon: 'i-lucide-circle-dollar-sign' },
  { key: 'outstandingDebtCents', label: 'Deuda pendiente', icon: 'i-lucide-hand-coins' },
  { key: 'saleCount', label: 'Cantidad de ventas', icon: 'i-lucide-shopping-bag' },
  { key: 'averageTicketCents', label: 'Ticket promedio', icon: 'i-lucide-receipt' },
] satisfies { key: BranchSalesTimeseriesMetricKey; label: string; icon: string }[]
const refundKpis = [
  { key: 'settledRefundsCents', label: 'Reembolsos liquidados', icon: 'i-lucide-rotate-ccw' },
  { key: 'pendingRefundObligationsCents', label: 'Obligaciones de reembolso pendientes', icon: 'i-lucide-clock-alert' },
] as const

const hasPoints = computed(() => Boolean(props.points?.length))
const xAccessor = (_point: BranchSalesTimeseriesPoint, index: number) => index
const netAccessor = (point: BranchSalesTimeseriesPoint) => point.netSalesCents
// Stable callbacks, each reading exactly one field. No sorting, filling or summing.
const accessors = Object.fromEntries(salesKpis.map(({ key }) => [key, (point: BranchSalesTimeseriesPoint) => point[key]]))
function shortDate(date: string) {
  return formatBranchSalesTimeseriesDate(date).replace(/^0/, '').replace(/ \d{4}$/, '')
}
const periodLabel = computed(() => {
  // Calendar presentation only: `to` is exclusive. UTC arithmetic cannot shift
  // the date with the viewer's zone; summary metadata owns this label.
  const end = new Date(`${props.summary.to}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  const last = end.toISOString().slice(0, 10)
  const startLabel = shortDate(props.summary.from)
  const lastLabel = shortDate(last)
  const year = props.summary.from.slice(0, 4) === last.slice(0, 4)
    ? last.slice(0, 4) : `${props.summary.from.slice(0, 4)}–${last.slice(0, 4)}`
  return `Del ${startLabel} al ${lastLabel} de ${year}`
})
const uid = useId()
const salesHeadingId = `${uid}-sales-heading`
const refundsHeadingId = `${uid}-refunds-heading`
</script>

<template>
  <div data-testid="branch-summary-metrics" class="dashboard-metrics min-w-0">
    <section data-testid="branch-summary-sales-section" :aria-labelledby="salesHeadingId">
      <div data-testid="branch-summary-sales-overview" class="grid min-w-0 grid-cols-1 gap-3" :class="$slots.controls ? 'lg:grid-cols-2 lg:items-start' : undefined">
        <div v-if="$slots.controls" data-testid="branch-summary-controls" class="min-w-0 lg:col-start-2 lg:row-start-1"><slot name="controls" /></div>
        <dl class="min-w-0 lg:col-start-1 lg:row-start-1">
          <div data-testid="branch-summary-net-sales-hero" class="dashboard-metric-panel dashboard-hero">
            <dt class="dashboard-metric-label">
              <span class="dashboard-hero-icon"><UIcon name="i-lucide-wallet" aria-hidden="true" class="size-5" /></span>
              <h2 :id="salesHeadingId">Ventas netas</h2>
            </dt>
            <dd class="tabular-nums">
              <div class="dashboard-hero-value"><span>{{ amount('netSalesCents') }}</span><span>MXN</span></div>
              <p class="dashboard-hero-period">{{ periodLabel }}</p>
              <div v-if="hasPoints" class="dashboard-hero-visual" aria-hidden="true">
                <div class="dashboard-sparkline dashboard-hero-spark">
                  <VisXYContainer :data="props.points" :height="120" :prevent-empty-domain="true" :duration="0" :margin="{ top: 5, bottom: 2, left: 0, right: 2 }">
                    <VisArea :x="xAccessor" :y="netAccessor" color="var(--hf-action)" :duration="0" />
                    <VisLine :x="xAccessor" :y="netAccessor" color="var(--hf-action)" :line-width="2.5" :duration="0" />
                  </VisXYContainer>
                </div>
                <div class="dashboard-spark-dates"><span>{{ shortDate(props.points![0]!.date) }}</span><span>{{ shortDate(props.points![props.points!.length - 1]!.date) }}</span></div>
              </div>
            </dd>
          </div>
        </dl>
      </div>
      <dl data-testid="branch-summary-sales-kpis" class="dashboard-metric-grid min-w-0">
        <div v-for="kpi in salesKpis" :key="kpi.key" data-testid="branch-summary-kpi-card" class="dashboard-metric-panel dashboard-metric-card" :class="{ 'dashboard-debt-card': kpi.key === 'outstandingDebtCents' }">
          <dt class="dashboard-metric-label"><UIcon :name="kpi.icon" aria-hidden="true" class="size-4 shrink-0" /><span>{{ kpi.label }}</span><span v-if="kpi.key === 'outstandingDebtCents'" class="dashboard-warning-dot" aria-hidden="true" /></dt>
          <dd class="tabular-nums">
            <div class="dashboard-metric-value">{{ amount(kpi.key) }}</div>
            <span v-if="kpi.key === 'outstandingDebtCents' && props.summary.outstandingDebtCents > 0" data-testid="branch-summary-debt-status" class="dashboard-metric-status"><UIcon name="i-lucide-alert-circle" aria-hidden="true" class="size-3" />Con deuda pendiente</span>
            <div v-if="hasPoints" class="dashboard-sparkline dashboard-card-spark" aria-hidden="true">
              <VisXYContainer :data="props.points" :height="30" :prevent-empty-domain="true" :duration="0" :margin="{ top: 5, bottom: 2, left: 0, right: 2 }">
                <VisLine :x="xAccessor" :y="accessors[kpi.key]" color="var(--hf-action)" :line-width="1.6" :duration="0" />
              </VisXYContainer>
            </div>
          </dd>
        </div>
      </dl>
    </section>
    <section data-testid="branch-summary-refunds-section" :aria-labelledby="refundsHeadingId" class="dashboard-refund-group">
      <div class="dashboard-refund-heading"><UIcon name="i-lucide-rotate-ccw" aria-hidden="true" class="size-4" /><h2 :id="refundsHeadingId">Reembolsos</h2><span>Separados de las ventas del periodo</span></div>
      <dl class="dashboard-refund-grid">
        <div v-for="kpi in refundKpis" :key="kpi.key" data-testid="branch-summary-refund-card" class="dashboard-refund-item" :class="{ 'dashboard-refund-pending': kpi.key === 'pendingRefundObligationsCents' }">
          <dt><span class="dashboard-refund-icon"><UIcon :name="kpi.icon" aria-hidden="true" class="size-4" /></span><span>{{ kpi.label }}</span></dt>
          <dd class="tabular-nums"><strong>{{ amount(kpi.key) }}</strong><span v-if="kpi.key === 'pendingRefundObligationsCents' && props.summary.pendingRefundObligationsCents > 0" data-testid="branch-summary-pending-refund-status" class="dashboard-metric-status"><UIcon name="i-lucide-alert-circle" aria-hidden="true" class="size-3" />Reembolsos pendientes</span></dd>
        </div>
      </dl>
    </section>
  </div>
</template>
