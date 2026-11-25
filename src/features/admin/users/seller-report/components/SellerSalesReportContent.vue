<script setup lang="ts">
/**
 * SellerSalesReportContent.vue — the seller report body.
 *
 * Contract:
 *   - Every monetary value, count and status is rendered exactly as the backend
 *     returned it. The browser never sums, averages, reclassifies or sorts: the
 *     metrics come from `confirmed.summary`, not from the rows, and the canceled
 *     section is display-only.
 *   - Canceled amounts live in their own section with an explicit "not added to
 *     confirmed sales" note, because mixing them would silently misstate the
 *     seller's numbers.
 *   - A failure NEVER coexists with retained rows: when there is no valid
 *     snapshot the component shows the failure (or the idle/loading status) and
 *     nothing else.
 *   - Instants are rendered in `America/Mexico_City` (the window the backend
 *     filtered on).
 *
 * Sales history redesign T2 (design 01/04, S1-S5): the same pattern as the customer
 * history — a metric strip, the folio search and payment chips by the list, an
 * aligned table (cards at phone width) whose rows open in place into the shared
 * sale detail, and the canceled sales folded under their own disclosure. The search
 * and chips only HIDE backend rows (design 01 notes: no sums, no re-sorting); long
 * periods reveal rows in steps of {@link ROW_STEP}. The seller, period, generation
 * instant and row count live in the drawer header and footer.
 *
 * Sales history backend data T2 (S5-S9, handoff 28 §5): the customer under each folio (confirmed
 * and canceled), «Ventas por día» from `dailyTotals`, «Más vendidos» from `topProducts` (never
 * part of the totals) and «+12% vs. período anterior» on «Ventas netas», a display ratio of two
 * backend figures. Each block needs its backend member; an older backend simply hides it.
 */
import { computed, shallowRef, watch } from 'vue'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import SellerReportSalesList from './SellerReportSalesList.vue'
import SellerReportDailyChart from './SellerReportDailyChart.vue'
import SellerReportTopProducts from './SellerReportTopProducts.vue'
import {
  SELLER_REPORT_PAYMENT_STATUS_LABELS,
  formatSellerReportCents,
  formatSellerReportCount,
  formatSellerReportInstant,
  sellerReportCustomerLabel,
  sellerReportPreviousPeriodComparison,
  type SellerReportTrend,
} from '../utils/sellerReportPresentation'
import type {
  SellerReportFailure,
  SellerReportPaymentStatus,
  SellerSalesReport,
} from '../interfaces/seller-report.types'

const props = withDefaults(
  defineProps<{
    /** The validated, unmasked snapshot. `null` while loading, idle or failed. */
    report: SellerSalesReport | null
    isInitialLoading: boolean
    isFetching: boolean
    isError: boolean
    errorMessage: string | null
    /** Normalized failure kind; the row-limit error offers «Cambiar periodo» instead of a retry. */
    failureKind?: SellerReportFailure['kind'] | null
    /** Whether the seller is currently active. Inactive sellers are still reportable. */
    sellerIsActive: boolean
    /** Whether «Ver este mes» may widen an empty period (design 04 · 9). */
    canWidenPeriod?: boolean
  }>(),
  { failureKind: null, canWidenPeriod: false },
)

const emit = defineEmits<{ retry: []; 'change-period': []; 'widen-period': [] }>()

/** Rows revealed per step on a long period; the rest stay one click away. */
const ROW_STEP = 50
const STATUS_ORDER: readonly SellerReportPaymentStatus[] = ['PAID', 'PARTIAL', 'CREDIT']

type StatusFilter = 'all' | SellerReportPaymentStatus
const statusChips = computed(() => [
  { value: 'all' as StatusFilter, label: 'Todas' },
  ...STATUS_ORDER.map((status) => ({
    value: status as StatusFilter,
    label: SELLER_REPORT_PAYMENT_STATUS_LABELS[status],
  })),
])

const search = shallowRef('')
const status = shallowRef<StatusFilter>('all')
const visibleCount = shallowRef(ROW_STEP)

