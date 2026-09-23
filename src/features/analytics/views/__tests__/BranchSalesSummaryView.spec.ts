// BranchSalesSummaryView.spec.ts — thin route-view composition contract (A3c-1).
// The query composable and tenant source are mocked at their boundaries; the
// committed filters and metrics components are mounted for real so their child
// events flow through the view. Failure copy, guarded retry, filter operability
// and the responsive-shell pins live in the sibling
// BranchSalesSummaryView.errors.spec.ts (A3c-2), which runs independently.
//
// OI-3 owns the default-range and active-preset contract here under strict TDD:
// `Este mes` is the initial preset, the view owns one typed active-preset source
// of truth, a preset click resolves boundaries through the committed helper
// exactly once, and a manual boundary edit clears only that selection.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import {
  MEXICO_CITY_RANGE_PRESET_IDS,
  getMexicoCityRangePreset,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'
import { isBranchSalesSummaryEmpty } from '../../utils/branchSalesSummary.utils'
import type { BranchSalesSummaryResponse } from '../../interfaces/branch-sales-summary.types'
import type {
  BranchSalesTimeseriesPoint,
  BranchSalesTimeseriesResponse,
} from '../../interfaces/branch-sales-timeseries.types'
import BranchSalesSummaryFilters from '@/features/analytics/components/BranchSalesSummaryFilters.vue'
import BranchSalesSummaryMetrics from '@/features/analytics/components/BranchSalesSummaryMetrics.vue'
import BranchSalesTrendChart from '@/features/analytics/components/BranchSalesTrendChart.vue'
import DashboardOperationalPanel from '@/features/analytics/components/DashboardOperationalPanel.vue'
import DashboardSaleRow from '@/features/analytics/components/DashboardSaleRow.vue'
import DashboardRefundRow from '@/features/analytics/components/DashboardRefundRow.vue'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import type { PendingRefundRow } from '@/features/POS/sales/interfaces/pending-refund.types'
import BranchSalesSummaryView from '@/features/analytics/views/BranchSalesSummaryView.vue'

// The trend chart is mounted for real so its props/events flow through the
// view, but a real Unovis container needs layout primitives jsdom does not
// implement. The stubs stay at the module boundary; production code is intact.
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

/** A daily-series response whose echo is the window that produced its buckets. */
function makeTimeseriesResponse(
  from: string,
  to: string,
  points: BranchSalesTimeseriesPoint[],
): BranchSalesTimeseriesResponse {
  return { timeZone: 'America/Mexico_City', from, to, interval: 'day', points }
}

/** 2025-01-01T04:00Z is still 2024-12-31 in Mexico City: a zone-sensitive instant. */
const UTC_OFFSET_INSTANT = Date.UTC(2025, 0, 1, 4, 0, 0)
/** 2025-03-15 12:00 in Mexico City; an unambiguous mid-month preset anchor. */
const NOON_2025_03_15 = Date.UTC(2025, 2, 15, 18, 0, 0)

function makePayload(
  overrides: Partial<BranchSalesSummaryResponse> = {},
): BranchSalesSummaryResponse {
  return {
    timeZone: 'America/Mexico_City',
    from: '2025-03-01',
    to: '2025-03-16',
    grossSalesCents: 0,
    netSalesCents: 0,
    collectedCents: 0,
    outstandingDebtCents: 0,
    saleCount: 0,
    averageTicketCents: 0,
    settledRefundsCents: 0,
    pendingRefundObligationsCents: 0,
    ...overrides,
  }
}

/** One confirmed sale row, typed exactly as the wire contract serializes it. */
function makeSaleRow(overrides: Partial<ConfirmedSaleRow> = {}): ConfirmedSaleRow {
  return {
    id: 'sale-recent-1',
    folio: 'VTA-2025-0001',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    deliveryStatus: 'DELIVERED',
    totalCents: 123_456,
    debtCents: 0,
    confirmedAt: '2025-03-01T12:30:00.000Z',
    dueDate: null,
    customer: { id: 'customer-1', name: 'María López' },
    cashier: { id: 'cashier-1', name: 'Caja Centro' },
    seller: null,
    paymentMethods: ['CASH'],
    ...overrides,
  }
}

/** One pending-refund row, typed exactly as the wire contract serializes it. */
function makeRefundRow(overrides: Partial<PendingRefundRow> = {}): PendingRefundRow {
  return {
    id: 'refund-1',
    saleId: 'sale-operational-id-001',
    method: 'card_credit',
    amountCents: 50_000,
    settledCents: 12_500,
    outstandingCents: 37_500,
    reason: 'CUSTOMER_REQUEST',
    status: 'PENDING',
    createdAt: '2025-03-02T01:15:00.000Z',
    ...overrides,
  }
}

const EMPTY_PAYLOAD = makePayload()
const REFUND_ONLY_PAYLOAD = makePayload({ settledRefundsCents: 12_300 })
const NON_EMPTY_PAYLOAD = makePayload({
  grossSalesCents: 999_999,
  netSalesCents: 500_000,
  collectedCents: 400_000,
  outstandingDebtCents: 250_000,
  saleCount: 13,
  averageTicketCents: 38_461,
  settledRefundsCents: 12_300,
  pendingRefundObligationsCents: 7_700,
})

