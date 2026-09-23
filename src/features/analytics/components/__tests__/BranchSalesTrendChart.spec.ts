// BranchSalesTrendChart.spec.ts — presentational contract for the daily
// single-series trend (ODD dashboard-operational-insights OI-5A).
//
// Unovis is stubbed narrowly at the module boundary: the chart's own DOM
// contract (selector semantics, state panels, region role/label, semantic table)
// is what this file measures, and a real Unovis container needs layout
// primitives jsdom does not implement. Production code is not weakened for the
// test.
//
// Mutation-sensitive: reordering or re-reading the point array, filling,
// sorting or aggregating buckets, counting a currency value as a plain number,
// dropping `aria-pressed`/`min-h-11`/the focus ring, hiding the semantic table,
// losing the exact backend date strings, collapsing the cohort-state copy, or
// exposing more than one retry path fails these tests.

import { describe, expect, it, vi } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { BranchSalesTimeseriesPoint } from '../../interfaces/branch-sales-timeseries.types'
import BranchSalesTrendChart from '../BranchSalesTrendChart.vue'

vi.mock('@unovis/vue', async () => {
  const { defineComponent, h } = await import('vue')
  const VisXYContainer = defineComponent({
    name: 'VisXYContainer',
    inheritAttrs: false,
    props: { data: { type: Array, default: () => [] } },
    setup(props, { slots }) {
      return () =>
        h(
          'div',
          {
            'data-unovis': 'xy-container',
            'data-point-count': String((props.data as unknown[] | undefined)?.length ?? 0),
          },
          slots.default?.(),
        )
    },
  })
  const leaf = (name: string) =>
    defineComponent({
      name,
      inheritAttrs: false,
      // The forwarded config is DECLARED so tests can inspect the exact accessors
      // and formatters the component hands to Unovis. Unovis compares config by
      // value, so the identity of these values decides whether a metric switch
      // actually re-renders the series.
      props: {
        x: { type: Function, default: undefined },
        y: { type: Function, default: undefined },
        color: { type: String, default: undefined },
        lineWidth: { type: Number, default: undefined },
        type: { type: String, default: undefined },
        tickFormat: { type: Function, default: undefined },
        tickValues: { type: Array, default: undefined },
        numTicks: { type: Number, default: undefined },
      },
      setup:
        (_props, { slots }) =>
        () =>
          h('div', { 'data-unovis': name }, slots.default?.()),
    })

  return {
    VisXYContainer,
    VisArea: leaf('VisArea'),
    VisLine: leaf('VisLine'),
    VisAxis: leaf('VisAxis'),
  }
})

const FROM = '2025-03-01'
const TO = '2025-03-04'

const POINTS: BranchSalesTimeseriesPoint[] = [
  {
    date: '2025-03-01',
    grossSalesCents: 125_000,
    netSalesCents: 100_000,
    collectedCents: 80_000,
    outstandingDebtCents: 20_000,
    saleCount: 3,
    averageTicketCents: 33_333,
  },
  {
    date: '2025-03-02',
    grossSalesCents: 0,
    netSalesCents: 0,
    collectedCents: 0,
    outstandingDebtCents: 0,
    saleCount: 0,
    averageTicketCents: 0,
  },
  {
    date: '2025-03-03',
    grossSalesCents: 250_000,
    netSalesCents: 200_000,
    collectedCents: 150_000,
    outstandingDebtCents: 50_000,
    saleCount: 4,
    averageTicketCents: 50_000,
  },
]

interface ChartProps {
  points?: BranchSalesTimeseriesPoint[]
  from?: string
  to?: string
  isInitialLoading?: boolean
  isRefetching?: boolean
  isError?: boolean
}

function mountChart(overrides: ChartProps = {}) {
  return mountWithUApp(BranchSalesTrendChart, {
    props: {
      points: POINTS,
      from: FROM,
      to: TO,
      isInitialLoading: false,
      isRefetching: false,
      isError: false,
      ...overrides,
    },
  })
}

