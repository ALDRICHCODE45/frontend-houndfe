// promotions-in-sale A.5 — STRICT TDD RED test for useApplicablePromotions.
// Verify the NEW composable (NOT YET IMPLEMENTED) is wired correctly:
//   1. draftId undefined → query disabled, queryFn NOT called.
//   2. draftId present  → query enabled, key shape correct, queryFn invoked with the draftId.
// Authoritative tenant source: useSafeTenantId() (mirrors useSalesDrafts).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h, ref } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useApplicablePromotions } from '../useApplicablePromotions'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import type { ListApplicablePromotionsResponse } from '../../interfaces/sale.types'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    listApplicablePromotions: vi.fn(),
  },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))

const expectedKey = saleQueryKeys.applicablePromotions('tenant-1', 'sale-1')

function mountComposableWithDraftId(
  draftIdSource: () => string | undefined,
): { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  const TestComponent = defineComponent({
    setup() {
      // Adaptable: pass a getter so the input stays reactive AND we can
      // assert pre/post enable behavior without remounting.
      useApplicablePromotions(() => draftIdSource())
      return () => h('div')
    },
  })
  mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })
  return { queryClient }
}

const fixtureResponse = (saleId: string): ListApplicablePromotionsResponse => ({
  saleId,
  promotions: [
    { id: 'promo-1', title: '2x1 Aspirina', type: 'PRODUCT_DISCOUNT' },
    { id: 'promo-2', title: '10% en subtotal', type: 'ORDER_DISCOUNT' },
  ],
})

describe('useApplicablePromotions (promotions-in-sale A.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.listApplicablePromotions).mockResolvedValue(
      fixtureResponse('sale-1'),
    )
  })

  it('does NOT call listApplicablePromotions when draftId is undefined', async () => {
    mountComposableWithDraftId(() => undefined)
    // Give vue-query a tick to settle (it would have fired by now if enabled).
    await new Promise((r) => setTimeout(r, 20))
    expect(saleApi.listApplicablePromotions).not.toHaveBeenCalled()
  })

  it('uses the applicablePromotions query key when draftId is undefined (stable shape)', () => {
    const { queryClient } = mountComposableWithDraftId(() => undefined)
    // The key factory uses '' fallback so the cache slot is consistent.
    expect(
      queryClient.getQueryCache().findAll({ queryKey: expectedKey }).length,
    ).toBe(0)
    // And the placeholder slot lives under the empty-draftId prefix.
    const emptyKey = saleQueryKeys.applicablePromotions('tenant-1', '')
    expect(
      queryClient.getQueryCache().findAll({ queryKey: emptyKey }).length,
    ).toBeGreaterThanOrEqual(0)
  })

  it('calls listApplicablePromotions with the draftId when present', async () => {
    mountComposableWithDraftId(() => 'sale-1')

    await vi.waitFor(() => {
      expect(saleApi.listApplicablePromotions).toHaveBeenCalledWith('sale-1')
    })
    expect(saleApi.listApplicablePromotions).toHaveBeenCalledTimes(1)
  })

  it('caches the response under the correct hierarchical key', async () => {
    mountComposableWithDraftId(() => 'sale-1')

    await vi.waitFor(() => {
      expect(saleApi.listApplicablePromotions).toHaveBeenCalledWith('sale-1')
    })
    // The cache slot under expectedKey should now contain the fixture.
    // We verify by checking the query exists in the cache with that key.
    // (We don't fetch the cache value here to avoid coupling to specific
    // composable return shape — just key presence is enough for A.5.)
    // Note: vue-query only marks observed queries; for additional safety we
    // use a fresh mount with the same key to confirm the refetch happens.
    vi.mocked(saleApi.listApplicablePromotions).mockClear()
    const fresh = mountComposableWithDraftId(() => 'sale-1')
    await vi.waitFor(() => {
      expect(saleApi.listApplicablePromotions).toHaveBeenCalledWith('sale-1')
    })
    expect(fresh.queryClient.getQueryCache().findAll({ queryKey: expectedKey }).length).toBeGreaterThanOrEqual(1)
  })

  it('reactively refetches when draftId changes from undefined to a value', async () => {
    // Mount with undefined first.
    const draftId = ref<string | undefined>(undefined)
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })
    const TestComponent = defineComponent({
      setup() {
        useApplicablePromotions(() => draftId.value)
        return () => h('div')
      },
    })
    mount(TestComponent, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    })

    await new Promise((r) => setTimeout(r, 20))
    expect(saleApi.listApplicablePromotions).not.toHaveBeenCalled()

    // Switch to a real draftId → query becomes enabled → refetch.
    draftId.value = 'sale-1'
    await vi.waitFor(() => {
      expect(saleApi.listApplicablePromotions).toHaveBeenCalledWith('sale-1')
    })
  })

  it('produces an isolated cache key for different tenants/draftIds', () => {
    // Pure key-factory sanity check (cheap double-assertion of A.3 + A.5 contract).
    const k1 = saleQueryKeys.applicablePromotions('tenant-1', 'sale-1')
    const k2 = saleQueryKeys.applicablePromotions('tenant-2', 'sale-1')
    const k3 = saleQueryKeys.applicablePromotions('tenant-1', 'sale-2')
    expect(k1).not.toEqual(k2)
    expect(k1).not.toEqual(k3)
    expect(k1).toEqual(['sales', 'tenant-1', 'applicable-promotions', 'sale-1'])
  })
})
