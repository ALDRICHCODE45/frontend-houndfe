// BranchSalesSummaryView.errors.spec.ts — failure copy, guarded retry, filter
// operability and responsive-shell contract (A3c-2).
//
// Sibling of BranchSalesSummaryView.spec.ts, which owns initialization, live
// tenant wiring, boundary/preset intents, render-state distinction, the
// aria-live refetch indicator and local validation. The composable and tenant
// boundaries are mocked again so this file executes in isolation; the committed
// filters and metrics components are mounted for real. TDD is off for this ODD
// unit (see odd/tasks/branch-sales-summary.md), so this is observed coverage.
//
// Mutation-sensitive: reading a backend body or error code instead of the HTTP
// status, collapsing the 400/403/unexpected copy, exposing more than one retry
// path, calling `refetch` instead of the guarded `retry`, disabling the filters
// during a background refetch, or regressing to the centered capped shell
// instead of the wide Products page-card shell fails these tests.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, type MaybeRefOrGetter } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import { isBranchSalesSummaryEmpty } from '../../utils/branchSalesSummary.utils'
import type { BranchSalesSummaryResponse } from '../../interfaces/branch-sales-summary.types'
import type {
  BranchSalesTimeseriesPoint,
  BranchSalesTimeseriesResponse,
} from '../../interfaces/branch-sales-timeseries.types'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import type { PendingRefundRow } from '@/features/POS/sales/interfaces/pending-refund.types'
import BranchSalesSummaryMetrics from '@/features/analytics/components/BranchSalesSummaryMetrics.vue'
import BranchSalesSummaryView from '@/features/analytics/views/BranchSalesSummaryView.vue'

// Narrow Unovis module stub: the trend chart is mounted for real so its
// independent failure state is exercised, while a real container needs layout
// primitives jsdom does not implement. Production code is untouched.
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

vi.mock('../../composables/useBranchSalesSummary', () => ({
  useBranchSalesSummary: () => state,
}))

// ── OI-5A: the daily series boundary keeps its own independent failure state ──

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