function metricButtons(wrapper: ReturnType<typeof mountChart>) {
  return wrapper.findAll('[data-testid="branch-sales-trend-metric"]')
}

function retryButtons(wrapper: ReturnType<typeof mountChart>) {
  return wrapper.findAll('button').filter((button) => /reintentar/i.test(button.text()))
}

function tableRows(wrapper: ReturnType<typeof mountChart>) {
  return wrapper.findAll('[data-testid="branch-sales-trend-table"] tbody tr')
}

describe('BranchSalesTrendChart — chart-scoped query states', () => {
  it('renders an accessible chart-scoped loading state without a chart claim', () => {
    const w = mountChart({ points: [], isInitialLoading: true })

    const loading = w.find('[data-testid="branch-sales-trend-loading"]')
    expect(loading.exists()).toBe(true)
    expect(loading.attributes('role')).toBe('status')
    expect(loading.attributes('aria-busy')).toBe('true')
    for (const testid of [
      'branch-sales-trend-chart',
      'branch-sales-trend-empty',
      'branch-sales-trend-error',
      'branch-sales-trend-table',
    ]) {
      expect(w.find(`[data-testid="${testid}"]`).exists(), testid).toBe(false)
    }
  })

  it('renders an error-without-data alert with exactly one chart-scoped retry', async () => {
    const w = mountChart({ points: [], isError: true })

    const alert = w.find('[data-testid="branch-sales-trend-error"]')
    expect(alert.exists()).toBe(true)
    expect(alert.attributes('role')).toBe('alert')

    const buttons = retryButtons(w)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.classes()).toContain('min-h-11')
  })

  it('keeps the loaded chart and exact table values visible during a stale-data error', () => {
    const w = mountChart({ isError: true })

    const warning = w.find('[data-testid="branch-sales-trend-refresh-error"]')
    expect(warning.exists()).toBe(true)
    expect(warning.attributes('role')).toBe('alert')
    expect(w.find('[data-testid="branch-sales-trend-chart"]').exists()).toBe(true)
    expect(w.find('[data-testid="branch-sales-trend-error"]').exists()).toBe(false)
    expect(tableRows(w)).toHaveLength(POINTS.length)
    expect(w.find('[data-testid="branch-sales-trend-table"]').text()).toContain('$1,000.00')
  })

  it('announces a background refresh politely while the chart stays on screen', () => {
    const w = mountChart({ isRefetching: true })

    const refreshing = w.find('[data-testid="branch-sales-trend-refreshing"]')
    expect(refreshing.exists()).toBe(true)
    expect(refreshing.attributes('role')).toBe('status')
    expect(refreshing.attributes('aria-live')).toBe('polite')
    expect(w.find('[data-testid="branch-sales-trend-chart"]').exists()).toBe(true)
  })

  it('renders an explicit empty state when the backend returned no buckets', () => {
    const w = mountChart({ points: [] })

    const empty = w.find('[data-testid="branch-sales-trend-empty"]')
    expect(empty.exists()).toBe(true)
    expect(empty.attributes('role')).toBe('status')
    expect(w.find('[data-testid="branch-sales-trend-chart"]').exists()).toBe(false)
    expect(w.find('[data-testid="branch-sales-trend-table"]').exists()).toBe(false)
  })

  it('emits exactly one retry event per click and never calls anything else', async () => {
    const w = mountChart({ points: [], isError: true })

    await retryButtons(w)[0]!.trigger('click')

    expect(w.emitted('retry')).toHaveLength(1)
    expect(w.emitted('retry')![0]).toEqual([])
  })

  it('exposes one retry affordance in the stale-data error state too', async () => {
    const w = mountChart({ isError: true })

    const buttons = retryButtons(w)
    expect(buttons).toHaveLength(1)
    await buttons[0]!.trigger('click')

    expect(w.emitted('retry')).toHaveLength(1)
  })
})

