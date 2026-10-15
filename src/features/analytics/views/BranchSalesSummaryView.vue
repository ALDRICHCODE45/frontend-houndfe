<script setup lang="ts">
/**
 * BranchSalesSummaryView — routed composition surface for the branch sales
 * summary screen (ODD branch-sales-summary A3c).
 *
 * Thin composition only: the view owns the two exact `YYYY-MM-DD` Mexico City
 * boundaries, the typed active-preset selection, resolves preset intents through
 * the committed calendar helpers, derives the local range validation, and renders
 * the composable's states. The tenant comes from `useSafeTenantId` for cache
 * isolation only and is never sent to the transport, and no aggregate, currency
 * math or status body is invented.
 *
 * Range semantics (OI-3): `Este mes` is the initial preset, a preset click
 * resolves boundaries through the committed helper and marks that preset active,
 * and a manual boundary edit clears only the selection while preserving the exact
 * edited range and its validation/query behavior.
 *
 * States: initial loading skeleton -> local invalid range -> no-data error
 * (400 / 403 / unexpected) -> loaded empty -> loaded metrics, with retained-data
 * refresh indicator/warning layers and one guarded retry action.
 *
 * OI-5A adds the daily trend as an INDEPENDENT sibling inside the same large
 * card: it consumes the committed `useBranchSalesTimeseries` boundary with the
 * exact same reactive tenant/range sources as the summary, owns its own
 * loading/error/empty states, and routes its single retry event into that
 * composable's guarded action. It is deliberately not nested inside summary
 * success, so neither module's failure can erase the other.
 *
 * OI-5B2 S3 adds the three optional operational modules (recent confirmed sales,
 * debt-bearing sales, pending refunds) as a responsive grid AFTER the trend,
 * inside the same card. Visibility and each composable's `enabled` flag come from
 * the single permission authority `useAuthStore().userCan` — `read:Sale` for the
 * two sales modules, `read:SaleRefund` for refunds — so a denied identity issues
 * no request. Each module is independent: its own composable instance, its own
 * state, and its own scoped retry, so one failure never erases a sibling.
 */
import { computed, ref, shallowRef } from 'vue'
import {
  getMexicoCityRangePreset,
  isValidMexicoCityDateRange,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import '../styles/dashboard-visual.css'
import { useBranchSalesSummary } from '../composables/useBranchSalesSummary'
import { useBranchSalesTimeseries } from '../composables/useBranchSalesTimeseries'
import { useRecentConfirmedSales } from '../composables/useRecentConfirmedSales'
import { useDebtConfirmedSales } from '../composables/useDebtConfirmedSales'
import { usePendingRefunds } from '../composables/usePendingRefunds'
import BranchSalesSummaryFilters from '../components/BranchSalesSummaryFilters.vue'
import BranchSalesSummaryMetrics from '../components/BranchSalesSummaryMetrics.vue'
import BranchSalesTrendChart from '../components/BranchSalesTrendChart.vue'
import DashboardOperationalPanel from '../components/DashboardOperationalPanel.vue'
import DashboardSaleRow from '../components/DashboardSaleRow.vue'
import DashboardRefundRow from '../components/DashboardRefundRow.vue'

const RANGE_VALIDATION_MESSAGE =
  'El rango no es válido: la fecha inicial debe ser anterior a la final y el periodo no puede superar 366 días.'

/** Status-only copy: no backend body, domain error code or status math. */
const ERROR_MESSAGES: Record<number, string> = {
  400: 'El servidor rechazó el rango de fechas. Ajusta el periodo e inténtalo de nuevo.',
  403: 'No tienes permiso para consultar el resumen de ventas de esta sucursal.',
}
const ERROR_FALLBACK_MESSAGE = 'No pudimos cargar el resumen de ventas. Reintenta en unos segundos.'

/** Initial window: the committed current-month preset, resolved once per mount. */
const initialRange = getMexicoCityRangePreset('thisMonth')
const from = ref(initialRange.from)
const to = ref(initialRange.to)

/**
 * The single source of truth for the selected preset. It starts as `thisMonth`
 * and becomes `null` as soon as either boundary is edited manually, so a custom
 * range stays active without any preset pretending to own it.
 */
const activePreset = shallowRef<MexicoCityRangePresetId | null>('thisMonth')

const tenantId = useSafeTenantId()
const summaryState = useBranchSalesSummary({ tenantId, from, to })

/**
 * OI-5A: the daily trend query. Same tenant source and same `from`/`to` refs as
 * the summary, so both boundaries always describe the SAME window, but a
 * separate query key, request and error state.
 */
const timeseriesState = useBranchSalesTimeseries({ tenantId, from, to })

/**
 * OI-5B2 S3: the three optional operational modules. `useAuthStore().userCan` is
 * the single permission authority; the two sales modules share `read:Sale` and
 * refunds require `read:SaleRefund`. The same booleans drive BOTH visibility and
 * each composable's `enabled` guard, so a denied identity renders nothing and
 * issues no request. Each slot is its own independent query/state/retry.
 */
const authStore = useAuthStore()
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))
const canReadRefunds = computed(() => authStore.userCan('read', 'SaleRefund'))
const operationalPanelCount = computed(() => (canReadSales.value ? 2 : 0) + (canReadRefunds.value ? 1 : 0))

