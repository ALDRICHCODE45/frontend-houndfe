import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useSellerAssignment } from '../useSellerAssignment'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import type { SaleDetail } from '../../interfaces/sale.types'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    assignSeller: vi.fn(),
    unassignSeller: vi.fn(),
  },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))

const baseSaleDetail = (overrides: Partial<SaleDetail> = {}): SaleDetail =>
  ({
    id: 'sale-1',
    folio: 'V-001',
    status: 'CONFIRMED',
    channel: 'POS',
    register: 'Principal',
    confirmedAt: '2026-01-01T00:00:00.000Z',
    dueDate: null,
    subtotalCents: 1000,
    discountCents: 0,
    totalCents: 1000,
    paidCents: 1000,
    debtCents: 0,
    changeDueCents: 0,
    paymentStatus: 'PAID',
    deliveryStatus: 'DELIVERED',
    customer: null,
    cashier: { id: 'u-cash', name: 'Cashier' },
    seller: null,
    items: [],
    payments: [],
    timeline: [],
    ...overrides,
  }) as SaleDetail

function mountComposable(saleId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  let result: ReturnType<typeof useSellerAssignment> | undefined

  const TestComponent = defineComponent({
    setup() {
      const maybeSaleId = computed(() => saleId)
      result = useSellerAssignment(maybeSaleId)
      return () => h('div')
    },
  })

  mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })

  return { composable: result!, queryClient, invalidateQueries }
}

describe('useSellerAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.assignSeller).mockResolvedValue(
      baseSaleDetail({ seller: { id: 'u-1', name: 'Ana' } }),
    )
    vi.mocked(saleApi.unassignSeller).mockResolvedValue(undefined)
  })

  it('assignSeller calls API with the right payload and invalidates detail', async () => {
    const { composable, invalidateQueries } = mountComposable('sale-1')

    await composable.assignSeller('u-1')

    expect(saleApi.assignSeller).toHaveBeenCalledWith('sale-1', { sellerUserId: 'u-1' })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: saleQueryKeys.detail('tenant-1', 'sale-1'),
    })
  })

  it('unassignSeller calls API and invalidates detail', async () => {
    const { composable, invalidateQueries } = mountComposable('sale-1')

    await composable.unassignSeller()

    expect(saleApi.unassignSeller).toHaveBeenCalledWith('sale-1')
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: saleQueryKeys.detail('tenant-1', 'sale-1'),
    })
  })

  it('maps backend domain errors to typed lastError', async () => {
    const { composable } = mountComposable('sale-1')
    const codes = ['SELLER_NOT_FOUND', 'SELLER_NOT_ASSIGNABLE', 'SALE_NOT_FOUND', 'SALE_UPDATE_FORBIDDEN'] as const

    for (const code of codes) {
      vi.mocked(saleApi.assignSeller).mockRejectedValueOnce({
        response: { data: { error: code } },
      })
      await expect(composable.assignSeller('u-x')).rejects.toMatchObject({ code })
      expect(composable.lastError.value?.code).toBe(code)
    }
  })

  it('isPending toggles while request is in flight', async () => {
    const { composable } = mountComposable('sale-1')
    let resolvePromise: ((value: SaleDetail) => void) | null = null
    vi.mocked(saleApi.assignSeller).mockImplementationOnce(
      () =>
        new Promise<SaleDetail>((resolve) => {
          resolvePromise = resolve
        }),
    )

    const promise = composable.assignSeller('u-1')
    await Promise.resolve()
    expect(composable.isPending.value).toBe(true)

    if (!resolvePromise) throw new Error('Resolver not set')
    ;(resolvePromise as (v: SaleDetail) => void)(baseSaleDetail())
    await promise

    expect(composable.isPending.value).toBe(false)
  })
})
