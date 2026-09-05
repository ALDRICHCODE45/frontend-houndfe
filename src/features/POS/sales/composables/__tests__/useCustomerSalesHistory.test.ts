import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Ref } from 'vue'
import { isRef, ref, defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useCustomerSalesHistory } from '../useCustomerSalesHistory'
import type {
  ConfirmedSalesListResponse,
  ConfirmedSaleRow,
} from '../../interfaces/sale.types'

const { listConfirmedMock, useAuthStoreMock } = vi.hoisted(() => ({
  listConfirmedMock: vi.fn(),
  useAuthStoreMock: vi.fn(),
}))

vi.mock('../../api/sale.api', () => ({
  saleApi: { listConfirmed: listConfirmedMock },
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: useAuthStoreMock,
}))

const CUSTOMER = 'customer-1'
const TENANT = 'tenant-1'

function row(): ConfirmedSaleRow {
  return {
    id: 'sale-1',
    folio: 'A-202608-000042',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    deliveryStatus: 'DELIVERED',
    totalCents: 180_000,
    debtCents: 0,
    confirmedAt: '2026-08-30T14:00:00.000Z',
    dueDate: null,
    customer: { id: CUSTOMER, name: 'Test Cliente' },
    cashier: { id: 'user-1', name: 'Cajero' },
    seller: null,
    paymentMethods: [],
  }
}

function responseWith(overrides: Partial<ConfirmedSalesListResponse> = {}): ConfirmedSalesListResponse {
  return {
    data: [row()],
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    counts: { all: 1, pendingPayments: 0, notDelivered: 0 },
    summary: { salesCount: 1, totalSoldCents: 180_000, outstandingDebtCents: 0 },
    ...overrides,
  }
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, retryDelay: 0 } },
  })
}

const wrappers: VueWrapper[] = []
type RunOpts = {
  customerId?: string | null | undefined
  page?: number
  open?: boolean
  queryClient?: QueryClient
}
function run(opts: RunOpts = {}) {
  const customerId = ref(opts.customerId !== undefined ? opts.customerId : CUSTOMER)
  const page = ref(opts.page ?? 1)
  const open = ref(opts.open ?? true)
  const queryClient = opts.queryClient ?? makeClient()
  let result!: ReturnType<typeof useCustomerSalesHistory>
  const Test = defineComponent({
    setup() {
      result = useCustomerSalesHistory({ customerId, page, open })
      return () => h('div')
    },
  })
  const wrapper = mount(Test, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  wrappers.push(wrapper)
  return { result, queryClient, customerId, page, open }
}

describe('useCustomerSalesHistory', () => {
  beforeEach(() => {
    listConfirmedMock.mockReset()
    listConfirmedMock.mockResolvedValue(responseWith())
    useAuthStoreMock.mockReset()
    useAuthStoreMock.mockReturnValue({ currentTenantId: TENANT })
  })

  afterEach(() => {
    while (wrappers.length) wrappers.pop()?.unmount()
  })

  it.each<RunOpts & { label: string }>([
    { label: 'open=false', open: false },
    { label: 'customerId=null', customerId: null },
    { label: 'customerId=undefined', customerId: undefined },
  ])('does not call the API when %s', (opts) => {
    const before = listConfirmedMock.mock.calls.length
    run(opts)
    expect(listConfirmedMock.mock.calls.length).toBe(before)
  })

  it('does not call the API when tenantId is empty', () => {
    useAuthStoreMock.mockReturnValueOnce({ currentTenantId: '' })
    const before = listConfirmedMock.mock.calls.length
    run()
    expect(listConfirmedMock.mock.calls.length).toBe(before)
  })

  it('sends the exact request shape with no status / customerIncludeNull', async () => {
    const { result } = run({ page: 2 })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    const params = listConfirmedMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(params).toEqual({
      customerId: [CUSTOMER],
      page: 2,
      limit: 10,
      sortBy: 'confirmedAt',
      sortOrder: 'desc',
    })
    expect(params).not.toHaveProperty('status')
    expect(params).not.toHaveProperty('customerIncludeNull')
  })

  it('exposes the authoritative summary from the response', async () => {
    const { result } = run()
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    expect(result.response.value?.summary).toEqual({
      salesCount: 1,
      totalSoldCents: 180_000,
      outstandingDebtCents: 0,
    })
  })

  it.each<[string, unknown]>([
    ['absent', {
      data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
    }],
    ['malformed', {
      data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
      summary: { salesCount: 'x', totalSoldCents: 0, outstandingDebtCents: 0 },
    }],
  ])('enters error state when summary is %s', async (_label, payload) => {
    listConfirmedMock.mockReset()
    listConfirmedMock.mockResolvedValue(payload as ConfirmedSalesListResponse)
    const { result } = run()
    await vi.waitFor(() => expect(result.isError.value).toBe(true))
  })
})