const recentSalesState = useRecentConfirmedSales({ tenantId, enabled: canReadSales })
const debtSalesState = useDebtConfirmedSales({ tenantId, enabled: canReadSales })
const pendingRefundsState = usePendingRefunds({ tenantId, enabled: canReadRefunds })

const hasLocalRangeError = computed(() => !isValidMexicoCityDateRange(from.value, to.value))
const validationMessage = computed(() =>
  hasLocalRangeError.value ? RANGE_VALIDATION_MESSAGE : undefined,
)

/**
 * The trend renders only while a query can actually exist: a tenant is resolved
 * and the local range is valid. That keeps a disabled query from being reported
 * as "no daily data", which would be a claim about a window never requested.
 */
const hasTrendQuery = computed(() => Boolean(tenantId.value?.trim()) && !hasLocalRangeError.value)

/**
 * OI-5A metadata binding (verifier finding): the chart's caption and image label
 * must describe the buckets actually ON SCREEN. The OI-4 query keeps the previous
 * payload while a new window is in flight (`keepPreviousData`), so the requested
 * `from`/`to` can already point at a window whose response has not landed. The
 * response's own echoed boundaries are therefore authoritative whenever a
 * response exists, and the requested boundaries are only the fallback for the
 * window before the first response arrives (and while the query is disabled).
 */
const timeseriesBoundFrom = computed(() => timeseriesState.timeseries.value?.from ?? from.value)
const timeseriesBoundTo = computed(() => timeseriesState.timeseries.value?.to ?? to.value)

/**
 * A summary is on screen for every loaded render (empty included), but only a
 * loaded, non-empty summary owns the metric hierarchy. Initial loading, local
 * invalid range, no-data error and idle all fall back to a standalone filters
 * panel plus their state panel.
 */
const hasLoadedSummary = computed(
  () =>
    Boolean(summaryState.summary.value) &&
    !summaryState.isInitialLoading.value &&
    !hasLocalRangeError.value,
)
const metricsSummary = computed(() =>
  hasLoadedSummary.value && !summaryState.isEmpty.value ? summaryState.summary.value : undefined,
)

/** HTTP status is the ONLY error signal consumed for presentation copy. */
function httpStatus(error: unknown): number | undefined {
  const status = (error as { response?: { status?: unknown } } | null | undefined)?.response?.status
  return typeof status === 'number' ? status : undefined
}

const errorMessage = computed(() => {
  const status = httpStatus(summaryState.error.value)
  return (status !== undefined ? ERROR_MESSAGES[status] : undefined) ?? ERROR_FALLBACK_MESSAGE
})

/** Preset intent -> committed helper boundaries; never local date arithmetic. */
function onPreset(id: MexicoCityRangePresetId) {
  const range = getMexicoCityRangePreset(id)
  from.value = range.from
  to.value = range.to
  activePreset.value = id
}

/**
 * Boundary edits stay exact strings; this view never parses or reformats them.
 * A manual edit clears only the preset selection: the emitted date stays exactly
 * as received and the query/validation behavior is unchanged.
 */
function onFromChange(value: string) {
  from.value = value
  activePreset.value = null
}

function onToChange(value: string) {
  to.value = value
  activePreset.value = null
}

/** Guarded retry: the composable alone decides whether a refetch may start. */
function onRetry() {
  void summaryState.retry()
}

/** Guarded trend retry: the OI-4 composable owns the enabled/in-flight guard. */
function onTrendRetry() {
  void timeseriesState.retry()
}

/** Guarded per-module retries: each operational module owns its own request. */
function onRecentSalesRetry() {
  void recentSalesState.retry()
}

function onDebtSalesRetry() {
  void debtSalesState.retry()
}

function onPendingRefundsRetry() {
  void pendingRefundsState.retry()
}
</script>

