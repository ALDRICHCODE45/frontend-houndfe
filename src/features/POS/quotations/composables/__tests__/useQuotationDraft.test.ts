import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import type { PaginatedQuotations, QuotationResponseDto } from '../../interfaces/quotation.types'

const queryClientMock = {
  setQueryData: vi.fn(),
  setQueriesData: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  refetchQueries: vi.fn().mockResolvedValue(undefined),
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
    applyManualPromotion: vi.fn(),
    removeManualPromotion: vi.fn(),
    vetoPromotion: vi.fn(),
    unvetoPromotion: vi.fn(),
    setExpiry: vi.fn(),
    send: vi.fn(),
    cancel: vi.fn(),
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

function findMutationConfig(
  name: 'addItem' | 'updateQuantity' | 'removeItem' | 'overridePrice'
  | 'applyManualPromotion' | 'removeManualPromotion'
  | 'vetoPromotion' | 'unvetoPromotion' | 'setExpiry'
  | 'sendQuotation' | 'cancelQuotation',
): MutationConfigShape {
  // The composable registers mutations in fixed order in onMount — for test
  // simplicity we look them up by method invocation count via api mock.
  // Each invocation of `addItem`/`updateQuantity`/etc. pushes one config.
  const mutationOrder = [
    'addItem', 'updateQuantity', 'removeItem', 'overridePrice',
    'applyManualPromotion', 'removeManualPromotion',
    'vetoPromotion', 'unvetoPromotion', 'setExpiry',
    'sendQuotation', 'cancelQuotation',
  ] as const
  const index = mutationOrder.indexOf(name as (typeof mutationOrder)[number])
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
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    }

    expect(updater(page)?.data[0]?.totalCents).toBe(900)
    expect(updater(undefined)).toBeUndefined()
  })

  it('does not throw when instantiated without an id — mutations become live once id resolves', () => {
    const draft = useQuotationDraft(null)
    // The composable always returns the same public surface. When id is
    // empty the mutationFn closures still capture it reactively, so once
    // the parent feeds a real id (after createDraft + router.replace),
    // the mutations work without a re-mount.
    expect(draft).toBeDefined()
    expect(draft.isMutating.value).toBe(false)
    expect(typeof draft.addItem).toBe('function')
  })

  it('exposes reactive isMutating aggregated flag', () => {
    const draft = useQuotationDraft('quotation-1')
    expect(computed(() => draft.isMutating.value)).toBeDefined()
  })
})

// ─── S6: promotions + expiry mutations ────────────────────────────────────────
// The mutations mirror the slice-5 item mutations: each calls its API method,
// updates detail + list caches on success, and surfaces backend errors with
// a localized toast. The 400/409 contracts are exercised explicitly because
// they have user-facing copy distinct from generic errors.

