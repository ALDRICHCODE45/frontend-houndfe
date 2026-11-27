/**
 * owner-ideas-batch T3 (S5): the «Cotizaciones» and «Cobros y recibos» tabs of the customer page
 * show the shared «N por página» choice (5..50); picking one asks for page 1 at that size and is
 * remembered for the next visit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import { TABLE_PAGE_SIZE_OPTIONS } from '@/core/shared/constants/table-page-size'
import { pageSizeStorageKey } from '@/core/shared/composables/useTablePageSize'
import CustomerPaymentsTab from '../CustomerPaymentsTab.vue'
import CustomerQuotationsTab from '../CustomerQuotationsTab.vue'

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))
const api = vi.hoisted(() => ({ getPayments: vi.fn(), list: vi.fn() }))
vi.mock('../../../api/customer-detail.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/customer-detail.api')>()
  return { ...actual, customerDetailApi: { ...actual.customerDetailApi, getPayments: api.getPayments } }
})
vi.mock('@/features/POS/quotations/api/quotation.api', () => ({ quotationApi: { list: api.list } }))

const paymentEvent = (id: string) => ({
  kind: 'payment', eventId: id, occurredAt: '2026-11-20T19:31:02.000Z', method: 'cash', catalog: null,
  reference: null, amountCents: 100, tenderedCents: 100, changeCents: 0,
  sale: { id: `s-${id}`, folio: `V-${id}`, status: 'CONFIRMED', totalCents: 100 },
  cashier: null, receiptPath: null,
})
const paymentsPage = (total: number, limit = 50) => ({
  data: [paymentEvent('p1')],
  pagination: { page: 1, limit, total, totalPages: Math.ceil(total / limit) },
})
const quotationsPage = (total: number, limit = 10) => ({
  data: [{ id: '0f1e2d3c-0000-0000-0000-000000000000', status: 'DRAFT', totalCents: 100, createdAt: '2026-11-20T19:31:02.000Z', expiresAt: '2026-12-20T19:31:02.000Z' }],
  pagination: { page: 1, limit, total, totalPages: Math.ceil(total / limit) },
})

let wrapper: VueWrapper | undefined
async function mountTab(component: typeof CustomerPaymentsTab | typeof CustomerQuotationsTab) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  wrapper = mountWithUApp(component, {
    attachTo: document.body,
    props: { customerId: 'c-1' },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  await flushPromises()
}
function unmount() {
  wrapper?.vm.$root?.$?.appContext.app.unmount()
  wrapper = undefined
}
async function openSizeMenu(testId: string) {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  const button = document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  expect(button).not.toBeNull()
  button!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')]
}

beforeEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  api.getPayments.mockReset().mockResolvedValue(paymentsPage(120))
  api.list.mockReset().mockResolvedValue(quotationsPage(23))
})
afterEach(unmount)

describe('Cobros y recibos — page size (S5)', () => {
  it('offers 5..50 with 50 checked; picking 15 asks for page 1 at 15 and is remembered', async () => {
    await mountTab(CustomerPaymentsTab)
    expect(api.getPayments).toHaveBeenCalledWith('c-1', 1, 50)
    const items = await openSizeMenu('customer-payments-page-size')
    expect(items.map((item) => item.textContent?.trim())).toEqual(TABLE_PAGE_SIZE_OPTIONS.map((size) => `${size} por página`))
    expect(items.find((item) => item.getAttribute('aria-checked') === 'true')?.textContent?.trim()).toBe('50 por página')

    items.find((item) => item.textContent?.trim() === '15 por página')!.click()
    await flushPromises()
    expect(api.getPayments).toHaveBeenLastCalledWith('c-1', 1, 15)
    expect(localStorage.getItem(pageSizeStorageKey('customer-payments'))).toBe('15')

    unmount()
    api.getPayments.mockClear()
    await mountTab(CustomerPaymentsTab)
    expect(api.getPayments).toHaveBeenCalledTimes(1)
    expect(api.getPayments).toHaveBeenCalledWith('c-1', 1, 15)
  })

  it('keeps the size choice on a single page of more than 5 events', async () => {
    api.getPayments.mockResolvedValue(paymentsPage(8))
    await mountTab(CustomerPaymentsTab)
    expect(document.body.querySelector('[data-testid="customer-payments-page-size"]')).not.toBeNull()
  })
})

describe('Cotizaciones — page size (S5)', () => {
  it('offers 5..50 with 10 checked; picking 30 asks for page 1 at 30 and is remembered', async () => {
    await mountTab(CustomerQuotationsTab)
    expect(api.list.mock.calls[0]![0]).toMatchObject({ page: 1, limit: 10 })
    const items = await openSizeMenu('customer-quotations-page-size')
    expect(items.map((item) => item.textContent?.trim())).toEqual(TABLE_PAGE_SIZE_OPTIONS.map((size) => `${size} por página`))
    expect(items.find((item) => item.getAttribute('aria-checked') === 'true')?.textContent?.trim()).toBe('10 por página')

    items.find((item) => item.textContent?.trim() === '30 por página')!.click()
    await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 30 }))
    expect(localStorage.getItem(pageSizeStorageKey('customer-quotations'))).toBe('30')

    unmount()
    api.list.mockClear()
    await mountTab(CustomerQuotationsTab)
    expect(api.list).toHaveBeenCalledTimes(1)
    expect(api.list.mock.calls[0]![0]).toMatchObject({ page: 1, limit: 30 })
  })

  it('hides the size choice when every quotation fits in the smallest page', async () => {
    api.list.mockResolvedValue(quotationsPage(3))
    await mountTab(CustomerQuotationsTab)
    expect(document.body.querySelector('[data-testid="customer-quotations-page-size"]')).toBeNull()
  })
})