<template>
  <div data-testid="branch-sales-summary-view" class="hf-theme hf-ui dashboard-visual">
    <div data-testid="branch-summary-card" class="dashboard-inner">
      <header class="dashboard-page-header">
        <div class="dashboard-title-block">
          <div class="dashboard-eyebrow">
            <span class="dashboard-brand-marker" aria-hidden="true" /> CONTROL DE VENTAS
          </div>
          <h1>Resumen de ventas</h1>
          <p>Ventas, cobros y reembolsos de la sucursal en el periodo seleccionado.</p>
          <p data-testid="branch-summary-range" class="sr-only">{{ from }} → {{ to }}</p>
        </div>
        <div data-testid="branch-summary-controls" class="dashboard-header-controls">
          <BranchSalesSummaryFilters
            :from="from"
            :to="to"
            :active-preset="activePreset"
            :loading="summaryState.isInitialLoading.value"
            :validation-message="validationMessage"
            @update:from="onFromChange"
            @update:to="onToChange"
            @preset="onPreset"
          />
        </div>
      </header>

      <div class="dashboard-content">
        <!--
          Retained-data indicators only exist while a summary is already on
          screen, so the empty result and the live metrics both keep them.
        -->
        <template v-if="hasLoadedSummary">
          <div
            v-if="summaryState.isRefetching.value"
            data-testid="branch-summary-refreshing"
            aria-live="polite"
            class="dashboard-refresh-note"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 shrink-0 animate-spin"
              aria-hidden="true"
            />
            <span>Actualizando el resumen…</span>
          </div>

          <!-- Retained-data refresh failure: keep the last data, warn compactly. -->
          <div
            v-if="summaryState.isError.value"
            data-testid="branch-summary-refresh-error"
            role="alert"
            class="dashboard-stale-alert"
          >
            <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
            <p data-testid="branch-summary-refresh-error-message" class="text-sm text-warning">
              No pudimos actualizar el resumen; se muestran los últimos datos disponibles.
            </p>
            <UButton
              color="warning"
              variant="outline"
              data-testid="branch-summary-refresh-retry"
              class="dashboard-retry min-h-11"
              icon="i-lucide-refresh-cw"
              :loading="summaryState.isRefetching.value"
              :disabled="summaryState.isRefetching.value"
              @click="onRetry"
            >
              Reintentar
            </UButton>
          </div>
        </template>

        <div
          class="dashboard-summary-state dashboard-state-content"
          :class="{ 'dashboard-state-refreshing': hasLoadedSummary && summaryState.isRefetching.value }"
        >
        <!-- Period controls live in the header for every independent data state. -->
        <BranchSalesSummaryMetrics
          v-if="metricsSummary"
          :summary="metricsSummary"
          :points="timeseriesState.points.value"
        />

        <template v-else>
          <!-- Initial load: accessible skeleton, never synthetic metric values. -->
          <div
            v-if="summaryState.isInitialLoading.value"
            data-testid="branch-summary-loading"
            role="status"
            aria-busy="true"
            class="dashboard-summary-feedback dashboard-loading-block"
          >
            <span class="sr-only">Cargando el resumen de ventas…</span>
            <USkeleton class="dashboard-state-skeleton h-5 w-40" aria-hidden="true" />
            <USkeleton class="dashboard-state-skeleton h-10 w-56 max-w-full" aria-hidden="true" />
            <USkeleton class="dashboard-state-skeleton w-full flex-1" aria-hidden="true" />
          </div>

          <!-- Local invalid range: the filters own the alert; no new-range claim. -->
          <p
            v-else-if="hasLocalRangeError"
            data-testid="branch-summary-invalid"
            role="status"
            class="text-sm text-muted"
          >
            Ajusta el periodo para volver a consultar el resumen de ventas.
          </p>

          <!-- Error with no data: status-aware copy and one guarded retry. -->
          <div
            v-else-if="summaryState.isError.value && !summaryState.summary.value"
            data-testid="branch-summary-error"
            role="alert"
            class="dashboard-summary-feedback dashboard-error-block"
          >
            <UIcon name="i-lucide-circle-alert" class="size-6 text-error" aria-hidden="true" />
            <p data-testid="branch-summary-error-message" class="text-sm text-error">
              {{ errorMessage }}
            </p>
            <UButton
              color="primary"
              data-testid="branch-summary-retry"
              class="dashboard-retry min-h-11"
              icon="i-lucide-refresh-cw"
              :loading="summaryState.isRefetching.value"
              :disabled="summaryState.isRefetching.value"
              @click="onRetry"
            >
              Reintentar
            </UButton>
          </div>

          <!-- Global empty keys off the composable `isEmpty` only, so refund-only
               activity (non-zero refunds, zero sales) still reaches metrics. -->
          <div
            v-else-if="summaryState.summary.value"
            data-testid="branch-summary-empty"
            role="status"
            class="dashboard-summary-feedback dashboard-empty-block"
          >
            <span class="dashboard-empty-icon" aria-hidden="true">
              <UIcon name="i-lucide-inbox" class="size-[26px]" />
            </span>
            <strong>Sin actividad en el periodo</strong>
            <p class="mt-1 text-sm text-muted">
              No se registraron ventas ni reembolsos para el rango seleccionado.
            </p>
          </div>

          <!-- No active query (for example, no tenant context yet). -->
          <p v-else data-testid="branch-summary-idle" role="status" class="text-sm text-muted">
            No hay una consulta activa. Inicia sesión con una sucursal para consultar el resumen.
          </p>
        </template>

        </div>

        <!--
          OI-5A: the daily trend is an INDEPENDENT sibling of the summary block
          above, inside the same large card. It is deliberately NOT nested inside
          summary success, so a summary failure never hides the trend and a trend
          failure never erases loaded summary KPIs. Its visibility depends only
          on whether the window can be queried at all.

          `from`/`to` are the RESPONSE's echoed window, not the requested one: the
          buckets stay on screen from the previous window while a new one is being
          fetched, so labels must describe the data, not the request.
        -->
        <BranchSalesTrendChart
          v-if="hasTrendQuery"
          :points="timeseriesState.points.value"
          :from="timeseriesBoundFrom"
          :to="timeseriesBoundTo"
          :is-initial-loading="timeseriesState.isInitialLoading.value"
          :is-refetching="timeseriesState.isRefetching.value"
          :is-error="timeseriesState.isError.value"
          @retry="onTrendRetry"
        />

        <!--
          OI-5B2 S3: three optional operational modules AFTER the trend, still
          inside the same card. Each panel is an INDEPENDENT sibling with its own
          permissions, query state and scoped retry, so a fatal failure in one
          never erases a loaded sibling. The outer grid renders only while at
          least one permission grants a module; a denied identity issues no
          request and renders no panel. Sections never overflow on narrow
          viewports and collapse to one column below `lg`.
        -->
        <div
          v-if="canReadSales || canReadRefunds"
          data-testid="branch-summary-operational-grid"
          class="dashboard-panel-grid"
          :data-panel-count="operationalPanelCount"
          :style="{ '--dashboard-panel-count': operationalPanelCount }"
        >
          <DashboardOperationalPanel
            v-if="canReadSales"
            id="dashboard-recent-sales"
            title="Ventas recientes"
            description="Últimas ventas confirmadas de la sucursal."
            icon="i-lucide-receipt-text"
            :has-items="!recentSalesState.isEmpty.value"
            :is-initial-loading="recentSalesState.isInitialLoading.value"
            :is-refetching="recentSalesState.isRefetching.value"
            :is-error="recentSalesState.isError.value"
            loading-message="Cargando las ventas recientes…"
            empty-message="No hay ventas confirmadas en el periodo."
            error-message="No pudimos cargar las ventas recientes."
            @retry="onRecentSalesRetry"
          >
            <DashboardSaleRow
              v-for="sale in recentSalesState.items.value"
              :key="sale.id"
              :sale="sale"
              kind="recent"
            />
          </DashboardOperationalPanel>

          <DashboardOperationalPanel
            v-if="canReadSales"
            id="dashboard-debt-sales"
            title="Ventas con deuda"
            description="Ventas confirmadas con saldo pendiente."
            icon="i-lucide-hand-coins"
            :has-items="!debtSalesState.isEmpty.value"
            :is-initial-loading="debtSalesState.isInitialLoading.value"
            :is-refetching="debtSalesState.isRefetching.value"
            :is-error="debtSalesState.isError.value"
            loading-message="Cargando las ventas con deuda…"
            empty-message="No hay ventas con deuda pendiente."
            error-message="No pudimos cargar las ventas con deuda."
            @retry="onDebtSalesRetry"
          >
            <DashboardSaleRow
              v-for="sale in debtSalesState.items.value"
              :key="sale.id"
              :sale="sale"
              kind="debt"
            />
          </DashboardOperationalPanel>

          <DashboardOperationalPanel
            v-if="canReadRefunds"
            id="dashboard-pending-refunds"
            title="Reembolsos pendientes"
            description="Reembolsos pendientes de liquidar."
            icon="i-lucide-rotate-ccw"
            :has-items="!pendingRefundsState.isEmpty.value"
            :is-initial-loading="pendingRefundsState.isInitialLoading.value"
            :is-refetching="pendingRefundsState.isRefetching.value"
            :is-error="pendingRefundsState.isError.value"
            loading-message="Cargando los reembolsos pendientes…"
            empty-message="No hay reembolsos pendientes."
            error-message="No pudimos cargar los reembolsos pendientes."
            @retry="onPendingRefundsRetry"
          >
            <DashboardRefundRow
              v-for="refund in pendingRefundsState.items.value"
              :key="refund.id"
              :refund="refund"
            />
          </DashboardOperationalPanel>
        </div>
      </div>
      <footer class="dashboard-page-footer">
        <span>HoundFe<span class="dashboard-footer-divider">/</span>Resumen de ventas</span>
        <span>Todos los importes en MXN · Hora de Ciudad de México</span>
      </footer>
    </div>
  </div>
</template>
