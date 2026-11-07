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
 *     filtered on); calendar boundaries are formatted from their own digits.
 */
import { computed } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useTablePreferences } from '@/core/shared/composables/useTablePreferences'
import type { TableColumn } from '@/core/shared/types/table.types'
import {
  SELLER_REPORT_PAYMENT_STATUS_LABELS,
  SELLER_REPORT_PAYMENT_STATUS_TONES,
  SELLER_REPORT_TIME_ZONE_LABEL,
  formatSellerReportCalendarDate,
  formatSellerReportCents,
  formatSellerReportCount,
  formatSellerReportInstant,
} from '../utils/sellerReportPresentation'
import type { SellerSalesReport } from '../interfaces/seller-report.types'

type ConfirmedRow = SellerSalesReport['confirmed']['rows'][number]
type CanceledRow = SellerSalesReport['canceled']['rows'][number]

const props = defineProps<{
  /** The validated, unmasked snapshot. `null` while loading, idle or failed. */
  report: SellerSalesReport | null
  isInitialLoading: boolean
  isFetching: boolean
  isError: boolean
  errorMessage: string | null
  /** Whether the seller is currently active. Inactive sellers are still reportable. */
  sellerIsActive: boolean
}>()

defineEmits<{ retry: [] }>()

const period = computed(() => {
  if (!props.report) return ''
  return `${formatSellerReportCalendarDate(props.report.from)} → ${formatSellerReportCalendarDate(props.report.to)}`
})

/** A refresh indicator only ever sits on top of an already loaded report. */
const isRefreshing = computed(() => props.report !== null && props.isFetching)

// Both lists on the shared AppDataTable (premium tables S7): order, pins, widths, visibility and
// density saved per user, one layout for every seller. No sorting and no totals row: the browser
// never reorders or sums the backend rows.
const money = { class: { th: 'text-right', td: 'hf-figure text-right' } }
// The drawer is ~45vw (about 570px of table at 1440): the sale column carries the folio and its date
// on a second line, so the status badge and the three amounts keep their whole width without a scroll.
const confirmedColumns: TableColumn<ConfirmedRow>[] = [
  { id: 'sale', header: 'Venta', minSize: 144, enableSorting: false },
  { id: 'paymentStatus', header: 'Estado', size: 120, minSize: 120, enableSorting: false },
  { id: 'totalCents', header: 'Total', size: 104, minSize: 96, enableSorting: false, meta: money },
  { id: 'paidCents', header: 'Pagado', size: 104, minSize: 96, enableSorting: false, meta: money },
  { id: 'debtCents', header: 'Saldo', size: 104, minSize: 96, enableSorting: false, meta: money },
]
const canceledColumns: TableColumn<CanceledRow>[] = [
  { id: 'sale', header: 'Venta', minSize: 160, enableSorting: false },
  { id: 'canceledAt', header: 'Fecha de cancelación', size: 184, minSize: 168, enableSorting: false },
  { id: 'totalCents', header: 'Total', size: 112, minSize: 96, enableSorting: false, meta: money },
]
// The cell slots of AppDataTable type their row loosely; these keep the status lookups typed.
const statusLabel = (sale: ConfirmedRow) => SELLER_REPORT_PAYMENT_STATUS_LABELS[sale.paymentStatus]
const statusTone = (sale: ConfirmedRow) => SELLER_REPORT_PAYMENT_STATUS_TONES[sale.paymentStatus]
const confirmedLayout = useTablePreferences({
  persistKey: 'admin-seller-report-confirmed',
  columnIds: confirmedColumns.map((column) => column.id ?? ''),
})
const canceledLayout = useTablePreferences({
  persistKey: 'admin-seller-report-canceled',
  columnIds: canceledColumns.map((column) => column.id ?? ''),
})
const {
  columnOrder: confirmedOrder,
  columnPinning: confirmedPinning,
  columnSizing: confirmedSizing,
  columnVisibility: confirmedVisibility,
  density: confirmedDensity,
} = confirmedLayout
const {
  columnOrder: canceledOrder,
  columnPinning: canceledPinning,
  columnSizing: canceledSizing,
  columnVisibility: canceledVisibility,
  density: canceledDensity,
} = canceledLayout
</script>

