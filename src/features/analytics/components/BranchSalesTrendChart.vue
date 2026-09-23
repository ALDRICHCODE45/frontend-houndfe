<script setup lang="ts">
/**
 * BranchSalesTrendChart — presentational single-series daily trend for the
 * branch sales summary (ODD dashboard-operational-insights OI-5A).
 *
 * Presentational only: it imports no API client and no composable, opens no
 * query and makes no request. Its single piece of own state is the selected
 * metric; everything else arrives as props and every recovery goes out as one
 * `retry` event that the route view routes into the guarded OI-4 retry.
 *
 * Locked contract:
 *   - The six metric fields the backend already returned are the complete
 *     selector. One metric is shown at a time and read 1:1 from each point;
 *     points are consumed in backend order, and the X position is the array
 *     index only. Nothing is sorted, filled, aggregated, totalled, compared,
 *     forecast or derived.
 *   - Values are never reachable only through the SVG: a keyboard-reachable
 *     native `<details>/<summary>` always opens a semantic table with the exact
 *     backend dates and the exact selected-metric values in backend order.
 *   - The chart region is an image with a metric+window label; the compact
 *     description explains what the selected value IS and claims no aggregate.
 *   - The chart owns its own loading / refreshing / error-without-data /
 *     stale-data-with-error / empty / data states, so a chart failure can never
 *     erase loaded summary KPIs (and a summary failure cannot hide the chart).
 *
 * Unovis theming: 1.7.0 detects dark mode only through its own selectors
 * (`html[data-theme="dark"]`, `html.dark-theme`, ...). The app uses `html.dark`,
 * so the `.dark` overrides below are required chrome, not decoration.
 */
import { computed, shallowRef, useId } from 'vue'
import { VisArea, VisAxis, VisLine, VisXYContainer } from '@unovis/vue'
import type { BranchSalesTimeseriesPoint } from '../interfaces/branch-sales-timeseries.types'
import {
  BRANCH_SALES_TIMESERIES_METRICS,
  DEFAULT_BRANCH_SALES_TIMESERIES_METRIC,
  buildBranchSalesTimeseriesChartLabel,
  formatBranchSalesTimeseriesDate,
  formatBranchSalesTimeseriesValue,
  getBranchSalesTimeseriesMetric,
  readBranchSalesTimeseriesValue,
  type BranchSalesTimeseriesMetricKey,
} from '../utils/branchSalesTimeseries.utils'

const props = withDefaults(
  defineProps<{
    /** Backend buckets, exactly as returned and in backend order. */
    points: BranchSalesTimeseriesPoint[]
    /** Inclusive `YYYY-MM-DD` boundary of the window that produced `points`. */
    from: string
    /** Exclusive `YYYY-MM-DD` boundary of the window that produced `points`. */
    to: string
    /** First load with no data yet. */
    isInitialLoading?: boolean
    /** Background refresh while previous points stay rendered. */
    isRefetching?: boolean
    /** Query failure; combined with `points` it means stale data + error. */
    isError?: boolean
  }>(),
  { isInitialLoading: false, isRefetching: false, isError: false },
)

/** One recovery request; the parent owns the guarded action behind it. */
const emit = defineEmits<{ retry: [] }>()

/** The only state this component owns: which backend field is displayed. */
const selectedKey = shallowRef<BranchSalesTimeseriesMetricKey>(
  DEFAULT_BRANCH_SALES_TIMESERIES_METRIC,
)

const selectedMetric = computed(() => getBranchSalesTimeseriesMetric(selectedKey.value))

const hasPoints = computed(() => props.points.length > 0)
const showLoading = computed(() => props.isInitialLoading && !hasPoints.value)
const showError = computed(() => props.isError && !hasPoints.value)
const showEmpty = computed(() => !hasPoints.value && !props.isInitialLoading && !props.isError)

const chartLabel = computed(() =>
  buildBranchSalesTimeseriesChartLabel(selectedKey.value, props.from, props.to),
)