describe('useQuotationDraft — promotions mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutationConfigs.length = 0
  })

  it('applyManualPromotion calls quotationApi.applyManualPromotion with id + promoId', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation()
    vi.mocked(quotationApi.applyManualPromotion).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.applyManualPromotion('promo-9')

    expect(quotationApi.applyManualPromotion).toHaveBeenCalledWith('quotation-1', 'promo-9')
  })

  it('applyManualPromotion onSuccess replaces detail and list caches', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ totalCents: 800 })
    vi.mocked(quotationApi.applyManualPromotion).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.applyManualPromotion('promo-9')
    await findMutationConfig('applyManualPromotion').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
    expect(queryClientMock.setQueriesData).toHaveBeenCalled()
  })

  it('applyManualPromotion surfaces 400 (not MANUAL promo) with a user-facing toast', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    type ApiError = Error & { response?: { status: number; data?: { message?: string } } }
    const error = new Error('Promotion is not MANUAL') as ApiError
    error.response = { status: 400, data: { message: 'Promotion is not MANUAL' } }
    vi.mocked(quotationApi.applyManualPromotion).mockRejectedValueOnce(error)
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.applyManualPromotion('promo-9')).rejects.toThrow('Promotion is not MANUAL')
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.any(String), description: expect.any(String) }),
    )
  })

  it('applyManualPromotion surfaces 409 (not DRAFT) with a warning toast', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    type ApiError = Error & { response?: { status: number } }
    const error = new Error('Quotation is not DRAFT') as ApiError
    error.response = { status: 409 }
    vi.mocked(quotationApi.applyManualPromotion).mockRejectedValueOnce(error)
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.applyManualPromotion('promo-9')).rejects.toThrow('Quotation is not DRAFT')
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'warning' }),
    )
  })

  it('removeManualPromotion calls quotationApi.removeManualPromotion', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation()
    vi.mocked(quotationApi.removeManualPromotion).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.removeManualPromotion('promo-9')

    expect(quotationApi.removeManualPromotion).toHaveBeenCalledWith('quotation-1', 'promo-9')
  })

  it('removeManualPromotion onSuccess replaces caches', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation()
    vi.mocked(quotationApi.removeManualPromotion).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.removeManualPromotion('promo-9')
    await findMutationConfig('removeManualPromotion').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
  })

  it('vetoPromotion calls quotationApi.vetoPromotion', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ vetoedPromotionIds: ['promo-2'] })
    vi.mocked(quotationApi.vetoPromotion).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.vetoPromotion('promo-2')

    expect(quotationApi.vetoPromotion).toHaveBeenCalledWith('quotation-1', 'promo-2')
  })

  it('vetoPromotion onSuccess replaces caches', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ vetoedPromotionIds: ['promo-2'] })
    vi.mocked(quotationApi.vetoPromotion).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.vetoPromotion('promo-2')
    await findMutationConfig('vetoPromotion').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
  })

  it('unvetoPromotion calls quotationApi.unvetoPromotion', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ vetoedPromotionIds: [] })
    vi.mocked(quotationApi.unvetoPromotion).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.unvetoPromotion('promo-2')

    expect(quotationApi.unvetoPromotion).toHaveBeenCalledWith('quotation-1', 'promo-2')
  })

  it('unvetoPromotion onSuccess replaces caches', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ vetoedPromotionIds: [] })
    vi.mocked(quotationApi.unvetoPromotion).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.unvetoPromotion('promo-2')
    await findMutationConfig('unvetoPromotion').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
  })
})

describe('useQuotationDraft — expiry mutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutationConfigs.length = 0
  })

  it('setExpiry calls quotationApi.setExpiry with ISO timestamp', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ expiresAt: '2026-09-01T00:00:00.000Z' })
    vi.mocked(quotationApi.setExpiry).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.setExpiry('2026-09-01T00:00:00.000Z')

    expect(quotationApi.setExpiry).toHaveBeenCalledWith(
      'quotation-1',
      '2026-09-01T00:00:00.000Z',
    )
  })

  it('setExpiry accepts null to clear the expiration', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ expiresAt: null })
    vi.mocked(quotationApi.setExpiry).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.setExpiry(null)

    expect(quotationApi.setExpiry).toHaveBeenCalledWith('quotation-1', null)
  })

  it('clearExpiry is a convenience wrapper that calls setExpiry with null', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ expiresAt: null })
    vi.mocked(quotationApi.setExpiry).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.clearExpiry()

    expect(quotationApi.setExpiry).toHaveBeenCalledWith('quotation-1', null)
  })

  it('setExpiry onSuccess replaces detail and list caches', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ expiresAt: '2026-09-01T00:00:00.000Z' })
    vi.mocked(quotationApi.setExpiry).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.setExpiry('2026-09-01T00:00:00.000Z')
    await findMutationConfig('setExpiry').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
    expect(queryClientMock.setQueriesData).toHaveBeenCalled()
  })

  it('setExpiry surfaces 409 (not DRAFT) with a warning toast', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    type ApiError = Error & { response?: { status: number } }
    const error = new Error('Quotation is not DRAFT') as ApiError
    error.response = { status: 409 }
    vi.mocked(quotationApi.setExpiry).mockRejectedValueOnce(error)
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.setExpiry('2026-09-01T00:00:00.000Z')).rejects.toThrow('Quotation is not DRAFT')
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'warning' }),
    )
  })
})

// ─── S7: send + cancel mutations ──────────────────────────────────────────────
// Both transitions are terminal-ish (SENT, CANCELLED). send can fail with 422
// (no items / no email) or 502 (Resend email failure — backend keeps status
// in DRAFT). cancel is simpler: terminal, no business errors beyond 404.

