import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Ref } from 'vue'
import { isRef, ref, defineComponent, h, nextTick } from 'vue'
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
  customerId?: string | null | Ref<string | null | undefined>
  page?: number | Ref<number>
  open?: boolean | Ref<boolean>
  q?: string | Ref<string | undefined>
  queryClient?: QueryClient
}
function run(opts: RunOpts = {}) {
  // Distinguish "not provided" (use CUSTOMER default) from "explicitly
  // undefined/null" (must disable the query).
  const customerId = isRef(opts.customerId)
    ? opts.customerId
    : ref('customerId' in opts ? (opts.customerId as string | null | undefined) : CUSTOMER)
  const page = isRef(opts.page) ? opts.page : ref(opts.page ?? 1)
  const open = isRef(opts.open) ? opts.open : ref(opts.open ?? true)
  const q = isRef(opts.q) ? opts.q : ref(opts.q)
  const queryClient = opts.queryClient ?? makeClient()
  let result!: ReturnType<typeof useCustomerSalesHistory>
  const Test = defineComponent({
    setup() {
      result = useCustomerSalesHistory({ customerId, page, open, q })
      return () => h('div')
    },
  })
  const wrapper = mount(Test, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  wrappers.push(wrapper)
  return { result, queryClient, customerId, page, open, q }
}

function axiosError(status: number) {
  return {
    response: { status, data: { error: 'x' } },
    isAxiosError: true,
    name: 'AxiosError',
    message: 'x',
    config: {},
    toJSON: () => ({}),
  }
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

  it('uses the exact centralized key and parameter identity', async () => {
    const { result, queryClient } = run({ page: 2 })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    expect(queryClient.getQueryCache().findAll().map((q) => q.queryKey)).toEqual([
      ['sales', TENANT, 'customer-history', CUSTOMER, {
        page: 2, limit: 10, sortBy: 'confirmedAt', sortOrder: 'desc',
      }],
    ])
  })

  it('hides customer A data while customer B is pending', async () => {
    let resolveB!: (v: ConfirmedSalesListResponse) => void
    listConfirmedMock.mockReset()
    listConfirmedMock
      .mockResolvedValueOnce(responseWith({ summary: { salesCount: 11, totalSoldCents: 0, outstandingDebtCents: 0 } }))
      .mockImplementationOnce(() => new Promise(r => { resolveB = r }))

    const customerId = ref('customer-A')
    const queryClient = makeClient()
    const { result } = run({ customerId, queryClient })
    await vi.waitFor(() => expect(result.response.value?.summary.salesCount).toBe(11))

    customerId.value = 'customer-B'
    await nextTick()
    await vi.waitFor(() => expect(result.isFetching.value).toBe(true))
    expect(result.response.value).toBeUndefined()

    resolveB(responseWith({ summary: { salesCount: 22, totalSoldCents: 0, outstandingDebtCents: 0 } }))
    await vi.waitFor(() => expect(result.response.value?.summary.salesCount).toBe(22))
  })

  it('keeps prior page response and toggles isPageTransition during same-customer page change', async () => {
    let hold!: (v: ConfirmedSalesListResponse) => void
    listConfirmedMock.mockReset()
    listConfirmedMock
      .mockResolvedValueOnce(responseWith({ pagination: { page: 1, limit: 10, total: 30, totalPages: 3 } }))
      .mockImplementationOnce(() => new Promise(r => { hold = r }))

    const page = ref(1)
    const queryClient = makeClient()
    const { result } = run({ page, queryClient })
    await vi.waitFor(() => expect(result.response.value?.pagination.page).toBe(1))

    page.value = 2
    await nextTick()
    await vi.waitFor(() => expect(result.isFetching.value).toBe(true))
    expect(result.response.value?.pagination.page).toBe(1)
    expect(result.isPageTransition.value).toBe(true)

    hold(responseWith({ pagination: { page: 2, limit: 10, total: 30, totalPages: 3 } }))
    await vi.waitFor(() => expect(result.response.value?.pagination.page).toBe(2))
    expect(result.isPageTransition.value).toBe(false)
  })

  it('reuses the cached response across close / reopen within staleTime', async () => {
    const open = ref(true)
    const queryClient = makeClient()
    const { result } = run({ open, queryClient })
    await vi.waitFor(() => expect(result.response.value).toBeDefined())
    const initialCalls = listConfirmedMock.mock.calls.length

    open.value = false
    await nextTick()
    open.value = true
    await nextTick()
    expect(listConfirmedMock.mock.calls.length).toBe(initialCalls)
    expect(result.response.value).toBeDefined()
  })

  it.each([400, 401, 403])('does not retry on HTTP %i', async (status) => {
    listConfirmedMock.mockReset()
    listConfirmedMock.mockRejectedValue(axiosError(status))
    // Retry-enabled client: only a composable-level 400/401/403 exclusion can
    // keep this to a single call.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 3, gcTime: 0, retryDelay: 0 } },
    })
    const { result } = run({ queryClient })
    await vi.waitFor(() => expect(result.isError.value).toBe(true))
    expect(listConfirmedMock).toHaveBeenCalledTimes(1)
  })

  it('trims q and forwards it to the API when non-empty', async () => {
    run({ q: '  A-202609  ' })
    await vi.waitFor(() => expect(listConfirmedMock).toHaveBeenCalled())
    expect((listConfirmedMock.mock.calls[0]?.[0] as Record<string, unknown>).q).toBe('A-202609')
  })

  it.each([undefined, '', '   '])('omits q from the API call when blank (%s)', async (qVal) => {
    run({ q: qVal as string })
    await vi.waitFor(() => expect(listConfirmedMock).toHaveBeenCalled())
    expect(listConfirmedMock.mock.calls[0]?.[0]).not.toHaveProperty('q')
  })

  it('reactive q triggers a new request', async () => {
    const q = ref<string | undefined>(undefined)
    run({ q })
    await vi.waitFor(() => expect(listConfirmedMock).toHaveBeenCalled())
    const before = listConfirmedMock.mock.calls.length

    q.value = 'A-42'
    await nextTick()
    await vi.waitFor(() => expect(listConfirmedMock).toHaveBeenCalledTimes(before + 1))
    expect((listConfirmedMock.mock.calls[before]?.[0] as Record<string, unknown>).q).toBe('A-42')
  })
})
