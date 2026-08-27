// @ts-nocheck — wrapper binding tests mock the inner composable; real type-checking
// happens in the `useConfirmedSales` suite.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, type Ref } from 'vue'

// We capture the filters Ref passed to `useConfirmedSales` because the wrapper's
// external contract is "force deliveryStatus: ['PENDING','SHIPPED']" while still
// passing through any other filter the caller supplied.
let capturedFilters: Ref<Record<string, unknown>> | undefined
let capturedInitialFilters: Record<string, unknown> | undefined

const mockStateRefs = {
  pagination: ref({ pageIndex: 0, pageSize: 20 }) as Ref<{ pageIndex: number; pageSize: number }>,
  sorting: ref<Array<{ id: string; desc: boolean }>>([]) as Ref<Array<{ id: string; desc: boolean }>>,
  globalFilter: ref<string>('') as Ref<string>,
  data: ref<unknown[]>([]) as Ref<unknown[]>,
  totalCount: ref(0) as Ref<number>,
  pageCount: ref(0) as Ref<number>,
  isLoading: ref(false) as Ref<boolean>,
  isFetching: ref(false) as Ref<boolean>,
  isError: ref(false) as Ref<boolean>,
  error: ref<unknown>(null) as Ref<unknown>,
  counts: ref({ all: 0, pendingPayments: 0, notDelivered: 0 }),
  filterErrors: ref<Record<string, string>>({}),
}

vi.mock('@/features/POS/sales/composables/useConfirmedSales', () => ({
  useConfirmedSales: vi.fn((filters: Ref<Record<string, unknown>>) => {
    capturedFilters = filters
    capturedInitialFilters = filters.value
    return {
      pagination: mockStateRefs.pagination,
      sorting: mockStateRefs.sorting,
      globalFilter: mockStateRefs.globalFilter,
      data: computed(() => mockStateRefs.data.value),
      totalCount: computed(() => mockStateRefs.totalCount.value),
      pageCount: computed(() => mockStateRefs.pageCount.value),
      isLoading: computed(() => mockStateRefs.isLoading.value),
      isFetching: computed(() => mockStateRefs.isFetching.value),
      isError: computed(() => mockStateRefs.isError.value),
      error: computed(() => mockStateRefs.error.value),
      counts: computed(() => mockStateRefs.counts.value),
      filterErrors: computed(() => mockStateRefs.filterErrors.value),
      refresh: vi.fn(),
      setTabFilter: vi.fn(),
      setDeliveryStatusFilter: vi.fn(),
    }
  }),
}))

import { useEligibleSales } from '../useEligibleSales'

beforeEach(() => {
  vi.clearAllMocks()
  capturedFilters = undefined
  capturedInitialFilters = undefined
})

describe('useEligibleSales — thin wrapper over useConfirmedSales (design.md §6.2)', () => {
  it('pins deliveryStatus to ["PENDING","SHIPPED"] when no filters are provided', () => {
    useEligibleSales()
    expect(capturedInitialFilters).toEqual({
      deliveryStatus: ['PENDING', 'SHIPPED'],
    })
  })

  it('merges caller-provided filters with deliveryStatus (caller wins on conflict)', () => {
    useEligibleSales({ customerId: 'cust-1', search: 'A' })
    expect(capturedInitialFilters).toEqual({
      customerId: 'cust-1',
      search: 'A',
      deliveryStatus: ['PENDING', 'SHIPPED'],
    })
  })

  it('always threads deliveryStatus: ["PENDING","SHIPPED"] into the inner queryKey slot', () => {
    // TRIANGULATE — the wrapper's effect persists across ref updates: even when the
    // caller's filter Ref changes, deliveryStatus MUST stay in the merged object the
    // inner composable receives.
    const callerFilters = ref<Record<string, unknown>>({ customerId: 'cust-1' })
    useEligibleSales(callerFilters)

    expect(capturedFilters).toBeDefined()
    // Initial value includes the SHIPPED add (REQ-SALES-DR-001 regression pin).
    expect(capturedFilters!.value).toEqual({
      customerId: 'cust-1',
      deliveryStatus: ['PENDING', 'SHIPPED'],
    })

    // Mutate caller's filters and confirm the inner Ref also reflects deliveryStatus.
    callerFilters.value = { customerId: 'cust-2', search: 'B' }
    expect(capturedFilters!.value).toEqual({
      customerId: 'cust-2',
      search: 'B',
      deliveryStatus: ['PENDING', 'SHIPPED'],
    })
  })

  it('returns the useConfirmedSales contract unchanged (data/pagination/refresh/…)', () => {
    const wrapper = useEligibleSales()
    const keys = Object.keys(wrapper).sort()
    // Confirmed-sales public slots are exposed.
    expect(keys).toContain('data')
    expect(keys).toContain('pagination')
    expect(keys).toContain('totalCount')
    expect(keys).toContain('pageCount')
    expect(keys).toContain('isLoading')
    expect(keys).toContain('refresh')
    expect(keys).toContain('counts')
  })

  it('SHIPPED is explicitly included — regression pin against the S1a SHIPPED addition', () => {
    // TRIANGULATE — REQ-SALES-DR-001: a confirmed sale that is already assigned to
    // an active delivery route must surface to the eligible-sales picker as long as
    // its status is PENDING or SHIPPED. Removing SHIPPED here would silently hide
    // every in-transit sale from the manager's create-route picker.
    useEligibleSales()
    const initial = capturedInitialFilters as Record<string, unknown> | undefined
    expect(initial?.deliveryStatus).toEqual(['PENDING', 'SHIPPED'])
    expect((initial?.deliveryStatus as string[])).toContain('SHIPPED')
  })
})
