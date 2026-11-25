/**
 * Sales history backend data T4 (S1, handoff 29 §1): «Descargar estado de cuenta» sits in the
 * history header for the shown customer, gated by `read:Sale` exactly like the monthly chart.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, shallowRef } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { Customer } from '../../interfaces/customer.types'
import type {
  ConfirmedSalesListResponse,
  CustomerSalesMonth,
} from '@/features/POS/sales/interfaces/sale.types'
import CustomerSalesHistorySlideover from '../CustomerSalesHistorySlideover.vue'

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))
vi.mock('@/features/POS/sales/components/history/SaleHistoryRowDetail.vue', () => ({
  default: defineComponent({ props: { saleId: String }, setup: () => () => h('div') }),
}))
vi.mock('@/features/POS/sales/components/DebtPaymentModal.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}))
vi.mock('../CustomerStatementDownload.vue', () => ({
  default: defineComponent({
    props: { customerId: String },
    setup: (props) => () =>
      h('button', { 'data-testid': 'statement-trigger', 'data-customer-id': props.customerId }),
  }),
}))

const response = shallowRef<ConfirmedSalesListResponse>()
const history = {
  response,
  customerSummary: computed(() => response.value?.summary),
  customerCounts: computed(() => response.value?.counts),
  isLoading: shallowRef(false),
  isFetching: shallowRef(false),
  isPageTransition: shallowRef(false),
  isError: shallowRef(false),
  error: shallowRef<unknown>(null),
  refetch: vi.fn(),
}
vi.mock('@/features/POS/sales/composables/useCustomerSalesHistory', () => ({
  useCustomerSalesHistory: () => history,
}))
const monthly = {
  canRead: shallowRef(true),
  months: shallowRef<CustomerSalesMonth[] | undefined>(),
  isLoading: shallowRef(false),
  isError: shallowRef(false),
  refetch: vi.fn(),
}
vi.mock('@/features/POS/sales/composables/useCustomerSalesMonthly', () => ({
  useCustomerSalesMonthly: () => monthly,
}))
vi.mock('../../pets/usePets', () => ({
  usePetsList: () => ({ data: shallowRef([]), refetch: vi.fn(), isLoading: shallowRef(false) }),
}))

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer-1',
    firstName: 'Ana',
    lastName: 'Pérez',
    fullName: 'Ana Pérez',
    phoneCountryCode: null,
    phone: null,
    email: null,
    globalPriceListId: null,
    globalPriceListName: null,
    comments: null,
    createdAt: '2025-03-15T18:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function stubViewport(mobile: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: mobile && query.includes('max-width'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
}

let wrapper: VueWrapper | undefined
function mountSlideover(props: { customer?: Customer | null } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  wrapper = mountWithUApp(CustomerSalesHistorySlideover, {
    props: { open: true, customer: customer(), ...props },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return wrapper
}

const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)

describe('CustomerSalesHistorySlideover — statement PDF (handoff 29)', () => {
  beforeEach(() => {
    stubViewport(false)
    monthly.canRead.value = true
    response.value = {
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      summary: { salesCount: 0, totalSoldCents: 0, outstandingDebtCents: 0 },
      counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
    }
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.vm.$root?.$?.appContext.app.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('shows the action in the header for the shown customer', async () => {
    mountSlideover()
    await flushPromises()
    const trigger = q('[data-testid="history-header"] [data-testid="statement-trigger"]')
    expect(trigger).not.toBeNull()
    expect(trigger!.dataset.customerId).toBe('customer-1')
  })

  it('also for a customer without sales (an empty statement is still valid)', async () => {
    mountSlideover()
    await flushPromises()
    expect(q('[data-testid="statement-trigger"]')).not.toBeNull()
  })

  it('is hidden without read:Sale, like the monthly chart', async () => {
    monthly.canRead.value = false
    mountSlideover()
    await flushPromises()
    expect(q('[data-testid="statement-trigger"]')).toBeNull()
  })

  it('is hidden without a customer', async () => {
    mountSlideover({ customer: null })
    await flushPromises()
    expect(q('[data-testid="statement-trigger"]')).toBeNull()
  })

  it('390: the action stays in the header', async () => {
    stubViewport(true)
    mountSlideover()
    await flushPromises()
    expect(q('[data-testid="history-header"] [data-testid="statement-trigger"]')).not.toBeNull()
  })
})
