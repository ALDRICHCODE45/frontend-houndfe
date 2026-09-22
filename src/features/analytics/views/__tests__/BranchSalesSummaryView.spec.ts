// BranchSalesSummaryView.spec.ts — thin route-view composition contract (A3c-1).
// The query composable and tenant source are mocked at their boundaries; the
// committed filters and metrics components are mounted for real so their child
// events flow through the view. Failure copy, guarded retry, filter operability
// and the responsive-shell pins live in the sibling
// BranchSalesSummaryView.errors.spec.ts (A3c-2), which runs independently.
// TDD is off for this ODD unit (see odd/tasks/branch-sales-summary.md).

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
import BranchSalesSummaryFilters from '@/features/analytics/components/BranchSalesSummaryFilters.vue'
import BranchSalesSummaryMetrics from '@/features/analytics/components/BranchSalesSummaryMetrics.vue'
import BranchSalesSummaryView from '@/features/analytics/views/BranchSalesSummaryView.vue'

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

const tenantIdRef = ref('tenant-1')

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => tenantIdRef,
}))

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
  tenantIdRef.value = 'tenant-1'
}

beforeEach(resetMocks)
afterEach(() => vi.useRealTimers())

// ── Initialization and wiring ────────────────────────────────────────────────

describe('BranchSalesSummaryView — initialization and composable wiring', () => {
  it('initializes to the committed last-7-days preset under a UTC instant whose Mexico City day differs', () => {
    setFakeNow(UTC_OFFSET_INSTANT)
    const view = mountView()

    expect(getMexicoCityRangePreset('last7Days')).toEqual({ from: '2024-12-25', to: '2025-01-01' })
    expect(toValue(captured().from)).toBe('2024-12-25')
    expect(toValue(captured().to)).toBe('2025-01-01')
    expect(view.find('[data-testid="branch-summary-range"]').text()).toBe('2024-12-25 → 2025-01-01')
    expect((filterInput(view, 'branch-summary-from').element as HTMLInputElement).value).toBe(
      '2024-12-25',
    )
    expect((filterInput(view, 'branch-summary-to').element as HTMLInputElement).value).toBe(
      '2025-01-01',
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
    'resolves the %s preset intent through committed calendar semantics',
    async (id) => {
      setFakeNow(NOON_2025_03_15)
      const view = mountView()
      const [expectedFrom, expectedTo] = PRESET_EXPECTATIONS[id]

      await presetButton(view, id).trigger('click')

      expect(getMexicoCityRangePreset(id)).toEqual({ from: expectedFrom, to: expectedTo })
      expect(toValue(captured().from)).toBe(expectedFrom)
      expect(toValue(captured().to)).toBe(expectedTo)
    },
  )
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