vi.mock('../../composables/useBranchSalesTimeseries', () => ({
  useBranchSalesTimeseries: () => timeseriesState,
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

// ── Helpers ──────────────────────────────────────────────────────────────────

type View = ReturnType<typeof mountWithUApp>

function mountView(): View {
  return mountWithUApp(BranchSalesSummaryView)
}

function filterInput(view: View, testid: string) {
  return view.find(`[data-testid="${testid}"]`)
}

function presetButton(view: View, id: string) {
  return view.find(`[data-testid="branch-summary-preset"][data-preset-id="${id}"]`)
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

/** Module-scoped panel lookup: the generic panel test id repeats per module. */
function panelByHeading(view: View, id: string) {
  return view.find(`[data-testid="dashboard-operational-panel"][aria-labelledby="${id}-heading"]`)
}

/**
 * Every visible retry affordance, matched by button text rather than test id:
 * a second retry rendered with any other marking is counted too, so "exactly
 * one retry" cannot pass while a duplicate exists.
 */
function retryButtons(view: View) {
  return view.findAll('button').filter((button) => /reintentar/i.test(button.text()))
}

function resetMocks() {
  summaryRef.value = undefined
  state.isInitialLoading.value = false
  state.isRefetching.value = false
  state.isError.value = false
  state.error.value = null
  state.refetch.mockClear()
  state.retry.mockClear()
  // The trend stays out of the way unless a test deliberately fails it, so the
  // "exactly one retry" audits below keep measuring the summary's own action.
  timeseriesPointsRef.value = []
  timeseriesPayloadRef.value = null
  timeseriesState.isInitialLoading.value = false
  timeseriesState.isRefetching.value = false
  timeseriesState.isError.value = false
  timeseriesState.error.value = null
  timeseriesState.refetch.mockClear()
  timeseriesState.retry.mockClear()
  tenantIdRef.value = 'tenant-1'
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

// ── No-data error copy and guarded retry ─────────────────────────────────────

describe('BranchSalesSummaryView — no-data error copy and retry', () => {
  const ERROR_CASES: ReadonlyArray<[string, unknown, string]> = [
    ['a 400 rejected range', { response: { status: 400 } }, 'rechazó el rango de fechas'],
    ['a 403 missing permission', { response: { status: 403 } }, 'No tienes permiso'],
    ['an unexpected 500', { response: { status: 500 } }, 'No pudimos cargar el resumen de ventas'],
    ['a transport error without status', new Error('Network Error'), 'No pudimos cargar'],
  ]

  it.each(ERROR_CASES)('renders status-aware copy for %s', (_label, error, expected) => {
    state.isError.value = true
    state.error.value = error
    const view = mountView()

    expect(view.find('[data-testid="branch-summary-error"]').attributes('role')).toBe('alert')
    expect(view.find('[data-testid="branch-summary-error-message"]').text()).toContain(expected)
    expect(view.find('[data-testid="branch-summary-metrics"]').exists()).toBe(false)
  })

  it('never collapses 400, 403 and unexpected failures into one message', () => {
    const rendered = [400, 403, 500].map((status) => {
      state.isError.value = true
      state.error.value = { response: { status } }
      return mountView().find('[data-testid="branch-summary-error-message"]').text()
    })

    expect(new Set(rendered).size).toBe(3)
  })

  it('derives copy from the HTTP status even when the body contradicts it', () => {
    const deniedBody = {
      error: 'PERMISSION_DENIED',
      message: 'No tienes permiso para consultar el resumen de ventas.',
    }
    const rejectedRangeBody = {
      error: 'DATE_RANGE_REJECTED',
      message: 'El rango de fechas fue rechazado por el servidor.',
    }
    const contradicting: ReadonlyArray<[number, { error: string; message: string }, string]> = [
      [400, deniedBody, 'rechazó el rango de fechas'],
      [403, rejectedRangeBody, 'No tienes permiso'],
      [500, deniedBody, 'No pudimos cargar el resumen de ventas'],
    ]

    for (const [status, body, expected] of contradicting) {
      state.isError.value = true
      state.error.value = { response: { status, data: body } }
      const message = mountView().find('[data-testid="branch-summary-error-message"]')

      expect(message.text(), `status ${status}`).toContain(expected)
      expect(message.text()).not.toContain(body.error)
      expect(message.text()).not.toContain(body.message)
    }
  })

  it('exposes one accessible retry that delegates exactly once per click', async () => {
    state.isError.value = true
    state.error.value = { response: { status: 400 } }
    const view = mountView()

    const buttons = retryButtons(view)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.classes()).toContain('min-h-11')
    await buttons[0]!.trigger('click')
    await nextTick()

    expect(state.retry).toHaveBeenCalledTimes(1)
    expect(state.refetch).not.toHaveBeenCalled()
  })

  it('routes the retained-data refresh retry through the same guarded action', async () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    state.isError.value = true
    state.error.value = { response: { status: 403 } }
    const view = mountView()

    const metrics = view.findComponent(BranchSalesSummaryMetrics)
    expect(metrics.props('summary')).toEqual(NON_EMPTY_PAYLOAD)
    expect(view.find('[data-testid="branch-summary-error"]').exists()).toBe(false)
    const warning = view.find('[data-testid="branch-summary-refresh-error"]')
    expect(warning.attributes('role')).toBe('alert')
    const warningText = view.find('[data-testid="branch-summary-refresh-error-message"]').text()
    expect(warningText).toContain('los últimos datos disponibles')

    const buttons = retryButtons(view)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.classes()).toContain('min-h-11')
    await buttons[0]!.trigger('click')
    await nextTick()

    expect(state.retry).toHaveBeenCalledTimes(1)
    expect(state.refetch).not.toHaveBeenCalled()
  })
})

describe('BranchSalesSummaryView — independent summary and trend failures', () => {
  const TREND_POINTS: BranchSalesTimeseriesPoint[] = [
    {
      date: '2025-03-01',
      grossSalesCents: 125_000,
      netSalesCents: 100_000,
      collectedCents: 80_000,
      outstandingDebtCents: 20_000,
      saleCount: 3,
      averageTicketCents: 33_333,
    },
  ]

  it('scopes each failure to its own module and keeps both guarded retries reachable', async () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    state.isError.value = true
    state.error.value = { response: { status: 403 } }
    timeseriesPointsRef.value = TREND_POINTS
    timeseriesState.isError.value = true
    const view = mountView()

    // The summary keeps its last KPIs and its own compact recovery...
    expect(view.findComponent(BranchSalesSummaryMetrics).props('summary')).toEqual(
      NON_EMPTY_PAYLOAD,
    )
    const summaryRetry = view.find('[data-testid="branch-summary-refresh-retry"]')
    expect(summaryRetry.exists()).toBe(true)
    // ...and the trend keeps its own last series and its own recovery.
    const trendRetry = view.find('[data-testid="branch-sales-trend-refresh-retry"]')
    expect(trendRetry.exists()).toBe(true)
    expect(view.find('[data-testid="branch-sales-trend-table"]').text()).toContain('2025-03-01')

    await summaryRetry.trigger('click')
    await trendRetry.trigger('click')
    await nextTick()

    expect(state.retry).toHaveBeenCalledTimes(1)
    expect(timeseriesState.retry).toHaveBeenCalledTimes(1)
    expect(state.refetch).not.toHaveBeenCalled()
    expect(timeseriesState.refetch).not.toHaveBeenCalled()
  })

  it('shows a trend-only failure without touching the summary retry inventory', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    timeseriesState.isError.value = true
    const view = mountView()

    expect(view.find('[data-testid="branch-sales-trend-error"]').attributes('role')).toBe('alert')
    expect(view.find('[data-testid="branch-summary-metrics"]').exists()).toBe(true)
    expect(view.find('[data-testid="branch-summary-error"]').exists()).toBe(false)
    // The trend owns its own recovery; the summary exposes none here.
    expect(view.find('[data-testid="branch-summary-refresh-retry"]').exists()).toBe(false)
    expect(retryButtons(view)).toHaveLength(1)
    expect(
      view
        .find('[data-testid="branch-sales-trend"]')
        .element.contains(retryButtons(view)[0]!.element),
    ).toBe(true)
  })
})

