/**
 * useQuotationsList — Slice 3 / REQ-QTN-002 tests.
 *
 * Strategy: same pattern as `useNotificationConfigQuery.spec.ts` and
 * `useEligibleUsersQuery.spec.ts` — mock `@tanstack/vue-query`'s `useQuery`
 * so we can assert the wiring (queryKey, queryFn, enabled, params) without
 * pulling the entire TanStack runtime into the unit test, and so we can
 * flip the data/loading/error return value to drive the composable's
 * derived `quotations` / `isLoading` / `isError` outputs.
 *
 * The pure `buildQuotationsQueryParams` helper is tested separately so the
 * "filter → API param" mapping is hermetic and lives in its own describe.
 *
 * `refDebounced` from `@vueuse/core` is mocked to a passthrough (identity
 * ref) — we only assert that it is called with the right input ref and
 * debounceMs; we do not re-test vueuse's own timer behavior here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    // Identity passthrough — preserves reactivity so debouncedSearch === search.
    // Wrapped in vi.fn so we can spy on it from the wiring tests.
    refDebounced: vi.fn((source: unknown) => source),
  }
})

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
  }),
}))

vi.mock('../../api/quotation.api', () => ({
  quotationApi: {
    list: vi.fn(),
  },
}))

import { useQuotationsList, buildQuotationsQueryParams } from '../useQuotationsList'
import { quotationApi } from '../../api/quotation.api'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import type { PaginatedQuotations, QuotationResponseDto } from '../../interfaces/quotation.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuotation(overrides: Partial<QuotationResponseDto> = {}): QuotationResponseDto {
  return {
    id: 'qtn-1',
    customerId: null,
    customer: null,
    globalPriceListId: null,
    priceListExplicitlySet: false,
    status: 'DRAFT',
    expiresAt: null,
    cancelReason: null,
    canceledAt: null,
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 1000,
    taxRate: null,
    taxCents: null,
    customerNotes: null,
    manuallyEnded: false,
    items: [],
    appliedPromotions: [],
    vetoedPromotionIds: [],
    optedInManualPromotionIds: [],
    effectiveStatus: 'DRAFT',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePageResponse(
  data: QuotationResponseDto[],
  pagination: { page?: number; limit?: number; total?: number; totalPages?: number } = {},
): PaginatedQuotations {
  return {
    data,
    pagination: {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 10,
      total: pagination.total ?? data.length,
      totalPages: pagination.totalPages ?? 1,
    },
  }
}

async function setupQueryReturn(data: PaginatedQuotations | undefined) {
  const { useQuery } = await import('@tanstack/vue-query')
  vi.mocked(useQuery).mockReturnValue({
    data: ref(data),
    isLoading: ref(false),
    isFetching: ref(false),
    isError: ref(false),
    error: ref(null),
    refetch: vi.fn(),
  } as never)
}

// ─── buildQuotationsQueryParams — pure filter → API mapper ────────────────────

describe('buildQuotationsQueryParams — pure filter → API param mapping', () => {
  it('omits status when filter is "ALL"', () => {
    const params = buildQuotationsQueryParams({
      status: 'ALL',
      page: 1,
      limit: 10,
    })
    expect('status' in params).toBe(false)
  })

  it('passes DRAFT status through verbatim', () => {
    const params = buildQuotationsQueryParams({
      status: 'DRAFT',
      page: 1,
      limit: 10,
    })
    expect(params.status).toBe('DRAFT')
  })

  it('passes SENT, EXPIRED, CANCELLED status through verbatim', () => {
    expect(
      buildQuotationsQueryParams({ status: 'SENT', page: 1, limit: 10 }).status,
    ).toBe('SENT')
    expect(
      buildQuotationsQueryParams({ status: 'EXPIRED', page: 1, limit: 10 }).status,
    ).toBe('EXPIRED')
    expect(
      buildQuotationsQueryParams({ status: 'CANCELLED', page: 1, limit: 10 }).status,
    ).toBe('CANCELLED')
  })

  it('trims and includes search when non-empty', () => {
    const params = buildQuotationsQueryParams({
      status: 'ALL',
      search: '  María  ',
      page: 1,
      limit: 10,
    })
    expect(params.search).toBe('María')
  })

  it('omits search when empty or whitespace', () => {
    const empty = buildQuotationsQueryParams({
      status: 'ALL',
      search: '',
      page: 1,
      limit: 10,
    })
    const ws = buildQuotationsQueryParams({
      status: 'ALL',
      search: '   ',
      page: 1,
      limit: 10,
    })
    expect('search' in empty).toBe(false)
    expect('search' in ws).toBe(false)
  })

  it('includes customerId when provided', () => {
    const params = buildQuotationsQueryParams({
      status: 'ALL',
      customerId: 'cust-1',
      page: 1,
      limit: 10,
    })
    expect(params.customerId).toBe('cust-1')
  })

  it('omits customerId when undefined', () => {
    const params = buildQuotationsQueryParams({
      status: 'ALL',
      page: 1,
      limit: 10,
    })
    expect('customerId' in params).toBe(false)
  })

  it('passes page and limit 1-indexed (matches backend contract)', () => {
    const params = buildQuotationsQueryParams({
      status: 'ALL',
      page: 3,
      limit: 20,
    })
    expect(params.page).toBe(3)
    expect(params.limit).toBe(20)
  })

  it('never includes tenantId in output params (regression guard)', () => {
    const params = buildQuotationsQueryParams({
      status: 'ALL',
      page: 1,
      limit: 10,
    })
    expect('tenantId' in params).toBe(false)
  })
})

// ─── useQuotationsList — composable wiring ────────────────────────────────────

describe('useQuotationsList — TanStack Query wiring (S3 / REQ-QTN-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes the query key to the active tenant via quotationQueryKeys.list', async () => {
    await setupQueryReturn(makePageResponse([]))

    useQuotationsList()

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as {
      queryKey: { value: readonly unknown[] }
    }
    const expected = [...quotationQueryKeys.list('tenant-1')]
    expect(callArgs.queryKey.value.slice(0, expected.length)).toEqual(expected)
  })

  it('includes the current params object inside the query key (reactive)', async () => {
    await setupQueryReturn(makePageResponse([]))

    useQuotationsList()

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as {
      queryKey: { value: readonly unknown[] }
    }
    // queryKey shape: ['quotations', tenantId, 'list', {}, params]
    const tail = callArgs.queryKey.value[callArgs.queryKey.value.length - 1] as Record<
      string,
      unknown
    >
    expect(tail).toMatchObject({ page: 1, limit: 10 })
  })

  it('passes quotationApi.list as the queryFn', async () => {
    await setupQueryReturn(makePageResponse([]))

    useQuotationsList()

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as unknown as {
      queryFn: () => unknown
    }
    vi.mocked(quotationApi.list).mockResolvedValueOnce(makePageResponse([]))
    void callArgs.queryFn()
    expect(vi.mocked(quotationApi.list)).toHaveBeenCalled()
  })

  it('enables the query only when a tenantId is available', async () => {
    await setupQueryReturn(makePageResponse([]))

    useQuotationsList()

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as {
      enabled: { value: boolean }
    }
    expect(callArgs.enabled.value).toBe(true)
  })

  it('uses keepPreviousData so paginated navigation does not blank the table', async () => {
    await setupQueryReturn(makePageResponse([]))

    useQuotationsList()

    const { useQuery, keepPreviousData } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as {
      placeholderData: unknown
    }
    expect(callArgs.placeholderData).toBe(keepPreviousData)
  })

  it('exposes the page data as the `quotations` derived ref', async () => {
    const items = [makeQuotation({ id: 'a' }), makeQuotation({ id: 'b' })]
    await setupQueryReturn(makePageResponse(items, { total: 2, totalPages: 1 }))

    const { quotations } = useQuotationsList()

    expect(quotations.value).toHaveLength(2)
    expect(quotations.value[0]?.id).toBe('a')
  })

  it('exposes total and totalPages from the pagination envelope', async () => {
    await setupQueryReturn(makePageResponse([], { total: 47, totalPages: 5 }))

    const { total, totalPages } = useQuotationsList()

    expect(total.value).toBe(47)
    expect(totalPages.value).toBe(5)
  })

  it('exposes zero total/totalPages when the query has not returned yet', async () => {
    await setupQueryReturn(undefined)

    const { total, totalPages, quotations } = useQuotationsList()

    expect(total.value).toBe(0)
    expect(totalPages.value).toBe(0)
    expect(quotations.value).toEqual([])
  })

  it('passes isLoading, isError, and error through from useQuery', async () => {
    const { useQuery } = await import('@tanstack/vue-query')
    vi.mocked(useQuery).mockReturnValue({
      data: ref(undefined),
      isLoading: ref(true),
      isFetching: ref(false),
      isError: ref(true),
      error: ref(new Error('boom')),
      refetch: vi.fn(),
    } as never)

    const { isLoading, isError, error } = useQuotationsList()

    expect(isLoading.value).toBe(true)
    expect(isError.value).toBe(true)
    expect((error.value as Error | null)?.message).toBe('boom')
  })
})

// ─── useQuotationsList — setters reset page-1 and rebuild the key ─────────────

describe('useQuotationsList — setters and reactive queryKey rebuild', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('setStatus persists the new status and resets the page', async () => {
    await setupQueryReturn(makePageResponse([]))

    const { status, page, setStatus } = useQuotationsList()
    setStatus('SENT')

    expect(status.value).toBe('SENT')
    expect(page.value).toBe(1)
  })

  it('setSearch persists the new value and resets the page', async () => {
    await setupQueryReturn(makePageResponse([]))

    const { search, page, setSearch } = useQuotationsList()
    setSearch('María')

    expect(search.value).toBe('María')
    expect(page.value).toBe(1)
  })

  it('setCustomerId persists the new value and resets the page', async () => {
    await setupQueryReturn(makePageResponse([]))

    const { customerId, page, setCustomerId } = useQuotationsList()
    setCustomerId('cust-9')

    expect(customerId.value).toBe('cust-9')
    expect(page.value).toBe(1)
  })

  it('setPage changes the page but does NOT auto-reset to 1', async () => {
    await setupQueryReturn(makePageResponse([]))

    const { page, setPage } = useQuotationsList()
    setPage(4)

    expect(page.value).toBe(4)
  })

  it('setLimit persists the new limit and resets the page to 1', async () => {
    await setupQueryReturn(makePageResponse([]))

    const { limit, page, setLimit } = useQuotationsList({ defaultLimit: 10 })
    setLimit(50)

    expect(limit.value).toBe(50)
    expect(page.value).toBe(1)
  })
})

// ─── useQuotationsList — refDebounced wiring (search debounce) ────────────────

describe('useQuotationsList — refDebounced wiring (REQ-QTN-002 search debounce)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps the search ref with refDebounced using the configured debounceMs', async () => {
    const { refDebounced } = await import('@vueuse/core')
    await setupQueryReturn(makePageResponse([]))

    useQuotationsList({ debounceMs: 250 })

    expect(vi.mocked(refDebounced)).toHaveBeenCalled()
    // first call's first arg is the search ref; second is the ms
    const call = vi.mocked(refDebounced).mock.calls[0] as unknown as [
      unknown,
      number,
    ]
    expect(call[1]).toBe(250)
  })

  it('falls back to a 300 ms debounce when no option is provided', async () => {
    const { refDebounced } = await import('@vueuse/core')
    await setupQueryReturn(makePageResponse([]))

    useQuotationsList()

    const call = vi.mocked(refDebounced).mock.calls[0] as unknown as [
      unknown,
      number,
    ]
    expect(call[1]).toBe(300)
  })
})