const tableCaption = computed(
  () =>
    `${selectedMetric.value.label} por día del ${props.from} al ${props.to} (Hasta excluyente).`,
)

/** Series colors are Coco tokens resolved by CSS, so both themes stay on-brand. */
const AREA_FILL = 'var(--coco-chart-area)'
const LINE_STROKE = 'var(--coco-chart-line)'

/**
 * X placement is the backend array index ONLY. The array is never sorted,
 * deduplicated or reordered, so column N is always backend bucket N.
 */
function xAccessor(_point: BranchSalesTimeseriesPoint, index: number): number {
  return index
}

/**
 * One 1:1 field accessor.
 *
 * `key` is captured INSIDE the computed getter, so the getter itself depends on
 * `selectedKey` and produces a NEW callback identity per metric. Reading the ref
 * only inside the returned closure (as an earlier revision did) left the identity
 * stable, and Unovis compares a component's merged config by value: an unchanged
 * accessor reference makes `setConfig` + `render()` be skipped, so the series
 * kept the previous metric's geometry.
 */
const yAccessor = computed(() => {
  const key = selectedKey.value
  return (point: BranchSalesTimeseriesPoint): number => readBranchSalesTimeseriesValue(point, key)
})

/** One candidate tick per backend bucket; Unovis picks the subset that fits. */
const xTickValues = computed(() => props.points.map((_point, index) => index))

/**
 * Index -> exact backend date label. The label is derived from the `YYYY-MM-DD`
 * string itself, so no browser time zone can shift the displayed day.
 */
const xTickFormat = computed(() => (tick: number | Date): string => {
  if (typeof tick !== 'number' || !Number.isInteger(tick)) return ''
  const point = props.points[tick]
  return point ? formatBranchSalesTimeseriesDate(point.date) : ''
})

/**
 * Y ticks use the same formatter as the table, so axis and values agree. The
 * metric is captured inside the getter for the same identity reason as
 * `yAccessor`: a stable formatter reference would leave the old metric's axis
 * labels on screen.
 */
const yTickFormat = computed(() => {
  const key = selectedKey.value
  return (tick: number | Date): string =>
    typeof tick === 'number' ? formatBranchSalesTimeseriesValue(key, tick) : ''
})

function selectMetric(key: BranchSalesTimeseriesMetricKey) {
  selectedKey.value = key
}

function onRetry() {
  emit('retry')
}

const uid = useId()
const headingId = `${uid}-heading`
</script>

