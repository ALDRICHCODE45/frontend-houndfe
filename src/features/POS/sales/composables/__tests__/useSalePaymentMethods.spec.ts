// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, type Ref } from 'vue'
import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query'

// ── Mocks ─────────────────────────────────────────────────────────────────────
const authMock = { currentTenantId: 'tenant-1' }
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

let capturedQueryKey: unknown
let capturedQueryFn: ((...args: unknown[]) => unknown) | undefined
let capturedStaleTime: number | undefined
let capturedRefetchOnWindowFocus: boolean | undefined
const queryReturnRefs = {
  data: ref([]) as Ref<unknown>,
  isLoading: ref(false) as Ref<boolean>,
  isFetching: ref(false) as Ref<boolean>,
  isError: ref(false) as Ref<boolean>,
  error: ref<unknown>(null) as Ref<unknown>,
  refetch: vi.fn(),
}

vi.mock('@tanstack/vue-query', () => ({
  useQuery: (config: {
    queryKey: unknown
    queryFn: (...args: unknown[]) => unknown
    staleTime?: number
    refetchOnWindowFocus?: boolean
    enabled?: unknown
  }) => {
    capturedQueryKey = config.queryKey
    capturedQueryFn = config.queryFn
    capturedStaleTime = config.staleTime
    capturedRefetchOnWindowFocus = config.refetchOnWindowFocus
    return {
      data: computed(() => queryReturnRefs.data.value),
      isLoading: computed(() => queryReturnRefs.isLoading.value),
      isFetching: computed(() => queryReturnRefs.isFetching.value),
      isError: computed(() => queryReturnRefs.isError.value),
      error: computed(() => queryReturnRefs.error.value),
      refetch: queryReturnRefs.refetch,
    } as unknown as UseQueryReturnType<unknown, unknown>
  },
}))

vi.mock('@/features/POS/sales/api/sale.api', () => ({
  saleApi: {
    getPaymentMethods: vi.fn(),
  },
}))

import { useSalePaymentMethods } from '../useSalePaymentMethods'
import { saleApi } from '@/features/POS/sales/api/sale.api'

beforeEach(() => {
  queryReturnRefs.data.value = []
  queryReturnRefs.isLoading.value = false
  queryReturnRefs.isFetching.value = false
  queryReturnRefs.isError.value = false
  queryReturnRefs.error.value = null
  queryReturnRefs.refetch.mockClear()
  capturedQueryKey = undefined
  capturedQueryFn = undefined
  capturedStaleTime = undefined
  capturedRefetchOnWindowFocus = undefined
  vi.clearAllMocks()
})

describe('useSalePaymentMethods (sdd custom-payment-methods S4A, REQ-PT-003)', () => {
  it('configures useQuery with saleQueryKeys.paymentMethods(tenantId) (or equivalent)', () => {
    useSalePaymentMethods()
    expect(capturedQueryKey).toBeDefined()
    // `queryKey` is a ComputedRef (reactive). Unwrap it for assertion.
    const keyRaw = capturedQueryKey as { value: readonly unknown[] } | readonly unknown[]
    const key = 'value' in (keyRaw as object)
      ? (keyRaw as { value: readonly unknown[] }).value
      : (keyRaw as readonly unknown[])
    expect(key).toContain('sales')
    expect(key).toContain('tenant-1')
    expect(key).toContain('payment-methods')
  })

  it('configures staleTime at 5 minutes (300_000 ms)', () => {
    useSalePaymentMethods()
    expect(capturedStaleTime).toBe(5 * 60_000)
  })

  it('disables refetchOnWindowFocus', () => {
    useSalePaymentMethods()
    expect(capturedRefetchOnWindowFocus).toBe(false)
  })

  it('queries the saleApi.getPaymentMethods() endpoint exactly once per fetch', async () => {
    vi.mocked(saleApi.getPaymentMethods).mockResolvedValue([])
    useSalePaymentMethods()
    await capturedQueryFn!()
    expect(saleApi.getPaymentMethods).toHaveBeenCalledTimes(1)
  })

  it('returns the projection data + isLoading + isFetching + error from useQuery', () => {
    const wrapper = useSalePaymentMethods()
    expect(wrapper).toHaveProperty('data')
    expect(wrapper).toHaveProperty('isLoading')
    expect(wrapper).toHaveProperty('isFetching')
    expect(wrapper).toHaveProperty('isError')
    expect(wrapper).toHaveProperty('error')
    expect(wrapper).toHaveProperty('refetch')
  })
})