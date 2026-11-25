<script setup lang="ts">
/**
 * Sales history backend data T1 (S4, handoff 28 §4): the customer's sales per month as a compact
 * CSS bar chart (no chart dependency). Months arrive oldest first with zero months included; each
 * bar is named for screen readers (month, count, total). On failure only a quiet line with a small
 * retry is shown, never an alert: the chart is secondary to the history.
 */
import { computed } from 'vue'
import type { CustomerSalesMonth } from '@/features/POS/sales/interfaces/sale.types'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'

const props = defineProps<{ months?: readonly CustomerSalesMonth[]; failed?: boolean }>()
const emit = defineEmits<{ retry: [] }>()

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const
/** Below this a non-empty bar would be invisible. */
const MIN_BAR_PERCENT = 4

// `month` is the local month string "YYYY-MM": read it as text, never through a Date.
function monthParts(value: string): { name: string; year: string } {
  const [year = '', month = ''] = value.split('-')
  const name = MONTH_NAMES[Number(month) - 1] ?? value
  return { name, year }
}

const bars = computed(() => {
  const list = props.months ?? []
  const max = Math.max(0, ...list.map((entry) => entry.totalCents))
  return list.map((entry) => {
    const { name, year } = monthParts(entry.month)
    const empty = entry.saleCount === 0 && entry.totalCents <= 0
    const ratio = max > 0 ? Math.round((entry.totalCents / max) * 1000) / 10 : 0
    const percent = empty ? 0 : Math.max(ratio, MIN_BAR_PERCENT)
    const sales = entry.saleCount === 1 ? '1 venta' : `${entry.saleCount} ventas`
    return {
      key: entry.month,
      empty,
      percent,
      short: name.slice(0, 3),
      initial: name.charAt(0),
      label: empty
        ? `${name} ${year}: sin ventas`
        : `${name} ${year}: ${sales}, ${formatCentsMXN(entry.totalCents)}`,
    }
  })
})

const rangeLabel = computed(() => {
  const count = props.months?.length ?? 0
  return count === 1 ? 'último mes' : `últimos ${count} meses`
})
</script>

<template>
  <p
    v-if="failed"
    data-testid="monthly-failed"
    class="flex min-w-0 flex-wrap items-center gap-x-2 text-[13px] text-[var(--hf-muted)]"
  >
    <UIcon name="i-lucide-chart-column" class="size-4 shrink-0" aria-hidden="true" />
    <span>No se pudieron cargar las ventas por mes.</span>
    <button
      type="button"
      data-testid="monthly-retry"
      class="inline-flex min-h-11 items-center gap-1 rounded-md px-1 font-medium text-[var(--hf-action)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hf-focus)] md:min-h-8"
      @click="emit('retry')"
    >
      <UIcon name="i-lucide-rotate-ccw" class="size-3.5" aria-hidden="true" />
      Reintentar
    </button>
  </p>

  <section
    v-else-if="months && months.length > 0"
    data-testid="history-monthly-chart"
    class="grid min-w-0 gap-2 rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)] px-4 py-3"
  >
    <p class="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[13px]">
      <span class="font-semibold text-[var(--hf-heading)]">Ventas por mes</span>
      <span class="text-[var(--hf-muted)]">{{ rangeLabel }}</span>
    </p>
    <ol :aria-label="`Ventas por mes, ${rangeLabel}`" class="flex h-20 min-w-0 items-stretch gap-1">
      <li
        v-for="bar in bars"
        :key="bar.key"
        class="grid min-w-0 flex-1 grid-rows-[1fr_auto] gap-1"
        :title="bar.label"
      >
        <span class="sr-only">{{ bar.label }}</span>
        <span class="flex min-h-0 items-end" aria-hidden="true">
          <span
            data-testid="monthly-bar"
            :data-empty="String(bar.empty)"
            class="block w-full rounded-t-sm"
            :class="
              bar.empty
                ? 'h-0.5 bg-[var(--hf-border)]'
                : 'bg-[color-mix(in_srgb,var(--hf-active)_70%,var(--hf-surface))]'
            "
            :style="bar.empty ? undefined : { height: `${bar.percent}%` }"
          />
        </span>
        <span class="text-center text-xs leading-none text-[var(--hf-muted)]" aria-hidden="true">
          <span class="sm:hidden">{{ bar.initial }}</span>
          <span class="hidden sm:inline">{{ bar.short }}</span>
        </span>
      </li>
    </ol>
  </section>
</template>
