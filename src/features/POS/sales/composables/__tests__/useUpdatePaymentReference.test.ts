import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import { saleApi, ReferenceUpdateError } from '../../api/sale.api'
import { useUpdatePaymentReference } from '../useUpdatePaymentReference'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    updatePaymentReference: vi.fn(),
  },
  ReferenceUpdateError: class ReferenceUpdateError extends Error {
    readonly code: 'ENTITY_NOT_FOUND' | 'SALE_UPDATE_FORBIDDEN' | 'NETWORK_ERROR'
    constructor(code: 'ENTITY_NOT_FOUND' | 'SALE_UPDATE_FORBIDDEN' | 'NETWORK_ERROR') {
      super(code)
      this.code = code
      this.name = 'ReferenceUpdateError'
    }
  },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))

const toastAddMock = vi.fn()
// `useToast` is auto-imported by the @nuxt/ui vite plugin at compile time
// (becomes a module import in the compiled composable), so vi.stubGlobal
// cannot intercept it. Mocking the module replaces the import binding.
vi.mock('@nuxt/ui/composables/useToast', () => ({
  useToast: () => ({ add: toastAddMock }),
}))

function mountComposable(saleIdRef: () => string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      // retryDelay: 0 keeps the retry suite synchronous so the test doesn't
      // stall waiting on TanStack's exponential backoff (default 1s + 2s + 4s).
      mutations: { retry: false, retryDelay: 0 },
    },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  let result: ReturnType<typeof useUpdatePaymentReference> | undefined

  const TestComponent = defineComponent({
    setup() {
      result = useUpdatePaymentReference(computed(() => saleIdRef()))
      return () => h('div')
    },
  })

  mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return { composable: result!, invalidateQueries, queryClient }
}

describe('useUpdatePaymentReference', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastAddMock.mockReset()
    vi.mocked(saleApi.updatePaymentReference).mockResolvedValue({
      paymentId: 'pay-1',
      method: 'CARD_DEBIT',
      amountCents: 127000,
      reference: 'AUTH-1',
      paidAt: '2026-05-06T14:43:00.000Z',
    })
  })

  it('forwards paymentId + payload to saleApi and invalidates the detail cache on success', async () => {
    const { composable, invalidateQueries } = mountComposable(() => 'sale-1')

    await composable.updateReference({ paymentId: 'pay-1', payload: { reference: 'AUTH-42' } })

    expect(saleApi.updatePaymentReference).toHaveBeenCalledWith('sale-1', 'pay-1', { reference: 'AUTH-42' })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: saleQueryKeys.detail('tenant-1', 'sale-1'),
    })
    expect(composable.lastError.value).toBeNull()
  })

  it('does NOT retry when the backend returns ENTITY_NOT_FOUND', async () => {
    vi.mocked(saleApi.updatePaymentReference).mockRejectedValueOnce(
      new ReferenceUpdateError('ENTITY_NOT_FOUND'),
    )

    const { composable } = mountComposable(() => 'sale-1')

    await expect(
      composable.updateReference({ paymentId: 'pay-1', payload: { reference: 'X' } }),
    ).rejects.toMatchObject({ code: 'ENTITY_NOT_FOUND' })

    expect(saleApi.updatePaymentReference).toHaveBeenCalledTimes(1)
    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'warning' }),
    )
  })

  it('does NOT retry when the backend returns SALE_UPDATE_FORBIDDEN', async () => {
    vi.mocked(saleApi.updatePaymentReference).mockRejectedValueOnce(
      new ReferenceUpdateError('SALE_UPDATE_FORBIDDEN'),
    )

    const { composable } = mountComposable(() => 'sale-1')

    await expect(
      composable.updateReference({ paymentId: 'pay-1', payload: { reference: 'X' } }),
    ).rejects.toMatchObject({ code: 'SALE_UPDATE_FORBIDDEN' })

    expect(saleApi.updatePaymentReference).toHaveBeenCalledTimes(1)
    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sin permisos',
        description: 'No tenés permisos para editar la referencia',
        color: 'error',
      }),
    )
  })

  it('retries up to 3 times for non-typed errors (network / 5xx)', async () => {
    vi.mocked(saleApi.updatePaymentReference).mockRejectedValue(
      Object.assign(new Error('boom'), { response: { status: 500, data: { error: 'INTERNAL_SERVER_ERROR' } } }),
    )

    const { composable } = mountComposable(() => 'sale-1')

    await expect(
      composable.updateReference({ paymentId: 'pay-1', payload: { reference: 'X' } }),
    ).rejects.toBeDefined()

    expect(saleApi.updatePaymentReference).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error al actualizar la referencia',
        color: 'error',
      }),
    )
  })

  it('ENTITY_NOT_FOUND also re-invalidates the detail cache so the cashier sees fresh state', async () => {
    vi.mocked(saleApi.updatePaymentReference).mockRejectedValueOnce(
      new ReferenceUpdateError('ENTITY_NOT_FOUND'),
    )

    const { composable, invalidateQueries } = mountComposable(() => 'sale-1')

    await expect(
      composable.updateReference({ paymentId: 'pay-1', payload: { reference: 'X' } }),
    ).rejects.toBeDefined()

    // Both onSuccess (n/a here) and onError should trigger invalidation when
    // the error is ENTITY_NOT_FOUND — total 1 call from the error handler.
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: saleQueryKeys.detail('tenant-1', 'sale-1'),
    })
  })

  it('exposes isPending flipping during the mutation', async () => {
    type Resolve = (value: import('../../interfaces/sale.types').UpdatedPaymentReference) => void
    const resolveFnRef: { current: Resolve | null } = { current: null }
    vi.mocked(saleApi.updatePaymentReference).mockImplementationOnce(
      () => new Promise<import('../../interfaces/sale.types').UpdatedPaymentReference>((r) => {
        resolveFnRef.current = r
      }),
    )

    const { composable } = mountComposable(() => 'sale-1')

    const promise = composable.updateReference({ paymentId: 'pay-1', payload: { reference: 'X' } })
    await Promise.resolve()
    expect(composable.isPending.value).toBe(true)

    if (!resolveFnRef.current) throw new Error('resolver not set')
    resolveFnRef.current({
      paymentId: 'pay-1',
      method: 'CARD_DEBIT',
      amountCents: 127000,
      reference: 'X',
      paidAt: '2026-05-06T14:43:00.000Z',
    })
    await promise
    expect(composable.isPending.value).toBe(false)
  })
})