// A new snapshot or filter starts from the first step again.
watch(
  () => props.report,
  () => {
    visibleCount.value = ROW_STEP
  },
)
watch([search, status], () => {
  visibleCount.value = ROW_STEP
})

const isPhone = useBreakpoints(breakpointsTailwind).smaller('md')
const listLayout = computed(() => (isPhone.value ? 'cards' : 'table'))

/** A refresh indicator only ever sits on top of an already loaded report. */
const isRefreshing = computed(() => props.report !== null && props.isFetching)
const isRowLimitError = computed(() => props.failureKind === 'row-limit-exceeded')

const allConfirmed = computed(() => props.report?.confirmed.rows ?? [])
const hasFilter = computed(() => status.value !== 'all' || search.value.trim() !== '')
/** Hides rows only: the backend order and every figure stay untouched. */
const filteredConfirmed = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return allConfirmed.value.filter(
    (sale) =>
      (status.value === 'all' || sale.paymentStatus === status.value) &&
      (!needle || (sale.folio ?? '').toLowerCase().includes(needle)),
  )
})
const visibleConfirmed = computed(() => filteredConfirmed.value.slice(0, visibleCount.value))
const remainingCount = computed(() => filteredConfirmed.value.length - visibleConfirmed.value.length)
const confirmedCountLabel = computed(() =>
  hasFilter.value
    ? `${formatSellerReportCount(filteredConfirmed.value.length)} de ${formatSellerReportCount(allConfirmed.value.length)}`
    : formatSellerReportCount(allConfirmed.value.length),
)

const periodIsEmpty = computed(
  () =>
    props.report !== null &&
    props.report.confirmed.rows.length === 0 &&
    props.report.canceled.rows.length === 0,
)
const hasDebt = computed(() => (props.report?.confirmed.summary.outstandingDebtCents ?? 0) > 0)
const listCaption = computed(() =>
  props.report ? `Ventas confirmadas de ${props.report.seller.name}` : 'Ventas confirmadas',
)

/** S7: only with daily data and at least one confirmed sale (backend count). */
const dailyTotals = computed(() => {
  const report = props.report
  if (!report?.dailyTotals?.length || report.confirmed.summary.saleCount === 0) return null
  return report.dailyTotals
})
/** S6: hidden when empty or absent. */
const topProducts = computed(() =>
  props.report?.topProducts?.length ? props.report.topProducts : null,
)
/** S8: a display ratio of `confirmed.summary.netSalesCents` and `previousPeriod.netSalesCents`. */
const previousComparison = computed(() => {
  const report = props.report
  if (!report?.previousPeriod) return null
  return sellerReportPreviousPeriodComparison(
    report.confirmed.summary.netSalesCents,
    report.previousPeriod,
  )
})
const TREND_ICONS: Record<SellerReportTrend, string> = {
  up: 'i-lucide-trending-up',
  down: 'i-lucide-trending-down',
  flat: 'i-lucide-equal',
  none: 'i-lucide-minus',
}

function clearFilters() {
  search.value = ''
  status.value = 'all'
}

function showMore() {
  visibleCount.value += remainingCount.value
}
</script>

