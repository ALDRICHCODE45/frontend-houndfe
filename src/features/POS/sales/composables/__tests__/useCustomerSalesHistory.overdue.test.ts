/**
 * Sales history backend data T1 (S3, handoff 28 §2.3): the «Vencidas» filter sends `overdue=true`
 * with the customer (and the pet), never with another status param; without it the params are
 * byte-identical to before. `summary`/`counts` stay customer-wide while it is applied.
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
const WIDE_SUMMARY = {
  salesCount: 23,
  totalSoldCents: 999_000,
  outstandingDebtCents: 98_000,
  averageTicketCents: 43_435,
  overdueDebtCents: 61_000,
  oldestOverdueDueDate: '2026-11-10',
}
const WIDE_COUNTS = { all: 23, pendingPayments: 4, notDelivered: 1, overdue: 2 }

function payload(overrides: Partial<ConfirmedSalesListResponse> = {}): ConfirmedSalesListResponse {
  return {
    data: [],
    pagination: { page: 1, limit: 10, total: 23, totalPages: 3 },
    counts: WIDE_COUNTS,
    summary: WIDE_SUMMARY,
    filterSummary: { count: 23, totalCents: 999_000, debtCents: 98_000 },
    ...overrides,
  }
}

const wrappers: VueWrapper[] = []
function run(opts: { status?: Ref<CustomerHistoryStatusFilter>; petId?: Ref<string | null> } = {}) {
  const status = opts.status ?? ref<CustomerHistoryStatusFilter>('all')
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
        petId: opts.petId ?? ref(null),
        status,
      })
      return () => h('div')
    },
  })
  wrappers.push(mount(Test, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } }))
  return { result, queryClient, status }
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

describe('useCustomerSalesHistory — «Vencidas» (overdue=true)', () => {
  beforeEach(() => {
    listConfirmedMock.mockReset()
    listConfirmedMock.mockResolvedValue(payload())
  })
  afterEach(() => {
    while (wrappers.length) wrappers.pop()?.unmount()
  })

  it('without the filter the params carry no overdue key (unchanged)', async () => {
    const { result } = run()
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    expect(lastParams()).toEqual(BASE)
    expect(lastParams()).not.toHaveProperty('overdue')
  })

  it('sends overdue: true with the customer and the pet, and no other status param', async () => {
    const { result } = run({ status: ref('overdue'), petId: ref('pet-1') })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    expect(lastParams()).toEqual({ ...BASE, petId: 'pet-1', overdue: true })
    expect(lastParams()).not.toHaveProperty('paymentStatus')
    expect(lastParams()).not.toHaveProperty('deliveryStatus')
  })

  it('puts overdue in the query key', async () => {
    const status = ref<CustomerHistoryStatusFilter>('all')
    const { result, queryClient } = run({ status })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    status.value = 'overdue'
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
      { ...BASE_KEY, overdue: true },
    ])
  })

  it('keeps the customer-wide summary and counts (with the new members) under the filter', async () => {
    const status = ref<CustomerHistoryStatusFilter>('all')
    const { result } = run({ status })
    await vi.waitFor(() => expect(result.customerSummary.value).toBeDefined())
    listConfirmedMock.mockResolvedValue(
      payload({
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
        filterSummary: { count: 2, totalCents: 120_000, debtCents: 61_000 },
      }),
    )
    status.value = 'overdue'
    await vi.waitFor(() => expect(result.response.value?.pagination.total).toBe(2))
    expect(result.customerSummary.value).toEqual(WIDE_SUMMARY)
    expect(result.customerCounts.value).toEqual(WIDE_COUNTS)
  })
})
