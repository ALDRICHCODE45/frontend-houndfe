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
 */
import { computed, ref, shallowRef } from 'vue'
import {
  getMexicoCityRangePreset,
  isValidMexicoCityDateRange,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import { useBranchSalesSummary } from '../composables/useBranchSalesSummary'
import { useBranchSalesTimeseries } from '../composables/useBranchSalesTimeseries'
import BranchSalesSummaryFilters from '../components/BranchSalesSummaryFilters.vue'
import BranchSalesSummaryMetrics from '../components/BranchSalesSummaryMetrics.vue'
import BranchSalesTrendChart from '../components/BranchSalesTrendChart.vue'

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
</script>

<template>
  <div data-testid="branch-sales-summary-view" class="flex w-full min-w-0 flex-col gap-6 md:px-10">
    <UCard
      data-testid="branch-summary-card"
      :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }"
      class="w-full min-w-0 max-w-full overflow-hidden shadow-sm"
    >
      <template #header>
        <TableHeaderDescription
          description="Ventas, cobros y reembolsos de la sucursal en el periodo seleccionado."
          title="Resumen de ventas"
        />
        <p data-testid="branch-summary-range" class="text-muted mt-1 text-xs">
          {{ from }} → {{ to }}
        </p>
      </template>

      <div class="flex w-full min-w-0 flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4">
        <!--
          Retained-data indicators only exist while a summary is already on
          screen, so the empty result and the live metrics both keep them.
        -->
        <template v-if="hasLoadedSummary">
          <div
            v-if="summaryState.isRefetching.value"
            data-testid="branch-summary-refreshing"
            aria-live="polite"
            class="flex min-w-0 items-center gap-2 text-xs text-muted"
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
            class="flex min-w-0 flex-col items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p data-testid="branch-summary-refresh-error-message" class="text-sm text-warning">
              No pudimos actualizar el resumen; se muestran los últimos datos disponibles.
            </p>
            <UButton
              color="warning"
              variant="outline"
              data-testid="branch-summary-refresh-retry"
              class="min-h-11 w-full justify-center sm:w-auto"
              @click="onRetry"
            >
              Reintentar
            </UButton>
          </div>
        </template>

        <!--
          Loaded non-empty metrics own the single filters instance through the
          metrics `controls` slot. That places the controls adjacent to the
          net-sales hero at `lg` while the secondary KPI and refund grids span
          the full dashboard width below the overview.
        -->
        <BranchSalesSummaryMetrics v-if="metricsSummary" :summary="metricsSummary">
          <template #controls>
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
          </template>
        </BranchSalesSummaryMetrics>

        <!--
          Every non-metric state (loading, invalid, no-data error, empty, idle)
          keeps exactly one standalone filters panel above its state panel. This
          branch and the metrics slot above are mutually exclusive, so two
          filters panels never render at once.
        -->
        <template v-else>
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

          <!-- Initial load: accessible skeleton, never synthetic metric values. -->
          <div
            v-if="summaryState.isInitialLoading.value"
            data-testid="branch-summary-loading"
            role="status"
            aria-busy="true"
            class="flex min-w-0 flex-col gap-3"
          >
            <span class="sr-only">Cargando el resumen de ventas…</span>
            <USkeleton class="h-5 w-1/3" />
            <div class="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <USkeleton v-for="i in 6" :key="i" class="h-16 w-full" />
            </div>
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
            class="flex min-w-0 flex-col items-start gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
          >
            <p data-testid="branch-summary-error-message" class="text-sm text-error">
              {{ errorMessage }}
            </p>
            <UButton
              color="primary"
              data-testid="branch-summary-retry"
              class="min-h-11"
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
            class="rounded-lg border border-default bg-elevated/40 p-6 text-center"
          >
            <p class="text-sm font-medium text-highlighted">Sin actividad en el periodo</p>
            <p class="mt-1 text-sm text-muted">
              No se registraron ventas ni reembolsos para el rango seleccionado.
            </p>
          </div>

          <!-- No active query (for example, no tenant context yet). -->
          <p v-else data-testid="branch-summary-idle" role="status" class="text-sm text-muted">
            No hay una consulta activa. Inicia sesión con una sucursal para consultar el resumen.
          </p>
        </template>

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
      </div>
    </UCard>
  </div>
</template>