// ── Mocked boundaries ────────────────────────────────────────────────────────

const summaryRef = ref<BranchSalesSummaryResponse | undefined>(undefined)

const state = {
  summary: summaryRef,
  isEmpty: computed(() => isBranchSalesSummaryEmpty(summaryRef.value)),
  isInitialLoading: ref(false),
  isRefetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn().mockResolvedValue(undefined),
  retry: vi.fn().mockResolvedValue(undefined),
}

const composableCalls: Array<{
  tenantId: MaybeRefOrGetter<string | null | undefined>
  from: MaybeRefOrGetter<string>
  to: MaybeRefOrGetter<string>
}> = []

vi.mock('../../composables/useBranchSalesSummary', () => ({
  useBranchSalesSummary: (options: (typeof composableCalls)[number]) => {
    composableCalls.push(options)
    return state
  },
}))

// ── OI-5A: the daily series boundary ─────────────────────────────────────────

const timeseriesPointsRef = ref<BranchSalesTimeseriesPoint[]>([])

/**
 * The retained response echo. `null` models the window before the first response
 * lands, which is the only case where the requested boundaries are authoritative.
 */
const timeseriesPayloadRef = ref<BranchSalesTimeseriesResponse | null>(null)

const timeseriesState = {
  timeseries: timeseriesPayloadRef,
  points: timeseriesPointsRef,
  isInitialLoading: ref(false),
  isRefetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn().mockResolvedValue(undefined),
  retry: vi.fn().mockResolvedValue(undefined),
}

const timeseriesCalls: Array<{
  tenantId: MaybeRefOrGetter<string | null | undefined>
  from: MaybeRefOrGetter<string>
  to: MaybeRefOrGetter<string>
}> = []

vi.mock('../../composables/useBranchSalesTimeseries', () => ({
  useBranchSalesTimeseries: (options: (typeof timeseriesCalls)[number]) => {
    timeseriesCalls.push(options)
    return timeseriesState
  },
}))

const tenantIdRef = ref('tenant-1')

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => tenantIdRef,
}))

// ── OI-5B2 S3: live permission authority + three independent operational slots ──

/** Live granted permission codes; `userCan` reads this so the view stays reactive. */
const grantedPermissions = ref(new Set<string>())