<template>
  <div data-testid="seller-report-content" class="flex w-full min-w-0 flex-col gap-4">
    <!-- Initial load: a skeleton shaped like the report, never placeholder numbers. -->
    <div
      v-if="isInitialLoading && !report"
      data-testid="seller-report-loading"
      role="status"
      aria-busy="true"
      class="flex min-w-0 flex-col gap-3"
    >
      <span class="sr-only">Cargando el reporte de ventas…</span>
      <div
        class="grid min-w-0 grid-cols-2 overflow-hidden rounded-xl border border-[var(--hf-border)] md:grid-cols-5"
        aria-hidden="true"
      >
        <div
          v-for="tile in 5"
          :key="tile"
          class="grid gap-1.5 px-3 py-3"
          :class="{ 'col-span-2 md:col-span-1': tile === 5 }"
        >
          <USkeleton class="h-3 w-16 !rounded" />
          <USkeleton class="h-5 w-20 !rounded" />
        </div>
      </div>
      <div class="grid min-w-0 gap-2" aria-hidden="true">
        <div
          v-for="row in 4"
          :key="row"
          class="grid gap-1.5 rounded-xl border border-[var(--hf-border)] px-4 py-3"
        >
          <div class="flex items-center justify-between gap-3">
            <USkeleton class="h-4 w-24 !rounded" />
            <USkeleton class="h-4 w-16 !rounded" />
          </div>
          <USkeleton class="h-3 w-40 !rounded" />
        </div>
      </div>
    </div>

    <!-- Failure with nothing valid to show: one message, one way out. -->
    <EmptyState
      v-else-if="isError && !report && isRowLimitError"
      data-testid="seller-report-error"
      data-failure-kind="row-limit-exceeded"
      kind="error"
      title="No se pudo cargar el reporte"
      :description="errorMessage ?? undefined"
      action-label="Cambiar periodo"
      action-icon="i-lucide-calendar"
      action-test-id="seller-report-change-period"
      @action="emit('change-period')"
    />
    <EmptyState
      v-else-if="isError && !report"
      data-testid="seller-report-error"
      :data-failure-kind="failureKind ?? undefined"
      kind="error"
      title="No se pudo cargar el reporte"
      :description="errorMessage ?? undefined"
      action-label="Reintentar"
      action-test-id="seller-report-retry"
      @action="emit('retry')"
    />

    <p
      v-else-if="!report"
      data-testid="seller-report-idle"
      role="status"
      class="text-sm text-muted"
    >
      No hay una consulta activa para este reporte.
    </p>

    <div v-else data-testid="seller-report-summary" class="flex min-w-0 flex-col gap-3">
      <p
        v-if="!sellerIsActive"
        data-testid="seller-report-inactive-note"
        role="status"
        class="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--hf-warning)_35%,var(--hf-warning-soft))] bg-[var(--hf-warning-soft)] px-3 py-2 text-[13px] text-[var(--hf-warning)]"
      >
        <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>Este vendedor está inactivo; el reporte muestra las ventas que ya tenía confirmadas.</span>
      </p>

      <dl
        data-testid="seller-report-metrics"
        aria-label="Resumen del periodo"
        class="grid min-w-0 grid-cols-2 overflow-hidden rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)] md:grid-cols-5"
      >
        <div
          data-testid="seller-report-metric-sale-count"
          class="grid min-w-0 content-start gap-0.5 px-3 py-3"
        >
          <dt class="truncate text-xs font-medium text-[var(--hf-muted)]">Ventas</dt>
          <dd class="hf-figure truncate text-base font-semibold text-[var(--hf-heading)]">
            {{ formatSellerReportCount(report.confirmed.summary.saleCount) }}
          </dd>
        </div>
        <div
          data-testid="seller-report-metric-net-sales"
          class="grid min-w-0 content-start gap-0.5 border-l border-[var(--hf-border)] px-3 py-3"
        >
          <dt class="truncate text-xs font-medium text-[var(--hf-muted)]">Ventas netas</dt>
          <dd class="grid min-w-0 gap-0.5">
            <span class="hf-figure truncate text-base font-semibold text-[var(--hf-heading)]">
              {{ formatSellerReportCents(report.confirmed.summary.netSalesCents) }}
            </span>
            <span
              v-if="previousComparison"
              data-testid="seller-report-previous-period"
              :data-trend="previousComparison.trend"
              :title="previousComparison.title"
              class="flex min-w-0 items-start gap-1 text-xs text-[var(--hf-muted)]"
            >
              <UIcon
                :name="TREND_ICONS[previousComparison.trend]"
                class="mt-px size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span class="hf-figure min-w-0">{{ previousComparison.label }}</span>
              <span class="sr-only">. {{ previousComparison.title }}</span>
            </span>
          </dd>
        </div>
        <div
          data-testid="seller-report-metric-collected"
          class="grid min-w-0 content-start gap-0.5 border-t border-[var(--hf-border)] px-3 py-3 md:border-l md:border-t-0"
        >
          <dt class="truncate text-xs font-medium text-[var(--hf-muted)]">Cobrado</dt>
          <dd class="hf-figure truncate text-base font-semibold text-[var(--hf-heading)]">
            {{ formatSellerReportCents(report.confirmed.summary.collectedCents) }}
          </dd>
        </div>
        <div
          data-testid="seller-report-metric-outstanding"
          class="grid min-w-0 content-start gap-0.5 border-l border-t border-[var(--hf-border)] px-3 py-3 md:border-t-0"
          :class="{ 'bg-[var(--hf-warning-soft)]': hasDebt }"
        >
          <dt class="truncate text-xs font-medium text-[var(--hf-muted)]">Saldo pendiente</dt>
          <dd
            class="hf-figure truncate text-base font-semibold"
            :class="hasDebt ? 'text-[var(--hf-warning)]' : 'text-[var(--hf-heading)]'"
          >
            {{ formatSellerReportCents(report.confirmed.summary.outstandingDebtCents) }}
          </dd>
        </div>
        <div
          data-testid="seller-report-metric-average-ticket"
          class="col-span-2 grid min-w-0 content-start gap-0.5 border-t border-[var(--hf-border)] px-3 py-3 md:col-span-1 md:border-l md:border-t-0"
        >
          <dt class="truncate text-xs font-medium text-[var(--hf-muted)]">Ticket promedio</dt>
          <dd class="hf-figure truncate text-base font-semibold text-[var(--hf-heading)]">
            {{ formatSellerReportCents(report.confirmed.summary.averageTicketCents) }}
          </dd>
        </div>
      </dl>

      <!--
        Approved business rule: the report is attributed to the CURRENTLY assigned
        seller, and a reassignment also moves past periods in this report. Without
        this disclosure the metrics could read as "sold by this person", and the
        current balances caveat must stay next to it.
      -->
      <details
        data-testid="seller-report-attribution"
        class="rounded-lg bg-[var(--hf-active-soft)] px-3 py-2 text-[13px] text-[var(--hf-ink)]"
      >
        <summary class="flex min-h-6 cursor-pointer list-none items-start gap-2">
          <UIcon
            name="i-lucide-info"
            class="mt-0.5 size-4 shrink-0 text-[var(--hf-active)]"
            aria-hidden="true"
          />
          <span>
            Ventas atribuidas al vendedor asignado actualmente. Saldos actuales al generar el
            reporte.
            <span class="font-medium text-[var(--hf-action)] underline">Qué significa</span>
          </span>
        </summary>
        <p class="mb-0 ml-6 mt-1 text-[var(--hf-muted)]">
          Si una venta se reasigna a otro vendedor, su atribución cambia también en este reporte de
          periodos anteriores. Los cobros y saldos se leen al generar el reporte.
        </p>
      </details>

      <div
        v-if="isRefreshing"
        data-testid="seller-report-refreshing"
        role="status"
        aria-live="polite"
        class="flex min-w-0 items-center gap-2 rounded-lg bg-[var(--hf-active-soft)] px-3 py-2 text-[13px] text-[var(--hf-active)]"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-4 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span>Actualizando el reporte…</span>
      </div>

      <EmptyState
        v-if="periodIsEmpty"
        data-testid="seller-report-period-empty"
        title="Sin ventas en este periodo"
        :description="`${report.seller.name} no tiene ventas confirmadas ni canceladas en este periodo.`"
        :action-label="canWidenPeriod ? 'Ver este mes' : undefined"
        action-test-id="seller-report-widen-period"
        @action="emit('widen-period')"
      />

      <div
        v-else
        class="flex min-w-0 flex-col gap-3"
        :aria-busy="isRefreshing || undefined"
        :class="{ 'opacity-60': isRefreshing }"
      >
        <SellerReportDailyChart v-if="dailyTotals" :days="dailyTotals" :compact="isPhone" />
        <SellerReportTopProducts v-if="topProducts" :products="topProducts" />

        <div
          v-if="allConfirmed.length > 0"
          class="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center"
        >
          <UInput
            v-model="search"
            data-testid="seller-report-search"
            type="search"
            icon="i-lucide-search"
            size="lg"
            placeholder="Buscar por folio..."
            aria-label="Buscar ventas del reporte por folio"
            class="w-full md:w-auto md:min-w-40 md:flex-1"
          />
          <div
            role="group"
            aria-label="Filtrar por estado de pago"
            class="flex min-w-0 flex-wrap gap-2"
          >
            <button
              v-for="chip in statusChips"
              :key="chip.value"
              type="button"
              data-testid="seller-report-status-chip"
              class="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-[var(--hf-muted)] bg-[var(--hf-surface)] px-3 text-[13px] font-medium text-[var(--hf-ink)] hover:bg-[var(--hf-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hf-focus)] aria-pressed:border-[var(--hf-active)] aria-pressed:bg-[var(--hf-active-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--hf-active)] md:min-h-9"
              :aria-pressed="status === chip.value"
              @click="status = chip.value"
            >
              <UIcon
                v-if="status === chip.value"
                name="i-lucide-check"
                class="size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span class="truncate">{{ chip.label }}</span>
            </button>
          </div>
        </div>

        <section class="flex min-w-0 flex-col gap-2" aria-labelledby="seller-report-confirmed-title">
          <div class="flex min-w-0 items-baseline gap-2">
            <h3
              id="seller-report-confirmed-title"
              class="text-base font-semibold text-[var(--hf-heading)]"
            >
              Ventas confirmadas
            </h3>
            <span
              data-testid="seller-report-confirmed-count"
              class="hf-figure text-[13px] text-[var(--hf-muted)]"
              >{{ confirmedCountLabel }}</span
            >
          </div>

          <p
            v-if="allConfirmed.length === 0"
            data-testid="seller-report-confirmed-empty"
            class="m-0 rounded-xl border border-[var(--hf-border)] px-4 py-4 text-center text-sm text-[var(--hf-muted)]"
          >
            Sin ventas confirmadas en el periodo
          </p>
          <EmptyState
            v-else-if="filteredConfirmed.length === 0"
            data-testid="seller-report-filter-empty"
            kind="no-match"
            title="Ninguna venta coincide con el filtro"
            description="Las cifras del periodo no cambian con la búsqueda ni con el estado."
            action-label="Ver todas"
            @action="clearFilters"
          />
          <template v-else>
            <div data-testid="seller-report-confirmed-table">
              <SellerReportSalesList
                :sales="visibleConfirmed"
                :layout="listLayout"
                :caption="listCaption"
              />
            </div>
            <div v-if="remainingCount > 0" class="flex min-w-0 flex-wrap items-center gap-3">
              <UButton
                data-testid="seller-report-show-more"
                color="neutral"
                variant="ghost"
                icon="i-lucide-chevron-down"
                class="min-h-11 text-[var(--hf-action)]"
                @click="showMore"
              >
                Mostrar las {{ formatSellerReportCount(remainingCount) }} ventas restantes
              </UButton>
              <span class="hf-figure text-[13px] text-[var(--hf-muted)]">
                {{ formatSellerReportCount(visibleConfirmed.length) }} de
                {{ formatSellerReportCount(filteredConfirmed.length) }} visibles
              </span>
            </div>
          </template>
        </section>

        <details
          data-testid="seller-report-canceled"
          class="group min-w-0 rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)]"
        >
          <summary
            class="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-[var(--hf-heading)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--hf-focus)]"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 shrink-0 text-[var(--hf-muted)] transition-transform group-open:rotate-90 motion-reduce:transition-none"
              aria-hidden="true"
            />
            <UIcon name="i-lucide-ban" class="size-4 shrink-0 text-[var(--hf-muted)]" aria-hidden="true" />
            <span class="shrink-0">Ventas canceladas</span>
            <span class="hf-figure min-w-0 truncate text-[13px] font-normal text-[var(--hf-muted)]"
              >{{ formatSellerReportCount(report.canceled.saleCount) }} · informativas, no suman a
              las ventas netas ni a los saldos</span
            >
          </summary>

          <div class="grid min-w-0 gap-2 border-t border-[var(--hf-border)] p-3">
            <p data-testid="seller-report-canceled-note" class="m-0 text-xs text-[var(--hf-muted)]">
              Los montos de esta sección son informativos. No se suman a las ventas confirmadas ni a
              los saldos actuales.
            </p>
            <p
              v-if="report.canceled.rows.length === 0"
              data-testid="seller-report-canceled-empty"
              class="m-0 py-2 text-center text-sm text-[var(--hf-muted)]"
            >
              Sin ventas canceladas en el periodo
            </p>
            <ul
              v-else-if="listLayout === 'cards'"
              data-testid="seller-report-canceled-cards"
              class="grid min-w-0 gap-2"
              aria-label="Ventas canceladas"
            >
              <li
                v-for="sale in report.canceled.rows"
                :key="sale.id"
                data-testid="seller-report-canceled-card"
                :data-row-id="sale.id"
                class="grid min-w-0 gap-0.5 rounded-lg border border-[var(--hf-border)] px-3 py-2 text-[13px] text-[var(--hf-muted)]"
              >
                <span class="flex min-w-0 items-baseline justify-between gap-3">
                  <span class="min-w-0 break-all font-semibold">{{ sale.folio ?? 'Sin folio' }}</span>
                  <span class="hf-figure shrink-0 font-semibold">{{
                    formatSellerReportCents(sale.totalCents)
                  }}</span>
                </span>
                <span
                  v-if="sellerReportCustomerLabel(sale.customer) !== null"
                  data-testid="seller-report-row-customer"
                  class="min-w-0 truncate text-[var(--hf-ink)]"
                  :title="sellerReportCustomerLabel(sale.customer) ?? undefined"
                  >{{ sellerReportCustomerLabel(sale.customer) }}</span
                >
                <span
                  >Confirmada:
                  {{ sale.confirmedAt ? formatSellerReportInstant(sale.confirmedAt) : '—' }}</span
                >
                <span>Cancelada: {{ formatSellerReportInstant(sale.canceledAt) }}</span>
                <span class="mt-1 flex"><StatusBadge label="Cancelada" /></span>
              </li>
            </ul>
            <div
              v-else
              data-testid="seller-report-canceled-table"
              class="min-w-0 overflow-hidden rounded-lg border border-[var(--hf-border)]"
            >
              <table class="hf-plain-table w-full table-fixed border-collapse text-sm">
                <caption class="sr-only">
                  Ventas canceladas del periodo
                </caption>
                <colgroup>
                  <col />
                  <col class="w-[11rem]" />
                  <col class="w-[7rem]" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" class="h-10 px-3 text-left">Venta</th>
                    <th scope="col" class="h-10 px-3 text-left">Cancelada</th>
                    <th scope="col" class="h-10 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="sale in report.canceled.rows"
                    :key="sale.id"
                    :data-row-id="sale.id"
                    class="text-[var(--hf-muted)]"
                  >
                    <td class="min-w-0 px-3 py-2.5">
                      <span class="flex min-w-0 items-center gap-2">
                        <span class="min-w-0 truncate font-semibold">{{
                          sale.folio ?? 'Sin folio'
                        }}</span>
                        <StatusBadge label="Cancelada" />
                      </span>
                      <span
                        v-if="sellerReportCustomerLabel(sale.customer) !== null"
                        data-testid="seller-report-row-customer"
                        class="block truncate text-[13px] text-[var(--hf-ink)]"
                        :title="sellerReportCustomerLabel(sale.customer) ?? undefined"
                        >{{ sellerReportCustomerLabel(sale.customer) }}</span
                      >
                      <span class="block truncate text-[13px]"
                        >Confirmada:
                        {{
                          sale.confirmedAt ? formatSellerReportInstant(sale.confirmedAt) : '—'
                        }}</span
                      >
                    </td>
                    <td class="px-3 py-2.5 text-[13px]">
                      {{ formatSellerReportInstant(sale.canceledAt) }}
                    </td>
                    <td class="hf-figure px-3 py-2.5 text-right">
                      {{ formatSellerReportCents(sale.totalCents) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>
