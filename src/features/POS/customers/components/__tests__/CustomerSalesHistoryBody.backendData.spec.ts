/// <reference types="vite/client" />
/**
 * Sales history backend data T1 (S2-S4, S9): «Ticket promedio», the overdue warning and its
 * «Vencidas» filter (`overdue=true`, combined with the pet, KPIs unchanged), one merged banner at
 * phone width, and the monthly chart (hidden without `read:Sale`, quiet retry on errors).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, shallowRef } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { Customer } from '../../interfaces/customer.types'
import type {
  ConfirmedSaleRow,
  ConfirmedSalesListResponse,
  CustomerSalesMonth,
  SaleListSummary,
  SalesListCounts,
} from '@/features/POS/sales/interfaces/sale.types'
import { makePet } from '../../pets/__tests__/pet.fixture'
import type { Pet } from '../../pets/pet.types'
import CustomerSalesHistoryHarness from './CustomerSalesHistoryHarness'

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

const customerWide = shallowRef<Pick<ConfirmedSalesListResponse, 'summary' | 'counts'>>()
const history = {
  response: shallowRef<ConfirmedSalesListResponse>(),
  customerSummary: computed<SaleListSummary | undefined>(() => customerWide.value?.summary),
  customerCounts: computed<SalesListCounts | undefined>(() => customerWide.value?.counts),
  isLoading: shallowRef(false),
  isFetching: shallowRef(false),
  isPageTransition: shallowRef(false),
  isError: shallowRef(false),
  error: shallowRef<unknown>(null),
  refetch: vi.fn(),
}
let options: { page: { value: number }; status?: unknown; petId?: unknown } | undefined
vi.mock('@/features/POS/sales/composables/useCustomerSalesHistory', () => ({
  useCustomerSalesHistory: (opts: typeof options) => {
    options = opts
    return history
  },
}))

const monthly = {
  canRead: shallowRef(true),
  months: shallowRef<CustomerSalesMonth[] | undefined>(),
  isLoading: shallowRef(false),
  isError: shallowRef(false),
  refetch: vi.fn(),
}
let monthlyOptions: { customerId: unknown; open: unknown; months?: unknown } | undefined
vi.mock('@/features/POS/sales/composables/useCustomerSalesMonthly', () => ({
  useCustomerSalesMonthly: (opts: typeof monthlyOptions) => {
    monthlyOptions = opts
    return monthly
  },
}))

const pets = shallowRef<Pet[]>([])
vi.mock('../../pets/usePets', () => ({
  usePetsList: () => ({ data: pets, refetch: vi.fn(), isLoading: shallowRef(false) }),
}))

function read(value: unknown): unknown {
  if (typeof value === 'function') return (value as () => unknown)()
  return (value as { value: unknown } | undefined)?.value
}

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

function sale(id: string, overrides: Partial<ConfirmedSaleRow> = {}): ConfirmedSaleRow {
  return {
    id,
    folio: `S-${id}`,
    status: 'CONFIRMED',
    paymentStatus: 'PARTIAL',
    deliveryStatus: 'DELIVERED',
    totalCents: 125_000,
    debtCents: 45_000,
    confirmedAt: '2026-11-10T17:02:11.000Z',
    dueDate: '2026-11-10T00:00:00.000Z',
    customer: null,
    cashier: { id: 'c', name: 'Caja' },
    seller: null,
    paymentMethods: [],
    channel: 'POS',
    ...overrides,
  }
}

const WIDE = {
  summary: {
    salesCount: 14,
    totalSoldCents: 1_834_500,
    outstandingDebtCents: 98_000,
    averageTicketCents: 131_036,
    overdueDebtCents: 61_000,
    oldestOverdueDueDate: '2026-11-10',
  },
  counts: { all: 14, pendingPayments: 3, notDelivered: 1, overdue: 2 },
}

function response(overrides: Partial<ConfirmedSalesListResponse> = {}): ConfirmedSalesListResponse {
  return {
    data: [sale('1'), sale('2', { paymentStatus: 'PAID', debtCents: 0, dueDate: null })],
    pagination: { page: 1, limit: 10, total: 14, totalPages: 2 },
    ...WIDE,
    ...overrides,
  }
}

function twelveMonths(): CustomerSalesMonth[] {
  return Array.from({ length: 12 }, (_, index) => ({
    month: `2026-${String(index + 1).padStart(2, '0')}`,
    saleCount: index === 10 ? 2 : 0,
    totalCents: index === 10 ? 58_000 : 0,
  }))
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
function mountHistory(props: { customer?: Customer } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  wrapper = mountWithUApp(CustomerSalesHistoryHarness, {
    props: { open: true, customer: customer(), ...props },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return wrapper
}

const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const all = (selector: string) => [...document.body.querySelectorAll<HTMLElement>(selector)]
const text = (element: HTMLElement | null) =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const buttonWith = (label: string, root: ParentNode = document.body) => {
  const found = [...root.querySelectorAll<HTMLElement>('button')].find((button) =>
    button.textContent?.includes(label),
  )
  if (!found) throw new Error(`button ${label} not found`)
  return found
}

describe('CustomerSalesHistoryBody — backend data (handoff 28)', () => {
  beforeEach(() => {
    stubViewport(false)
    customerWide.value = WIDE
    history.response.value = response()
    history.isError.value = false
    history.error.value = null
    monthly.canRead.value = true
    monthly.months.value = twelveMonths()
    monthly.isError.value = false
    monthly.refetch.mockReset()
    pets.value = []
    options = undefined
    monthlyOptions = undefined
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.vm.$root?.$?.appContext.app.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('shows «Ticket promedio» from the customer-wide summary', async () => {
    mountHistory()
    await flushPromises()
    expect(text(q('[data-testid="metric-average-ticket"]'))).toContain('$1,310.36')
  })

  it('desktop: an overdue warning with count, debt and the oldest due day from the string', async () => {
    mountHistory()
    await flushPromises()
    const warning = q('[data-testid="history-overdue-warning"]')!
    expect(text(warning)).toContain('2 vencidas · $610.00 · la más antigua el 10/11/2026')
    // Same day the row shows (formatSaleDueDate), never shifted by the browser time zone.
    expect(text(warning)).not.toContain('09/11')
    expect(q('[data-testid="history-debt-banner"]')).toBeNull()
  })

  it('uses the singular for one overdue sale', async () => {
    customerWide.value = {
      summary: { ...WIDE.summary, overdueDebtCents: 45_000 },
      counts: { ...WIDE.counts, overdue: 1 },
    }
    mountHistory()
    await flushPromises()
    expect(text(q('[data-testid="history-overdue-warning"]'))).toContain(
      '1 vencida · $450.00 · la más antigua el 10/11/2026',
    )
  })

  it('no warning without overdue sales or when the payload lacks the members', async () => {
    customerWide.value = {
      summary: { ...WIDE.summary, overdueDebtCents: 0, oldestOverdueDueDate: null },
      counts: { ...WIDE.counts, overdue: 0 },
    }
    const mounted = mountHistory()
    await flushPromises()
    expect(q('[data-testid="history-overdue-warning"]')).toBeNull()
    mounted.vm.$root?.$?.appContext.app.unmount()
    document.body.innerHTML = ''

    customerWide.value = {
      summary: { salesCount: 14, totalSoldCents: 1_834_500, outstandingDebtCents: 98_000 },
      counts: { all: 14, pendingPayments: 3, notDelivered: 1 },
    }
    mountHistory()
    await flushPromises()
    expect(q('[data-testid="history-overdue-warning"]')).toBeNull()
    expect(text(q('[data-testid="history-status-filter"]'))).not.toContain('Vencidas')
  })

  it('«Ver vencidas» applies the «Vencidas» filter, back to page 1, KPIs unchanged', async () => {
    mountHistory()
    await flushPromises()
    options!.page.value = 2
    buttonWith('Ver vencidas', q('[data-testid="history-overdue-warning"]')!).click()
    await nextTick()
    expect(read(options!.status)).toBe('overdue')
    expect(options!.page.value).toBe(1)

    history.response.value = response({
      data: [sale('1')],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      filterSummary: { count: 2, totalCents: 250_000, debtCents: 61_000 },
    })
    await flushPromises()
    const metrics = text(q('dl[aria-label="Resumen del cliente"]'))
    expect(metrics).toContain('14')
    expect(metrics).toContain('$18,345.00')
    expect(metrics).toContain('$980.00')
    expect(metrics).toContain('$1,310.36')
    const chip = buttonWith('Vencidas', q('[data-testid="history-status-filter"]')!)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    expect(text(q('[data-testid="history-filter-summary"]'))).toBe(
      'Vencidas: $2,500.00 vendido · $610.00 de saldo',
    )
    // While the filter is on, the warning stays but its action is not repeated.
    expect(q('[data-testid="history-overdue-warning"] button')).toBeNull()
  })

  it('the «Vencidas» chip has its count and combines with the pet', async () => {
    pets.value = [makePet({ id: 'p1', name: 'Bruno' })]
    mountHistory()
    await flushPromises()
    const chip = buttonWith('Vencidas', q('[data-testid="history-status-filter"]')!)
    expect(text(chip)).toBe('Vencidas 2')
    chip.click()
    all('[data-testid="history-pet-chip"]')
      .find((pet) => pet.textContent?.includes('Bruno'))!
      .click()
    await nextTick()
    expect(read(options!.status)).toBe('overdue')
    expect(read(options!.petId)).toBe('p1')
  })

  it('empty «Vencidas»: says so and offers «Ver todas»', async () => {
    mountHistory()
    await flushPromises()
    buttonWith('Vencidas', q('[data-testid="history-status-filter"]')!).click()
    await nextTick()
    history.response.value = response({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    })
    await flushPromises()
    expect(text(q('.hf-empty-state'))).toContain('No hay ventas vencidas')
    buttonWith('Ver todas').click()
    await nextTick()
    expect(read(options!.status)).toBe('all')
  })

  it('390: one banner merges the debt and the overdue warning; its action applies «Vencidas»', async () => {
    stubViewport(true)
    mountHistory()
    await flushPromises()
    expect(all('[data-testid="history-debt-banner"]')).toHaveLength(1)
    expect(q('[data-testid="history-overdue-warning"]')).toBeNull()
    const banner = q('[data-testid="history-debt-banner"]')!
    expect(text(banner)).toContain('Debe $980.00')
    expect(text(banner)).toContain('3 ventas por cobrar')
    expect(text(banner)).toContain('2 vencidas · $610.00 · la más antigua el 10/11/2026')
    const action = buttonWith('Ver vencidas', banner)
    expect(action.className).toContain('min-h-11')
    action.click()
    await nextTick()
    expect(read(options!.status)).toBe('overdue')
  })

  it('390: without overdue sales the banner keeps «Ver» → «Con saldo»', async () => {
    stubViewport(true)
    customerWide.value = {
      summary: { ...WIDE.summary, overdueDebtCents: 0, oldestOverdueDueDate: null },
      counts: { ...WIDE.counts, overdue: 0 },
    }
    mountHistory()
    await flushPromises()
    const banner = q('[data-testid="history-debt-banner"]')!
    expect(text(banner)).not.toContain('vencida')
    buttonWith('Ver', banner).click()
    await nextTick()
    expect(read(options!.status)).toBe('with-debt')
  })

  it('shows the monthly chart of the customer (12 months)', async () => {
    mountHistory()
    await flushPromises()
    expect(read(monthlyOptions!.customerId)).toBe('customer-1')
    expect(read(monthlyOptions!.open)).toBe(true)
    expect(read(monthlyOptions!.months) ?? 12).toBe(12)
    const chart = q('[data-testid="history-monthly-chart"]')!
    expect(chart.querySelectorAll('li')).toHaveLength(12)
    expect(text(chart)).toContain('noviembre 2026: 2 ventas, $580.00')
  })

  it('hides the chart without read:Sale or while it has no data', async () => {
    monthly.canRead.value = false
    mountHistory()
    await flushPromises()
    expect(q('[data-testid="history-monthly-chart"]')).toBeNull()
    expect(q('[data-testid="monthly-retry"]')).toBeNull()
    monthly.canRead.value = true
    monthly.months.value = undefined
    await flushPromises()
    expect(q('[data-testid="history-monthly-chart"]')).toBeNull()
  })

  it('a monthly error (e.g. 404 CUSTOMER_NOT_FOUND) hides the chart with a small retry; the history stays', async () => {
    monthly.months.value = undefined
    monthly.isError.value = true
    mountHistory()
    await flushPromises()
    expect(q('[data-testid="history-monthly-chart"] ol')).toBeNull()
    expect(q('table')).not.toBeNull()
    q('[data-testid="monthly-retry"]')!.click()
    expect(monthly.refetch).toHaveBeenCalledTimes(1)
  })

  it('a customer without sales sees no chart', async () => {
    customerWide.value = {
      summary: {
        salesCount: 0,
        totalSoldCents: 0,
        outstandingDebtCents: 0,
        averageTicketCents: 0,
        overdueDebtCents: 0,
        oldestOverdueDueDate: null,
      },
      counts: { all: 0, pendingPayments: 0, notDelivered: 0, overdue: 0 },
    }
    monthly.months.value = twelveMonths().map((month) => ({
      ...month,
      saleCount: 0,
      totalCents: 0,
    }))
    history.response.value = response({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      ...customerWide.value,
    })
    mountHistory()
    await flushPromises()
    expect(q('[data-testid="history-monthly-chart"]')).toBeNull()
    expect(text(q('[data-testid="metric-average-ticket"]'))).toContain('$0.00')
  })
})