const authMock = {
  userCan: (action: string, subject: string) =>
    grantedPermissions.value.has(`${action}:${subject}`),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

function grantPermissions(...codes: string[]) {
  grantedPermissions.value = new Set(codes)
}

type OperationalCall = {
  tenantId: MaybeRefOrGetter<string | null | undefined>
  enabled: MaybeRefOrGetter<boolean>
}

const recentSalesItems = ref<ConfirmedSaleRow[]>([])
const recentSalesState = {
  items: recentSalesItems,
  isEmpty: computed(() => recentSalesItems.value.length === 0),
  isInitialLoading: ref(false),
  isRefetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(undefined),
  refetch: vi.fn().mockResolvedValue(undefined),
  retry: vi.fn().mockResolvedValue(undefined),
}
const recentSalesCalls: OperationalCall[] = []

vi.mock('../../composables/useRecentConfirmedSales', () => ({
  useRecentConfirmedSales: (options: OperationalCall) => {
    recentSalesCalls.push(options)
    return recentSalesState
  },
}))

const debtSalesItems = ref<ConfirmedSaleRow[]>([])
const debtSalesState = {
  items: debtSalesItems,
  isEmpty: computed(() => debtSalesItems.value.length === 0),
  isInitialLoading: ref(false),
  isRefetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(undefined),
  refetch: vi.fn().mockResolvedValue(undefined),
  retry: vi.fn().mockResolvedValue(undefined),
}
const debtSalesCalls: OperationalCall[] = []

vi.mock('../../composables/useDebtConfirmedSales', () => ({
  useDebtConfirmedSales: (options: OperationalCall) => {
    debtSalesCalls.push(options)
    return debtSalesState
  },
}))

const pendingRefundsItems = ref<PendingRefundRow[]>([])
const pendingRefundsState = {
  items: pendingRefundsItems,
  isEmpty: computed(() => pendingRefundsItems.value.length === 0),
  isInitialLoading: ref(false),
  isRefetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(undefined),
  refetch: vi.fn().mockResolvedValue(undefined),
  retry: vi.fn().mockResolvedValue(undefined),
}
const pendingRefundsCalls: OperationalCall[] = []

vi.mock('../../composables/usePendingRefunds', () => ({
  usePendingRefunds: (options: OperationalCall) => {
    pendingRefundsCalls.push(options)
    return pendingRefundsState
  },
}))

/**
 * OI-3: the committed preset helper is wrapped, never replaced, so preset
 * intents can be counted while real Mexico City boundaries still resolve.
 */
vi.mock('@/core/shared/utils/mexicoCityCalendar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/shared/utils/mexicoCityCalendar')>()
  return {
    ...actual,
    getMexicoCityRangePreset: vi.fn((...args: Parameters<typeof actual.getMexicoCityRangePreset>) =>
      actual.getMexicoCityRangePreset(...args),
    ),
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

type View = ReturnType<typeof mountWithUApp>

function mountView(): View {
  return mountWithUApp(BranchSalesSummaryView)
}

function captured() {
  const call = composableCalls[0]
  if (!call) throw new Error('useBranchSalesSummary was not called')
  return call
}

/** Drive a real boundary UInput emission exactly as the child component does. */
async function emitBoundary(view: View, index: 0 | 1, value: string) {
  view.findAllComponents({ name: 'Input' })[index]!.vm.$emit('update:modelValue', value)
  await nextTick()
}

function presetButton(view: View, id: MexicoCityRangePresetId) {
  return view.find(`[data-testid="branch-summary-preset"][data-preset-id="${id}"]`)
}

function filterInput(view: View, testid: string) {
  return view.find(`[data-testid="${testid}"]`)
}

function setFakeNow(utcMs: number) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(utcMs)
}

function resetMocks() {
  composableCalls.length = 0
  summaryRef.value = undefined
  state.isInitialLoading.value = false
  state.isRefetching.value = false
  state.isError.value = false
  state.error.value = null
  state.refetch.mockClear()
  state.retry.mockClear()
  timeseriesCalls.length = 0
  timeseriesPointsRef.value = []
  timeseriesPayloadRef.value = null
  timeseriesState.isInitialLoading.value = false
  timeseriesState.isRefetching.value = false
  timeseriesState.isError.value = false
  timeseriesState.error.value = null
  timeseriesState.refetch.mockClear()
  timeseriesState.retry.mockClear()
  tenantIdRef.value = 'tenant-1'
  vi.mocked(getMexicoCityRangePreset).mockClear()
  grantedPermissions.value = new Set()
  recentSalesCalls.length = 0
  recentSalesItems.value = []
  recentSalesState.isInitialLoading.value = false
  recentSalesState.isRefetching.value = false
  recentSalesState.isError.value = false
  recentSalesState.error.value = undefined
  recentSalesState.refetch.mockClear()
  recentSalesState.retry.mockClear()
  debtSalesCalls.length = 0
  debtSalesItems.value = []
  debtSalesState.isInitialLoading.value = false
  debtSalesState.isRefetching.value = false
  debtSalesState.isError.value = false
  debtSalesState.error.value = undefined
  debtSalesState.refetch.mockClear()
  debtSalesState.retry.mockClear()
  pendingRefundsCalls.length = 0
  pendingRefundsItems.value = []
  pendingRefundsState.isInitialLoading.value = false
  pendingRefundsState.isRefetching.value = false
  pendingRefundsState.isError.value = false
  pendingRefundsState.error.value = undefined
  pendingRefundsState.refetch.mockClear()
  pendingRefundsState.retry.mockClear()
}

beforeEach(resetMocks)
afterEach(() => vi.useRealTimers())

// ── Initialization and wiring ────────────────────────────────────────────────

describe('BranchSalesSummaryView — initialization and composable wiring', () => {
  it('initializes to the committed current-month preset under a UTC instant whose Mexico City day differs', () => {
    setFakeNow(UTC_OFFSET_INSTANT)
    const view = mountView()

    expect(getMexicoCityRangePreset('thisMonth')).toEqual({ from: '2024-12-01', to: '2025-01-01' })
    expect(toValue(captured().from)).toBe('2024-12-01')
    expect(toValue(captured().to)).toBe('2025-01-01')
    expect(view.find('[data-testid="branch-summary-range"]').text()).toBe('2024-12-01 → 2025-01-01')
    expect((filterInput(view, 'branch-summary-from').element as HTMLInputElement).value).toBe(
      '2024-12-01',
    )
    expect((filterInput(view, 'branch-summary-to').element as HTMLInputElement).value).toBe(
      '2025-01-01',
    )
  })

  it('owns one typed active preset initialized to the current month and passes it to the filters', () => {
    const view = mountView()
    const filters = view.findComponent(BranchSalesSummaryFilters)

    expect(filters.props('activePreset')).toBe('thisMonth')
    expect(presetButton(view, 'thisMonth').attributes('aria-pressed')).toBe('true')
    expect(presetButton(view, 'last7Days').attributes('aria-pressed')).toBe('false')
    expect(view.findAll('[data-testid="branch-summary-preset"][aria-pressed="true"]')).toHaveLength(
      1,
    )
  })

  it('calls the composable exactly once with live tenant/from/to sources', async () => {
    mountView()
    expect(composableCalls).toHaveLength(1)
    expect(toValue(captured().tenantId)).toBe('tenant-1')

    tenantIdRef.value = 'tenant-2'
    await nextTick()

    expect(toValue(captured().tenantId)).toBe('tenant-2')
    expect(composableCalls).toHaveLength(1)
  })
})

// ── Boundary and preset intents ──────────────────────────────────────────────

describe('BranchSalesSummaryView — boundary and preset intents', () => {
  it('preserves each boundary child event as the exact string it received', async () => {
    const view = mountView()

    await emitBoundary(view, 0, '2025-04-10')
    await emitBoundary(view, 1, ' 2025-1-1 ')

    expect(toValue(captured().from)).toBe('2025-04-10')
    expect(toValue(captured().to)).toBe(' 2025-1-1 ')
    const filters = view.findComponent(BranchSalesSummaryFilters)
    expect(filters.props('from')).toBe('2025-04-10')
    expect(filters.props('to')).toBe(' 2025-1-1 ')
  })

  const PRESET_EXPECTATIONS: Record<MexicoCityRangePresetId, readonly [string, string]> = {
    today: ['2025-03-15', '2025-03-16'],
    last7Days: ['2025-03-09', '2025-03-16'],
    thisMonth: ['2025-03-01', '2025-03-16'],
    previousMonth: ['2025-02-01', '2025-03-01'],
  }

  it.each([...MEXICO_CITY_RANGE_PRESET_IDS])(
    'resolves the %s preset intent through committed calendar semantics exactly once and marks it active',
    async (id) => {
      setFakeNow(NOON_2025_03_15)
      const view = mountView()
      const [expectedFrom, expectedTo] = PRESET_EXPECTATIONS[id]
      const helper = vi.mocked(getMexicoCityRangePreset)
      // Resolve the expectation BEFORE the baseline so this test-owned call is
      // never counted as part of the click under measurement.
      expect(getMexicoCityRangePreset(id)).toEqual({ from: expectedFrom, to: expectedTo })
      helper.mockClear()
      const helperCallsBeforeClick = helper.mock.calls.length

      await presetButton(view, id).trigger('click')

      // The WHOLE mocked helper gains exactly one call for the click, and that
      // single call carries this exact preset id.
      expect(helper.mock.calls.length).toBe(helperCallsBeforeClick + 1)
      expect(helper.mock.calls.map(([calledId]) => calledId)).toEqual([id])
      expect(toValue(captured().from)).toBe(expectedFrom)
      expect(toValue(captured().to)).toBe(expectedTo)
      const filters = view.findComponent(BranchSalesSummaryFilters)
      expect(filters.props('activePreset')).toBe(id)
      expect(presetButton(view, id).attributes('aria-pressed')).toBe('true')
      expect(
        view.findAll('[data-testid="branch-summary-preset"][aria-pressed="true"]'),
      ).toHaveLength(1)
    },
  )
})

// ── Manual edit clears only the preset selection (OI-3) ──────────────────────

describe('BranchSalesSummaryView — manual boundary edits clear only the preset selection', () => {
  /** 2025-03-15 in Mexico City: `thisMonth` resolves to [2025-03-01, 2025-03-16). */
  const MANUAL_EDITS: ReadonlyArray<{
    readonly index: 0 | 1
    readonly edited: 'from' | 'to'
    readonly value: string
    readonly from: string
    readonly to: string
  }> = [
    { index: 0, edited: 'from', value: '2025-03-05', from: '2025-03-05', to: '2025-03-16' },
    { index: 1, edited: 'to', value: '2025-03-20', from: '2025-03-01', to: '2025-03-20' },
  ]

  it.each(MANUAL_EDITS)(
    'preserves the edited $edited value and clears the active preset',
    async ({ index, edited, value, from: expectedFrom, to: expectedTo }) => {
      setFakeNow(NOON_2025_03_15)
      const view = mountView()
      await presetButton(view, 'thisMonth').trigger('click')
      expect(view.findComponent(BranchSalesSummaryFilters).props('activePreset')).toBe('thisMonth')

      const helper = vi.mocked(getMexicoCityRangePreset)
      helper.mockClear()
      const helperCallsBeforeEdit = helper.mock.calls.length

      await emitBoundary(view, index, value)

      // A manual edit resolves no preset: the committed helper is never consulted.
      expect(helper.mock.calls.length).toBe(helperCallsBeforeEdit)

      const filters = view.findComponent(BranchSalesSummaryFilters)
      expect(filters.props('activePreset')).toBeNull()
      expect(
        view.findAll('[data-testid="branch-summary-preset"][aria-pressed="true"]'),
      ).toHaveLength(0)
      expect(filters.props(edited)).toBe(value)
      expect(toValue(captured().from)).toBe(expectedFrom)
      expect(toValue(captured().to)).toBe(expectedTo)
      expect(view.find('[data-testid="branch-summary-validation"]').exists()).toBe(false)
    },
  )

  it('re-selects a preset after a manual edit and restores its committed boundaries once', async () => {
    setFakeNow(NOON_2025_03_15)
    const view = mountView()
    await emitBoundary(view, 0, '2025-03-05')
    expect(view.findComponent(BranchSalesSummaryFilters).props('activePreset')).toBeNull()

    const helper = vi.mocked(getMexicoCityRangePreset)
    helper.mockClear()
    const helperCallsBeforeClick = helper.mock.calls.length
    await presetButton(view, 'last7Days').trigger('click')

    // Re-selection resolves the preset once through the committed helper.
    expect(helper.mock.calls.length).toBe(helperCallsBeforeClick + 1)
    expect(helper.mock.calls.map(([id]) => id)).toEqual(['last7Days'])
    expect(toValue(captured().from)).toBe('2025-03-09')
    expect(toValue(captured().to)).toBe('2025-03-16')
    expect(view.findComponent(BranchSalesSummaryFilters).props('activePreset')).toBe('last7Days')
    expect(presetButton(view, 'last7Days').attributes('aria-pressed')).toBe('true')
  })
})

// ── Render states ────────────────────────────────────────────────────────────

describe('BranchSalesSummaryView — render states stay distinct', () => {
  it('renders an accessible initial loading skeleton with no metric claim', () => {
    state.isInitialLoading.value = true
    const view = mountView()

    const loading = view.find('[data-testid="branch-summary-loading"]')
    expect(loading.attributes('role')).toBe('status')
    expect(loading.attributes('aria-busy')).toBe('true')
    expect(loading.findAll('.animate-pulse').length).toBeGreaterThan(0)
    for (const testid of [
      'branch-summary-metrics',
      'branch-summary-empty',
      'branch-summary-error',
      'branch-summary-idle',
    ]) {
      expect(view.find(`[data-testid="${testid}"]`).exists()).toBe(false)
    }
  })

  it('renders the metrics component with the exact summary payload', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    const view = mountView()

    expect(view.find('[data-testid="branch-summary-metrics"]').exists()).toBe(true)
    const metrics = view.findComponent(BranchSalesSummaryMetrics)
    expect(metrics.props('summary')).toEqual(NON_EMPTY_PAYLOAD)
    expect(view.find('[data-testid="branch-summary-empty"]').exists()).toBe(false)
    expect(view.text()).toContain('$9,999.99')
  })

  it('renders the global empty state only for an all-zero payload', () => {
    summaryRef.value = EMPTY_PAYLOAD
    const view = mountView()

    const empty = view.find('[data-testid="branch-summary-empty"]')
    expect(empty.attributes('role')).toBe('status')
    expect(empty.text()).toContain('Sin actividad en el periodo')
    expect(view.find('[data-testid="branch-summary-metrics"]').exists()).toBe(false)
  })

  it('reaches metrics for refund-only activity instead of the empty state', () => {
    summaryRef.value = REFUND_ONLY_PAYLOAD
    const view = mountView()

    expect(state.isEmpty.value).toBe(false)
    expect(view.find('[data-testid="branch-summary-metrics"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-summary-empty"]').exists()).toBe(false)
  })

  it('renders a neutral idle status when no query is active', () => {
    const view = mountView()
    expect(view.find('[data-testid="branch-summary-idle"]').attributes('role')).toBe('status')
  })

  it('keeps metrics during a background refetch and announces it politely', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    state.isRefetching.value = true
    const view = mountView()

    expect(view.find('[data-testid="branch-summary-metrics"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-summary-refreshing"]').attributes('aria-live')).toBe(
      'polite',
    )
    expect(view.find('[data-testid="branch-summary-error"]').exists()).toBe(false)
  })

  it('retains metrics with a compact refresh warning instead of replacing data', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    state.isError.value = true
    state.error.value = { response: { status: 500 } }
    const view = mountView()

    expect(view.find('[data-testid="branch-summary-metrics"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-summary-error"]').exists()).toBe(false)
    const warning = view.find('[data-testid="branch-summary-refresh-error"]')
    expect(warning.attributes('role')).toBe('alert')
    expect(warning.text()).toContain('los últimos datos disponibles')
  })
})

