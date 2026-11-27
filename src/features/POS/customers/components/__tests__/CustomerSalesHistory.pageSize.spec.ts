/**
 * owner-ideas-batch T3 (S5): the «Ventas» tab of the customer page offers the shared 5..50 page
 * sizes and remembers the choice under 'customer-sales-history' (default 10). Mounts the live
 * controller + pager through CustomerSalesHistoryHarness; the history query is mocked to capture
 * the page and limit it is asked for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { computed, nextTick, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import { TABLE_PAGE_SIZE_OPTIONS } from '@/core/shared/constants/table-page-size'
import { pageSizeStorageKey } from '@/core/shared/composables/useTablePageSize'
import type { Customer } from '../../interfaces/customer.types'
import type { ConfirmedSalesListResponse } from '@/features/POS/sales/interfaces/sale.types'
import CustomerSalesHistoryHarness from './CustomerSalesHistoryHarness'

vi.mock('vue-router', async (importOriginal) => ({
  ...await importOriginal<object>(),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))

const response$ = shallowRef<ConfirmedSalesListResponse>()
const history = {
  response: response$,
  customerSummary: computed(() => response$.value?.summary),
  customerCounts: computed(() => response$.value?.counts),
  isLoading: shallowRef(false),
  isFetching: shallowRef(false),
  isPageTransition: shallowRef(false),
  isError: shallowRef(false),
  error: shallowRef<Error | null>(null),
  refetch: vi.fn(),
}
const captured: { page?: MaybeRefOrGetter<number>; limit?: MaybeRefOrGetter<number> } = {}
vi.mock('@/features/POS/sales/composables/useCustomerSalesHistory', () => ({
  useCustomerSalesHistory: (options: { page: MaybeRefOrGetter<number>; limit?: MaybeRefOrGetter<number> }) => {
    captured.page = options.page
    captured.limit = options.limit
    return history
  },
}))
vi.mock('@/features/POS/sales/composables/useCustomerSalesMonthly', async () => {
  const { shallowRef: ref } = await import('vue')
  return {
    useCustomerSalesMonthly: () => ({
      canRead: ref(false), months: ref(undefined), isLoading: ref(false), isError: ref(false), refetch: () => undefined,
    }),
  }
})
vi.mock('../../pets/usePets', () => ({
  usePetsList: () => ({ data: shallowRef([]), refetch: vi.fn() }),
}))

const KEY = pageSizeStorageKey('customer-sales-history')
const requestedLimit = () => (captured.limit === undefined ? 10 : toValue(captured.limit))
const requestedPage = () => toValue(captured.page)

function customer(): Customer {
  return { id: 'customer-1', firstName: 'Ana', lastName: 'López', fullName: 'Ana López', phoneCountryCode: null, phone: null, email: null, globalPriceListId: null, globalPriceListName: null, comments: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
}

function response(total = 23, limit = 10): ConfirmedSalesListResponse {
  return {
    data: [],
    pagination: { page: 1, limit, total, totalPages: Math.ceil(total / limit) },
    counts: { all: total, pendingPayments: 0, notDelivered: 0 },
    summary: { salesCount: total, totalSoldCents: 0, outstandingDebtCents: 0 },
  }
}

let wrapper: VueWrapper | undefined
function mountHistory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  wrapper = mountWithUApp(CustomerSalesHistoryHarness, {
    props: { open: true, customer: customer() },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return wrapper
}
function unmount() {
  wrapper?.vm.$root?.$?.appContext.app.unmount()
  wrapper = undefined
}

async function openSizeMenu() {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  const button = document.body.querySelector<HTMLElement>('[data-testid="history-page-size"]')
  expect(button).not.toBeNull()
  button!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')]
}

describe('customer sales history — page size (S5)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
    response$.value = response()
    captured.page = undefined
    captured.limit = undefined
  })
  afterEach(unmount)

  it('asks for 10 per page by default and offers 5 to 50 in steps of 5', async () => {
    mountHistory()
    await flushPromises()
    expect(requestedLimit()).toBe(10)
    const button = document.body.querySelector('[data-testid="history-page-size"]')!
    expect(button.getAttribute('aria-label')).toBe('10 por página')
    const items = await openSizeMenu()
    expect(items.map((item) => item.textContent?.trim())).toEqual(
      TABLE_PAGE_SIZE_OPTIONS.map((size) => `${size} por página`),
    )
    expect(items.find((item) => item.getAttribute('aria-checked') === 'true')?.textContent?.trim()).toBe('10 por página')
  })

  it('the first request uses the stored size', async () => {
    localStorage.setItem(KEY, '25')
    mountHistory()
    expect(requestedLimit()).toBe(25)
  })

  it.each([['7'], ['100'], ['"abc"'], ['not json']])('an invalid stored size %s falls back to 10', (stored) => {
    localStorage.setItem(KEY, stored)
    mountHistory()
    expect(requestedLimit()).toBe(10)
  })

  it('choosing a size goes back to page 1, asks for it and is remembered across a remount', async () => {
    mountHistory()
    await flushPromises()
    // The controller hands its own page ref to the history query.
    ;(captured.page as { value: number }).value = 3
    await nextTick()
    expect(requestedPage()).toBe(3)

    const items = await openSizeMenu()
    items.find((item) => item.textContent?.trim() === '35 por página')!.click()
    await flushPromises()
    expect(requestedLimit()).toBe(35)
    expect(requestedPage()).toBe(1)
    expect(localStorage.getItem(KEY)).toBe('35')

    unmount()
    document.body.innerHTML = ''
    mountHistory()
    expect(requestedLimit()).toBe(35)
  })

  it('shows the size choice on a single page, but no page buttons', async () => {
    response$.value = response(7)
    mountHistory()
    await flushPromises()
    expect(document.body.querySelector('[data-testid="history-page-size"]')).not.toBeNull()
    expect(document.body.querySelector('[data-testid="history-pagination-controls"]')).toBeNull()
  })

  it('hides the size choice when every sale fits in the smallest page', async () => {
    response$.value = response(4)
    mountHistory()
    await flushPromises()
    expect(document.body.querySelector('[data-testid="history-page-size"]')).toBeNull()
  })
})
