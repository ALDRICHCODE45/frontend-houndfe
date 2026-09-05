/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { Customer } from '../interfaces/customer.types'
import type { ConfirmedSalesListResponse, ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import CustomerSalesHistorySlideover from './CustomerSalesHistorySlideover.vue'

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn(async () => undefined) }))
vi.mock('vue-router', async (importOriginal) => ({
  ...await importOriginal<object>(),
  useRouter: () => ({ push: routerPush }),
}))

// Mocked S2 query state: the slideover unit pins its consumption contract only.
const history = {
  response: shallowRef<ConfirmedSalesListResponse>(),
  isLoading: shallowRef(false),
  isFetching: shallowRef(false),
  isPageTransition: shallowRef(false),
  isError: shallowRef(false),
  error: shallowRef<Error | null>(null),
  refetch: vi.fn(),
}
let historyPage: { value: number } | undefined
vi.mock('@/features/POS/sales/composables/useCustomerSalesHistory', () => ({
  useCustomerSalesHistory: (options: { page: { value: number } }) => {
    historyPage = options.page
    return history
  },
}))

function customer(id = 'customer-1'): Customer {
  return { id, firstName: 'Ana', lastName: 'López', fullName: 'Ana López', phoneCountryCode: null, phone: null, email: null, globalPriceListId: null, globalPriceListName: null, comments: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
}

function sale(id = 'sale-1'): ConfirmedSaleRow {
  return { id, folio: 'A-1', status: 'CONFIRMED', paymentStatus: 'PAID', deliveryStatus: 'DELIVERED', totalCents: 100_000, debtCents: 0, confirmedAt: '2026-08-30T14:00:00.000Z', dueDate: null, customer: null, cashier: { id: 'cashier-1', name: 'Caja' }, seller: null, paymentMethods: [] }
}

function response(overrides: Partial<ConfirmedSalesListResponse> = {}): ConfirmedSalesListResponse {
  return { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }, counts: { all: 0, pendingPayments: 0, notDelivered: 0 }, summary: { salesCount: 0, totalSoldCents: 0, outstandingDebtCents: 0 }, ...overrides }
}

const stubs = {
  EntityAvatar: { template: '<span data-testid="customer-avatar" />' },
  AppBadge: { props: ['label'], template: '<span>{{ label }}</span>' },
  StatusDotBadge: { props: ['label'], template: '<span>{{ label }}</span>' },
}

let wrapper: VueWrapper | undefined
function mountSlideover(props: { open?: boolean; customer?: Customer | null } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  wrapper = mountWithUApp(CustomerSalesHistorySlideover, {
    props: { open: true, customer: customer(), ...props },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }]], components: stubs },
  })
  return wrapper
}

function element(selector: string): HTMLElement {
  const node = document.body.querySelector(selector)
  if (!(node instanceof HTMLElement)) throw new Error(`${selector} not found in portal`)
  return node
}

function buttonWithText(label: string): HTMLButtonElement {
  const node = [...document.body.querySelectorAll('button')].find((button) => button.textContent?.includes(label))
  if (!(node instanceof HTMLButtonElement)) throw new Error(`${label} button not found`)
  return node
}

describe('CustomerSalesHistorySlideover', () => {
  beforeEach(() => {
    history.response.value = undefined
    history.isLoading.value = false
    history.isFetching.value = false
    history.isPageTransition.value = false
    history.isError.value = false
    history.error.value = null
    history.refetch.mockClear()
    routerPush.mockClear()
    historyPage = undefined
    document.body.innerHTML = ''
  })

  afterEach(() => {
    wrapper?.vm.$root?.$?.appContext.app.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  it('renders the real named dialog with responsive classes and closes through update:open', async () => {
    const mounted = mountSlideover()
    await flushPromises()

    const dialog = element('[role="dialog"]')
    expect(dialog.className).toContain('sm:!max-w-[520px]')
    expect(element('[data-slot="body"]').className).toContain('p-0')
    expect(dialog.textContent).toContain('Historial de ventas')
    expect(dialog.textContent).toContain('Ana López')

    element('[aria-label="Cerrar historial de ventas"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(mounted.emitted('update:open')?.[0]).toEqual([false])
  })

  it('does not open merely because a customer remains selected', async () => {
    mountSlideover({ open: false })
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('shows three metric and five row skeletons while the first response is pending', async () => {
    history.isFetching.value = true
    mountSlideover()
    await flushPromises()

    expect(element('[aria-busy="true"]')).toBeTruthy()
    expect(document.body.querySelectorAll('[data-testid="metric-skeleton"]')).toHaveLength(3)
    expect(document.body.querySelectorAll('[data-testid="row-skeleton"]')).toHaveLength(5)
  })

  it('renders authoritative zero metrics and the exact empty status', async () => {
    history.response.value = response()
    mountSlideover()
    await flushPromises()

    expect(element('dl').textContent).toContain('Ventas confirmadas')
    expect(element('dl').textContent).toContain('0')
    expect(element('[role="status"]').textContent?.trim()).toBe('Este cliente aún no tiene ventas confirmadas.')
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
  })

  it('renders normalized errors and retries the current query', async () => {
    history.isError.value = true
    history.error.value = Object.assign(new Error('Server error'), { response: { status: 500 } })
    mountSlideover()
    await flushPromises()

    expect(element('[role="alert"]').textContent).toContain('No se pudo cargar el historial de ventas. Reintenta.')
    buttonWithText('Reintentar').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(history.refetch).toHaveBeenCalledOnce()
  })
})