// ── Daily trend composition (OI-5A) ───────────────────────────────────

/** Three backend buckets, including a zero-filled day that must survive. */
const TIMESERIES_POINTS: BranchSalesTimeseriesPoint[] = [
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

describe('BranchSalesSummaryView — daily trend composition', () => {
  it('opens the daily series query once with the same live tenant/from/to as the summary', async () => {
    setFakeNow(NOON_2025_03_15)
    const view = mountView()

    expect(composableCalls).toHaveLength(1)
    expect(timeseriesCalls).toHaveLength(1)
    expect(toValue(timeseriesCalls[0]!.from)).toBe(toValue(captured().from))
    expect(toValue(timeseriesCalls[0]!.to)).toBe(toValue(captured().to))
    expect(toValue(timeseriesCalls[0]!.tenantId)).toBe(toValue(captured().tenantId))

    // The same boundary sources, not a snapshot copy: a preset moves both queries.
    await presetButton(view, 'previousMonth').trigger('click')
    expect(toValue(timeseriesCalls[0]!.from)).toBe('2025-02-01')
    expect(toValue(timeseriesCalls[0]!.to)).toBe('2025-03-01')
    expect(toValue(timeseriesCalls[0]!.from)).toBe(toValue(captured().from))
    expect(toValue(timeseriesCalls[0]!.to)).toBe(toValue(captured().to))

    tenantIdRef.value = 'tenant-2'
    await nextTick()
    expect(toValue(timeseriesCalls[0]!.tenantId)).toBe('tenant-2')
    expect(toValue(timeseriesCalls[0]!.tenantId)).toBe(toValue(captured().tenantId))
    expect(timeseriesCalls).toHaveLength(1)
  })

  it('binds the chart metadata to the displayed response window, not the requested one', async () => {
    setFakeNow(NOON_2025_03_15)
    summaryRef.value = NON_EMPTY_PAYLOAD
    // The buckets on screen belong to the RESPONSE window `[2025-03-01, 2025-03-04)`,
    // which is intentionally narrower than the requested current-month window.
    const retained = makeTimeseriesResponse('2025-03-01', '2025-03-04', TIMESERIES_POINTS)
    timeseriesPayloadRef.value = retained
    timeseriesPointsRef.value = TIMESERIES_POINTS
    const view = mountView()

    const initialChart = view.findComponent(BranchSalesTrendChart)
    expect(initialChart.props('from')).toBe('2025-03-01')
    expect(initialChart.props('to')).toBe('2025-03-04')
    expect(view.find('[data-testid="branch-sales-trend-table"] caption').text()).toContain(
      '2025-03-04',
    )
    expect(
      view.find('[data-testid="branch-sales-trend-chart"]').attributes('aria-label'),
    ).toContain('2025-03-04')
    expect(
      view.find('[data-testid="branch-sales-trend-chart"]').attributes('aria-label'),
    ).not.toContain('2025-03-16')

    // Move the requested window while the previous response is still retained and
    // the refetch is in flight. The edit is applied in ONE valid step (a manual
    // `from` move inside the window), because a transient invalid range would
    // legitimately unmount the trend while no query can exist.
    timeseriesState.isRefetching.value = true
    await emitBoundary(view, 0, '2025-03-02')
    await nextTick()
    // Re-resolve after the transition: a bound wrapper is not assumed to survive.
    const chart = view.findComponent(BranchSalesTrendChart)

    expect(toValue(timeseriesCalls[0]!.from)).toBe('2025-03-02')
    expect(toValue(timeseriesCalls[0]!.to)).toBe('2025-03-16')
    // The request moved, the data did not, so the metadata must not follow it.
    expect(chart.props('from')).toBe('2025-03-01')
    expect(chart.props('to')).toBe('2025-03-04')
    expect(chart.props('isRefetching')).toBe(true)
    expect(view.find('[data-testid="branch-sales-trend"]').exists()).toBe(true)
    expect(
      view.find('[data-testid="branch-sales-trend-chart"]').attributes('aria-label'),
    ).toContain('2025-03-04')
    expect(
      view.find('[data-testid="branch-sales-trend-chart"]').attributes('aria-label'),
    ).not.toContain('2025-03-16')
    expect(view.find('[data-testid="branch-sales-trend-table"] caption').text()).not.toContain(
      '2025-03-16',
    )
    // The buckets are still the retained ones, in retained order.
    expect(
      view.findAll('[data-testid="branch-sales-trend-date"]').map((cell) => cell.text()),
    ).toEqual(TIMESERIES_POINTS.map((point) => point.date))

    // Only when the new response replaces the old one does the metadata follow.
    timeseriesState.isRefetching.value = false
    timeseriesPayloadRef.value = makeTimeseriesResponse(
      '2025-03-02',
      '2025-03-16',
      TIMESERIES_POINTS,
    )
    await nextTick()

    const settled = view.findComponent(BranchSalesTrendChart)
    expect(settled.props('from')).toBe('2025-03-02')
    expect(settled.props('to')).toBe('2025-03-16')
    expect(
      view.find('[data-testid="branch-sales-trend-chart"]').attributes('aria-label'),
    ).toContain('2025-03-16')
    expect(view.find('[data-testid="branch-sales-trend-table"] caption').text()).toContain(
      '2025-03-16',
    )
  })

  it('falls back to the requested boundaries only while no response metadata exists', () => {
    setFakeNow(NOON_2025_03_15)
    summaryRef.value = NON_EMPTY_PAYLOAD
    // Defensive branch: the real OI-4 composable always echoes the window, so this
    // pins the documented fallback rather than a state the composable can emit.
    timeseriesPointsRef.value = TIMESERIES_POINTS
    const view = mountView()

    const chart = view.findComponent(BranchSalesTrendChart)
    expect(chart.props('from')).toBe('2025-03-01')
    expect(chart.props('to')).toBe('2025-03-16')
    expect(chart.props('from')).toBe(toValue(captured().from))
    expect(chart.props('to')).toBe(toValue(captured().to))
  })

  it('renders the trend as an independent sibling inside the same large card', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    timeseriesPointsRef.value = TIMESERIES_POINTS
    const view = mountView()

    const card = view.find('[data-testid="branch-summary-card"]')
    const trend = view.find('[data-testid="branch-sales-trend"]')
    expect(trend.exists()).toBe(true)
    expect(card.element.contains(trend.element)).toBe(true)

    const chart = view.findComponent(BranchSalesTrendChart)
    expect(chart.props('points')).toEqual(TIMESERIES_POINTS)
    expect(chart.props('from')).toBe(toValue(captured().from))
    expect(chart.props('to')).toBe(toValue(captured().to))
    expect(chart.props('isInitialLoading')).toBe(false)
    expect(chart.props('isError')).toBe(false)
    expect(view.find('[data-testid="branch-sales-trend-chart"]').exists()).toBe(true)
  })

  it('keeps the trend and its own state when the summary fails', () => {
    state.isError.value = true
    state.error.value = { response: { status: 403 } }
    timeseriesPointsRef.value = TIMESERIES_POINTS
    const view = mountView()

    expect(view.find('[data-testid="branch-summary-error"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-sales-trend"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-sales-trend-chart"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-sales-trend-error"]').exists()).toBe(false)
    expect(view.find('[data-testid="branch-sales-trend-table"]').text()).toContain('2025-03-01')
  })

  it('keeps the loaded summary KPIs when the trend itself fails', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    timeseriesState.isError.value = true
    const view = mountView()

    expect(view.find('[data-testid="branch-summary-metrics"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-summary-error"]').exists()).toBe(false)
    expect(view.find('[data-testid="branch-sales-trend-error"]').attributes('role')).toBe('alert')
  })

  it('reports trend loading independently of a loaded summary', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    timeseriesState.isInitialLoading.value = true
    const view = mountView()

    expect(view.find('[data-testid="branch-summary-metrics"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-sales-trend-loading"]').exists()).toBe(true)
  })

  it('routes the chart retry into the guarded daily-series retry exactly once', async () => {
    timeseriesState.isError.value = true
    const view = mountView()

    await view.find('[data-testid="branch-sales-trend-retry"]').trigger('click')
    await nextTick()

    expect(timeseriesState.retry).toHaveBeenCalledTimes(1)
    expect(timeseriesState.refetch).not.toHaveBeenCalled()
    expect(state.retry).not.toHaveBeenCalled()
  })

  it('keeps the trend visible next to an empty summary instead of collapsing it', () => {
    summaryRef.value = EMPTY_PAYLOAD
    timeseriesPointsRef.value = TIMESERIES_POINTS
    const view = mountView()

    // The summary claims nothing, but the trend's own backend buckets still render.
    expect(view.find('[data-testid="branch-summary-empty"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-sales-trend-chart"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-sales-trend-table"]').text()).toContain('$2,000.00')
  })

  it('renders no trend while the local range is invalid or no tenant is available', async () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    timeseriesPointsRef.value = TIMESERIES_POINTS
    const view = mountView()
    expect(view.find('[data-testid="branch-sales-trend"]').exists()).toBe(true)

    await emitBoundary(view, 0, '2025-05-01')
    await emitBoundary(view, 1, '2025-04-01')
    expect(view.find('[data-testid="branch-sales-trend"]').exists()).toBe(false)

    resetMocks()
    summaryRef.value = NON_EMPTY_PAYLOAD
    timeseriesPointsRef.value = TIMESERIES_POINTS
    tenantIdRef.value = ''
    expect(mountView().find('[data-testid="branch-sales-trend"]').exists()).toBe(false)
  })
})

