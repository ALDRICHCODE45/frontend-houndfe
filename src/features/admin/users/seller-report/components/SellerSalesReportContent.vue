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
import AppBadge from '@/core/shared/components/AppBadge.vue'
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
</script>

<template>
  <div data-testid="seller-report-content" class="flex w-full min-w-0 flex-col gap-4">
    <!-- Initial load: a status, never placeholder numbers. -->
    <div
      v-if="isInitialLoading && !report"
      data-testid="seller-report-loading"
      role="status"
      aria-busy="true"
      class="flex min-w-0 flex-col gap-3"
    >
      <span class="sr-only">Cargando el reporte de ventas…</span>
      <USkeleton class="h-5 w-1/3" />
      <USkeleton class="h-24 w-full" />
    </div>

    <!-- Failure with nothing valid to show: one message, one retry. -->
    <div
      v-else-if="isError && !report"
      data-testid="seller-report-error"
      role="alert"
      class="flex min-w-0 flex-col items-start gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
    >
      <p data-testid="seller-report-error-message" class="text-sm text-error">
        {{ errorMessage }}
      </p>
      <UButton
        color="primary"
        class="min-h-11"
        data-testid="seller-report-retry"
        @click="$emit('retry')"
      >
        Reintentar
      </UButton>
    </div>

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
        <h3 data-testid="seller-report-seller-name" class="text-base font-bold text-highlighted">
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

        <div class="w-full min-w-0 overflow-x-auto">
          <table data-testid="seller-report-confirmed-table" class="w-full min-w-[42rem] text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs text-muted">
                <th scope="col" class="py-2 pr-3 font-medium">Folio</th>
                <th scope="col" class="py-2 pr-3 font-medium">Fecha de confirmación</th>
                <th scope="col" class="py-2 pr-3 font-medium">Estado</th>
                <th scope="col" class="py-2 pr-3 text-right font-medium">Total</th>
                <th scope="col" class="py-2 pr-3 text-right font-medium">Pagado</th>
                <th scope="col" class="py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="sale in report.confirmed.rows"
                :key="sale.id"
                data-testid="seller-report-confirmed-row"
                :data-row-id="sale.id"
                class="border-b border-default/60 align-top"
              >
                <td class="py-2 pr-3">{{ sale.folio ?? 'Sin folio' }}</td>
                <td class="py-2 pr-3">{{ formatSellerReportInstant(sale.confirmedAt) }}</td>
                <td class="py-2 pr-3">
                  <AppBadge
                    :label="SELLER_REPORT_PAYMENT_STATUS_LABELS[sale.paymentStatus]"
                    :tone="SELLER_REPORT_PAYMENT_STATUS_TONES[sale.paymentStatus]"
                  />
                </td>
                <td class="py-2 pr-3 text-right">{{ formatSellerReportCents(sale.totalCents) }}</td>
                <td class="py-2 pr-3 text-right">{{ formatSellerReportCents(sale.paidCents) }}</td>
                <td class="py-2 text-right">{{ formatSellerReportCents(sale.debtCents) }}</td>
              </tr>
              <tr v-if="report.confirmed.rows.length === 0">
                <td
                  data-testid="seller-report-confirmed-empty"
                  colspan="6"
                  class="py-4 text-center text-sm text-muted"
                >
                  Sin ventas confirmadas en el periodo
                </td>
              </tr>
            </tbody>
          </table>
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

        <div class="w-full min-w-0 overflow-x-auto">
          <table data-testid="seller-report-canceled-table" class="w-full min-w-[36rem] text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs text-muted">
                <th scope="col" class="py-2 pr-3 font-medium">Folio</th>
                <th scope="col" class="py-2 pr-3 font-medium">Fecha de confirmación</th>
                <th scope="col" class="py-2 pr-3 font-medium">Fecha de cancelación</th>
                <th scope="col" class="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="sale in report.canceled.rows"
                :key="sale.id"
                data-testid="seller-report-canceled-row"
                :data-row-id="sale.id"
                class="border-b border-default/60 align-top text-muted"
              >
                <td class="py-2 pr-3">{{ sale.folio ?? 'Sin folio' }}</td>
                <td class="py-2 pr-3">
                  {{ sale.confirmedAt ? formatSellerReportInstant(sale.confirmedAt) : '—' }}
                </td>
                <td class="py-2 pr-3">{{ formatSellerReportInstant(sale.canceledAt) }}</td>
                <td class="py-2 text-right">{{ formatSellerReportCents(sale.totalCents) }}</td>
              </tr>
              <tr v-if="report.canceled.rows.length === 0">
                <td
                  data-testid="seller-report-canceled-empty"
                  colspan="4"
                  class="py-4 text-center text-sm text-muted"
                >
                  Sin ventas canceladas en el periodo
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p data-testid="seller-report-row-count" class="text-xs text-muted">
          Filas incluidas: {{ formatSellerReportCount(report.rowCount) }} de
          {{ formatSellerReportCount(report.rowLimit) }}.
        </p>
      </section>
    </div>
  </div>
</template>
