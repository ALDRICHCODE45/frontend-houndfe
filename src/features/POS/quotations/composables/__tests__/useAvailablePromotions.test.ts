/**
 * useAvailablePromotions — tests.
 *
 * Strategy: mirror `useQuotationsList.test.ts` — mock `@tanstack/vue-query`'s
 * `useQuery` so we can assert the wiring (queryKey, queryFn, enabled) without
 * pulling the TanStack runtime in, and flip the data/loading/error return to
 * drive the composable's derived `promotions` / `isLoading` / `isError`.
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

vi.mock('@/features/POS/promotions/api/promotion.api', () => ({
  promotionApi: {
    getPaginated: vi.fn(),
  },
}))

import { useAvailablePromotions } from '../useAvailablePromotions'
import { promotionApi } from '@/features/POS/promotions/api/promotion.api'
import { promotionQueryKeys } from '@/core/shared/constants/query-keys'
import type { PromotionResponse } from '@/features/POS/promotions/interfaces/promotion.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePromotion(overrides: Partial<PromotionResponse> = {}): PromotionResponse {
  return {
    id: 'promo-1',
    title: 'Cupón 10%',
    type: 'ORDER_DISCOUNT',
    method: 'MANUAL',
    status: 'ACTIVE',
    startDate: null,
    endDate: null,
    customerScope: 'ALL',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minPurchaseAmountCents: null,
    appliesTo: null,
    buyQuantity: null,
    getQuantity: null,
    getDiscountPercent: null,
    buyTargetType: null,
    getTargetType: null,
    targetItems: [],
    customers: [],
    priceLists: [],
    daysOfWeek: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePageResponse(data: PromotionResponse[]) {
  return {
    data,
    pagination: {
      pageIndex: 0,
      pageSize: 100,
      totalCount: data.length,
      pageCount: 1,
    },
  }
}

interface SetupQueryReturnOptions {
  isLoading?: boolean
  isError?: boolean
}

async function setupQueryReturn(
  data: ReturnType<typeof makePageResponse> | undefined,
  options: SetupQueryReturnOptions = {},
) {
  const { useQuery } = await import('@tanstack/vue-query')
  vi.mocked(useQuery).mockReturnValue({
    data: ref(data),
    isLoading: ref(options.isLoading ?? false),
    isFetching: ref(false),
    isError: ref(options.isError ?? false),
    error: ref(null),
    refetch: vi.fn(),
  } as never)
}

async function getUseQueryCall() {
  const { useQuery } = await import('@tanstack/vue-query')
  return vi.mocked(useQuery).mock.calls[0]?.[0] as unknown as {
    queryKey: { value: readonly unknown[] }
    queryFn: () => unknown
    enabled: { value: boolean }
  }
}

// ─── Composable wiring ────────────────────────────────────────────────────────

describe('useAvailablePromotions — TanStack Query wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses a tenant- and method-scoped query key via promotionQueryKeys.available', async () => {
    await setupQueryReturn(makePageResponse([]))

    useAvailablePromotions('tenant-1', 'MANUAL')

    const callArgs = await getUseQueryCall()
    expect(callArgs.queryKey.value).toEqual(promotionQueryKeys.available('tenant-1', 'MANUAL'))
  })

  it('calls promotionApi.getPaginated with ACTIVE + the requested method and a 100-page size', async () => {
    await setupQueryReturn(makePageResponse([]))
    vi.mocked(promotionApi.getPaginated).mockResolvedValueOnce(makePageResponse([]))

    useAvailablePromotions('tenant-1', 'AUTOMATIC')

    const callArgs = await getUseQueryCall()
    void callArgs.queryFn()

    expect(promotionApi.getPaginated).toHaveBeenCalledWith({
      pageIndex: 0,
      pageSize: 100,
      status: 'ACTIVE',
      method: 'AUTOMATIC',
    })
  })

  it('disables the query when tenantId is empty', async () => {
    await setupQueryReturn(makePageResponse([]))

    useAvailablePromotions('', 'MANUAL')

    const callArgs = await getUseQueryCall()
    expect(callArgs.enabled.value).toBe(false)
  })

  it('enables the query when tenantId is present', async () => {
    await setupQueryReturn(makePageResponse([]))

    useAvailablePromotions('tenant-1', 'MANUAL')

    const callArgs = await getUseQueryCall()
    expect(callArgs.enabled.value).toBe(true)
  })

  it('exposes the page data as the `promotions` derived ref', async () => {
    const items = [makePromotion({ id: 'a' }), makePromotion({ id: 'b' })]
    await setupQueryReturn(makePageResponse(items))

    const { promotions } = useAvailablePromotions('tenant-1', 'MANUAL')

    expect(promotions.value).toHaveLength(2)
    expect(promotions.value[0]?.id).toBe('a')
  })

  it('exposes an empty array before the query has returned', async () => {
    await setupQueryReturn(undefined)

    const { promotions } = useAvailablePromotions('tenant-1', 'MANUAL')

    expect(promotions.value).toEqual([])
  })

  it('passes isLoading and isError through from useQuery', async () => {
    await setupQueryReturn(makePageResponse([]), { isLoading: true, isError: true })

    const { isLoading, isError } = useAvailablePromotions('tenant-1', 'AUTOMATIC')

    expect(isLoading.value).toBe(true)
    expect(isError.value).toBe(true)
  })
})