<template>
  <div data-testid="seller-report-content" class="flex w-full min-w-0 flex-col gap-4">
    <!-- Initial load: a skeleton shaped like the report, never placeholder numbers. -->
    <div
      v-if="isInitialLoading && !report"
      data-testid="seller-report-loading"
      role="status"
      aria-busy="true"
      class="flex min-w-0 flex-col gap-4"
    >
      <span class="sr-only">Cargando el reporte de ventas…</span>
      <USkeleton class="h-5 w-1/3" />
      <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <USkeleton v-for="tile in 3" :key="tile" class="h-16 w-full" />
      </div>
      <div class="flex min-w-0 flex-col gap-2">
        <USkeleton v-for="row in 4" :key="row" class="h-10 w-full" />
      </div>
    </div>

    <!-- Failure with nothing valid to show: one message, one retry. -->
    <EmptyState
      v-else-if="isError && !report"
      data-testid="seller-report-error"
      kind="error"
      title="No se pudo cargar el reporte"
      :description="errorMessage ?? undefined"
      action-label="Reintentar"
      action-test-id="seller-report-retry"
      @action="$emit('retry')"
    />

    <p
      v-else-if="!report"
      data-testid="seller-report-idle"
      role="status"
      class="text-sm text-muted"
    >
      No hay una consulta activa para este reporte.
    </p>

    <div v-else data-testid="seller-report-summary" class="flex min-w-0 flex-col gap-5">
      <div
        v-if="isRefreshing"
        data-testid="seller-report-refreshing"
        aria-live="polite"
        class="flex min-w-0 items-center gap-2 text-xs text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-4 shrink-0 animate-spin"
          aria-hidden="true"
        />
        <span>Actualizando el reporte…</span>
      </div>

      <header class="flex min-w-0 flex-col gap-1">
        <h3 data-testid="seller-report-seller-name" class="text-base font-semibold text-highlighted">
          {{ report.seller.name }}
        </h3>
        <p data-testid="seller-report-period" class="text-sm text-muted">Periodo {{ period }}</p>
        <p data-testid="seller-report-generated-at" class="text-xs text-muted">
          Generado el {{ formatSellerReportInstant(report.generatedAt) }}
          <span data-testid="seller-report-zone">· {{ SELLER_REPORT_TIME_ZONE_LABEL }}</span>
        </p>
        <p
          v-if="!sellerIsActive"
          data-testid="seller-report-inactive-note"
          role="status"
          class="mt-1 rounded-lg border border-warning/30 bg-warning/5 p-2 text-xs text-warning"
        >
          Este vendedor está inactivo; el reporte muestra las ventas que ya tenía confirmadas.
        </p>
      </header>

      <section class="flex min-w-0 flex-col gap-3">
        <div class="flex min-w-0 flex-col gap-1">
          <h4 class="text-sm font-semibold text-highlighted">Ventas confirmadas</h4>
          <!--
            Approved business rule: the report is attributed to the CURRENTLY
            assigned seller, and a reassignment also moves past periods in this
            report. Without this disclosure the metrics could read as "sold by this
            person", and the current balances caveat must stay next to it.
          -->
          <p data-testid="seller-report-attribution" class="text-xs text-muted">
            Ventas atribuidas al vendedor asignado actualmente. Si una venta se reasigna a otro
            vendedor, su atribución cambia también en este reporte de periodos anteriores. Los
            cobros y saldos mostrados son los Saldos actuales leídos al generar el reporte.
          </p>
        </div>

        <dl
          data-testid="seller-report-metrics"
          class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          <div
            data-testid="seller-report-metric-sale-count"
            class="rounded-lg border border-default bg-elevated/40 p-3"
          >
            <dt class="text-xs text-muted">Ventas confirmadas</dt>
            <dd class="text-lg font-semibold text-highlighted">
              {{ formatSellerReportCount(report.confirmed.summary.saleCount) }}
            </dd>
          </div>
          <div
            data-testid="seller-report-metric-net-sales"
            class="rounded-lg border border-default bg-elevated/40 p-3"
          >
            <dt class="text-xs text-muted">Ventas netas</dt>
            <dd class="text-lg font-semibold text-highlighted">
              {{ formatSellerReportCents(report.confirmed.summary.netSalesCents) }}
            </dd>
          </div>
          <div
            data-testid="seller-report-metric-collected"
            class="rounded-lg border border-default bg-elevated/40 p-3"
          >
            <dt class="text-xs text-muted">Cobrado</dt>
            <dd class="text-lg font-semibold text-highlighted">
              {{ formatSellerReportCents(report.confirmed.summary.collectedCents) }}
            </dd>
          </div>
          <div
            data-testid="seller-report-metric-outstanding"
            class="rounded-lg border border-default bg-elevated/40 p-3"
          >
            <dt class="text-xs text-muted">Saldo pendiente</dt>
            <dd class="text-lg font-semibold text-highlighted">
              {{ formatSellerReportCents(report.confirmed.summary.outstandingDebtCents) }}
            </dd>
          </div>
          <div
            data-testid="seller-report-metric-average-ticket"
            class="rounded-lg border border-default bg-elevated/40 p-3"
          >
            <dt class="text-xs text-muted">Ticket promedio</dt>
            <dd class="text-lg font-semibold text-highlighted">
              {{ formatSellerReportCents(report.confirmed.summary.averageTicketCents) }}
            </dd>
          </div>
        </dl>

        <div data-testid="seller-report-confirmed-table" class="seller-report-table">
          <AppDataTable
            v-model:column-order="confirmedOrder"
            v-model:column-pinning="confirmedPinning"
            v-model:column-sizing="confirmedSizing"
            v-model:column-visibility="confirmedVisibility"
            v-model:density="confirmedDensity"
            :persist-layout="true"
            :show-toolbar="false"
            :columns="confirmedColumns"
            :data="report.confirmed.rows"
            display-mode="auto"
            mobile-render="cards"
            class="hf-data-table"
            @reset-columns="confirmedLayout.reset"
          >
            <template #sale-cell="{ row }">
              <span class="hf-row-primary" :data-row-id="row.original.id">{{ row.original.folio ?? 'Sin folio' }}</span>
              <span class="hf-row-secondary" title="Fecha de confirmación">{{ formatSellerReportInstant(row.original.confirmedAt) }}</span>
            </template>
            <template #paymentStatus-cell="{ row }">
              <StatusBadge
                :label="statusLabel(row.original)"
                :tone="statusTone(row.original)"
              />
            </template>
            <template #totalCents-cell="{ row }">{{ formatSellerReportCents(row.original.totalCents) }}</template>
            <template #paidCents-cell="{ row }">{{ formatSellerReportCents(row.original.paidCents) }}</template>
            <template #debtCents-cell="{ row }">{{ formatSellerReportCents(row.original.debtCents) }}</template>
            <template #empty>
              <p data-testid="seller-report-confirmed-empty" class="seller-report-empty">
                Sin ventas confirmadas en el periodo
              </p>
            </template>
            <template #cards>
              <p
                v-if="report.confirmed.rows.length === 0"
                data-testid="seller-report-confirmed-empty"
                class="seller-report-empty"
              >
                Sin ventas confirmadas en el periodo
              </p>
              <ul v-else class="seller-report-cards">
                <li
                  v-for="sale in report.confirmed.rows"
                  :key="sale.id"
                  data-testid="seller-report-confirmed-card"
                  class="seller-report-card"
                >
                  <div class="seller-report-card__top">
                    <span class="hf-row-primary" :data-row-id="sale.id">{{ sale.folio ?? 'Sin folio' }}</span>
                    <StatusBadge
                      :label="SELLER_REPORT_PAYMENT_STATUS_LABELS[sale.paymentStatus]"
                      :tone="SELLER_REPORT_PAYMENT_STATUS_TONES[sale.paymentStatus]"
                    />
                  </div>
                  <span class="hf-row-secondary">{{ formatSellerReportInstant(sale.confirmedAt) }}</span>
                  <dl class="seller-report-card__figures">
                    <div><dt>Total</dt><dd class="hf-figure">{{ formatSellerReportCents(sale.totalCents) }}</dd></div>
                    <div><dt>Pagado</dt><dd class="hf-figure">{{ formatSellerReportCents(sale.paidCents) }}</dd></div>
                    <div><dt>Saldo</dt><dd class="hf-figure">{{ formatSellerReportCents(sale.debtCents) }}</dd></div>
                  </dl>
                </li>
              </ul>
            </template>
          </AppDataTable>
        </div>
      </section>

      <section class="flex min-w-0 flex-col gap-3">
        <div class="flex min-w-0 flex-col gap-1">
          <h4 class="text-sm font-semibold text-highlighted">Ventas canceladas</h4>
          <p data-testid="seller-report-canceled-note" class="text-xs text-muted">
            Los montos de esta sección son informativos. No se suman a las ventas confirmadas ni a
            los saldos actuales.
          </p>
        </div>

        <div data-testid="seller-report-canceled-table" class="seller-report-table seller-report-table--canceled">
          <AppDataTable
            v-model:column-order="canceledOrder"
            v-model:column-pinning="canceledPinning"
            v-model:column-sizing="canceledSizing"
            v-model:column-visibility="canceledVisibility"
            v-model:density="canceledDensity"
            :persist-layout="true"
            :show-toolbar="false"
            :columns="canceledColumns"
            :data="report.canceled.rows"
            display-mode="auto"
            mobile-render="cards"
            class="hf-data-table"
            @reset-columns="canceledLayout.reset"
          >
            <template #sale-cell="{ row }">
              <span class="hf-row-primary" :data-row-id="row.original.id">{{ row.original.folio ?? 'Sin folio' }}</span>
              <span class="hf-row-secondary">
                Confirmada: {{ row.original.confirmedAt ? formatSellerReportInstant(row.original.confirmedAt) : '—' }}
              </span>
            </template>
            <template #canceledAt-cell="{ row }">{{ formatSellerReportInstant(row.original.canceledAt) }}</template>
            <template #totalCents-cell="{ row }">{{ formatSellerReportCents(row.original.totalCents) }}</template>
            <template #empty>
              <p data-testid="seller-report-canceled-empty" class="seller-report-empty">
                Sin ventas canceladas en el periodo
              </p>
            </template>
            <template #cards>
              <p
                v-if="report.canceled.rows.length === 0"
                data-testid="seller-report-canceled-empty"
                class="seller-report-empty"
              >
                Sin ventas canceladas en el periodo
              </p>
              <ul v-else class="seller-report-cards">
                <li
                  v-for="sale in report.canceled.rows"
                  :key="sale.id"
                  data-testid="seller-report-canceled-card"
                  class="seller-report-card"
                >
                  <div class="seller-report-card__top">
                    <span class="hf-row-primary" :data-row-id="sale.id">{{ sale.folio ?? 'Sin folio' }}</span>
                    <span class="hf-figure seller-report-card__total">{{ formatSellerReportCents(sale.totalCents) }}</span>
                  </div>
                  <span class="hf-row-secondary">
                    Confirmada: {{ sale.confirmedAt ? formatSellerReportInstant(sale.confirmedAt) : '—' }}
                  </span>
                  <span class="hf-row-secondary">Cancelada: {{ formatSellerReportInstant(sale.canceledAt) }}</span>
                </li>
              </ul>
            </template>
          </AppDataTable>
        </div>

        <p data-testid="seller-report-row-count" class="text-xs text-muted">
          Filas incluidas: {{ formatSellerReportCount(report.rowCount) }} de
          {{ formatSellerReportCount(report.rowLimit) }}.
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* From md each list sits in a bordered card, like every table; phone cards keep their own. */
@media (min-width: 768px) {
  .seller-report-table { overflow: hidden; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); }
}
/* Canceled sales are informative only: their cells read quieter than the confirmed ones. */
.seller-report-table--canceled :deep(td[data-slot='td']) { color: var(--hf-muted); }
.seller-report-empty { margin: 0; padding: 16px 0; color: var(--hf-muted); font-size: 14px; text-align: center; }
.seller-report-cards { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.seller-report-card { display: grid; gap: 2px; min-width: 0; padding: 12px 16px; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); }
.seller-report-card__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.seller-report-card__total { color: var(--hf-heading); font-weight: 600; }
.seller-report-card__figures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 8px 0 0; padding-top: 8px; border-top: 1px solid var(--hf-border); }
.seller-report-card__figures dt { color: var(--hf-muted); font-size: 12px; }
.seller-report-card__figures dd { margin: 0; color: var(--hf-heading); font-size: 14px; font-weight: 600; }
</style>
