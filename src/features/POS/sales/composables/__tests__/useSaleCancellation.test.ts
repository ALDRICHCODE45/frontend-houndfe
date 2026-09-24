// PCA-3 (promotion-capacity-alerts): cancellation mutation orchestration.
//
// Backend contract §2.8–2.9 + §3.3:
//   - The UI flow must ALWAYS send { reason: 'CUSTOMER_REQUEST' }.
//   - Success restores stock + promotion capacity, so the mutation must
//     invalidate: current sale detail, every confirmed-sale list slot, every
//     pending-refund queue slot, the dashboard recent/debt sale slots, all
//     active-tenant promotion slots (restored counters), branch sales summary
//     and the time-series analytics slots.
//   - IDEMPOTENCY_KEY_CONFLICT is surfaced honestly (never claim restoration)
//     and refreshes the affected sale state.
//   - SALE_NOT_FOUND and generic failures are handled safely (no restoration
//     claim, modal stays open via the `undefined` return).

import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useSaleCancellation } from '../useSaleCancellation'
import type { SaleCancellationResponse } from '../../interfaces/sale.types'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    cancelSale: vi.fn(),
  },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => computed(() => 'tenant-1'),
}))

const toastAddMock = vi.fn()
vi.mock('@nuxt/ui/composables/useToast', () => ({
  useToast: () => ({ add: toastAddMock }),
}))

const response: SaleCancellationResponse = {
  saleId: 'sale-1',
  status: 'CANCELED',
  refundedCents: 127000,
  restockedItems: [
    { productId: 'prod-1', variantId: null, quantity: 2 },
    { productId: 'prod-2', variantId: 'var-1', quantity: 1 },
  ],
  canceledAt: '2026-09-21T18:04:11.482Z',
}

function mountComposable(saleIdRef: () => string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, retryDelay: 0 },
    },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  let result: ReturnType<typeof useSaleCancellation> | undefined

  const TestComponent = defineComponent({
    setup() {
      result = useSaleCancellation(computed(() => saleIdRef()))
      return () => h('div')
    },
  })

  mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return { composable: result!, invalidateQueries }
}

function invalidatedKeys(spy: MockInstance): unknown[][] {
  return spy.mock.calls.map((call) => {
    const options = call[0] as { queryKey: readonly unknown[] } | undefined
    return (options?.queryKey ?? []) as unknown[]
  })
}