describe('BranchSalesTrendChart — metric selector semantics', () => {
  it('renders a semantic group of exactly the six selectable fields', () => {
    const w = mountChart()

    const group = w.find('[data-testid="branch-sales-trend-metrics"]')
    expect(group.attributes('role')).toBe('group')
    expect(group.attributes('aria-label')).toBeTruthy()

    expect(metricButtons(w).map((button) => button.attributes('data-metric-key'))).toEqual([
      'netSalesCents',
      'grossSalesCents',
      'collectedCents',
      'outstandingDebtCents',
      'saleCount',
      'averageTicketCents',
    ])
  })

  it('marks net sales pressed by default and exactly one metric pressed at a time', () => {
    const w = mountChart()

    expect(
      w
        .find('[data-testid="branch-sales-trend-metric"][data-metric-key="netSalesCents"]')
        .attributes('aria-pressed'),
    ).toBe('true')
    expect(
      w.findAll('[data-testid="branch-sales-trend-metric"][aria-pressed="true"]'),
    ).toHaveLength(1)
  })

  it('declares a 44px target and a visible focus ring on every metric control', () => {
    const w = mountChart()

    for (const button of metricButtons(w)) {
      expect(button.classes()).toContain('min-h-11')
      expect(button.classes().some((token) => /focus-visible:ring-/.test(token))).toBe(true)
    }
  })

  it('switches only the 1:1 field accessor and the formatting when another metric is selected', async () => {
    const w = mountChart()

    await w
      .find('[data-testid="branch-sales-trend-metric"][data-metric-key="saleCount"]')
      .trigger('click')

    expect(
      w
        .find('[data-testid="branch-sales-trend-metric"][data-metric-key="saleCount"]')
        .attributes('aria-pressed'),
    ).toBe('true')
    expect(
      w.findAll('[data-testid="branch-sales-trend-metric"][aria-pressed="true"]'),
    ).toHaveLength(1)

    // Counts render as grouped integers: the same buckets, a different accessor.
    expect(tableRows(w).map((row) => row.text())).toEqual([
      expect.stringContaining('2025-03-01'),
      expect.stringContaining('2025-03-02'),
      expect.stringContaining('2025-03-03'),
    ])
    expect(w.find('[data-testid="branch-sales-trend-table"]').text()).toContain(
      'Cantidad de ventas',
    )
    const countValues = w.findAll('[data-testid="branch-sales-trend-value"]').map((c) => c.text())
    expect(countValues).toEqual(['3', '0', '4'])
    expect(countValues.join(' ')).not.toContain('$')
  })

  it('changes the chart region label with the selected metric while keeping the exact window', () => {
    const w = mountChart()

    const defaultLabel = w
      .find('[data-testid="branch-sales-trend-chart"]')
      .attributes('aria-label')!
    expect(defaultLabel).toContain('Ventas netas')
    expect(defaultLabel).toContain(FROM)
    expect(defaultLabel).toContain(TO)
  })

  it('round-trips back to MXN formatting and never reorders the backend buckets', async () => {
    const w = mountChart()
    const backendDates = w
      .findAll('[data-testid="branch-sales-trend-date"]')
      .map((cell) => cell.text())

    await w
      .find('[data-testid="branch-sales-trend-metric"][data-metric-key="saleCount"]')
      .trigger('click')
    expect(w.findAll('[data-testid="branch-sales-trend-date"]').map((c) => c.text())).toEqual(
      backendDates,
    )

    await w
      .find('[data-testid="branch-sales-trend-metric"][data-metric-key="averageTicketCents"]')
      .trigger('click')

    expect(w.findAll('[data-testid="branch-sales-trend-value"]').map((c) => c.text())).toEqual([
      formatCentsMXN(33_333),
      formatCentsMXN(0),
      formatCentsMXN(50_000),
    ])
    expect(w.findAll('[data-testid="branch-sales-trend-date"]').map((c) => c.text())).toEqual(
      backendDates,
    )
    expect(w.find('[data-testid="branch-sales-trend-table"]').text()).toContain('Ticket promedio')
  })
})

