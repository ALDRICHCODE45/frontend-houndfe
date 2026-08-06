import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import type { PaginatedQuotations, QuotationResponseDto } from '../../interfaces/quotation.types'

const queryClientMock = {
  setQueryData: vi.fn(),
  setQueriesData: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
}
const routerReplace = vi.fn().mockResolvedValue(undefined)
const mutationConfigs: Array<{
  mutationFn: (variables: never) => Promise<QuotationResponseDto>
  onSuccess?: (data: QuotationResponseDto, variables: never) => unknown
}> = []

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

vi.mock('../../api/quotation.api', () => ({
  quotationApi: {
    getById: vi.fn(),
    createDraft: vi.fn(),
    assignCustomer: vi.fn(),
    setPriceList: vi.fn(),
  },
}))

import { useQuery } from '@tanstack/vue-query'
import { quotationApi } from '../../api/quotation.api'
import { useQuotationDetail } from '../useQuotationDetail'

function makeQuotation(overrides: Partial<QuotationResponseDto> = {}): QuotationResponseDto {
  return {
    id: 'quotation-12345678',
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

function setupQuery(data?: QuotationResponseDto, options: { error?: Error } = {}) {
  vi.mocked(useQuery).mockReturnValue({
    data: ref(data),
    isLoading: ref(false),
    isError: ref(Boolean(options.error)),
    error: ref(options.error ?? null),
  } as never)
}

describe('useQuotationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutationConfigs.length = 0
    setupQuery()
  })

  it('fetches the quotation with the tenant-scoped detail key', async () => {
    const quotation = makeQuotation()
    vi.mocked(quotationApi.getById).mockResolvedValueOnce(quotation)
    setupQuery(quotation)

    const result = useQuotationDetail(ref(quotation.id))
    const options = vi.mocked(useQuery).mock.calls[0]?.[0] as unknown as {
      queryKey: { value: readonly unknown[] }
      queryFn: () => Promise<QuotationResponseDto>
      enabled: { value: boolean }
    }

    expect(options.queryKey.value).toEqual(
      quotationQueryKeys.detail('tenant-1', quotation.id),
    )
    expect(options.enabled.value).toBe(true)
    await expect(options.queryFn()).resolves.toEqual(quotation)
    expect(result.quotation.value).toEqual(quotation)
  })

  it('exposes the detail query error state', () => {
    setupQuery(undefined, { error: new Error('detail failed') })
    const result = useQuotationDetail('quotation-1')

    expect(result.isError.value).toBe(true)
    expect(result.error.value).toMatchObject({ message: 'detail failed' })
  })

  it('creates a draft, seeds both caches, invalidates lists, and navigates', async () => {
    const created = makeQuotation({ id: 'created-1' })
    vi.mocked(quotationApi.createDraft).mockResolvedValueOnce(created)
    const result = useQuotationDetail(null)

    await expect(result.createDraft()).resolves.toEqual(created)
    expect(quotationApi.createDraft).toHaveBeenCalledWith(undefined)
    await mutationConfigs[0]?.onSuccess?.(created, undefined as never)

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', created.id),
      created,
    )
    expect(queryClientMock.invalidateQueries).toHaveBeenCalled()
    expect(routerReplace).toHaveBeenCalledWith(`/pos/cotizaciones/${created.id}`)
  })

  it('passes an optional customerId when creating a draft', async () => {
    const created = makeQuotation({ customerId: 'customer-1' })
    vi.mocked(quotationApi.createDraft).mockResolvedValueOnce(created)
    const result = useQuotationDetail(null)

    await result.createDraft('customer-1')

    expect(quotationApi.createDraft).toHaveBeenCalledWith('customer-1')
  })

  it('updates detail and list caches after assigning a customer', async () => {
    const updated = makeQuotation({
      customerId: 'customer-1',
      customer: { id: 'customer-1', firstName: 'María', lastName: 'Pérez', email: 'maria@test.com' },
    })
    vi.mocked(quotationApi.assignCustomer).mockResolvedValueOnce(updated)
    const result = useQuotationDetail(updated.id)

    await expect(result.assignCustomer('customer-1')).resolves.toEqual(updated)
    await mutationConfigs[1]?.onSuccess?.(updated, 'customer-1' as never)

    expect(quotationApi.assignCustomer).toHaveBeenCalledWith(updated.id, 'customer-1')
    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
    expect(queryClientMock.setQueriesData).toHaveBeenCalled()
  })

  it('updates detail and list caches after changing the price list', async () => {
    const updated = makeQuotation({ globalPriceListId: 'price-list-1' })
    vi.mocked(quotationApi.setPriceList).mockResolvedValueOnce(updated)
    const result = useQuotationDetail(updated.id)

    await expect(result.changePriceList('price-list-1')).resolves.toEqual(updated)
    await mutationConfigs[2]?.onSuccess?.(updated, 'price-list-1' as never)

    expect(quotationApi.setPriceList).toHaveBeenCalledWith(updated.id, 'price-list-1')
    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', updated.id),
      updated,
    )
  })

  it.each([
    ['createDraft', 'createDraft', null],
    ['assignCustomer', 'assignCustomer', 'customer-1'],
    ['changePriceList', 'setPriceList', 'price-list-1'],
  ] as const)('surfaces %s API errors to the caller', async (method, apiMethod, argument) => {
    vi.mocked(quotationApi[apiMethod]).mockRejectedValueOnce(new Error(`${method} failed`))
    const result = useQuotationDetail(method === 'createDraft' ? null : 'quotation-1')

    const action = result[method] as (value?: string | null) => Promise<QuotationResponseDto>
    await expect(action(argument)).rejects.toThrow(`${method} failed`)
  })

  it('replaces a matching quotation in every cached list page', () => {
    const updated = makeQuotation({ id: 'quotation-1', totalCents: 900 })
    const result = useQuotationDetail(updated.id)
    void result
    mutationConfigs[1]?.onSuccess?.(updated, 'customer-1' as never)

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
})
