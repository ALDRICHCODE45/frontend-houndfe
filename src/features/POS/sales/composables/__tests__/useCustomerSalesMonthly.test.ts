/**
 * Sales history backend data T1 (S4, handoff 28 §4): GET /customers/:customerId/sales-monthly for the
 * chart in the customer history. Needs `read:Sale` (not `read:Customer`); the key carries the
 * customer and `months`; a `404 CUSTOMER_NOT_FOUND` or a 4xx is not retried.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useCustomerSalesMonthly } from '../useCustomerSalesMonthly'

const { monthlyMock, userCanMock } = vi.hoisted(() => ({
  monthlyMock: vi.fn(),
  userCanMock: vi.fn(),
}))

vi.mock('../../api/sale.api', () => ({ saleApi: { getCustomerSalesMonthly: monthlyMock } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: userCanMock }),
}))

const MONTHS = [
  { month: '2026-09', saleCount: 0, totalCents: 0 },
  { month: '2026-10', saleCount: 2, totalCents: 58_000 },
  { month: '2026-11', saleCount: 3, totalCents: 125_000 },
]

const wrappers: VueWrapper[] = []
function run(opts: { customerId?: Ref<string | null>; open?: Ref<boolean>; months?: number } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retryDelay: 0 } },
  })
  let result!: ReturnType<typeof useCustomerSalesMonthly>
  const Test = defineComponent({
    setup() {
      result = useCustomerSalesMonthly({
        customerId: opts.customerId ?? ref('customer-1'),
        open: opts.open ?? ref(true),
        ...(opts.months !== undefined && { months: opts.months }),
      })
      return () => h('div')
    },
  })
  wrappers.push(mount(Test, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } }))
  return { result, queryClient }
}

function notFound() {
  return Object.assign(new Error('Not found'), {
    response: { status: 404, data: { statusCode: 404, error: 'CUSTOMER_NOT_FOUND' } },
  })
}

describe('useCustomerSalesMonthly', () => {
  beforeEach(() => {
    monthlyMock.mockReset()
    userCanMock.mockReset()
    userCanMock.mockReturnValue(true)
    monthlyMock.mockResolvedValue({
      customerId: 'customer-1',
      timeZone: 'America/Mexico_City',
      months: MONTHS,
    })
  })
  afterEach(() => {
    while (wrappers.length) wrappers.pop()?.unmount()
  })

  it('asks for 12 months of the customer and keys the query by customer and months', async () => {
    const { result, queryClient } = run()
    await vi.waitFor(() => expect(result.months.value).toEqual(MONTHS))
    expect(monthlyMock).toHaveBeenCalledWith('customer-1', 12, expect.anything())
    expect(
      queryClient
        .getQueryCache()
        .findAll()
        .map((query) => query.queryKey),
    ).toEqual([['sales', 'tenant-1', 'customer-monthly', 'customer-1', 12]])
    expect(result.canRead.value).toBe(true)
  })

  it('passes another months value through', async () => {
    const { result } = run({ months: 6 })
    await vi.waitFor(() => expect(result.months.value).toBeDefined())
    expect(monthlyMock).toHaveBeenCalledWith('customer-1', 6, expect.anything())
  })

  it('checks read:Sale and never fetches without it', async () => {
    userCanMock.mockImplementation(
      (action: string, subject: string) => !(action === 'read' && subject === 'Sale'),
    )
    const { result } = run()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(userCanMock).toHaveBeenCalledWith('read', 'Sale')
    expect(result.canRead.value).toBe(false)
    expect(monthlyMock).not.toHaveBeenCalled()
    expect(result.months.value).toBeUndefined()
  })

  it('does not fetch while closed or without a customer', async () => {
    run({ open: ref(false) })
    run({ customerId: ref(null) })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(monthlyMock).not.toHaveBeenCalled()
  })

  it('a 404 CUSTOMER_NOT_FOUND is an error, not retried', async () => {
    monthlyMock.mockRejectedValue(notFound())
    const { result } = run()
    await vi.waitFor(() => expect(result.isError.value).toBe(true))
    expect(monthlyMock).toHaveBeenCalledTimes(1)
    expect(result.months.value).toBeUndefined()
  })

  it('never shows the months of another customer', async () => {
    const customerId = ref<string | null>('customer-1')
    const { result } = run({ customerId })
    await vi.waitFor(() => expect(result.months.value).toEqual(MONTHS))
    let resolveNext!: (value: unknown) => void
    monthlyMock.mockReturnValue(new Promise((resolve) => (resolveNext = resolve)))
    customerId.value = 'customer-2'
    await vi.waitFor(() => expect(monthlyMock).toHaveBeenCalledTimes(2))
    expect(result.months.value).toBeUndefined()
    resolveNext({ customerId: 'customer-2', timeZone: 'America/Mexico_City', months: [] })
  })
})
