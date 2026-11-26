/**
 * «Cobrar todo» T1 (S4): the history offers «Cobrar todo» only with `update:Sale` and open debt
 * (`summary.outstandingDebtCents > 0`); on a phone it also sits in the debt banner.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, shallowRef } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { Customer } from '../../interfaces/customer.types'
import type { ConfirmedSalesListResponse } from '@/features/POS/sales/interfaces/sale.types'
import CustomerSalesHistorySlideover from '../CustomerSalesHistorySlideover.vue'

const can = { update: true }
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: (action: string, subject: string) =>
      subject === 'Sale' && (action === 'read' || (action === 'update' && can.update)),
  }),
}))
vi.mock('@/features/POS/sales/components/history/SaleHistoryRowDetail.vue', () => ({
  default: defineComponent({ props: { saleId: String }, setup: () => () => h('div') }),
}))
vi.mock('@/features/POS/sales/components/DebtPaymentModal.vue', () => ({
  default: defineComponent({ setup: () => () => null }),
}))
vi.mock('../CustomerStatementDownload.vue', () => ({
  default: defineComponent({ setup: () => () => h('span') }),
}))
vi.mock('../CustomerCollectionSlideover.vue', () => ({
  default: defineComponent({
    props: { open: Boolean, customerId: String, customerName: String },
    setup: (props) => () =>
      props.open
        ? h(
            'div',
            { 'data-testid': 'collection-sheet', 'data-customer-id': props.customerId },
            props.customerName,
          )
        : null,
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
vi.mock('@/features/POS/sales/composables/useCustomerSalesMonthly', () => ({
  useCustomerSalesMonthly: () => ({
    canRead: shallowRef(true),
    months: shallowRef(undefined),
    isLoading: shallowRef(false),
    isError: shallowRef(false),
    refetch: vi.fn(),
  }),
}))
vi.mock('../../pets/usePets', () => ({
  usePetsList: () => ({ data: shallowRef([]), refetch: vi.fn(), isLoading: shallowRef(false) }),
}))

function customer(): Customer {
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
  }
}

function withDebt(debtCents: number) {
  response.value = {
    data: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    summary: { salesCount: 3, totalSoldCents: 300000, outstandingDebtCents: debtCents },
    counts: { all: 3, pendingPayments: debtCents > 0 ? 2 : 0, notDelivered: 0 },
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
function mountHistory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  wrapper = mountWithUApp(CustomerSalesHistorySlideover, {
    props: { open: true, customer: customer() },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return wrapper
}
const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const qa = (selector: string) => [...document.body.querySelectorAll<HTMLElement>(selector)]

beforeEach(() => {
  document.body.innerHTML = ''
  can.update = true
  stubViewport(false)
  withDebt(61000)
})
afterEach(() => {
  wrapper?.vm.$root?.$?.appContext.app.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('CustomerSalesHistorySlideover — «Cobrar todo»', () => {
  it('shows «Cobrar todo» with update:Sale and open debt', async () => {
    mountHistory()
    await flushPromises()
    const action = q('[data-testid="history-collect-all"]')
    expect(action?.textContent).toContain('Cobrar todo')
  })

  it('is hidden without update:Sale', async () => {
    can.update = false
    mountHistory()
    await flushPromises()
    expect(qa('[data-testid^="history-collect-all"]')).toHaveLength(0)
  })

  it('is hidden without open debt', async () => {
    withDebt(0)
    mountHistory()
    await flushPromises()
    expect(qa('[data-testid^="history-collect-all"]')).toHaveLength(0)
  })

  it('opens the collection sheet for the shown customer', async () => {
    mountHistory()
    await flushPromises()
    expect(q('[data-testid="collection-sheet"]')).toBeNull()
    q('[data-testid="history-collect-all"]')!.click()
    await flushPromises()
    const sheet = q('[data-testid="collection-sheet"]')
    expect(sheet?.dataset.customerId).toBe('customer-1')
    expect(sheet?.textContent).toBe('Ana Pérez')
  })

  it('390: also sits in the debt banner, as a 44 px target', async () => {
    stubViewport(true)
    mountHistory()
    await flushPromises()
    const banner = q(
      '[data-testid="history-debt-banner"] [data-testid="history-collect-all-banner"]',
    )
    expect(banner).not.toBeNull()
    expect(banner!.className).toContain('min-h-11')
    banner!.click()
    await flushPromises()
    expect(q('[data-testid="collection-sheet"]')).not.toBeNull()
  })

  it('stays open when the refreshed history no longer has debt', async () => {
    mountHistory()
    await flushPromises()
    q('[data-testid="history-collect-all"]')!.click()
    await flushPromises()
    withDebt(0)
    await flushPromises()
    expect(q('[data-testid="collection-sheet"]')).not.toBeNull()
  })
})
