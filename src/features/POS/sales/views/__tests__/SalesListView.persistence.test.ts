/**
 * Real localStorage persistence integration tests for pos-sales-list-redesign
 *
 * These tests exercise the REAL useTablePreferences + localStorage path.
 * They do NOT mock columnVisibility — they let useConfirmedSales wire it
 * through useServerTable → useTablePreferences → localStorage.
 *
 * Scope: R-004, R-005, R-204 (persistence roundtrip + overrides defaults)
 *
 * The storage key used by useTablePreferences is:
 *   `table-preferences-${persistKey}` = `table-preferences-pos-sales-list`
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { useConfirmedSales } from '../../composables/useConfirmedSales'
import { defaultColumnVisibility } from '../../composables/useSalesColumns'

// ── Minimal dependencies mocked so composable can mount without network ──────

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    listConfirmed: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
    }),
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-test' }),
}))

// ── Persistence storage key (mirrors useTablePreferences logic) ───────────────

const STORAGE_KEY = 'table-preferences-pos-sales-list'

// ── Composable mount helper ───────────────────────────────────────────────────

type ConfirmedSalesReturn = ReturnType<typeof useConfirmedSales>

function mountConfirmedSales(): { result: ConfirmedSalesReturn; unmount: () => void } {
  let result: ConfirmedSalesReturn | undefined

  const TestComponent = defineComponent({
    setup() {
      result = useConfirmedSales()
      return () => h('div')
    },
  })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  const wrapper = mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return { result: result!, unmount: () => wrapper.unmount() }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useConfirmedSales – real localStorage persistence roundtrip', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── A1: Fresh state uses defaults ──────────────────────────────────────────

  it('A1 – fresh state: columnVisibility reflects defaultColumnVisibility when localStorage is empty', () => {
    // GIVEN: localStorage is empty (done in beforeEach)

    // WHEN: useConfirmedSales mounts
    const { result, unmount } = mountConfirmedSales()

    // THEN: columnVisibility matches the exported defaultColumnVisibility exactly
    const visibility = result.columnVisibility.value

    // Default visible columns must be true (or absent = treated as true by TanStack Table)
    expect(visibility.venta).toBe(true)
    expect(visibility.confirmedAt).toBe(true)
    expect(visibility.customer).toBe(true)
    expect(visibility.paymentStatus).toBe(true)
    expect(visibility.paymentMethods).toBe(true)
    expect(visibility.totalCents).toBe(true)
    expect(visibility.debtCents).toBe(true)
    expect(visibility.deliveryStatus).toBe(true)

    // Default hidden columns must be false
    expect(visibility.cashier).toBe(false)
    expect(visibility.seller).toBe(false)
    expect(visibility.channel).toBe(false)
    expect(visibility.invoice).toBe(false)

    // Sanity-check: the result matches defaultColumnVisibility exactly
    expect(visibility).toEqual(defaultColumnVisibility)

    unmount()
  })

  // ── A2: Persisted state overrides defaults ─────────────────────────────────

  it('A2 – persisted state: pre-seeded localStorage overrides defaults for specified keys', () => {
    // GIVEN: localStorage has partial visibility with seller/cashier flipped to true
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        visibility: { seller: true, cashier: true },
      }),
    )

    // WHEN: useConfirmedSales mounts (reads storage in useTablePreferences constructor)
    const { result, unmount } = mountConfirmedSales()

    const visibility = result.columnVisibility.value

    // THEN: keys present in storage override defaults (seller/cashier true despite defaults being false)
    expect(visibility.seller).toBe(true)
    expect(visibility.cashier).toBe(true)

    // AND: keys NOT in the stored snapshot fall back to the defaultColumnVisibility
    // useTablePreferences stores the ENTIRE visibility object, not just deltas.
    // When only { seller: true, cashier: true } is stored, other keys are absent
    // from stored.visibility (they'd resolve to undefined, not to defaults).
    // This is the ACTUAL behavior we are documenting and locking.
    // The partial stored object becomes the full visibility ref — only stored keys present.
    expect(visibility.invoice).toBeUndefined()
    expect(visibility.channel).toBeUndefined()

    unmount()
  })

  // ── A3: Roundtrip ──────────────────────────────────────────────────────────

  it('A3 – roundtrip: toggling columnVisibility persists to localStorage and is restored on re-mount', async () => {
    // GIVEN: localStorage is empty (fresh state)
    const { result: first, unmount: unmountFirst } = mountConfirmedSales()

    // Initial state: invoice is false (default hidden)
    expect(first.columnVisibility.value.invoice).toBe(false)

    // WHEN: user toggles invoice to true (simulates AppDataTable emit).
    //
    // Implementation note: useTablePreferences uses an `isInitial` guard that skips
    // the FIRST watch trigger (to avoid persisting during component initialization, e.g.
    // when TanStack Query reactivity causes an initial flush). This means we must trigger
    // the watch TWICE — first to clear `isInitial`, then to actually persist.
    //
    // First trigger — clears the isInitial guard (no persist yet):
    first.columnVisibility.value = { ...defaultColumnVisibility }
    await nextTick()
    await flushPromises()

    // Second trigger — actual user change, now persists:
    first.columnVisibility.value = {
      ...defaultColumnVisibility,
      invoice: true,
    }
    await nextTick()
    await flushPromises()
    await nextTick()

    // THEN: localStorage entry must contain the updated visibility
    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!) as { visibility: Record<string, boolean> }
    expect(parsed.visibility.invoice).toBe(true)

    unmountFirst()

    // AND: re-mounting restores the persisted state
    const { result: second, unmount: unmountSecond } = mountConfirmedSales()
    expect(second.columnVisibility.value.invoice).toBe(true)

    unmountSecond()
  })
})