describe('useSaleCancellation (PCA-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastAddMock.mockReset()
  })

  it('always cancels with the exact CUSTOMER_REQUEST body and returns the response', async () => {
    vi.mocked(saleApi.cancelSale).mockResolvedValue(response)
    const { composable } = mountComposable(() => 'sale-1')

    const result = await composable.cancelSale()

    expect(saleApi.cancelSale).toHaveBeenCalledTimes(1)
    expect(saleApi.cancelSale).toHaveBeenCalledWith('sale-1', { reason: 'CUSTOMER_REQUEST' })
    expect(result).toEqual(response)
  })

  it('invalidates every affected cache slot on success, scoped to the active tenant', async () => {
    vi.mocked(saleApi.cancelSale).mockResolvedValue(response)
    const { composable, invalidateQueries } = mountComposable(() => 'sale-1')

    await composable.cancelSale()

    const keys = invalidatedKeys(invalidateQueries)
    for (const expected of [
      ['sales', 'tenant-1', 'detail', 'sale-1'],
      ['sales', 'tenant-1', 'confirmed'],
      ['sales', 'tenant-1', 'pending-refunds'],
      ['sales', 'tenant-1', 'dashboard-recent'],
      ['sales', 'tenant-1', 'dashboard-debt'],
      ['promotions', 'tenant-1'],
      ['analytics', 'tenant-1', 'sales-summary'],
      ['analytics', 'tenant-1', 'sales-timeseries'],
    ]) {
      expect(keys).toContainEqual(expected)
    }
    // Tenant isolation: every invalidated key carries the active tenant and no
    // other tenant value leaks into a slot.
    expect(JSON.stringify(keys)).not.toContain('tenant-2')
  })

  it('surfaces a success toast with the authoritative refundedCents and restored units', async () => {
    vi.mocked(saleApi.cancelSale).mockResolvedValue(response)
    const { composable } = mountComposable(() => 'sale-1')

    await composable.cancelSale()

    expect(toastAddMock).toHaveBeenCalledTimes(1)
    const toast = toastAddMock.mock.calls[0]?.[0] as { color: string; description: string }
    expect(toast.color).toBe('success')
    // The full phrase is asserted on purpose: the refunded amount also renders a
    // "2" ($1,270.00), so a loose /2/ match would pass even with a wrong count.
    expect(toast.description).toBe('$1,270.00 reembolsados · 3 unidades restauradas')
  })

  it('sums the authoritative restored units instead of counting restocked rows', async () => {
    vi.mocked(saleApi.cancelSale).mockResolvedValue(response)
    const { composable } = mountComposable(() => 'sale-1')

    await composable.cancelSale()

    const toast = toastAddMock.mock.calls[0]?.[0] as { color: string; description: string }
    expect(toast.color).toBe('success')
    // Rows are quantity 2 + quantity 1 → three restored units, not two rows.
    expect(toast.description).toContain('3 unidades restauradas')
    expect(toast.description).not.toContain('2 unidades restauradas')
  })

  it('uses singular wording for exactly one restored unit', async () => {
    vi.mocked(saleApi.cancelSale).mockResolvedValue({
      ...response,
      restockedItems: [{ productId: 'prod-1', variantId: null, quantity: 1 }],
    })
    const { composable } = mountComposable(() => 'sale-1')

    await composable.cancelSale()

    const toast = toastAddMock.mock.calls[0]?.[0] as { description: string }
    expect(toast.description).toContain('1 unidad restaurada')
    expect(toast.description).not.toContain('unidades restauradas')
  })

  it('does not invent a restocked count when the response restores nothing', async () => {
    vi.mocked(saleApi.cancelSale).mockResolvedValue({
      ...response,
      refundedCents: 0,
      restockedItems: [],
    })
    const { composable } = mountComposable(() => 'sale-1')

    await composable.cancelSale()

    const toast = toastAddMock.mock.calls[0]?.[0] as { color: string; description: string }
    expect(toast.color).toBe('success')
    expect(toast.description).toContain('$0.00')
    expect(toast.description).not.toMatch(/restaurad/i)
  })

  it('warns honestly on IDEMPOTENCY_KEY_CONFLICT and refreshes without claiming restoration', async () => {
    vi.mocked(saleApi.cancelSale).mockRejectedValue({
      response: { status: 409, data: { error: 'IDEMPOTENCY_KEY_CONFLICT' } },
    })
    const { composable, invalidateQueries } = mountComposable(() => 'sale-1')

    const result = await composable.cancelSale()

    expect(result).toBeUndefined()
    const toast = toastAddMock.mock.calls[0]?.[0] as { color: string; description: string }
    expect(toast.color).toBe('warning')
    expect(`${toast.description}`.toLowerCase()).not.toMatch(/restaurad|restored/)
    const keys = invalidatedKeys(invalidateQueries)
    expect(keys).toContainEqual(['sales', 'tenant-1', 'detail', 'sale-1'])
    expect(keys).toContainEqual(['sales', 'tenant-1', 'confirmed'])
  })

  it('handles SALE_NOT_FOUND safely and refreshes the affected sale state', async () => {
    vi.mocked(saleApi.cancelSale).mockRejectedValue({
      response: { status: 404, data: { error: 'SALE_NOT_FOUND' } },
    })
    const { composable, invalidateQueries } = mountComposable(() => 'sale-1')

    const result = await composable.cancelSale()

    expect(result).toBeUndefined()
    expect(toastAddMock).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
    const keys = invalidatedKeys(invalidateQueries)
    expect(keys).toContainEqual(['sales', 'tenant-1', 'detail', 'sale-1'])
    expect(keys).toContainEqual(['sales', 'tenant-1', 'confirmed'])
  })

  it('handles a generic failure with an error toast and no restoration claim', async () => {
    vi.mocked(saleApi.cancelSale).mockRejectedValue(new Error('boom'))
    const { composable } = mountComposable(() => 'sale-1')

    const result = await composable.cancelSale()

    expect(result).toBeUndefined()
    const toast = toastAddMock.mock.calls[0]?.[0] as { color: string; description?: string }
    expect(toast.color).toBe('error')
    expect(`${toast.description ?? ''}`.toLowerCase()).not.toMatch(/restaurad|restored/)
  })

  it('keeps the pending flag reactive while the request is in flight', async () => {
    let resolve!: (value: SaleCancellationResponse) => void
    vi.mocked(saleApi.cancelSale).mockImplementation(
      () => new Promise<SaleCancellationResponse>((r) => (resolve = r)),
    )
    const { composable } = mountComposable(() => 'sale-1')

    const pending = composable.cancelSale()
    await Promise.resolve()
    expect(composable.isPending.value).toBe(true)

    resolve(response)
    await pending
    expect(composable.isPending.value).toBe(false)
  })
})
