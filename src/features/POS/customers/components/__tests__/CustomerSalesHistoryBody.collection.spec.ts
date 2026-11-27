/**
 * «Cobrar todo» T1 (S4): the history offers «Cobrar todo» only with `update:Sale` and open debt
 * (`summary.outstandingDebtCents > 0`); on a phone it sits in the debt banner of the body.
 * style-cleanup U6: moved off the removed history slideover onto CustomerSalesHistoryHarness. The
 * header button and the customer-switch toast were slideover-only and were dropped; the page header
 * action is covered by CustomerDetailView.spec.ts. The gating is asserted on the shared controller
 * (`showCollectAction`, `collectActionLabel`) and on the body's banner action.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, reactive, ref, shallowRef, type ComputedRef } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { Customer } from '../../interfaces/customer.types'
import type { ConfirmedSalesListResponse } from '@/features/POS/sales/interfaces/sale.types'
import CustomerSalesHistoryHarness from './CustomerSalesHistoryHarness'

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

const unresolvedFor = ref(new Set<string>())
vi.mock('../../collection/useCustomerCollection', () => ({
  hasUnresolvedCollection: (tenantId: string, customerId: string | undefined) =>
    tenantId === 'tenant-1' && !!customerId && unresolvedFor.value.has(customerId),
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
let props: { open: boolean; customer: Customer | null }
function mountHistory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  props = reactive({ open: true, customer: customer() })
  wrapper = mountWithUApp(CustomerSalesHistoryHarness, {
    props,
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return wrapper
}
const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const qa = (selector: string) => [...document.body.querySelectorAll<HTMLElement>(selector)]
const BANNER_ACTION = '[data-testid="history-debt-banner"] [data-testid="history-collect-all-banner"]'
/** The controller the history parents read for their «Cobrar todo» header action. */
function controller() {
  return (wrapper!.vm.$.exposed as {
    history: { showCollectAction: ComputedRef<boolean>; collectActionLabel: ComputedRef<string> }
  }).history
}

beforeEach(() => {
  document.body.innerHTML = ''
  can.update = true
  unresolvedFor.value = new Set()
  stubViewport(false)
  withDebt(61000)
})
afterEach(() => {
  wrapper?.vm.$root?.$?.appContext.app.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('CustomerSalesHistoryBody — «Cobrar todo»', () => {
  it('offers «Cobrar todo» with update:Sale and open debt', async () => {
    mountHistory()
    await flushPromises()
    expect(controller().showCollectAction.value).toBe(true)
    expect(controller().collectActionLabel.value).toBe('Cobrar todo')
  })

  it('is hidden without update:Sale', async () => {
    can.update = false
    stubViewport(true)
    mountHistory()
    await flushPromises()
    expect(controller().showCollectAction.value).toBe(false)
    expect(q('[data-testid="history-debt-banner"]')).not.toBeNull()
    expect(qa('[data-testid^="history-collect-all"]')).toHaveLength(0)
  })

  it('is hidden without open debt', async () => {
    withDebt(0)
    stubViewport(true)
    mountHistory()
    await flushPromises()
    expect(controller().showCollectAction.value).toBe(false)
    expect(qa('[data-testid^="history-collect-all"]')).toHaveLength(0)
  })

  it('opens the collection sheet for the shown customer', async () => {
    stubViewport(true)
    mountHistory()
    await flushPromises()
    expect(q('[data-testid="collection-sheet"]')).toBeNull()
    q(BANNER_ACTION)!.click()
    await flushPromises()
    const sheet = q('[data-testid="collection-sheet"]')
    expect(sheet?.dataset.customerId).toBe('customer-1')
    expect(sheet?.textContent).toBe('Ana Pérez')
  })

  it('390: sits in the debt banner, as a 44 px target', async () => {
    stubViewport(true)
    mountHistory()
    await flushPromises()
    const banner = q(BANNER_ACTION)
    expect(banner).not.toBeNull()
    expect(banner!.textContent).toContain('Cobrar todo')
    expect(banner!.className).toContain('min-h-11')
    banner!.click()
    await flushPromises()
    expect(q('[data-testid="collection-sheet"]')).not.toBeNull()
  })

  it('stays open when the refreshed history no longer has debt', async () => {
    stubViewport(true)
    mountHistory()
    await flushPromises()
    q(BANNER_ACTION)!.click()
    await flushPromises()
    withDebt(0)
    await flushPromises()
    expect(q('[data-testid="collection-sheet"]')).not.toBeNull()
  })
})

describe('CustomerSalesHistoryBody — unresolved collection (R1/R4)', () => {
  it('keeps the collection reachable while its outcome is unknown, even without debt', async () => {
    unresolvedFor.value = new Set(['customer-1'])
    withDebt(0)
    stubViewport(true)
    mountHistory()
    await flushPromises()
    expect(controller().showCollectAction.value).toBe(true)
    const action = q(BANNER_ACTION)
    expect(action?.textContent).toContain('Cobro sin confirmar')
    action!.click()
    await flushPromises()
    expect(q('[data-testid="collection-sheet"]')?.dataset.customerId).toBe('customer-1')
  })
})
