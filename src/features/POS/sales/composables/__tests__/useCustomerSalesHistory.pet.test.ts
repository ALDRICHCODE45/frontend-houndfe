/**
 * Customer pets T4 (handoff 27 §7): the history of one pet is `GET /sales?customerId=<uuid>&petId=<uuid>`.
 * `petId` only ever travels with exactly one `customerId` (`400 PET_FILTER_REQUIRES_CUSTOMER` must never
 * be sent), it is part of the query key, and `summary`/`counts` are passed through untouched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useCustomerSalesHistory } from '../useCustomerSalesHistory'
import type { ConfirmedSalesListResponse } from '../../interfaces/sale.types'

const { listConfirmedMock } = vi.hoisted(() => ({ listConfirmedMock: vi.fn() }))

vi.mock('../../api/sale.api', () => ({ saleApi: { listConfirmed: listConfirmedMock } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

const CUSTOMER = 'customer-1'

function customerWide(
  overrides: Partial<ConfirmedSalesListResponse> = {},
): ConfirmedSalesListResponse {
  return {
    data: [],
    pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    counts: { all: 23, pendingPayments: 4, notDelivered: 1 },
    summary: { salesCount: 23, totalSoldCents: 999_000, outstandingDebtCents: 5_000 },
    filterSummary: { count: 2, totalCents: 30_000, debtCents: 0 },
    ...overrides,
  }
}

const wrappers: VueWrapper[] = []
function run(
  opts: {
    customerId?: Ref<string | null | undefined>
    petId?: Ref<string | null | undefined>
    queryClient?: QueryClient
  } = {},
) {
  const customerId = opts.customerId ?? ref<string | null | undefined>(CUSTOMER)
  const petId = opts.petId ?? ref<string | null | undefined>(null)
  const queryClient =
    opts.queryClient ??
    new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, retryDelay: 0 } } })
  let result!: ReturnType<typeof useCustomerSalesHistory>
  const Test = defineComponent({
    setup() {
      result = useCustomerSalesHistory({ customerId, page: ref(1), open: ref(true), petId })
      return () => h('div')
    },
  })
  wrappers.push(mount(Test, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } }))
  return { result, queryClient, petId, customerId }
}

const lastParams = () => listConfirmedMock.mock.lastCall?.[0] as Record<string, unknown> | undefined

describe('useCustomerSalesHistory — pet filter (§7)', () => {
  beforeEach(() => {
    listConfirmedMock.mockReset()
    listConfirmedMock.mockResolvedValue(customerWide())
  })
  afterEach(() => {
    while (wrappers.length) wrappers.pop()?.unmount()
  })

  it('without a pet sends exactly the same params and key as before', async () => {
    const { result, queryClient } = run()
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    expect(lastParams()).toEqual({
      customerId: [CUSTOMER],
      page: 1,
      limit: 10,
      sortBy: 'confirmedAt',
      sortOrder: 'desc',
    })
    expect(
      queryClient
        .getQueryCache()
        .findAll()
        .map((q) => q.queryKey),
    ).toEqual([
      [
        'sales',
        'tenant-1',
        'customer-history',
        CUSTOMER,
        {
          page: 1,
          limit: 10,
          sortBy: 'confirmedAt',
          sortOrder: 'desc',
        },
      ],
    ])
  })

  it('sends petId together with the single customerId', async () => {
    const { result } = run({ petId: ref('pet-1') })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    expect(lastParams()).toEqual({
      customerId: [CUSTOMER],
      petId: 'pet-1',
      page: 1,
      limit: 10,
      sortBy: 'confirmedAt',
      sortOrder: 'desc',
    })
  })

  it('includes petId in the query key, so switching pets fetches again', async () => {
    const petId = ref<string | null | undefined>(null)
    const { result, queryClient } = run({ petId })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())

    petId.value = 'pet-1'
    await nextTick()
    await vi.waitFor(() => expect(listConfirmedMock).toHaveBeenCalledTimes(2))
    expect(lastParams()?.petId).toBe('pet-1')
    const keys = queryClient
      .getQueryCache()
      .findAll()
      .map((q) => q.queryKey)
    expect(keys).toContainEqual([
      'sales',
      'tenant-1',
      'customer-history',
      CUSTOMER,
      {
        page: 1,
        limit: 10,
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
        petId: 'pet-1',
      },
    ])
  })

  it('never sends petId without a customer (PET_FILTER_REQUIRES_CUSTOMER)', async () => {
    run({ customerId: ref(null), petId: ref('pet-1') })
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(listConfirmedMock).not.toHaveBeenCalled()

    const { result } = run({ petId: ref('pet-1') })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    for (const [params] of listConfirmedMock.mock.calls as [Record<string, unknown>][]) {
      expect(params.customerId).toEqual([CUSTOMER])
    }
  })

  it('keeps summary and counts customer-wide while data/pagination/filterSummary narrow', async () => {
    const { result } = run({ petId: ref('pet-1') })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    expect(result.response.value?.summary).toEqual({
      salesCount: 23,
      totalSoldCents: 999_000,
      outstandingDebtCents: 5_000,
    })
    expect(result.response.value?.counts).toEqual({ all: 23, pendingPayments: 4, notDelivered: 1 })
    expect(result.response.value?.pagination.total).toBe(2)
    expect(result.response.value?.filterSummary).toEqual({
      count: 2,
      totalCents: 30_000,
      debtCents: 0,
    })
  })

  it('does not retry 404 PET_NOT_FOUND (the pet is gone, retrying cannot help)', async () => {
    listConfirmedMock.mockReset()
    listConfirmedMock.mockRejectedValue({
      response: {
        status: 404,
        data: { statusCode: 404, error: 'PET_NOT_FOUND', message: 'PET_NOT_FOUND' },
      },
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 3, gcTime: 0, retryDelay: 0 } },
    })
    const { result } = run({ petId: ref('pet-gone'), queryClient })
    await vi.waitFor(() => expect(result.isError.value).toBe(true))
    expect(listConfirmedMock).toHaveBeenCalledTimes(1)
  })
})