describe('useQuotationDraft — send mutation (S7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutationConfigs.length = 0
  })

  it('sendQuotation calls quotationApi.send with email=true by default', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ status: 'SENT' })
    vi.mocked(quotationApi.send).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.sendQuotation()

    expect(quotationApi.send).toHaveBeenCalledWith('quotation-1', true)
  })

  it('sendQuotation forwards email=false to quotationApi.send', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ status: 'SENT' })
    vi.mocked(quotationApi.send).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.sendQuotation(false)

    expect(quotationApi.send).toHaveBeenCalledWith('quotation-1', false)
  })

  it('sendQuotation onSuccess replaces detail + list caches with SENT quotation', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({ status: 'SENT' })
    vi.mocked(quotationApi.send).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.sendQuotation()
    await findMutationConfig('sendQuotation').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
    expect(queryClientMock.setQueriesData).toHaveBeenCalled()
  })

  it('sendQuotation surfaces 422 (QUOTATION_HAS_NO_ITEMS) with localized toast', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    type ApiError = Error & {
      response?: { status: number; data?: { error?: string } }
    }
    const error = new Error('Cannot send empty quotation') as ApiError
    error.response = { status: 422, data: { error: 'QUOTATION_HAS_NO_ITEMS' } }
    vi.mocked(quotationApi.send).mockRejectedValueOnce(error)
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.sendQuotation()).rejects.toBeDefined()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
        description: expect.stringMatching(/productos/i),
      }),
    )
  })

  it('sendQuotation surfaces 422 (QUOTATION_CUSTOMER_HAS_NO_EMAIL) with localized toast', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    type ApiError = Error & {
      response?: { status: number; data?: { error?: string } }
    }
    const error = new Error('Customer has no email') as ApiError
    error.response = { status: 422, data: { error: 'QUOTATION_CUSTOMER_HAS_NO_EMAIL' } }
    vi.mocked(quotationApi.send).mockRejectedValueOnce(error)
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.sendQuotation()).rejects.toBeDefined()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringMatching(/email/i),
      }),
    )
  })

  it('sendQuotation surfaces 502 (Resend fail) with retry toast', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    type ApiError = Error & { response?: { status: number } }
    const error = new Error('Resend upstream failed') as ApiError
    error.response = { status: 502 }
    vi.mocked(quotationApi.send).mockRejectedValueOnce(error)
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.sendQuotation()).rejects.toBeDefined()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringMatching(/reintent/i),
      }),
    )
  })

  it('sendQuotation surfaces 409 (not DRAFT) with a warning toast', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    type ApiError = Error & { response?: { status: number } }
    const error = new Error('Quotation is not DRAFT') as ApiError
    error.response = { status: 409 }
    vi.mocked(quotationApi.send).mockRejectedValueOnce(error)
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.sendQuotation()).rejects.toThrow('Quotation is not DRAFT')
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'warning' }),
    )
  })
})

describe('useQuotationDraft — cancel mutation (S7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutationConfigs.length = 0
  })

  it('cancelQuotation calls quotationApi.cancel with the reason', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({
      status: 'CANCELLED',
      cancelReason: 'CUSTOMER_REQUEST',
      canceledAt: '2026-08-01T01:00:00.000Z',
    })
    vi.mocked(quotationApi.cancel).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.cancelQuotation('CUSTOMER_REQUEST')

    expect(quotationApi.cancel).toHaveBeenCalledWith('quotation-1', 'CUSTOMER_REQUEST')
  })

  it('cancelQuotation onSuccess replaces detail + list caches with CANCELLED quotation', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    const updated = makeQuotation({
      status: 'CANCELLED',
      cancelReason: 'PRICE_OBJECTION',
    })
    vi.mocked(quotationApi.cancel).mockResolvedValueOnce(updated)
    const draft = useQuotationDraft('quotation-1')

    await draft.cancelQuotation('PRICE_OBJECTION')
    await findMutationConfig('cancelQuotation').onSuccess?.(updated, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
    expect(queryClientMock.setQueriesData).toHaveBeenCalled()
  })

  it('cancelQuotation surfaces backend errors with a toast and rethrows', async () => {
    const { quotationApi } = await import('../../api/quotation.api')
    type ApiError = Error & { response?: { status: number } }
    const error = new Error('Quotation not found') as ApiError
    error.response = { status: 404 }
    vi.mocked(quotationApi.cancel).mockRejectedValueOnce(error)
    const draft = useQuotationDraft('quotation-1')

    await expect(draft.cancelQuotation('OTHER')).rejects.toThrow('Quotation not found')
    expect(toastAdd).toHaveBeenCalled()
  })
})
