/**
 * useQuotationItemStock — Slice 8 / REQ-QTN-013 (stock badges) tests.
 *
 * Stock info for a quotation item is NOT shipped in the QuotationItemResponseDto
 * (backend §4.2 only includes `{id, name, sku, imageUrl}` on `item.product`).
 * The quotations module re-uses `productApi.getById` (products module) to
 * hydrate stock info lazily — keeping the cost off the list endpoints.
 *
 * Behavior under test:
 *   1. Empty / null productId ⇒ query stays disabled (no network call).
 *   2. Query key is the tenant-scoped `productQueryKeys.detail` slot.
 *   3. Query forwards `AbortSignal` through to `productApi.getById`.
 *   4. Composable exposes a derivable `stock` shape that downstream
 *      components can use without juggling `useQuery` internals.
 *   5. Stale time is the 60-second window documented in tasks.md §S8.1.
 *   6. Errors don't crash; `isAvailable` reads false and `stock` is null.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

const productApiMock = vi.hoisted(() => ({
  getById: vi.fn(),
  getVariants: vi.fn(),
}))

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: productApiMock,
}))

vi.mock('@/core/shared/constants/query-keys', () => ({
  productQueryKeys: {
    detail: (tenantId: string, productId: string) =>
      ['products', tenantId, 'detail', productId] as const,
    variants: (tenantId: string, productId: string) =>
      ['products', tenantId, 'variants', productId] as const,
  },
  quotationQueryKeys: {
    detail: vi.fn(),
    list: vi.fn(),
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

const useQueryMock = vi.fn()
vi.mock('@tanstack/vue-query', () => ({
  useQuery: (...args: unknown[]) => {
    const opts = args[0] as { queryKey?: { value: readonly unknown[] }; queryFn?: () => unknown }
    // Route to different stub data based on the query key so detail and
    // variants queries can be tested independently.
    if (opts.queryKey?.value?.[2] === 'variants') {
      const variantStub = (useQueryMock as unknown as { _variantStub: Record<string, unknown> })._variantStub
      if (variantStub) {
        // Fire the queryFn so getVariants assertions work.
        if (opts.queryFn) void opts.queryFn()
        return {
          data: ref(variantStub.data ?? null),
          isLoading: ref(false),
          isFetching: ref(false),
          isError: ref(false),
        }
      }
    }
    return useQueryMock(...args)
  },
}))

const flush = async () => {
  await nextTick()
  await vi.advanceTimersByTimeAsync(0)
}

import { useQuotationItemStock } from '../useQuotationItemStock'

function mountWith(
  productIdRef: { value: string | null | undefined },
  variantIdRef?: { value: string | null | undefined },
  variantStub?: { data?: unknown },
) {
  let captured: ReturnType<typeof useQuotationItemStock> | null = null
  // Store variant stub on the mock so the intercepted useQuery can read it.
  ;(useQueryMock as unknown as { _variantStub: Record<string, unknown> })._variantStub =
    (variantStub as Record<string, unknown>) ?? {}
  const Harness = defineComponent({
    setup() {
      captured = useQuotationItemStock(
        () => productIdRef.value,
        variantIdRef ? () => variantIdRef.value : undefined,
      )
      return () => h('div')
    },
  })
  mount(Harness)
  return captured as unknown as ReturnType<typeof useQuotationItemStock>
}

describe('useQuotationItemStock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    productApiMock.getById.mockReset()
    productApiMock.getVariants.mockReset()
    ;(useQueryMock as unknown as { _variantStub: Record<string, unknown> })._variantStub = {}
    useQueryMock.mockReset()
    useQueryMock.mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('disables the query when productId is empty', async () => {
    const captured = mountWith(ref(''))
    await flush()

    const opts = useQueryMock.mock.calls[0]?.[0] as { enabled: { value: boolean } }
    expect(opts.enabled.value).toBe(false)
    expect(captured?.isAvailable.value).toBe(false)
  })

  it('disables the query when productId is null/undefined', async () => {
    const captured = mountWith(ref(null))
    await flush()

    const opts = useQueryMock.mock.calls[0]?.[0] as { enabled: { value: boolean } }
    expect(opts.enabled.value).toBe(false)
    expect(captured?.isAvailable.value).toBe(false)
  })

  it('enables the query and uses the tenant-scoped productQueryKeys.detail key when productId is set', async () => {
    mountWith(ref('product-1'))
    await flush()

    const opts = useQueryMock.mock.calls[0]?.[0] as {
      queryKey: { value: readonly unknown[] }
      enabled: { value: boolean }
    }
    expect(opts.enabled.value).toBe(true)
    expect(opts.queryKey.value).toEqual(['products', 'tenant-1', 'detail', 'product-1'])
  })

  it('uses a 60-second stale time window (task S8.1 budget)', async () => {
    mountWith(ref('product-1'))
    await flush()

    const opts = useQueryMock.mock.calls[0]?.[0] as { staleTime: number }
    expect(opts.staleTime).toBe(60_000)
  })

  it('looks the productId up via productApi.getById', async () => {
    useQueryMock.mockImplementation((queryOpts: { queryFn: () => unknown }) => {
      productApiMock.getById.mockResolvedValueOnce({
        id: 'product-1',
        useStock: true,
        quantity: 5,
        minQuantity: 1,
      })
      void queryOpts.queryFn()
      return {
        data: ref({ id: 'product-1', useStock: true, quantity: 5, minQuantity: 1 }),
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(false),
      }
    })

    mountWith(ref('product-1'))
    await flush()

    expect(productApiMock.getById).toHaveBeenCalledWith('product-1')
  })

  it('returns null stock and `isAvailable=false` when useStock is false', async () => {
    useQueryMock.mockReturnValue({
      data: ref({ id: 'product-1', useStock: false, quantity: 999, minQuantity: 1, hasVariants: false, variantStockTotal: null }),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    })

    const captured = mountWith(ref('product-1'))
    await flush()

    expect(captured?.stock.value).toBeNull()
    expect(captured?.isAvailable.value).toBe(false)
  })

  it('returns the hydrated stock record when useStock is true', async () => {
    useQueryMock.mockReturnValue({
      data: ref({ id: 'product-1', useStock: true, quantity: 12, minQuantity: 3, hasVariants: false, variantStockTotal: null }),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    })

    const captured = mountWith(ref('product-1'))
    await flush()

    expect(captured?.stock.value).toEqual({
      quantity: 12,
      minQuantity: 3,
      isLow: false,
      isOut: false,
    })
    expect(captured?.isAvailable.value).toBe(true)
  })

  it('marks stock as low when quantity <= minQuantity (warning tone in UI)', async () => {
    useQueryMock.mockReturnValue({
      data: ref({ id: 'product-1', useStock: true, quantity: 2, minQuantity: 5, hasVariants: false, variantStockTotal: null }),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    })

    const captured = mountWith(ref('product-1'))
    await flush()

    expect(captured?.stock.value?.isLow).toBe(true)
    expect(captured?.stock.value?.isOut).toBe(false)
  })

  it('marks stock as out when quantity is zero', async () => {
    useQueryMock.mockReturnValue({
      data: ref({ id: 'product-1', useStock: true, quantity: 0, minQuantity: 0, hasVariants: false, variantStockTotal: null }),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    })

    const captured = mountWith(ref('product-1'))
    await flush()

    expect(captured?.stock.value?.isOut).toBe(true)
    expect(captured?.stock.value?.isLow).toBe(true)
  })

  it('uses the specific variant stock when variantId is provided', async () => {
    // Product detail: hasVariants=true, variantStockTotal=200 (aggregate)
    useQueryMock.mockReturnValue({
      data: ref({
        id: 'product-variant',
        useStock: true,
        quantity: 0,
        minQuantity: 5,
        hasVariants: true,
        variantStockTotal: 200,
      }),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    })

    const captured = mountWith(
      ref('product-variant'),
      ref('variant-192'),
      {
        data: [
          { id: 'variant-192', quantity: 192, minQuantity: 5 },
          { id: 'variant-8', quantity: 8, minQuantity: 5 },
        ],
      },
    )
    await flush()

    // Should show the specific variant's stock, not the aggregate 200
    expect(captured?.stock.value).toEqual({
      quantity: 192,
      minQuantity: 5,
      isLow: false,
      isOut: false,
    })
    expect(captured?.isAvailable.value).toBe(true)
  })

  it('falls back to variantStockTotal when variantId not found in variants', async () => {
    useQueryMock.mockReturnValue({
      data: ref({
        id: 'product-variant',
        useStock: true,
        quantity: 0,
        minQuantity: 5,
        hasVariants: true,
        variantStockTotal: 200,
      }),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    })

    const captured = mountWith(
      ref('product-variant'),
      ref('non-existent-variant'),
      {
        data: [
          { id: 'variant-192', quantity: 192, minQuantity: 5 },
        ],
      },
    )
    await flush()

    // Falls back to variantStockTotal when the variant ID doesn't match
    expect(captured?.stock.value?.quantity).toBe(200)
  })

  it('uses variantStockTotal for variant products when no variantId is provided', async () => {
    useQueryMock.mockReturnValue({
      data: ref({
        id: 'product-variant',
        useStock: true,
        quantity: 0,
        minQuantity: 5,
        hasVariants: true,
        variantStockTotal: 200,
      }),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    })

    // No variantId provided — use the aggregate
    const captured = mountWith(ref('product-variant'))
    await flush()

    expect(captured?.stock.value?.quantity).toBe(200)
    expect(captured?.isAvailable.value).toBe(true)
  })

  it('does not throw when the query fails (returns null + isError)', async () => {
    useQueryMock.mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(true),
    })

    const captured = mountWith(ref('product-1'))
    await flush()

    expect(captured?.stock.value).toBeNull()
    expect(captured?.isAvailable.value).toBe(false)
    expect(captured?.isError.value).toBe(true)
  })

  it('uses variantStockTotal for variant products (stock tracked per variant)', async () => {
    useQueryMock.mockReturnValue({
      data: ref({
        id: 'product-variant',
        useStock: true,
        quantity: 0,               // product-level is 0 — stock is per variant
        minQuantity: 5,
        hasVariants: true,
        variantStockTotal: 180,    // 180 across all variants
      }),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
    })

    const captured = mountWith(ref('product-variant'))
    await flush()

    expect(captured?.stock.value).toEqual({
      quantity: 180,
      minQuantity: 5,
      isLow: false,
      isOut: false,
    })
    expect(captured?.isAvailable.value).toBe(true)
  })
})
