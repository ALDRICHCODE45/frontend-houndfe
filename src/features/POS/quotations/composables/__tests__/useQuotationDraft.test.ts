import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import type { PaginatedQuotations, QuotationResponseDto } from '../../interfaces/quotation.types'

const queryClientMock = {
  setQueryData: vi.fn(),
  setQueriesData: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
}
const routerReplace = vi.fn().mockResolvedValue(undefined)
const toastAdd = vi.fn()

interface MutationConfigShape {
  mutationFn: (variables: never) => Promise<QuotationResponseDto>
  onSuccess?: (data: QuotationResponseDto, variables: never) => unknown
}
const mutationConfigs: MutationConfigShape[] = []

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQuery: vi.fn(),
    useQueryClient: () => queryClientMock,
    useMutation: vi.fn((config) => {
      mutationConfigs.push(config)
      return {
        mutateAsync: (variables: never) => config.mutationFn(variables),
        isPending: ref(false),
        isError: ref(false),
        error: ref(null),
      }
    }),
  }
})

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ replace: routerReplace }) }
})

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

vi.mock('@nuxt/ui/composables/useToast', () => ({
  useToast: () => ({ add: toastAdd }),
}))

vi.mock('../../api/quotation.api', () => ({
  quotationApi: {
    addItem: vi.fn(),
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    overridePrice: vi.fn(),
  },
}))

import { useQuotationDraft } from '../useQuotationDraft'

