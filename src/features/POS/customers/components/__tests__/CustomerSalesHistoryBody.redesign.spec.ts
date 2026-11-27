/// <reference types="vite/client" />
/**
 * Sales history redesign T1 (S1-S5): metric strip from the customer-wide aggregates, «Con saldo» /
 * «Sin entregar» filters (L3), footer from `filterSummary`, cards and the debt banner at 390,
 * «Cobrar» through the existing DebtPaymentModal. (style-cleanup U6: moved off the removed history
 * slideover onto CustomerSalesHistoryHarness; its header tests were dropped.)
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

// The shared row detail has its own spec; here it only has to forward «Cobrar».
vi.mock('@/features/POS/sales/components/history/SaleHistoryRowDetail.vue', () => ({
  default: defineComponent({
    props: { saleId: { type: String, required: true }, allowCharge: Boolean },
    emits: ['charge'],
    setup(props, { emit }) {
      return () =>
        h('button', {
          type: 'button',
          'data-testid': 'row-detail-charge',
          'data-allow-charge': String(props.allowCharge),
          onClick: () => emit('charge', { saleId: props.saleId, debtCents: 78_600 }),
        })
    },
  }),
}))

const debtModalProps: Record<string, unknown>[] = []
vi.mock('@/features/POS/sales/components/DebtPaymentModal.vue', () => ({
  default: defineComponent({
    props: { open: Boolean, saleId: String, debtCents: Number, portalClass: String },
    emits: ['update:open', 'success'],
    setup(props, { emit }) {
      return () => {
        debtModalProps.push({ ...props })
        return props.open
          ? h('div', { 'data-testid': 'debt-modal', 'data-sale-id': props.saleId }, [
              h('button', {
                type: 'button',
                'data-testid': 'debt-modal-success',
                onClick: () => emit('success'),
              }),
            ])
          : null
      }
    },
  }),
}))

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
const customerWide = shallowRef<Pick<ConfirmedSalesListResponse, 'summary' | 'counts'>>()
let options: { page: { value: number }; status?: unknown; petId?: unknown; q?: unknown } | undefined

vi.mock('@/features/POS/sales/composables/useCustomerSalesHistory', () => ({
  useCustomerSalesHistory: (opts: typeof options) => {
    options = opts
    return history
  },
}))

// Handoff 28 §4: the monthly chart has its own specs (…backendData.spec.ts); hidden here.
vi.mock('@/features/POS/sales/composables/useCustomerSalesMonthly', async () => {
  const { shallowRef: ref } = await import('vue')
  return {
    useCustomerSalesMonthly: () => ({
      canRead: ref(false),
      months: ref(undefined),
      isLoading: ref(false),
      isError: ref(false),
      refetch: () => undefined,
    }),
  }
})

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
    firstName: 'Ana Sofía',
    lastName: 'Treviño Garza',
    fullName: 'Ana Sofía Treviño Garza',
    phoneCountryCode: null,
    phone: '8123456789',
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
    deliveryStatus: 'PENDING',
    totalCents: 148_600,
    debtCents: 78_600,
    confirmedAt: '2026-11-22T23:42:00.000Z',
    dueDate: null,
    customer: null,
    cashier: { id: 'c', name: 'Caja' },
    seller: null,
    paymentMethods: [],
    channel: 'POS',
    ...overrides,
  }
}

const WIDE = {
  summary: { salesCount: 23, totalSoldCents: 1_846_050, outstandingDebtCents: 128_400 },
  counts: { all: 23, pendingPayments: 2, notDelivered: 1 },
}

function response(overrides: Partial<ConfirmedSalesListResponse> = {}): ConfirmedSalesListResponse {
  return {
    data: [
      sale('1'),
      sale('2', { paymentStatus: 'PAID', debtCents: 0, deliveryStatus: 'DELIVERED' }),
    ],
    pagination: { page: 1, limit: 10, total: 23, totalPages: 3 },
    ...WIDE,
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
let queryClient: QueryClient
function mountHistory(props: { customer?: Customer } = {}) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  wrapper = mountWithUApp(CustomerSalesHistoryHarness, {
    props: { open: true, customer: customer(), ...props },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return wrapper
}

const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const all = (selector: string) => [...document.body.querySelectorAll<HTMLElement>(selector)]
const buttonWith = (text: string) => {
  const found = all('button').find((button) => button.textContent?.includes(text))
  if (!found) throw new Error(`button ${text} not found`)
  return found
}

describe('CustomerSalesHistoryBody — redesign', () => {
  beforeEach(() => {
    stubViewport(false)
    customerWide.value = WIDE
    history.response.value = response()
    history.isLoading.value = false
    history.isFetching.value = false
    history.isPageTransition.value = false
    history.isError.value = false
    history.error.value = null
    pets.value = []
    options = undefined
    debtModalProps.length = 0
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.vm.$root?.$?.appContext.app.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('renders the metric strip and the status chips from the customer-wide aggregates', async () => {
    mountHistory()
    await flushPromises()
    const metrics = q('dl[aria-label="Resumen del cliente"]')!.textContent!
    expect(metrics).toContain('23')
    expect(metrics).toContain('$18,460.50')
    expect(metrics).toContain('$1,284.00')
    expect(metrics).toContain('2 ventas por cobrar')
    const chips = all('[data-testid="history-status-filter"] button').map((b) =>
      b.textContent!.replace(/\s+/g, ' ').trim(),
    )
    expect(chips).toEqual(['Todas', 'Con saldo 2', 'Sin entregar 1'])
  })

  it('«Con saldo» sends the status, goes back to page 1 and leaves the metrics unchanged', async () => {
    mountHistory()
    await flushPromises()
    expect(read(options!.status)).toBe('all')
    options!.page.value = 3

    buttonWith('Con saldo').click()
    await nextTick()
    expect(read(options!.status)).toBe('with-debt')
    expect(options!.page.value).toBe(1)

    // The list narrows; the composable keeps the customer-wide aggregates (its own spec pins it).
    history.response.value = response({
      data: [sale('1')],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      summary: { salesCount: 2, totalSoldCents: 1, outstandingDebtCents: 1 },
      filterSummary: { count: 2, totalCents: 297_200, debtCents: 128_400 },
    })
    await flushPromises()
    const metrics = q('dl[aria-label="Resumen del cliente"]')!.textContent!
    expect(metrics).toContain('$18,460.50')
    expect(metrics).toContain('23')
    expect(buttonWith('Con saldo').getAttribute('aria-pressed')).toBe('true')

    buttonWith('Sin entregar').click()
    await nextTick()
    expect(read(options!.status)).toBe('not-delivered')
  })

  it('shows the range and the filter totals from filterSummary in the footer', async () => {
    mountHistory()
    await flushPromises()
    const footer = q('[data-testid="history-pagination"]')!
    expect(footer.textContent).toContain('1–10 de 23 ventas')
    expect(q('[data-testid="history-filter-summary"]')).toBeNull()

    buttonWith('Con saldo').click()
    await nextTick()
    history.response.value = response({
      data: [sale('1')],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      filterSummary: { count: 2, totalCents: 297_200, debtCents: 128_400 },
    })
    await flushPromises()
    expect(q('[data-testid="history-pagination"]')!.textContent).toContain('1–2 de 2 ventas')
    const summary = q('[data-testid="history-filter-summary"]')!.textContent!
    expect(summary).toContain('$2,972.00')
    expect(summary).toContain('$1,284.00')
  })

  it('shows the range of a later page', async () => {
    history.response.value = response({
      pagination: { page: 3, limit: 10, total: 23, totalPages: 3 },
    })
    mountHistory()
    await flushPromises()
    expect(q('[data-testid="history-pagination"]')!.textContent).toContain('21–23 de 23 ventas')
  })

  it('empty status filter: says so and offers «Ver todas»', async () => {
    mountHistory()
    await flushPromises()
    buttonWith('Sin entregar').click()
    await nextTick()
    history.response.value = response({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    })
    await flushPromises()
    expect(q('.hf-empty-state')!.textContent).toContain('No hay ventas sin entregar')
    buttonWith('Ver todas').click()
    await nextTick()
    expect(read(options!.status)).toBe('all')
  })

  it('a customer without sales sees real zeros and no search or filters', async () => {
    customerWide.value = {
      summary: { salesCount: 0, totalSoldCents: 0, outstandingDebtCents: 0 },
      counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
    }
    history.response.value = response({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      ...customerWide.value,
    })
    mountHistory()
    await flushPromises()
    expect(q('.hf-empty-state')!.textContent).toContain('Aún no hay ventas')
    expect(q('input[type="search"]')).toBeNull()
    expect(q('[data-testid="history-status-filter"]')).toBeNull()
  })

  it('announces «Actualizando…» while a page or filter change loads, keeping the rows', async () => {
    history.isFetching.value = true
    history.isPageTransition.value = true
    mountHistory()
    await flushPromises()
    expect(q('[data-testid="history-updating"]')!.textContent).toContain(
      'Actualizando el historial',
    )
    expect(q('[data-testid="history-updating"]')!.getAttribute('role')).toBe('status')
    expect(q('table')).not.toBeNull()
  })

  it('desktop: an aligned table, rows open in place and «Cobrar» opens the DebtPaymentModal', async () => {
    mountHistory()
    await flushPromises()
    expect(q('table')).not.toBeNull()
    expect(all('[data-testid="sale-history-card"]')).toHaveLength(0)
    expect(q('[data-testid="history-debt-banner"]')).toBeNull()

    q('button[aria-label="Detalle de la venta S-1"]')!.click()
    await nextTick()
    const charge = q('[data-testid="row-detail-charge"]')!
    expect(charge.dataset.allowCharge).toBe('true')
    charge.click()
    await flushPromises()
    expect(q('[data-testid="debt-modal"]')!.dataset.saleId).toBe('1')
    expect(debtModalProps[debtModalProps.length - 1]).toMatchObject({
      saleId: '1',
      debtCents: 78_600,
      open: true,
    })

    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    q('[data-testid="debt-modal-success"]')!.click()
    await flushPromises()
    expect(q('[data-testid="debt-modal"]')).toBeNull()
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['sales', 'tenant-1', 'customer-history', 'customer-1'],
    })
  })

  it('390: cards instead of the table, and the debt banner «Ver» applies «Con saldo»', async () => {
    stubViewport(true)
    mountHistory()
    await flushPromises()
    expect(q('table')).toBeNull()
    expect(all('[data-testid="sale-history-card"]')).toHaveLength(2)

    const banner = q('[data-testid="history-debt-banner"]')!
    expect(banner.textContent).toContain('Debe $1,284.00')
    expect(banner.textContent).toContain('2 ventas por cobrar')
    const see = [...banner.querySelectorAll('button')].find((b) => b.textContent?.includes('Ver'))!
    expect(see.className).toContain('min-h-11')
    see.click()
    await nextTick()
    expect(read(options!.status)).toBe('with-debt')
  })

  it('390: no debt banner for a customer without balance', async () => {
    stubViewport(true)
    customerWide.value = { ...WIDE, summary: { ...WIDE.summary, outstandingDebtCents: 0 } }
    mountHistory()
    await flushPromises()
    expect(q('[data-testid="history-debt-banner"]')).toBeNull()
  })

  it('resets the status filter when the customer changes', async () => {
    const mounted = mountHistory()
    await flushPromises()
    buttonWith('Con saldo').click()
    await nextTick()
    mounted.vm.$.props.customer = customer({ id: 'customer-2' })
    await nextTick()
    expect(read(options!.status)).toBe('all')
  })

  it('keeps the pet chips next to the status chips and combines both', async () => {
    pets.value = [makePet({ id: 'p1', name: 'Bruno' })]
    mountHistory()
    await flushPromises()
    buttonWith('Con saldo').click()
    all('[data-testid="history-pet-chip"]')
      .find((chip) => chip.textContent?.includes('Bruno'))!
      .click()
    await nextTick()
    expect(read(options!.status)).toBe('with-debt')
    expect(read(options!.petId)).toBe('p1')
  })
})