// ── Operational panel composition (OI-5B2 S3) ───────────────────────────────

/** Module-scoped panel lookup: the generic panel test id repeats per module. */
function panelByHeading(view: View, id: string) {
  return view.find(`[data-testid="dashboard-operational-panel"][aria-labelledby="${id}-heading"]`)
}

describe('BranchSalesSummaryView — operational panel composition', () => {
  it('opens all three operational boundaries once and renders no panel when both permissions are denied', () => {
    grantPermissions()
    const view = mountView()

    expect(recentSalesCalls).toHaveLength(1)
    expect(debtSalesCalls).toHaveLength(1)
    expect(pendingRefundsCalls).toHaveLength(1)
    expect(toValue(recentSalesCalls[0]!.enabled)).toBe(false)
    expect(toValue(debtSalesCalls[0]!.enabled)).toBe(false)
    expect(toValue(pendingRefundsCalls[0]!.enabled)).toBe(false)
    expect(view.findAll('[data-testid="dashboard-operational-panel"]')).toHaveLength(0)
    expect(view.find('[data-testid="branch-summary-operational-grid"]').exists()).toBe(false)
  })

  it('renders exactly the recent and debt panels for a Sale-only identity', () => {
    grantPermissions('read:Sale')
    const view = mountView()

    expect(view.findAll('[data-testid="dashboard-operational-panel"]')).toHaveLength(2)
    expect(panelByHeading(view, 'dashboard-recent-sales').exists()).toBe(true)
    expect(panelByHeading(view, 'dashboard-debt-sales').exists()).toBe(true)
    expect(panelByHeading(view, 'dashboard-pending-refunds').exists()).toBe(false)
    expect(toValue(recentSalesCalls[0]!.enabled)).toBe(true)
    expect(toValue(debtSalesCalls[0]!.enabled)).toBe(true)
    expect(toValue(pendingRefundsCalls[0]!.enabled)).toBe(false)
  })

  it('renders exactly the refund panel for a SaleRefund-only identity', () => {
    grantPermissions('read:SaleRefund')
    const view = mountView()

    expect(view.findAll('[data-testid="dashboard-operational-panel"]')).toHaveLength(1)
    expect(panelByHeading(view, 'dashboard-pending-refunds').exists()).toBe(true)
    expect(toValue(recentSalesCalls[0]!.enabled)).toBe(false)
    expect(toValue(debtSalesCalls[0]!.enabled)).toBe(false)
    expect(toValue(pendingRefundsCalls[0]!.enabled)).toBe(true)
  })

  it('flips every enabled computed when the live permission set changes', async () => {
    grantPermissions('read:Sale', 'read:SaleRefund')
    const view = mountView()

    expect(toValue(recentSalesCalls[0]!.enabled)).toBe(true)
    expect(toValue(debtSalesCalls[0]!.enabled)).toBe(true)
    expect(toValue(pendingRefundsCalls[0]!.enabled)).toBe(true)

    grantPermissions()
    await nextTick()

    expect(toValue(recentSalesCalls[0]!.enabled)).toBe(false)
    expect(toValue(debtSalesCalls[0]!.enabled)).toBe(false)
    expect(toValue(pendingRefundsCalls[0]!.enabled)).toBe(false)
    expect(view.findAll('[data-testid="dashboard-operational-panel"]')).toHaveLength(0)
    expect(recentSalesCalls).toHaveLength(1)
    expect(pendingRefundsCalls).toHaveLength(1)
  })

  it('shares the live tenant source with all three operational boundaries exactly once', async () => {
    grantPermissions('read:Sale', 'read:SaleRefund')
    mountView()

    expect(toValue(recentSalesCalls[0]!.tenantId)).toBe('tenant-1')
    expect(toValue(debtSalesCalls[0]!.tenantId)).toBe('tenant-1')
    expect(toValue(pendingRefundsCalls[0]!.tenantId)).toBe('tenant-1')
    expect(toValue(recentSalesCalls[0]!.tenantId)).toBe(toValue(captured().tenantId))

    tenantIdRef.value = 'tenant-2'
    await nextTick()

    expect(toValue(recentSalesCalls[0]!.tenantId)).toBe('tenant-2')
    expect(toValue(debtSalesCalls[0]!.tenantId)).toBe('tenant-2')
    expect(toValue(pendingRefundsCalls[0]!.tenantId)).toBe('tenant-2')
    expect(toValue(pendingRefundsCalls[0]!.tenantId)).toBe(toValue(captured().tenantId))
    expect(recentSalesCalls).toHaveLength(1)
    expect(debtSalesCalls).toHaveLength(1)
    expect(pendingRefundsCalls).toHaveLength(1)
  })

  it('renders each operational list with its exact row component kind and data', () => {
    grantPermissions('read:Sale', 'read:SaleRefund')
    recentSalesItems.value = [makeSaleRow()]
    debtSalesItems.value = [
      makeSaleRow({
        id: 'sale-debt-1',
        folio: 'VTA-2025-0002',
        debtCents: 25_500,
        dueDate: '2025-03-31T00:00:00.000Z',
      }),
    ]
    pendingRefundsItems.value = [makeRefundRow()]
    const view = mountView()

    const saleRows = view.findAllComponents(DashboardSaleRow)
    expect(saleRows).toHaveLength(2)
    expect(saleRows.map((row) => row.props('kind'))).toEqual(['recent', 'debt'])
    expect(saleRows.map((row) => row.props('sale').id)).toEqual(['sale-recent-1', 'sale-debt-1'])

    const refundRows = view.findAllComponents(DashboardRefundRow)
    expect(refundRows).toHaveLength(1)
    expect(refundRows[0]!.props('refund')).toEqual(makeRefundRow())

    // Rows stay scoped to their own module: no cross-panel bleed.
    expect(
      panelByHeading(view, 'dashboard-recent-sales').findAll('[data-testid="dashboard-sale-row"]'),
    ).toHaveLength(1)
    expect(
      panelByHeading(view, 'dashboard-debt-sales').findAll('[data-testid="dashboard-sale-row"]'),
    ).toHaveLength(1)
    expect(
      panelByHeading(view, 'dashboard-pending-refunds').findAll(
        '[data-testid="dashboard-refund-row"]',
      ),
    ).toHaveLength(1)
    expect(
      panelByHeading(view, 'dashboard-recent-sales')
        .find('[data-testid="dashboard-refund-row"]')
        .exists(),
    ).toBe(false)
  })

  it('places the operational grid after the trend with the responsive three-column contract', () => {
    grantPermissions('read:Sale', 'read:SaleRefund')
    summaryRef.value = NON_EMPTY_PAYLOAD
    timeseriesPointsRef.value = TIMESERIES_POINTS
    const view = mountView()

    const grid = view.find('[data-testid="branch-summary-operational-grid"]')
    expect(grid.classes()).toEqual(
      expect.arrayContaining(['grid', 'min-w-0', 'grid-cols-1', 'gap-4', 'lg:grid-cols-3']),
    )

    const card = view.find('[data-testid="branch-summary-card"]')
    expect(card.element.contains(grid.element)).toBe(true)
    const ordered = Array.from(
      card.element.querySelectorAll(
        '[data-testid="branch-sales-trend"], [data-testid="branch-summary-operational-grid"]',
      ),
    ).map((element) => element.getAttribute('data-testid'))
    expect(ordered).toEqual(['branch-sales-trend', 'branch-summary-operational-grid'])

    // The modules compose into the existing card without a second page heading.
    expect(view.findAll('h1')).toHaveLength(1)
    expect(view.findComponent(DashboardOperationalPanel).attributes('aria-labelledby')).toBe(
      'dashboard-recent-sales-heading',
    )
  })
})

// ── Local validation ─────────────────────────────────────────────────────────

describe('BranchSalesSummaryView — local range validation', () => {
  it('shows the accessible filters validation and never claims a new-range summary', async () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    const view = mountView()

    await emitBoundary(view, 0, '2025-05-01')
    await emitBoundary(view, 1, '2025-04-01')

    const validation = view.find('[data-testid="branch-summary-validation"]')
    expect(validation.attributes('role')).toBe('alert')
    expect(validation.text()).toContain('no es válido')
    expect(view.find('[data-testid="branch-summary-invalid"]').exists()).toBe(true)
    const absentStates = ['branch-summary-metrics', 'branch-summary-empty', 'branch-summary-error']
    for (const testid of absentStates) {
      expect(view.find(`[data-testid="${testid}"]`).exists()).toBe(false)
    }
    expect(state.retry).not.toHaveBeenCalled()
  })
})