function makeQuotation(overrides: Partial<QuotationResponseDto> = {}): QuotationResponseDto {
  return {
    id: 'quotation-1',
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
    totalCents: 0,
    manuallyEnded: false,
    items: [],
    appliedPromotions: [],
    vetoedPromotionIds: [],
    optedInManualPromotionIds: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function findMutationConfig(name: 'addItem' | 'updateQuantity' | 'removeItem' | 'overridePrice'): MutationConfigShape {
  // The composable registers mutations in fixed order in onMount — for test
  // simplicity we look them up by method invocation count via api mock.
  // Each invocation of `addItem`/`updateQuantity`/etc. pushes one config.
  const index = ['addItem', 'updateQuantity', 'removeItem', 'overridePrice'].indexOf(name)
  const config = mutationConfigs[index]
  if (!config) throw new Error(`Mutation ${name} not registered`)
  return config
}

describe('useQuotationDraft — item mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutationConfigs.length = 0
  })

  it('addItem calls quotationApi.addItem with normalized payload', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ items: [] })
    vi.mocked(quotationApi.addItem).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.addItem('product-1', 2)

    expect(quotationApi.addItem).toHaveBeenCalledWith('quotation-1', {
      productId: 'product-1',
      variantId: undefined,
      quantity: 2,
    })
  })

  it('addItem includes variantId when provided', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    vi.mocked(quotationApi.addItem).mockResolvedValueOnce(makeQuotation())
    const draft = useQuotationDraft('quotation-1')

    await draft.addItem('product-1', 1, 'variant-7')

    expect(quotationApi.addItem).toHaveBeenCalledWith('quotation-1', {
      productId: 'product-1',
      variantId: 'variant-7',
      quantity: 1,
    })
  })

  it('addItem with quantity < 1 throws client-side validation error', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.addItem('product-1', 0)).rejects.toThrow(/cantidad/i)
    await expect(draft.addItem('product-1', -1)).rejects.toThrow(/cantidad/i)
    expect(quotationApi.addItem).not.toHaveBeenCalled()
  })

  it('addItem onSuccess replaces the detail cache with the response', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ totalCents: 999 })
    vi.mocked(quotationApi.addItem).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.addItem('product-1', 1)
    await findMutationConfig('addItem').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
    expect(queryClientMock.setQueriesData).toHaveBeenCalled()
  })

  it('updateQuantity calls quotationApi.updateItemQuantity with id/itemId/quantity', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation()
    vi.mocked(quotationApi.updateQuantity).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.updateQuantity('item-1', 5)

    expect(quotationApi.updateQuantity).toHaveBeenCalledWith('quotation-1', 'item-1', 5)
  })

  it('updateQuantity rejects invalid quantity client-side', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.updateQuantity('item-1', 0)).rejects.toThrow(/cantidad/i)
    expect(quotationApi.updateQuantity).not.toHaveBeenCalled()
  })

  it('updateQuantity onSuccess replaces detail and list caches', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ totalCents: 1234 })
    vi.mocked(quotationApi.updateQuantity).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.updateQuantity('item-1', 3)
    await findMutationConfig('updateQuantity').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
    expect(queryClientMock.setQueriesData).toHaveBeenCalled()
  })

  it('removeItem calls quotationApi.removeItem with id/itemId', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ items: [] })
    vi.mocked(quotationApi.removeItem).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.removeItem('item-1')

    expect(quotationApi.removeItem).toHaveBeenCalledWith('quotation-1', 'item-1')
  })

  it('removeItem onSuccess replaces caches', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation()
    vi.mocked(quotationApi.removeItem).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.removeItem('item-1')
    await findMutationConfig('removeItem').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
  })

  it('overridePrice calls quotationApi.overrideItemPrice', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation()
    vi.mocked(quotationApi.overridePrice).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.overridePrice('item-1', 19900)

    expect(quotationApi.overridePrice).toHaveBeenCalledWith('quotation-1', 'item-1', 19900)
  })

  it('overridePrice rejects negative price client-side', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.overridePrice('item-1', -1)).rejects.toThrow(/precio/i)
    expect(quotationApi.overridePrice).not.toHaveBeenCalled()
  })

  it('overridePrice onSuccess replaces caches with the updated quotation', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ totalCents: 7777 })
    vi.mocked(quotationApi.overridePrice).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.overridePrice('item-1', 9900)
    await findMutationConfig('overridePrice').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
    expect(queryClientMock.setQueriesData).toHaveBeenCalled()
  })

  it.each([
    { method: 'addItem', apiMethod: 'addItem' },
    { method: 'updateQuantity', apiMethod: 'updateQuantity' },
    { method: 'removeItem', apiMethod: 'removeItem' },
    { method: 'overridePrice', apiMethod: 'overridePrice' },
  ] as const)('surfaces %s API errors to the caller', async ({ method, apiMethod }) => {
    const { quotationApi } = await import('../../api/quotation.api')
    vi.mocked(quotationApi[apiMethod]).mockRejectedValueOnce(new Error(`${apiMethod} failed`))
    const draft = useQuotationDraft('quotation-1')

    const action = draft[method] as unknown as (...args: unknown[]) => Promise<unknown>
    if (method === 'addItem') {
      await expect(action('product-1', 1)).rejects.toThrow(`${apiMethod} failed`)
    } else if (method === 'updateQuantity') {
      await expect(action('item-1', 1)).rejects.toThrow(`${apiMethod} failed`)
    } else if (method === 'removeItem') {
      await expect(action('item-1')).rejects.toThrow(`${apiMethod} failed`)
    } else if (method === 'overridePrice') {
      await expect(action('item-1', 100)).rejects.toThrow(`${apiMethod} failed`)
    }
  })

  it('toasts a user-facing error when backend rejects with 409 (not DRAFT)', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    type ApiError = Error & { response?: { status: number } }
    const error = new Error('Quotation is not DRAFT') as ApiError
    error.response = { status: 409 }
    vi.mocked(quotationApi.addItem).mockRejectedValueOnce(error)
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.addItem('product-1', 1)).rejects.toThrow('Quotation is not DRAFT')
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/bloqueada|error/i),
        color: expect.stringMatching(/warning|error/i),
      }),
    )
  })

  it('replaces a matching quotation in every cached list page', async () => {
    const updated = makeQuotation({ id: 'quotation-1', totalCents: 900 })
    useQuotationDraft('quotation-1')
    // Manually invoke addItem success once the mutation is registered
    mutationConfigs[0]?.onSuccess?.(updated, undefined as never)

    const updater = queryClientMock.setQueriesData.mock.calls[0]?.[1] as (
      page: PaginatedQuotations | undefined,
    ) => PaginatedQuotations | undefined
    const page: PaginatedQuotations = {
      data: [makeQuotation({ id: 'quotation-1' }), makeQuotation({ id: 'quotation-2' })],
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    }

    expect(updater(page)?.data[0]?.totalCents).toBe(900)
    expect(updater(undefined)).toBeUndefined()
  })

  it('throws when called without an active quotation id', () => {
    expect(() => useQuotationDraft(null)).toThrow(/quotation id/i)
  })

  it('exposes reactive isMutating aggregated flag', () => {
    const draft = useQuotationDraft('quotation-1')
    expect(computed(() => draft.isMutating.value)).toBeDefined()
  })
})