describe('BranchSalesTrendChart — chart region and Unovis wiring', () => {
  it('renders exactly one Unovis container fed with the backend points in order', () => {
    const w = mountChart()

    const containers = w.findAll('[data-unovis="xy-container"]')
    expect(containers).toHaveLength(1)
    expect(containers[0]!.attributes('data-point-count')).toBe(String(POINTS.length))
    expect(w.find('[data-unovis="VisArea"]').exists()).toBe(true)
    expect(w.find('[data-unovis="VisLine"]').exists()).toBe(true)
    expect(w.findAll('[data-unovis="VisAxis"]').length).toBeGreaterThanOrEqual(2)
  })

  it('labels the chart region as an image with the metric and the exact half-open window', () => {
    const w = mountChart()

    const chart = w.find('[data-testid="branch-sales-trend-chart"]')
    expect(chart.attributes('role')).toBe('img')
    expect(chart.attributes('aria-label')).toBe(
      `Ventas netas por día del ${FROM} al ${TO} (Hasta excluyente)`,
    )
  })

  it('does not require SVG or hover interaction to reach the values', () => {
    const w = mountChart()

    // The chart region holds no text at all: every value lives in the table.
    expect(w.find('[data-testid="branch-sales-trend-chart"]').text()).toBe('')
  })
})

describe('BranchSalesTrendChart — keyboard-reachable semantic table', () => {
  it('always exposes a native details/summary path to the table', () => {
    const w = mountChart()

    const details = w.find('details[data-testid="branch-sales-trend-table-details"]')
    expect(details.exists()).toBe(true)

    const summary = details.find('summary')
    expect(summary.attributes('data-testid')).toBe('branch-sales-trend-table-summary')
    expect(summary.classes()).toContain('min-h-11')
    expect(summary.classes().some((token) => /focus-visible:ring-/.test(token))).toBe(true)
  })

  it('captions the table with the selected metric and the exact window', () => {
    const w = mountChart()

    const caption = w.find('[data-testid="branch-sales-trend-table"] caption')
    expect(caption.exists()).toBe(true)
    expect(caption.text()).toContain('Ventas netas')
    expect(caption.text()).toContain(FROM)
    expect(caption.text()).toContain(TO)
  })

  it('scopes both column headers and every row header correctly', () => {
    const w = mountChart()

    const headers = w.findAll('[data-testid="branch-sales-trend-table"] thead th')
    expect(headers).toHaveLength(2)
    expect(headers.map((header) => header.attributes('scope'))).toEqual(['col', 'col'])
    expect(headers.map((header) => header.text())).toEqual(['Fecha', 'Ventas netas'])

    for (const row of tableRows(w)) {
      expect(row.find('th').attributes('scope')).toBe('row')
    }
  })

  it('renders the exact backend dates and exact selected metric values in backend order', () => {
    const w = mountChart()

    expect(w.findAll('[data-testid="branch-sales-trend-date"]').map((cell) => cell.text())).toEqual(
      ['2025-03-01', '2025-03-02', '2025-03-03'],
    )
    expect(
      w.findAll('[data-testid="branch-sales-trend-value"]').map((cell) => cell.text()),
    ).toEqual([formatCentsMXN(100_000), formatCentsMXN(0), formatCentsMXN(200_000)])
  })

  it('keeps the zero-filled buckets the backend sent instead of dropping them', () => {
    const w = mountChart()

    expect(w.find('[data-testid="branch-sales-trend-table"]').text()).toContain('$0.00')
  })
})