describe('BranchSalesSummaryView — operational panel failure isolation', () => {
  it('keeps loaded debt and refund panels on a fatal recent failure and retries only the recent module', async () => {
    grantPermissions('read:Sale', 'read:SaleRefund')
    recentSalesItems.value = []
    recentSalesState.isError.value = true
    recentSalesState.error.value = { response: { status: 500 } }
    debtSalesItems.value = [makeSaleRow({ id: 'sale-debt-1' })]
    pendingRefundsItems.value = [makeRefundRow()]

    const view = mountView()

    const recentPanel = panelByHeading(view, 'dashboard-recent-sales')
    expect(recentPanel.exists()).toBe(true)
    expect(recentPanel.find('[data-testid="dashboard-operational-error"]').attributes('role')).toBe(
      'alert',
    )
    expect(recentPanel.find('[data-testid="dashboard-operational-list"]').exists()).toBe(false)

    // The two other modules keep their loaded rows and expose no error state.
    expect(
      panelByHeading(view, 'dashboard-debt-sales').findAll('[data-testid="dashboard-sale-row"]'),
    ).toHaveLength(1)
    expect(
      panelByHeading(view, 'dashboard-pending-refunds').findAll(
        '[data-testid="dashboard-refund-row"]',
      ),
    ).toHaveLength(1)
    expect(
      panelByHeading(view, 'dashboard-debt-sales')
        .find('[data-testid="dashboard-operational-error"]')
        .exists(),
    ).toBe(false)
    expect(
      panelByHeading(view, 'dashboard-pending-refunds')
        .find('[data-testid="dashboard-operational-error"]')
        .exists(),
    ).toBe(false)

    const recentRetry = recentPanel
      .findAll('button')
      .find((button) => /reintentar/i.test(button.text()))
    expect(recentRetry).toBeDefined()
    await recentRetry!.trigger('click')
    await nextTick()

    // Only the recent module's guarded retry runs; siblings and the summary stay untouched.
    expect(recentSalesState.retry).toHaveBeenCalledTimes(1)
    expect(debtSalesState.retry).not.toHaveBeenCalled()
    expect(pendingRefundsState.retry).not.toHaveBeenCalled()
    expect(state.retry).not.toHaveBeenCalled()
    expect(timeseriesState.retry).not.toHaveBeenCalled()

    // The retry did not erase the successfully loaded sibling modules.
    expect(
      panelByHeading(view, 'dashboard-debt-sales').findAll('[data-testid="dashboard-sale-row"]'),
    ).toHaveLength(1)
    expect(
      panelByHeading(view, 'dashboard-pending-refunds').findAll(
        '[data-testid="dashboard-refund-row"]',
      ),
    ).toHaveLength(1)
  })
})

