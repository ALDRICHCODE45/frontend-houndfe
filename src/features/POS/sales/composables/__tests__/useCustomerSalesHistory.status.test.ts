/**
 * Sales history redesign T1 (L3): the «Con saldo» / «Sin entregar» filters of the customer history.
 * `paymentStatus=PARTIAL,CREDIT` and `deliveryStatus=PENDING` combine with `customerId` (+`petId`) by
 * AND; `summary`/`counts` ignore them (customer-wide) but narrow with `q`, so the metric strip keeps
 * the last customer-wide aggregates while a folio search is active.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import {
  useCustomerSalesHistory,
  type CustomerHistoryStatusFilter,
} from '../useCustomerSalesHistory'
import type { ConfirmedSalesListResponse } from '../../interfaces/sale.types'

const { listConfirmedMock } = vi.hoisted(() => ({ listConfirmedMock: vi.fn() }))

vi.mock('../../api/sale.api', () => ({ saleApi: { listConfirmed: listConfirmedMock } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

const CUSTOMER = 'customer-1'

function payload(overrides: Partial<ConfirmedSalesListResponse> = {}): ConfirmedSalesListResponse {
  return {
    data: [],
    pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    counts: { all: 23, pendingPayments: 4, notDelivered: 1 },
    summary: { salesCount: 23, totalSoldCents: 999_000, outstandingDebtCents: 5_000 },
    filterSummary: { count: 2, totalCents: 30_000, debtCents: 5_000 },
    ...overrides,
  }
}

const wrappers: VueWrapper[] = []
function run(
  opts: {
    status?: Ref<CustomerHistoryStatusFilter>
    petId?: Ref<string | null>
    q?: Ref<string | undefined>
  } = {},
) {
  const status = opts.status ?? ref<CustomerHistoryStatusFilter>('all')
  const petId = opts.petId ?? ref<string | null>(null)
  const q = opts.q ?? ref<string | undefined>(undefined)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, retryDelay: 0 } },
  })
  let result!: ReturnType<typeof useCustomerSalesHistory>
  const Test = defineComponent({
    setup() {
      result = useCustomerSalesHistory({
        customerId: ref(CUSTOMER),
        page: ref(1),
        open: ref(true),
        q,
        petId,
        status,
      })
      return () => h('div')
    },
  })
  wrappers.push(mount(Test, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } }))
  return { result, queryClient, status, q }
}

const lastParams = () => listConfirmedMock.mock.lastCall?.[0] as Record<string, unknown> | undefined
const BASE = {
  customerId: [CUSTOMER],
  page: 1,
  limit: 10,
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
}
const BASE_KEY = { page: 1, limit: 10, sortBy: 'confirmedAt', sortOrder: 'desc' }

describe('useCustomerSalesHistory — status filters (L3)', () => {
  beforeEach(() => {
    listConfirmedMock.mockReset()
    listConfirmedMock.mockResolvedValue(payload())
  })
  afterEach(() => {
    while (wrappers.length) wrappers.pop()?.unmount()
  })

  it('«Todas» sends no status params and keeps the previous key', async () => {
    const { result, queryClient } = run()
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    expect(lastParams()).toEqual(BASE)
    expect(
      queryClient
        .getQueryCache()
        .findAll()
        .map((query) => query.queryKey),
    ).toEqual([['sales', 'tenant-1', 'customer-history', CUSTOMER, BASE_KEY]])
  })

  it('«Con saldo» sends paymentStatus PARTIAL,CREDIT with the customer (and the pet)', async () => {
    const { result } = run({ status: ref('with-debt'), petId: ref('pet-1') })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    expect(lastParams()).toEqual({
      ...BASE,
      petId: 'pet-1',
      paymentStatus: ['PARTIAL', 'CREDIT'],
    })
    expect(lastParams()).not.toHaveProperty('deliveryStatus')
  })

  it('«Sin entregar» sends deliveryStatus PENDING and never a date, cashier or status param', async () => {
    const { result } = run({ status: ref('not-delivered') })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    expect(lastParams()).toEqual({ ...BASE, deliveryStatus: ['PENDING'] })
    for (const key of [
      'confirmedFrom',
      'confirmedTo',
      'cashierUserId',
      'status',
      'paymentStatus',
    ]) {
      expect(lastParams()).not.toHaveProperty(key)
    }
  })

  it('puts the status in the query key, so switching it fetches again', async () => {
    const status = ref<CustomerHistoryStatusFilter>('all')
    const { result, queryClient } = run({ status })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    status.value = 'with-debt'
    await nextTick()
    await vi.waitFor(() => expect(listConfirmedMock).toHaveBeenCalledTimes(2))
    expect(
      queryClient
        .getQueryCache()
        .findAll()
        .map((query) => query.queryKey),
    ).toContainEqual([
      'sales',
      'tenant-1',
      'customer-history',
      CUSTOMER,
      { ...BASE_KEY, paymentStatus: ['PARTIAL', 'CREDIT'] },
    ])
  })

  it('exposes the customer-wide summary and counts, untouched by a status filter', async () => {
    const status = ref<CustomerHistoryStatusFilter>('all')
    const { result } = run({ status })
    await vi.waitFor(() => expect(result.customerSummary.value).toBeDefined())
    listConfirmedMock.mockResolvedValue(
      payload({
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        filterSummary: { count: 1, totalCents: 15_000, debtCents: 5_000 },
      }),
    )
    status.value = 'with-debt'
    await vi.waitFor(() => expect(result.response.value?.pagination.total).toBe(1))
    expect(result.customerSummary.value).toEqual({
      salesCount: 23,
      totalSoldCents: 999_000,
      outstandingDebtCents: 5_000,
    })
    expect(result.customerCounts.value).toEqual({ all: 23, pendingPayments: 4, notDelivered: 1 })
  })

  it('keeps the last customer-wide aggregates while a folio search (q) narrows them', async () => {
    const q = ref<string | undefined>(undefined)
    const { result } = run({ q })
    await vi.waitFor(() => expect(result.customerSummary.value).toBeDefined())
    listConfirmedMock.mockResolvedValue(
      payload({
        counts: { all: 1, pendingPayments: 0, notDelivered: 0 },
        summary: { salesCount: 1, totalSoldCents: 15_000, outstandingDebtCents: 0 },
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    )
    q.value = 'A-1'
    await vi.waitFor(() => expect(result.response.value?.pagination.total).toBe(1))
    expect(lastParams()?.q).toBe('A-1')
    expect(result.customerSummary.value?.salesCount).toBe(23)
    expect(result.customerCounts.value?.pendingPayments).toBe(4)
  })
})