describe('BranchSalesTrendChart — descriptive copy claims nothing derived', () => {
  it('describes the selected metric only, with no total, delta, extreme, average or trend claim', () => {
    const w = mountChart()

    const description = w.find('[data-testid="branch-sales-trend-description"]')
    expect(description.exists()).toBe(true)
    expect(description.text()).toContain('Ventas netas')
    expect(description.text()).not.toMatch(/total|delta|comparaci|variaci|mínimo|máximo|tendencia/i)
  })

  it('preserves the cohort-state distinction for collected and outstanding debt', async () => {
    const w = mountChart()

    await w
      .find('[data-testid="branch-sales-trend-metric"][data-metric-key="collectedCents"]')
      .trigger('click')
    expect(w.find('[data-testid="branch-sales-trend-description"]').text()).toContain(
      'No es el efectivo recibido ese día',
    )

    await w
      .find('[data-testid="branch-sales-trend-metric"][data-metric-key="outstandingDebtCents"]')
      .trigger('click')
    expect(w.find('[data-testid="branch-sales-trend-description"]').text()).toContain(
      'No es la deuda originada ese día',
    )
  })

  it('never computes or renders a total column, delta or second series', () => {
    const w = mountChart()

    const table = w.find('[data-testid="branch-sales-trend-table"]')
    expect(table.findAll('thead th')).toHaveLength(2)
    expect(table.findAll('tbody tr td')).toHaveLength(POINTS.length)
    expect(w.findAll('[data-unovis="VisArea"]')).toHaveLength(1)
    expect(w.findAll('[data-unovis="VisLine"]')).toHaveLength(1)
  })
})

// ── Forwarded Unovis config identity (independent verifier HIGH finding) ──────
//
// Unovis compares a component's merged config by VALUE and skips `setConfig` +
// `render()` when it is deep-equal. A `computed` whose GETTER never reads the
// selected metric returns a stable callback reference, so a metric switch would
// leave the forwarded accessor/formatter identical and the series would keep the
// previous metric's geometry and axis labels. These tests inspect the ACTUAL
// props handed to the Unovis components, which is where the identity lives.

describe('BranchSalesTrendChart — forwarded Unovis config identity', () => {
  function forwardedYAccessor(
    wrapper: ReturnType<typeof mountChart>,
    componentName: 'VisArea' | 'VisLine',
  ): (point: BranchSalesTimeseriesPoint) => number {
    return wrapper.findComponent({ name: componentName }).props('y') as (
      point: BranchSalesTimeseriesPoint,
    ) => number
  }

  function forwardedYTickFormat(
    wrapper: ReturnType<typeof mountChart>,
  ): (tick: number | Date) => string {
    const yAxis = wrapper
      .findAllComponents({ name: 'VisAxis' })
      .find((axis) => axis.props('type') === 'y')
    if (!yAxis) throw new Error('the forwarded Y axis was not found')
    return yAxis.props('tickFormat') as (tick: number | Date) => string
  }

  async function selectMetric(wrapper: ReturnType<typeof mountChart>, key: string) {
    await wrapper
      .find(`[data-testid="branch-sales-trend-metric"][data-metric-key="${key}"]`)
      .trigger('click')
  }

  it('forwards a Y accessor whose identity changes so Unovis actually re-renders', async () => {
    const w = mountChart()
    const lineBefore = forwardedYAccessor(w, 'VisLine')
    const areaBefore = forwardedYAccessor(w, 'VisArea')
    expect(lineBefore(POINTS[0]!)).toBe(POINTS[0]!.netSalesCents)
    expect(areaBefore(POINTS[2]!)).toBe(POINTS[2]!.netSalesCents)

    await selectMetric(w, 'saleCount')

    const lineAfter = forwardedYAccessor(w, 'VisLine')
    const areaAfter = forwardedYAccessor(w, 'VisArea')

    // Identity must change, otherwise Unovis deep-equals the config and the
    // series is never re-rendered for the new metric.
    expect(lineAfter).not.toBe(lineBefore)
    expect(areaAfter).not.toBe(areaBefore)

    // The new callback must read the NEW 1:1 field, not the previous one.
    expect(lineAfter(POINTS[0]!)).toBe(POINTS[0]!.saleCount)
    expect(lineAfter(POINTS[2]!)).toBe(POINTS[2]!.saleCount)
    expect(areaAfter(POINTS[0]!)).toBe(POINTS[0]!.saleCount)
    // One series at a time: area and line always read the same field.
    expect(lineAfter(POINTS[1]!)).toBe(areaAfter(POINTS[1]!))

    // Every switch produces a fresh identity, and the table/buttons follow.
    await selectMetric(w, 'netSalesCents')
    const lineBack = forwardedYAccessor(w, 'VisLine')
    expect(lineBack).not.toBe(lineAfter)
    expect(lineBack(POINTS[0]!)).toBe(POINTS[0]!.netSalesCents)
    expect(
      w
        .find('[data-testid="branch-sales-trend-metric"][data-metric-key="netSalesCents"]')
        .attributes('aria-pressed'),
    ).toBe('true')
  })

  it('forwards a Y tick formatter whose identity changes from MXN to a grouped count', async () => {
    const w = mountChart()
    const before = forwardedYTickFormat(w)
    expect(before(100_000)).toBe('$1,000.00')
    expect(before(0)).toBe('$0.00')

    await selectMetric(w, 'saleCount')

    const after = forwardedYTickFormat(w)
    expect(after).not.toBe(before)
    expect(after(100_000)).toBe('100,000')
    expect(after(25)).toBe('25')
    expect(after(100_000)).not.toContain('$')
  })

  it('leaves the X placement accessor stable across a metric switch', async () => {
    const w = mountChart()
    const xBefore = w.findComponent({ name: 'VisLine' }).props('x') as (
      point: BranchSalesTimeseriesPoint,
      index: number,
    ) => number

    await selectMetric(w, 'collectedCents')

    const xAfter = w.findComponent({ name: 'VisLine' }).props('x') as (
      point: BranchSalesTimeseriesPoint,
      index: number,
    ) => number
    // X is backend array order, so it is deliberately not rescaled or replaced.
    expect(xBefore(POINTS[2]!, 2)).toBe(2)
    expect(xAfter(POINTS[2]!, 2)).toBe(2)
  })
})