<template>
  <section
    data-testid="branch-sales-trend"
    :aria-labelledby="headingId"
    class="flex min-w-0 flex-col gap-3 rounded-xl border border-default bg-default p-3 lg:p-4"
  >
    <div class="flex min-w-0 flex-col gap-1">
      <h2 :id="headingId" class="text-sm font-semibold text-highlighted">Tendencia diaria</h2>
      <p
        v-if="hasPoints"
        data-testid="branch-sales-trend-description"
        class="text-xs leading-relaxed text-muted"
      >
        {{ selectedMetric.description }}
      </p>
    </div>

    <!-- Background refresh: the rendered series stays put. -->
    <div
      v-if="hasPoints && props.isRefetching"
      data-testid="branch-sales-trend-refreshing"
      role="status"
      aria-live="polite"
      class="flex min-w-0 items-center gap-2 text-xs text-muted"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-4 shrink-0 animate-spin"
        aria-hidden="true"
      />
      <span>Actualizando la tendencia…</span>
    </div>

    <!--
      Stale data + error: keep the last series, warn compactly, one recovery.
      Mutually exclusive with the refresh status above: while a retry is still in
      flight the polite refresh announcement owns the live region, and this alert
      only appears once fetching has stopped and the error remains. Two live
      regions at once would announce overlapping state.
    -->
    <div
      v-if="hasPoints && props.isError && !props.isRefetching"
      data-testid="branch-sales-trend-refresh-error"
      role="alert"
      class="flex min-w-0 flex-col items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-sm text-warning">
        No pudimos actualizar la tendencia; se muestran los últimos datos disponibles.
      </p>
      <UButton
        color="warning"
        variant="outline"
        data-testid="branch-sales-trend-refresh-retry"
        class="min-h-11 w-full justify-center sm:w-auto"
        @click="onRetry"
      >
        Reintentar
      </UButton>
    </div>

    <!-- Initial load: accessible skeleton, never a synthetic series. -->
    <div
      v-if="showLoading"
      data-testid="branch-sales-trend-loading"
      role="status"
      aria-busy="true"
      class="flex min-w-0 flex-col gap-2"
    >
      <span class="sr-only">Cargando la tendencia diaria…</span>
      <USkeleton class="h-56 w-full" />
    </div>

    <!-- Error with no data: chart-scoped copy and one guarded recovery. -->
    <div
      v-else-if="showError"
      data-testid="branch-sales-trend-error"
      role="alert"
      class="flex min-w-0 flex-col items-start gap-3 rounded-lg border border-error/30 bg-error/5 p-3"
    >
      <p class="text-sm text-error">
        No pudimos cargar la tendencia diaria. Reintenta en unos segundos.
      </p>
      <UButton
        color="primary"
        data-testid="branch-sales-trend-retry"
        class="min-h-11"
        @click="onRetry"
      >
        Reintentar
      </UButton>
    </div>

    <!-- Empty: the backend returned no bucket at all for the window. -->
    <p
      v-else-if="showEmpty"
      data-testid="branch-sales-trend-empty"
      role="status"
      class="rounded-lg border border-default bg-elevated/40 p-4 text-center text-sm text-muted"
    >
      Sin datos diarios en el periodo seleccionado.
    </p>

    <template v-else-if="hasPoints">
      <!-- One metric at a time: a semantic group of native pressed-state buttons. -->
      <div
        data-testid="branch-sales-trend-metrics"
        role="group"
        aria-label="Métrica de la tendencia"
        class="flex min-w-0 flex-wrap gap-2"
      >
        <UButton
          v-for="metric in BRANCH_SALES_TIMESERIES_METRICS"
          :key="metric.key"
          type="button"
          data-testid="branch-sales-trend-metric"
          :data-metric-key="metric.key"
          :variant="selectedKey === metric.key ? 'solid' : 'outline'"
          :color="selectedKey === metric.key ? 'primary' : 'neutral'"
          :aria-pressed="selectedKey === metric.key ? 'true' : 'false'"
          class="min-h-11 focus-visible:ring-2 focus-visible:ring-coco-500/60 focus-visible:outline-none"
          @click="selectMetric(metric.key)"
        >
          {{ metric.label }}
        </UButton>
      </div>

      <!--
        Chart region. The wrapper carries the Coco series variables and the
        `.dark` chrome overrides; Unovis resolves `var()` inside its fill/stroke
        presentation values, so both themes follow the tokens.
      -->
      <div
        data-testid="branch-sales-trend-chart"
        role="img"
        :aria-label="chartLabel"
        class="branch-sales-trend-chart min-w-0 overflow-hidden rounded-lg"
      >
        <!--
          `:key` is load-bearing, not cosmetic. Unovis recomputes the shared X/Y
          scale domains only inside the CONTAINER's `_preRender`, and a metric
          switch changes only a component-level accessor: the component
          re-renders its path, but the container never re-runs `_preRender`, so
          the previous metric's Y domain and its tick labels stay in the DOM
          (verified in a real browser: cents-scale ticks survived next to the new
          count ticks). Keying the container on the selected metric recreates it
          when the series identity changes, which recomputes the domains from the
          new accessor and leaves exactly one correct Y axis.
        -->
        <VisXYContainer
          :key="selectedKey"
          :data="props.points"
          :prevent-empty-domain="true"
          class="h-56 w-full min-w-0 sm:h-64"
        >
          <VisArea :x="xAccessor" :y="yAccessor" :color="AREA_FILL" />
          <VisLine :x="xAccessor" :y="yAccessor" :color="LINE_STROKE" :line-width="2" />
          <VisAxis
            type="x"
            position="bottom"
            :tick-values="xTickValues"
            :tick-format="xTickFormat"
            :tick-text-adaptive-sets="true"
            :tick-text-hide-overlapping="true"
            :grid-line="false"
            :tick-line="false"
            :domain-line="false"
          />
          <VisAxis
            type="y"
            position="left"
            :num-ticks="4"
            :tick-format="yTickFormat"
            :grid-line="true"
            :tick-line="false"
            :domain-line="false"
          />
        </VisXYContainer>
      </div>

      <!--
        Keyboard-reachable alternative that never depends on SVG or hover: a
        native disclosure in front of a semantic table with the exact backend
        dates and the exact selected-metric values in backend order.
      -->
      <details data-testid="branch-sales-trend-table-details" class="min-w-0">
        <summary
          data-testid="branch-sales-trend-table-summary"
          class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 text-sm font-medium text-highlighted focus-visible:ring-2 focus-visible:ring-coco-500/60 focus-visible:outline-none"
        >
          <UIcon name="i-lucide-table-2" aria-hidden="true" class="size-4 shrink-0" />
          <span>Ver la tabla de datos</span>
        </summary>

        <div class="mt-2 min-w-0 overflow-x-auto">
          <table
            data-testid="branch-sales-trend-table"
            class="w-full min-w-0 border-collapse text-left"
          >
            <caption class="px-1 py-2 text-left text-xs text-muted">
              {{
                tableCaption
              }}
            </caption>
            <thead>
              <tr class="border-b border-default">
                <th scope="col" class="px-1 py-2 text-xs font-semibold text-muted">Fecha</th>
                <th scope="col" class="px-1 py-2 text-right text-xs font-semibold text-muted">
                  {{ selectedMetric.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="point in props.points"
                :key="point.date"
                class="border-b border-default/60"
              >
                <th
                  scope="row"
                  data-testid="branch-sales-trend-date"
                  class="px-1 py-2 text-left text-xs font-normal tabular-nums text-default"
                >
                  {{ point.date }}
                </th>
                <td
                  data-testid="branch-sales-trend-value"
                  class="px-1 py-2 text-right text-sm font-medium tabular-nums text-highlighted"
                >
                  {{
                    formatBranchSalesTimeseriesValue(
                      selectedKey,
                      readBranchSalesTimeseriesValue(point, selectedKey),
                    )
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </section>
</template>

<style scoped>
/*
 * Coco series colors plus Unovis chrome, expressed only through Coco tokens.
 * The wrapper is the inheritance root for everything Unovis renders below it.
 */
.branch-sales-trend-chart {
  --coco-chart-area: var(--color-coco-500);
  --coco-chart-line: var(--color-coco-600);
  --vis-area-fill-opacity: 0.22;
  --vis-axis-grid-color: var(--color-coco-neutral-200);
  --vis-axis-tick-color: var(--color-coco-neutral-300);
  --vis-axis-domain-color: var(--color-coco-neutral-300);
  --vis-axis-tick-label-color: var(--color-coco-neutral-700);
  --vis-axis-tick-label-font-size: 10px;
}

/*
 * Unovis 1.7.0 enables its dark palette only for `html[data-theme="dark"]`,
 * `html.dark-theme`, `body.dark-theme`, `html.theme-dark` and
 * `body.theme-dark`. The app resolves dark mode with `html.dark`, which Unovis
 * never matches, so the dark values are declared explicitly here.
 */
.dark .branch-sales-trend-chart {
  --coco-chart-area: var(--color-coco-400);
  --coco-chart-line: var(--color-coco-300);
  --vis-area-fill-opacity: 0.3;
  --vis-axis-grid-color: var(--color-coco-neutral-800);
  --vis-axis-tick-color: var(--color-coco-neutral-700);
  --vis-axis-domain-color: var(--color-coco-neutral-700);
  --vis-axis-tick-label-color: var(--color-coco-neutral-300);
}
</style>
