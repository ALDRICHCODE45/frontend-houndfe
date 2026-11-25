<script setup lang="ts">
/**
 * Sales history backend data T2 (S7, handoff 28 §5.3): the seller's sales per local day as a
 * compact CSS bar chart (no chart dependency). One bar per `dailyTotals` entry in the backend
 * order, zero days included; nothing is summed, grouped or filled in. Bar heights are only a
 * display scale against the highest returned day. Every bar carries its day, sale count and net
 * sales as screen-reader text and as a hover title.
 *
 * Width: bars compress to fill the box; when the period has more days than fit (about 60 at 390,
 * 120 in the wide drawer) the chart scrolls inside its own box, focusable for the keyboard, with
 * a visible hint. The page itself never scrolls sideways.
 */
import { computed, useId } from 'vue'
import type { SellerReportDailyTotal } from '../interfaces/seller-report.types'
import {
  formatSellerReportCents,
  formatSellerReportDay,
  formatSellerReportSaleCount,
  formatSellerReportShortDay,
} from '../utils/sellerReportPresentation'

const props = withDefaults(
  defineProps<{
    days: readonly SellerReportDailyTotal[]
    /** Phone width: fewer bars fit before the box scrolls. */
    compact?: boolean
  }>(),
  { compact: false },
)

/** Minimum bar plus gap, in px: keeps every day visible and tappable as a column. */
const BAR_PITCH_PX = 5
/** Days that fit without scrolling (≈ 330 px at 390, ≈ 600 px in the drawer). */
const FIT_DAYS = { compact: 60, wide: 120 } as const

const titleId = useId()

const highest = computed(() => Math.max(0, ...props.days.map((day) => day.netSalesCents)))
const scrolls = computed(
  () => props.days.length > (props.compact ? FIT_DAYS.compact : FIT_DAYS.wide),
)

const bars = computed(() =>
  props.days.map((day) => ({
    date: day.date,
    height: highest.value > 0 ? Math.round((day.netSalesCents / highest.value) * 100) : 0,
    label: `${formatSellerReportDay(day.date)}: ${formatSellerReportSaleCount(day.saleCount)} · ${formatSellerReportCents(day.netSalesCents)}`,
  })),
)

const firstDay = computed(() =>
  props.days[0] ? formatSellerReportShortDay(props.days[0].date) : '',
)
const lastDay = computed(() => {
  const last = props.days[props.days.length - 1]
  return last ? formatSellerReportShortDay(last.date) : ''
})
</script>

<template>
  <section
    data-testid="seller-report-daily-chart"
    :aria-labelledby="titleId"
    class="grid min-w-0 gap-2 rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)] p-3"
  >
    <div class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h3 :id="titleId" class="m-0 text-sm font-semibold text-[var(--hf-heading)]">
        Ventas por día
      </h3>
      <span class="hf-figure text-xs text-[var(--hf-muted)]"
        >Día más alto: {{ formatSellerReportCents(highest) }}</span
      >
    </div>

    <div
      data-testid="seller-report-daily-scroller"
      class="min-w-0 overflow-x-auto overscroll-x-contain rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hf-focus)]"
      :tabindex="scrolls ? 0 : undefined"
      :role="scrolls ? 'region' : undefined"
      :aria-label="scrolls ? 'Ventas por día, desplazable' : undefined"
    >
      <ol
        class="m-0 flex h-24 list-none items-end gap-px p-0"
        :style="{ minWidth: `${days.length * BAR_PITCH_PX}px` }"
        aria-label="Ventas netas de cada día del periodo"
      >
        <li
          v-for="bar in bars"
          :key="bar.date"
          data-testid="seller-report-daily-bar"
          :data-height="bar.height"
          :title="bar.label"
          class="flex h-full min-w-1 flex-1 items-end"
        >
          <span
            aria-hidden="true"
            class="block w-full rounded-t-sm"
            :class="bar.height > 0 ? 'bg-[var(--hf-active)]' : 'bg-[var(--hf-border)]'"
            :style="{ height: bar.height > 0 ? `max(${bar.height}%, 2px)` : '1px' }"
          />
          <span class="sr-only">{{ bar.label }}</span>
        </li>
      </ol>
    </div>

    <div
      class="flex min-w-0 justify-between gap-3 text-xs text-[var(--hf-muted)]"
      aria-hidden="true"
    >
      <span>{{ firstDay }}</span>
      <span>{{ lastDay }}</span>
    </div>
    <p
      v-if="scrolls"
      data-testid="seller-report-daily-hint"
      class="m-0 flex items-start gap-1.5 text-xs text-[var(--hf-muted)]"
    >
      <UIcon name="i-lucide-move-horizontal" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>Desliza el gráfico para ver todos los días.</span>
    </p>
  </section>
</template>
