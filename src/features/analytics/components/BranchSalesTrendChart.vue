<script setup lang="ts">
/**
 * BranchSalesTrendChart — presentational single-series daily trend for the
 * branch sales summary (ODD dashboard-operational-insights OI-5A).
 *
 * Presentational only: it imports no API client and no composable, opens no
 * query and makes no request. Own state is the selected metric and keyboard
 * position; everything else arrives as props and every recovery goes out as one
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
import { computed, shallowRef, useId, watch } from 'vue'
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import '../styles/dashboard-trend.css'
import type { BranchSalesTimeseriesPoint } from '../interfaces/branch-sales-timeseries.types'
import {
  BRANCH_SALES_TIMESERIES_METRICS,
  DEFAULT_BRANCH_SALES_TIMESERIES_METRIC,
  buildBranchSalesTimeseriesChartLabel,
  formatBranchSalesTimeseriesAxisDate,
  formatBranchSalesTimeseriesAxisTick,
  formatBranchSalesTimeseriesDate,
  formatBranchSalesTimeseriesWindow,
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

/** Local presentation state only; no data transformation. */
const selectedKey = shallowRef<BranchSalesTimeseriesMetricKey>(
  DEFAULT_BRANCH_SALES_TIMESERIES_METRIC,
)

const selectedMetric = computed(() => getBranchSalesTimeseriesMetric(selectedKey.value))

const hasPoints = computed(() => props.points.length > 0)
// A retry from the no-data error keeps the error in place with a busy button
// (`actionLoading`); the skeleton is only for the first load.
const showLoading = computed(() => !hasPoints.value && props.isInitialLoading)
const showError = computed(() => props.isError && !hasPoints.value && !props.isInitialLoading)
const showEmpty = computed(() => !hasPoints.value && !props.isInitialLoading && !props.isError)

const chartLabel = computed(() =>
  buildBranchSalesTimeseriesChartLabel(selectedKey.value, props.from, props.to),
)

const tableCaption = computed(
  () => `${selectedMetric.value.label} por día, del ${formatBranchSalesTimeseriesWindow(props.from, props.to)}`,
)

/** A series with no movement draws a flat line and "$0" ticks; say it in words instead. */
const isFlatSeries = computed(
  () =>
    hasPoints.value &&
    props.points.every((point) => readBranchSalesTimeseriesValue(point, selectedKey.value) === 0),
)

/** With no movement in ANY metric there is nothing to switch between: no tab strip. */
const hasAnyMovement = computed(() =>
  props.points.some((point) =>
    BRANCH_SALES_TIMESERIES_METRICS.some((metric) => readBranchSalesTimeseriesValue(point, metric.key) !== 0),
  ),
)

/** Skeleton shape: the six metric tabs, the grid and a rising run of bars. */
const SKELETON_BARS = [18, 26, 22, 34, 30, 44, 38, 52, 48, 64, 58, 76] as const
const SKELETON_TABS = 6

const LINE_STROKE = 'var(--hf-action)'
const keyboardIndex = shallowRef<number | undefined>()
const keyboardPoint = computed(() =>
  keyboardIndex.value === undefined ? undefined : props.points[keyboardIndex.value],
)
const metricIndex = computed(() =>
  BRANCH_SALES_TIMESERIES_METRICS.findIndex((metric) => metric.key === selectedKey.value),
)

// Reset positions when the window/data changes; never retain an obsolete bucket.
watch(() => props.points, () => { keyboardIndex.value = undefined })

function onChartKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    keyboardIndex.value = undefined
    return
  }
  if (!['ArrowRight', 'ArrowLeft'].includes(event.key) || !hasPoints.value) return
  event.preventDefault()
  keyboardIndex.value = Math.max(0, Math.min(
    props.points.length - 1,
    (keyboardIndex.value ?? -1) + (event.key === 'ArrowRight' ? 1 : -1),
  ))
}

/** Native Unovis positions and follows the pointer; textContent escapes backend strings. */
const tooltipTemplate = computed(() => {
  const key = selectedKey.value
  const metric = getBranchSalesTimeseriesMetric(key)
  return (point: BranchSalesTimeseriesPoint): HTMLElement => {
    const tooltip = document.createElement('div')
    tooltip.className = 'dashboard-trend-tooltip'
    const date = document.createElement('span')
    date.textContent = formatBranchSalesTimeseriesDate(point.date)
    const row = document.createElement('p')
    const dot = document.createElement('i')
    dot.className = 'dashboard-trend-legend-dot'
    const label = document.createElement('span')
    label.textContent = metric.label
    const value = document.createElement('strong')
    value.textContent = formatBranchSalesTimeseriesValue(key, readBranchSalesTimeseriesValue(point, key))
    row.append(dot, label, value)
    tooltip.append(date, row)
    return tooltip
  }
})

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
  return point ? formatBranchSalesTimeseriesAxisDate(point.date) : ''
})