// ── Filter operability and responsive shell ────────────────────────────────

describe('BranchSalesSummaryView — filter operability', () => {
  it('uses the filters loading state only for the initial load', () => {
    state.isInitialLoading.value = true
    const loading = mountView()

    expect(filterInput(loading, 'branch-summary-from').attributes('disabled')).toBeDefined()
    expect(filterInput(loading, 'branch-summary-to').attributes('disabled')).toBeDefined()
    expect(loading.find('[data-testid="branch-summary-filters"]').attributes('aria-busy')).toBe(
      'true',
    )

    resetMocks()
    summaryRef.value = NON_EMPTY_PAYLOAD
    state.isRefetching.value = true
    const refetching = mountView()

    expect(filterInput(refetching, 'branch-summary-from').attributes('disabled')).toBeUndefined()
    expect(filterInput(refetching, 'branch-summary-to').attributes('disabled')).toBeUndefined()
    expect(presetButton(refetching, 'last7Days').attributes('disabled')).toBeUndefined()
    expect(
      refetching.find('[data-testid="branch-summary-filters"]').attributes('aria-busy'),
    ).toBeUndefined()
  })
})

describe('BranchSalesSummaryView — wide page-card shell and composition', () => {
  it('adopts the full-width Products page shell instead of the centered capped layout', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    const view = mountView()

    const root = view.find('[data-testid="branch-sales-summary-view"]')
    expect(root.classes()).toEqual(
      expect.arrayContaining(['flex', 'w-full', 'min-w-0', 'flex-col', 'gap-6', 'md:px-10']),
    )
    expect(root.classes()).not.toContain('mx-auto')
    expect(root.classes()).not.toContain('max-w-full')
    expect(root.classes().some((token) => /^lg:max-w-/.test(token))).toBe(false)
    expect(root.classes().some((token) => /^lg:px-/.test(token))).toBe(false)
  })

  it('renders the full-width card body with the Coco zero-padding shell and inner responsive wrapper', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    const view = mountView()

    const card = view.find('[data-testid="branch-summary-card"]')
    expect(card.classes()).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full', 'overflow-hidden']),
    )

    const body = card.find('[data-slot="body"]')
    expect(body.exists()).toBe(true)
    expect(body.classes()).toEqual(
      expect.arrayContaining(['p-0', 'sm:p-0', 'bg-coco-neutral-50', 'dark:bg-coco-neutral-950']),
    )

    const wrapper = body.element.children[0] as HTMLElement
    expect(wrapper).toBeDefined()
    for (const token of ['w-full', 'min-w-0', 'px-3', 'py-3', 'sm:px-4', 'sm:py-4']) {
      expect(wrapper.classList.contains(token), token).toBe(true)
    }
  })

  it('renders one H1 with a descriptive subtitle and the exact range as its own element', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    const view = mountView()

    const headings = view.findAll('h1')
    expect(headings).toHaveLength(1)
    expect(headings[0]!.text()).toBe('Resumen de ventas')

    const header = view.find('[data-testid="branch-summary-card"] [data-slot="header"]')
    const subtitle = header.find('p')
    expect(subtitle.text().trim().length).toBeGreaterThan(0)
    expect(subtitle.text()).toMatch(/ventas|reembolsos/i)

    const range = view.find('[data-testid="branch-summary-range"]')
    expect(range.exists()).toBe(true)
    expect(range.text()).toMatch(/^\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}$/)
    expect(range.element).not.toBe(subtitle.element)
    expect(headings[0]!.element.contains(range.element)).toBe(false)

    const cardText = view.find('[data-testid="branch-summary-card"]').text()
    expect(cardText).not.toContain('Periodo acotado al calendario')
    expect(cardText).not.toContain('America/Mexico_City')
  })

  it('routes the single filters panel through the metrics overview as the adjacent right column at lg', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    const view = mountView()

    expect(view.findAll('[data-testid="branch-summary-filters"]')).toHaveLength(1)

    const overview = view.find('[data-testid="branch-summary-sales-overview"]')
    expect(overview.exists()).toBe(true)
    expect(overview.classes()).toContain('lg:grid-cols-2')

    const controls = overview.find('[data-testid="branch-summary-controls"]')
    const hero = overview.find('[data-testid="branch-summary-net-sales-hero"]')
    expect(controls.exists()).toBe(true)
    expect(hero.exists()).toBe(true)
    expect(controls.find('[data-testid="branch-summary-filters"]').exists()).toBe(true)
    expect(controls.classes()).toContain('lg:col-start-2')
    expect(hero.element.closest('dl')!.classList.contains('lg:col-start-1')).toBe(true)

    // Controls are first in DOM so narrow viewports read them above the hero.
    expect(Array.from(overview.element.children)[0]!.getAttribute('data-testid')).toBe(
      'branch-summary-controls',
    )
  })

  it('keeps secondary sales KPIs and refunds outside the two-column overview, full width below', () => {
    summaryRef.value = NON_EMPTY_PAYLOAD
    const view = mountView()

    const overview = view.find('[data-testid="branch-summary-sales-overview"]')
    const kpis = view.find('[data-testid="branch-summary-sales-kpis"]')
    const refunds = view.find('[data-testid="branch-summary-refunds-section"]')

    // The prior half-width regression clamped these into the overview grid.
    expect(overview.element.contains(kpis.element)).toBe(false)
    expect(overview.element.contains(refunds.element)).toBe(false)
    expect(kpis.classes()).toEqual(
      expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-2', 'xl:grid-cols-3']),
    )
    expect(kpis.findAll('[data-testid="branch-summary-kpi-card"]')).toHaveLength(5)
    expect(refunds.findAll('[data-testid="branch-summary-refund-card"]')).toHaveLength(2)
    // Six sales metric groups stay discoverable across the whole sales section.
    expect(
      view.find('[data-testid="branch-summary-sales-section"]').findAll('dl > div'),
    ).toHaveLength(6)
  })

  it('keeps the only filters control available across loading, error, empty, idle and loaded states', () => {
    state.isInitialLoading.value = true
    const loading = mountView()
    expect(loading.findAll('[data-testid="branch-summary-filters"]')).toHaveLength(1)
    expect(filterInput(loading, 'branch-summary-from').exists()).toBe(true)
    // No loaded metrics/controls exist while the initial skeleton shows.
    expect(loading.find('[data-testid="branch-summary-controls"]').exists()).toBe(false)
    expect(loading.find('[data-testid="branch-summary-sales-overview"]').exists()).toBe(false)

    resetMocks()
    state.isError.value = true
    state.error.value = { response: { status: 400 } }
    const errored = mountView()
    expect(errored.findAll('[data-testid="branch-summary-filters"]')).toHaveLength(1)
    expect(errored.find('[data-testid="branch-summary-controls"]').exists()).toBe(false)

    resetMocks()
    summaryRef.value = makePayload()
    const empty = mountView()
    expect(empty.findAll('[data-testid="branch-summary-filters"]')).toHaveLength(1)
    expect(empty.find('[data-testid="branch-summary-empty"]').exists()).toBe(true)
    expect(empty.find('[data-testid="branch-summary-controls"]').exists()).toBe(false)

    resetMocks()
    const idle = mountView()
    expect(idle.findAll('[data-testid="branch-summary-filters"]')).toHaveLength(1)
    expect(idle.find('[data-testid="branch-summary-idle"]').exists()).toBe(true)
    expect(idle.find('[data-testid="branch-summary-controls"]').exists()).toBe(false)

    resetMocks()
    summaryRef.value = NON_EMPTY_PAYLOAD
    state.isRefetching.value = true
    const loaded = mountView()
    expect(loaded.findAll('[data-testid="branch-summary-filters"]')).toHaveLength(1)
    expect(loaded.find('[data-testid="branch-summary-controls"]').exists()).toBe(true)
    expect(loaded.find('[data-testid="branch-summary-metrics"]').exists()).toBe(true)
    expect(loaded.find('[data-testid="branch-summary-refreshing"]').exists()).toBe(true)
  })
})
