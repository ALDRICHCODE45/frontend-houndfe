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
let historyQ: unknown

vi.mock('@/features/POS/sales/composables/useCustomerSalesHistory', () => ({
  useCustomerSalesHistory: (options: { page: { value: number }; q?: unknown }) => {
    historyPage = options.page
    historyQ = options.q
    return history
  },
}))

function resolveQ(): string | undefined {
  if (historyQ == null) return undefined
  if (typeof historyQ === 'function') return (historyQ as () => string | undefined)()
  return (historyQ as { value: string | undefined }).value
}

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
  AppResponsiveDrawer: {
    props: ['open', 'closeAriaLabel', 'desktopUi'],
    emits: ['update:open'],
    template: `
      <section v-if="open" role="dialog" :class="desktopUi.content">
        <button :aria-label="closeAriaLabel" @click="$emit('update:open', false)" />
        <slot name="title" />
        <div data-slot="body" :class="desktopUi.body"><slot name="body" /></div>
        <slot name="footer" />
      </section>`,
  },
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
    historyQ = undefined
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    wrapper?.vm.$root?.$?.appContext.app.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  it('forwards the approved desktop shell and close behavior', async () => {
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
    expect(element('input[type="search"]')).toBeTruthy()
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

  it('contains history content and keeps a padded, wrapping multi-page footer', async () => {
    history.response.value = response({
      data: [sale()],
      pagination: { page: 1, limit: 10, total: 23, totalPages: 3 },
      summary: { salesCount: 23, totalSoldCents: 999_999, outstandingDebtCents: 0 },
    })
    mountSlideover()
    await flushPromises()

    const contentClasses = element('[data-testid="history-content"]').className
    expect(contentClasses).toEqual(expect.stringContaining('min-w-0'))
    expect(contentClasses).toEqual(expect.stringContaining('max-w-full'))
    expect(contentClasses).toEqual(expect.stringContaining('overflow-x-hidden'))

    const footerClasses = element('[data-testid="history-pagination"]').className
    for (const className of ['min-h-14', 'px-4', 'py-3', 'lg:min-h-0', 'lg:p-0', 'flex-wrap', 'gap-3']) {
      expect(footerClasses).toEqual(expect.stringContaining(className))
    }
    expect(element('[data-testid="history-pagination-controls"]')).toBeTruthy()
  })

  it('hides pagination controls for a single page while retaining the count', async () => {
    history.response.value = response({
      pagination: { page: 1, limit: 10, total: 7, totalPages: 1 },
      summary: { salesCount: 7, totalSoldCents: 0, outstandingDebtCents: 0 },
    })
    mountSlideover()
    await flushPromises()

    expect(element('[data-testid="history-pagination"]').textContent).toContain('7 ventas')
    expect(document.body.querySelector('[data-testid="history-pagination-controls"]')).toBeNull()
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

  it('keeps the backend summary during page transitions and routes selected rows by name', async () => {
    history.response.value = response({
      data: [sale('sale-42')],
      pagination: { page: 1, limit: 10, total: 23, totalPages: 3 },
      summary: { salesCount: 23, totalSoldCents: 999_999, outstandingDebtCents: 500 },
    })
    history.isFetching.value = true
    history.isPageTransition.value = true
    mountSlideover()
    await flushPromises()

    expect(element('dl').textContent).toContain('23')
    expect(element('[aria-busy="true"]').className).toContain('opacity-50')
    expect(element('[data-testid="history-pagination"]').dataset.disabled).toBe('true')
    expect(element('[data-testid="history-pagination"]').textContent).toContain('23 ventas')
    element('button[aria-label^="Venta folio"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(routerPush).toHaveBeenCalledWith({ name: 'pos-sale-detail', params: { id: 'sale-42' } })
  })

  it('resets the 1-based page synchronously when the customer changes', async () => {
    history.response.value = response({ summary: { salesCount: 2, totalSoldCents: 1, outstandingDebtCents: 0 } })
    const mounted = mountSlideover()
    await flushPromises()
    historyPage!.value = 3

    mounted.vm.$.props.customer = customer('customer-2')
    await nextTick()
    expect(historyPage!.value).toBe(1)
  })

  it('renders the no-matches empty state when a search returns no rows', async () => {
    vi.useFakeTimers()
    history.response.value = response({ summary: { salesCount: 4, totalSoldCents: 180_000, outstandingDebtCents: 0 } })
    mountSlideover()
    await flushPromises()

    const input = element('input[type="search"]') as HTMLInputElement
    input.value = 'nonexistent'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(element('[role="status"]').textContent).toContain('No se encontraron ventas que coincidan')
  })

  it('forwards the trimmed debounced search to the composable', async () => {
    vi.useFakeTimers()
    history.response.value = response()
    mountSlideover()
    await flushPromises()

    const input = element('input[type="search"]') as HTMLInputElement
    input.value = '  A-202609  '
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.runAllTimersAsync()

    expect(resolveQ()).toBe('A-202609')
  })

  it('resets page and search when customer identity changes', async () => {
    vi.useFakeTimers()
    history.response.value = response({ summary: { salesCount: 5, totalSoldCents: 1, outstandingDebtCents: 0 } })
    const mounted = mountSlideover()
    await nextTick()

    const input = document.body.querySelector('input[type="search"]') as HTMLInputElement
    input.value = 'A-202609'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    await vi.runAllTimersAsync()

    expect(resolveQ()).toBe('A-202609')

    mounted.vm.$.props.customer = customer('customer-2')

    expect(historyPage!.value).toBe(1)
    expect(resolveQ()).toBeUndefined()
    vi.useRealTimers()
  })

  it('toasts and closes once for the same defensive 403 error object', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), {
      response: { status: 403, data: { message: 'No tienes permiso.' } },
    })
    history.isError.value = true
    history.error.value = forbidden
    const mounted = mountSlideover()
    await flushPromises()

    expect(document.body.textContent).toContain('Sin permiso para ver ventas')
    expect(document.body.textContent).toContain('No tienes permiso.')
    expect(mounted.emitted('update:open')).toHaveLength(1)

    mounted.vm.$forceUpdate()
    await nextTick()
    const toasts = document.body.querySelectorAll('[data-slot="base"][data-orientation="vertical"]')
    expect(toasts).toHaveLength(1)
    expect(mounted.emitted('update:open')).toHaveLength(1)
  })
})