/**
 * Y ticks are compact labels only (cents to thousands of MXN); exact backend
 * values remain in the tooltip and table. Capture the metric for the same reason as
 * `yAccessor`: a stable formatter reference would leave the old metric's axis
 * labels on screen.
 */
const yTickFormat = computed(() => {
  const key = selectedKey.value
  return (tick: number | Date): string =>
    typeof tick === 'number' ? formatBranchSalesTimeseriesAxisTick(key, tick) : ''
})

function selectMetric(key: BranchSalesTimeseriesMetricKey) {
  selectedKey.value = key
  keyboardIndex.value = undefined
}

function onRetry() {
  emit('retry')
}

const uid = useId()
const headingId = `${uid}-heading`
const descriptionId = `${uid}-description`
const gradientId = `${uid}-area-fill`
const areaFill = `url(#${gradientId})`
</script>

<template>
  <section
    data-testid="branch-sales-trend"
    :aria-labelledby="headingId"
    class="dashboard-trend"
    :class="{ 'dashboard-trend-refreshing': hasPoints && props.isRefetching }"
  >
    <header class="dashboard-trend-heading">
      <h2 :id="headingId">Tendencia diaria</h2>
      <UIcon name="i-lucide-chart-no-axes-combined" class="size-5 shrink-0" aria-hidden="true" />
    </header>
    <div class="dashboard-trend-description">
      <p
        v-if="hasPoints"
        :id="descriptionId"
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
      class="dashboard-stale-alert"
    >
      <p class="min-w-0 flex-1 text-sm">
        No pudimos actualizar la tendencia; se muestran los últimos datos disponibles.
      </p>
      <UButton
        color="neutral"
        variant="outline"
        data-testid="branch-sales-trend-refresh-retry"
        class="dashboard-retry"
        @click="onRetry"
      >
        Reintentar
      </UButton>
    </div>

    <!-- Initial load: accessible skeleton shaped like the chart, never a synthetic series. -->
    <div
      v-if="showLoading"
      data-testid="branch-sales-trend-loading"
      role="status"
      aria-busy="true"
      class="dashboard-trend-skeleton-shape"
    >
      <span class="sr-only">Cargando la tendencia diaria…</span>
      <div class="dashboard-trend-skeleton-tabs" aria-hidden="true">
        <span v-for="n in SKELETON_TABS" :key="n" data-skeleton="tab" class="dashboard-state-skeleton" />
      </div>
      <div class="dashboard-trend-skeleton-chart" aria-hidden="true">
        <span v-for="n in 5" :key="n" data-skeleton="grid-line" class="dashboard-trend-skeleton-line" />
        <div class="dashboard-trend-skeleton-bars">
          <span
            v-for="(height, index) in SKELETON_BARS"
            :key="index"
            data-skeleton="bar"
            class="dashboard-state-skeleton"
            :style="{ height: `${height}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Error with no data: chart-scoped copy and one guarded recovery. -->
    <EmptyState
      v-else-if="showError"
      data-testid="branch-sales-trend-error"
      class="dashboard-compact-error"
      kind="error"
      title="No pudimos cargar la tendencia diaria"
      action-label="Reintentar"
      action-test-id="branch-sales-trend-retry"
      :action-loading="props.isRefetching"
      @action="onRetry"
    />

    <!-- Empty: the backend returned no bucket at all for the window. -->
    <EmptyState
      v-else-if="showEmpty"
      data-testid="branch-sales-trend-empty"
      kind="empty"
      title="Sin datos diarios en el periodo"
    />

    <template v-else-if="hasPoints">
      <!-- One metric at a time: a semantic group of native pressed-state buttons. -->
      <div v-if="hasAnyMovement" class="dashboard-trend-tabs-scroll">
      <div
        data-testid="branch-sales-trend-metrics"
        role="group"
        aria-label="Métrica de la tendencia"
        class="dashboard-trend-tabs"
      >
        <span class="dashboard-trend-tab-indicator" aria-hidden="true"
          :style="{ transform: `translateX(${metricIndex * 100}%)` }" />
        <button
          v-for="metric in BRANCH_SALES_TIMESERIES_METRICS"
          :key="metric.key"
          type="button"
          data-testid="branch-sales-trend-metric"
          :data-metric-key="metric.key"
          :aria-pressed="selectedKey === metric.key ? 'true' : 'false'"
          class="dashboard-trend-tab min-h-11 focus-visible:ring-2 focus-visible:outline-none"
          @click="selectMetric(metric.key)"
        >
          {{ metric.label }}
        </button>
      </div>
      </div>

      <!--
        Chart region. The wrapper carries the semantic series variables and the
        `.dark` chrome overrides; Unovis resolves `var()` inside its fill/stroke
        presentation values, so both themes follow the tokens.
      -->
      <EmptyState
        v-if="isFlatSeries"
        data-testid="branch-sales-trend-flat"
        kind="empty"
        title="Sin movimiento en el periodo"
      />

      <div
        v-else
        data-testid="branch-sales-trend-chart"
        role="img"
        :aria-label="chartLabel"
        :aria-describedby="descriptionId"
        tabindex="0"
        class="branch-sales-trend-chart"
        @keydown="onChartKeydown"
        @pointermove="keyboardIndex = undefined"
        @blur="keyboardIndex = undefined"
      >
        <svg class="dashboard-trend-defs" aria-hidden="true" width="0" height="0">
          <defs>
            <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--hf-action)" stop-opacity="0.16" />
              <stop offset="100%" stop-color="var(--hf-action)" stop-opacity="0.01" />
            </linearGradient>
          </defs>
        </svg>
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
          :auto-margin="false"
          :margin="{ top: 18, right: 28, left: 58, bottom: 32 }"
          :duration="0"
          class="dashboard-trend-canvas"
        >
          <VisArea :x="xAccessor" :y="yAccessor" :color="areaFill" :duration="0" />
          <VisLine :x="xAccessor" :y="yAccessor" :color="LINE_STROKE" :line-width="2.5" :duration="0" />
          <VisCrosshair
            :x="xAccessor" :y="yAccessor" :color="LINE_STROKE"
            :circle-radius="5" :hide-when-far-from-pointer="false"
            :force-show-at="keyboardIndex" :template="tooltipTemplate" :duration="0"
          />
          <VisTooltip :horizontal-shift="12" />
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
            :num-ticks="5"
            :tick-format="yTickFormat"
            :grid-line="true"
            :tick-line="false"
            :domain-line="false"
          />
        </VisXYContainer>
      </div>

      <p v-if="keyboardPoint" data-testid="branch-sales-trend-announcement"
        aria-live="polite" class="dashboard-trend-keyboard-tooltip">
        {{ formatBranchSalesTimeseriesDate(keyboardPoint.date) }} ·
        <strong>{{ formatBranchSalesTimeseriesValue(selectedKey, readBranchSalesTimeseriesValue(keyboardPoint, selectedKey)) }}</strong>
      </p>

      <footer class="dashboard-trend-footer">
      <p class="dashboard-trend-caption">{{ tableCaption }}</p>
      <!--
        Keyboard-reachable alternative that never depends on SVG or hover: a
        native disclosure in front of a semantic table with the exact backend
        dates and the exact selected-metric values in backend order.
      -->
      <details data-testid="branch-sales-trend-table-details" class="dashboard-trend-table min-w-0">
        <summary
          data-testid="branch-sales-trend-table-summary"
          class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 text-sm font-medium text-highlighted focus-visible:ring-2 focus-visible:ring-[var(--hf-focus)] focus-visible:outline-none"
        >
          <UIcon name="i-lucide-table-2" aria-hidden="true" class="size-4 shrink-0" />
          <span>Ver datos en tabla</span>
        </summary>

        <div class="mt-2 min-w-0 overflow-x-auto">
          <table
            data-testid="branch-sales-trend-table"
            class="hf-plain-table dashboard-trend-data w-full min-w-0 text-left"
          >
            <caption class="px-1 py-2 text-left text-xs text-muted">
              {{
                tableCaption
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col" class="text-right">
                  {{ selectedMetric.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="point in props.points" :key="point.date">
                <th
                  scope="row"
                  data-testid="branch-sales-trend-date"
                  class="text-left font-normal tabular-nums text-default"
                >
                  {{ point.date }}
                </th>
                <td
                  data-testid="branch-sales-trend-value"
                  class="text-right font-medium tabular-nums text-highlighted"
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
      </footer>
    </template>
  </section>
</template>