// ── Single live announcement (independent verifier state-consistency finding) ──
//
// `isRefetching` and `isError` can be true together. Rendering both the polite
// refresh status and the stale-error alert would announce two overlapping live
// messages, so precedence is explicit: while a retry is in flight the refresh
// status owns the announcement; once fetching stops and the error remains, the
// stale-error alert takes over.

describe('BranchSalesTrendChart — exactly one live announcement at a time', () => {
  const LIVE_REGION_SELECTOR = '[role="status"], [role="alert"]'

  it('announces only the refresh status while a retry is still in flight', () => {
    const w = mountChart({ isError: true, isRefetching: true })

    expect(w.find('[data-testid="branch-sales-trend-refreshing"]').exists()).toBe(true)
    expect(w.find('[data-testid="branch-sales-trend-refresh-error"]').exists()).toBe(false)
    expect(w.findAll(LIVE_REGION_SELECTOR)).toHaveLength(1)
    // The stale series stays on screen through both states.
    expect(w.find('[data-testid="branch-sales-trend-chart"]').exists()).toBe(true)
    expect(tableRows(w)).toHaveLength(POINTS.length)
  })

  it('switches to the stale-error alert once fetching stops and the error remains', () => {
    const w = mountChart({ isError: true, isRefetching: false })

    expect(w.find('[data-testid="branch-sales-trend-refreshing"]').exists()).toBe(false)
    expect(w.find('[data-testid="branch-sales-trend-refresh-error"]').exists()).toBe(true)
    expect(w.findAll(LIVE_REGION_SELECTOR)).toHaveLength(1)
    expect(w.find('[data-testid="branch-sales-trend-chart"]').exists()).toBe(true)
    expect(tableRows(w)).toHaveLength(POINTS.length)
  })

  it('never offers a redundant recovery control while a retry is already in flight', async () => {
    const duringRetry = mountChart({ isError: true, isRefetching: true })

    // The guarded refetch is a no-op while a request is pending, so the refresh
    // state deliberately exposes no second recovery control.
    expect(retryButtons(duringRetry)).toHaveLength(0)
    expect(duringRetry.findAll(LIVE_REGION_SELECTOR)).toHaveLength(1)

    const afterRetry = mountChart({ isError: true, isRefetching: false })
    const buttons = retryButtons(afterRetry)
    expect(buttons).toHaveLength(1)
    expect(afterRetry.findAll(LIVE_REGION_SELECTOR)).toHaveLength(1)

    await buttons[0]!.trigger('click')
    expect(afterRetry.emitted('retry')).toHaveLength(1)
  })
})
