/**
 * customers-module T4 (S4, artboard 02): the customer page `/pos/customers/:id` — header, KPI strip
 * from the customer-wide sales summary, URL-synced tabs that load only when opened, permissions,
 * 404 and delete.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, reactive, shallowRef } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { ConfirmedSalesListResponse, ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import type { CustomerDetail } from '../../interfaces/customer.types'
import CustomerDetailView from '../CustomerDetailView.vue'

// ── Router ────────────────────────────────────────────────────────────────────
const route = reactive<{ params: Record<string, string>; query: Record<string, string> }>({
  params: { id: 'c-1' },
  query: {},
})
const router = vi.hoisted(() => ({
  push: vi.fn(async () => undefined),
  replace: vi.fn(async () => undefined),
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRoute: () => route,
  useRouter: () => router,
  RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : to.path" data-router-link><slot /></a>' },
}))

// ── Permissions ──────────────────────────────────────────────────────────────
const grants = vi.hoisted(() => ({ set: new Set<string>() }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: (action: string, subject: string) => grants.set.has(`${action}:${subject}`),
  }),
}))
const ALL = ['read:Customer', 'update:Customer', 'delete:Customer', 'read:Sale', 'update:Sale', 'read:Quotation']

// ── API ───────────────────────────────────────────────────────────────────────
const api = vi.hoisted(() => ({ getById: vi.fn(), remove: vi.fn(), update: vi.fn() }))
vi.mock('../../api/customer.api', () => ({ customerApi: api }))
// T5: the KPI strip reads GET /customers/:id/sales-summary; «Cobros y recibos» the payments feed.
const detailApi = vi.hoisted(() => ({ getSalesSummary: vi.fn(), getPayments: vi.fn(), getReceiptPdf: vi.fn() }))
vi.mock('../../api/customer-detail.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/customer-detail.api')>()
  return { ...actual, customerDetailApi: detailApi }
})
vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: { getGlobalPriceLists: vi.fn(async () => []) },
}))

// ── Sales history (customer-wide summary/counts) ─────────────────────────────
const salesResponse = shallowRef<ConfirmedSalesListResponse>()
const historyCalls: Array<{ open: () => boolean }> = []
vi.mock('@/features/POS/sales/composables/useCustomerSalesHistory', () => ({
  useCustomerSalesHistory: (options: { open: unknown }) => {
    const open = options.open
    historyCalls.push({ open: () => (typeof open === 'function' ? open() : (open as { value: boolean }).value) })
    return {
      response: salesResponse,
      customerSummary: computed(() => salesResponse.value?.summary),
      customerCounts: computed(() => salesResponse.value?.counts),
      isLoading: shallowRef(false),
      isFetching: shallowRef(false),
      isPageTransition: shallowRef(false),
      isError: shallowRef(false),
      error: shallowRef(null),
      refetch: vi.fn(),
    }
  },
}))
const monthlyOpen: Array<() => boolean> = []
vi.mock('@/features/POS/sales/composables/useCustomerSalesMonthly', () => ({
  useCustomerSalesMonthly: (options: { open: () => boolean }) => {
    monthlyOpen.push(options.open)
    return {
      canRead: computed(() => grants.set.has('read:Sale')),
      months: shallowRef(undefined),
      isLoading: shallowRef(false),
      isError: shallowRef(false),
      refetch: vi.fn(),
    }
  },
}))
vi.mock('../../pets/usePets', () => ({
  usePetsList: () => ({ data: shallowRef([]), refetch: vi.fn(), isLoading: shallowRef(false), isError: shallowRef(false) }),
  usePetAccess: () => ({ canRead: computed(() => true), canUpdate: computed(() => true), canDelete: computed(() => true) }),
}))
const quotationsEnabled: Array<() => boolean> = []
vi.mock('@/features/POS/quotations/composables/useCustomerQuotations', () => ({
  CUSTOMER_QUOTATIONS_PAGE_SIZE: 10,
  useCustomerQuotations: (options: { enabled: () => boolean }) => {
    quotationsEnabled.push(options.enabled)
    return {
      canRead: computed(() => grants.set.has('read:Quotation')),
      page: shallowRef(1),
      response: shallowRef({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      isLoading: shallowRef(false),
      isFetching: shallowRef(false),
      isError: shallowRef(false),
      refetch: vi.fn(),
    }
  },
}))

// ── «Nueva venta» (owner-ideas-batch T4; the composable has its own spec) ──────────────────
const startSale = vi.hoisted(() => ({ start: vi.fn(), pending: { value: false } }))
vi.mock('@/features/POS/sales/composables/useStartSaleForCustomer', async () => {
  const { shallowRef } = await import('vue')
  const pending = shallowRef(false)
  startSale.pending = pending
  return { useStartSaleForCustomer: () => ({ start: startSale.start, isPending: pending }) }
})

// ── Heavy children (their own specs cover them) ──────────────────────────────
const stub = vi.hoisted(() => (name: string, testid: string, props: string[] = []) =>
  defineComponent({ name, props, setup: (_, { attrs }) => () => h('div', { 'data-testid': testid, ...attrs }) }))
vi.mock('../../components/CustomerSalesHistoryBody.vue', () => ({ default: stub('CustomerSalesHistoryBody', 'sales-body', ['history', 'showMetrics']) }))
vi.mock('../../components/CustomerSalesHistoryPager.vue', () => ({ default: stub('CustomerSalesHistoryPager', 'sales-pager', ['history', 'variant']) }))
vi.mock('../../components/CustomerPetsSection.vue', () => ({ default: stub('CustomerPetsSection', 'pets-section', ['customerId', 'activePetsCount']) }))
vi.mock('../../components/CustomerStatementDownload.vue', () => ({ default: stub('CustomerStatementDownload', 'statement-download', ['customerId']) }))
vi.mock('../../components/CustomerCollectionSlideover.vue', () => ({ default: stub('CustomerCollectionSlideover', 'collection-sheet', ['open', 'customerId', 'customerName']) }))
vi.mock('../../components/CustomerUpsertSlideover.vue', () => ({ default: stub('CustomerUpsertSlideover', 'customer-editor', ['open', 'mode', 'customer', 'loading', 'errors', 'globalPriceLists', 'showPets']) }))
vi.mock('../../components/SalesHistoryMonthlyChart.vue', () => ({ default: stub('SalesHistoryMonthlyChart', 'monthly-chart', ['months', 'failed']) }))
vi.mock('../../components/SalesHistoryList.vue', () => ({ default: stub('SalesHistoryList', 'sales-list', ['sales', 'layout', 'caption']) }))
vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: defineComponent({
    name: 'ConfirmModal',
    props: ['open', 'description', 'confirmLabel', 'confirmColor', 'loading', 'ui'],
    emits: ['confirm', 'update:open'],
    setup: (props) => () => h('div', { 'data-testid': 'confirm', 'data-open': String(props.open) }, props.description),
  }),
}))

const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@nuxt/ui/runtime/composables/useToast', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useToast: () => toast,
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────
function detail(overrides: Partial<CustomerDetail> = {}): CustomerDetail {
  return {
    id: 'c-1',
    firstName: 'Ana Sofía',
    lastName: 'Treviño Garza',
    fullName: 'Ana Sofía Treviño Garza',
    phoneCountryCode: '+52',
    phone: '8123456789',
    email: 'ana@example.com',
    globalPriceListId: 'pl-1',
    globalPriceListName: 'Público',
    comments: 'Prefiere entrega por la tarde',
    createdAt: '2025-03-15T18:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    businessName: 'Ana SA',
    fiscalZipCode: '64000',
    rfc: 'TEGA800101AAA',
    fiscalRegime: '612',
    billingStreet: null,
    billingExteriorNumber: null,
    billingInteriorNumber: null,
    billingZipCode: null,
    billingNeighborhood: null,
    billingMunicipality: null,
    billingCity: null,
    billingState: null,
    addresses: [
      {
        id: 'a-1', customerId: 'c-1', street: 'Padre Mier', exteriorNumber: '1450', interiorNumber: null,
        zipCode: '64000', neighborhood: 'Mitras Centro', municipality: 'Monterrey', city: null, state: 'NL',
        createdAt: '2025-03-15T18:00:00.000Z', updatedAt: '2025-03-15T18:00:00.000Z',
      },
    ],
    activePetsCount: 2,
    ...overrides,
  }
}

function sale(overrides: Partial<ConfirmedSaleRow> = {}): ConfirmedSaleRow {
  return {
    id: 's-1', folio: 'S-000412', status: 'CONFIRMED', paymentStatus: 'PARTIAL', deliveryStatus: 'PENDING',
    totalCents: 148_600, debtCents: 78_600, confirmedAt: '2026-11-22T17:42:00.000Z', dueDate: '2026-12-06',
    customer: null, cashier: { id: 'u', name: 'Caja' }, seller: null, paymentMethods: [], ...overrides,
  }
}

function summaryMetrics(overrides: Record<string, unknown> = {}) {
  return {
    customerId: 'c-1',
    metrics: {
      openDebtCents: 128_400, overdueDebtCents: 49_800, overdueCount: 1, oldestOverdueDueDate: '2026-11-20',
      salesCount: 23, totalSoldCents: 1_846_050, averageTicketCents: 80_263, lastPurchaseAt: '2026-11-22T17:42:00.000Z',
      ...overrides,
    },
  }
}

function withSales(debtCents = 128_400) {
  detailApi.getSalesSummary.mockResolvedValue(summaryMetrics(
    debtCents > 0 ? { openDebtCents: debtCents } : { openDebtCents: 0, overdueDebtCents: 0, overdueCount: 0, oldestOverdueDueDate: null },
  ))
  salesResponse.value = {
    data: [sale()],
    pagination: { page: 1, limit: 10, total: 23, totalPages: 3 },
    counts: { all: 23, pendingPayments: 2, notDelivered: 1, overdue: 1 },
    summary: {
      salesCount: 23, totalSoldCents: 1_846_050, outstandingDebtCents: debtCents, averageTicketCents: 80_263,
      overdueDebtCents: debtCents > 0 ? 49_800 : 0, oldestOverdueDueDate: debtCents > 0 ? '2026-11-20' : null,
    },
  }
}

let wrapper: VueWrapper | undefined
async function mountPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  wrapper = mountWithUApp(CustomerDetailView, {
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  await flushPromises()
  return wrapper
}
const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const qa = (selector: string) => [...document.body.querySelectorAll<HTMLElement>(selector)]
const tabLabels = () => qa('[role="tab"]').map((tab) => tab.textContent?.replace(/\s+/g, ' ').trim())

beforeEach(() => {
  document.body.innerHTML = ''
  grants.set = new Set(ALL)
  route.params = { id: 'c-1' }
  route.query = {}
  router.push.mockClear()
  router.replace.mockClear()
  api.getById.mockReset().mockResolvedValue(detail())
  api.remove.mockReset().mockResolvedValue(undefined)
  toast.add.mockClear()
  startSale.start.mockReset().mockResolvedValue(true)
  startSale.pending.value = false
  historyCalls.length = 0
  monthlyOpen.length = 0
  quotationsEnabled.length = 0
  detailApi.getSalesSummary.mockReset()
  detailApi.getPayments.mockReset().mockResolvedValue({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })
  withSales()
})
afterEach(() => {
  wrapper?.vm.$root?.$?.appContext.app.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('CustomerDetailView — header', () => {
  it('shows the meta line, the 22px name, the phone as a tel: link and a «Clientes» crumb', async () => {
    await mountPage()
    expect(api.getById).toHaveBeenCalledWith('c-1')
    expect(q('[data-testid="customer-detail-name"]')?.textContent?.trim()).toBe('Ana Sofía Treviño Garza')
    expect(q('[data-testid="customer-detail-meta"]')?.textContent).toContain('Cliente desde mar 2025')
    const phone = q('[data-testid="customer-detail-phone"]') as HTMLAnchorElement
    expect(phone.getAttribute('href')).toBe('tel:+528123456789')
    const crumb = q('[data-testid="customer-detail-crumb"]')
    expect(crumb?.textContent).toContain('Clientes')
    expect(crumb?.querySelector('a')?.getAttribute('href')).toBe('/pos/customers')
  })

  it('offers «Cobrar todo» as the one primary with update:Sale and open debt, opening the collection sheet', async () => {
    await mountPage()
    const collect = q('[data-testid="customer-detail-collect"]')
    expect(collect?.textContent).toContain('Cobrar todo')
    expect(q('[data-testid="collection-sheet"]')).toBeNull()
    collect!.click()
    await flushPromises()
    expect(q('[data-testid="collection-sheet"]')).not.toBeNull()
  })

  it('hides «Cobrar todo» without update:Sale or without debt', async () => {
    grants.set.delete('update:Sale')
    await mountPage()
    expect(q('[data-testid="customer-detail-collect"]')).toBeNull()
    wrapper?.vm.$root?.$?.appContext.app.unmount()
    document.body.innerHTML = ''

    grants.set = new Set(ALL)
    withSales(0)
    await mountPage()
    expect(q('[data-testid="customer-detail-collect"]')).toBeNull()
  })

  it('the ⋮ menu has the statement, Editar, WhatsApp and Eliminar… (destructive last)', async () => {
    await mountPage()
    const menu = wrapper!.findComponent({ name: 'RowActionsMenu' })
    const actions = menu.props('actions') as Array<{ key: string; label: string; destructive?: boolean }>
    expect(actions.map((a) => a.key)).toEqual(['edit', 'whatsapp', 'delete'])
    expect(actions[actions.length - 1]?.destructive).toBe(true)
    expect(q('[data-testid="statement-download"]')).not.toBeNull()
  })

  it('without update/delete:Customer or read:Sale the menu and the statement are not offered', async () => {
    grants.set = new Set(['read:Customer'])
    api.getById.mockResolvedValue(detail({ phone: null }))
    await mountPage()
    expect(wrapper!.findComponent({ name: 'RowActionsMenu' }).exists()).toBe(false)
    expect(q('[data-testid="statement-download"]')).toBeNull()
  })

  it('«Editar» opens the existing customer editor with the loaded detail', async () => {
    await mountPage()
    wrapper!.findComponent({ name: 'RowActionsMenu' }).vm.$emit('select', 'edit')
    await flushPromises()
    const editor = wrapper!.findComponent({ name: 'CustomerUpsertSlideover' })
    expect(editor.props('open')).toBe(true)
    expect(editor.props('mode')).toBe('edit')
    expect((editor.props('customer') as CustomerDetail).id).toBe('c-1')
  })

  it('«Eliminar…» asks first, deletes and goes back to the customers list', async () => {
    await mountPage()
    wrapper!.findComponent({ name: 'RowActionsMenu' }).vm.$emit('select', 'delete')
    await flushPromises()
    const confirm = wrapper!.findComponent({ name: 'ConfirmModal' })
    expect(confirm.props('open')).toBe(true)
    expect(confirm.props('description')).toContain('Ana Sofía Treviño Garza')
    expect(api.remove).not.toHaveBeenCalled()
    confirm.vm.$emit('confirm')
    await flushPromises()
    expect(api.remove).toHaveBeenCalledWith('c-1')
    expect(router.push).toHaveBeenCalledWith({ name: 'pos-customers' })
  })

  it('a refused delete keeps the page', async () => {
    api.remove.mockRejectedValue({ response: { status: 409, data: { error: 'CUSTOMER_HAS_ACTIVE_BACKORDERS' } } })
    await mountPage()
    wrapper!.findComponent({ name: 'RowActionsMenu' }).vm.$emit('select', 'delete')
    await flushPromises()
    wrapper!.findComponent({ name: 'ConfirmModal' }).vm.$emit('confirm')
    await flushPromises()
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('CustomerDetailView — «Nueva venta» (owner-ideas-batch T4, S2)', () => {
  const SELLER = [...ALL, 'create:Sale']
  const newSale = () => q('[data-testid="customer-detail-new-sale"]') as HTMLButtonElement | null
  const collect = () => q('[data-testid="customer-detail-collect"]')
  const isPrimary = (el: HTMLElement | null) => !!el?.classList.contains('hf-primary-control')

  it('needs read + create + update:Sale', async () => {
    for (const missing of ['read:Sale', 'create:Sale', 'update:Sale']) {
      grants.set = new Set(SELLER.filter((grant) => grant !== missing))
      await mountPage()
      expect(newSale()).toBeNull()
      wrapper?.vm.$root?.$?.appContext.app.unmount()
      document.body.innerHTML = ''
    }
    grants.set = new Set(SELLER)
    await mountPage()
    expect(newSale()?.textContent).toContain('Nueva venta')
  })

  it('is the one solid primary; «Cobrar todo» turns secondary outline and comes first (artboard order)', async () => {
    grants.set = new Set(SELLER)
    await mountPage()
    expect(isPrimary(newSale())).toBe(true)
    expect(isPrimary(collect())).toBe(false)
    expect(collect()?.textContent).toContain('Cobrar todo')
    expect(collect()!.compareDocumentPosition(newSale()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(qa('.customer-detail-header .hf-primary-control')).toHaveLength(1)
  })

  it('without create:Sale «Cobrar todo» stays the primary', async () => {
    await mountPage()
    expect(newSale()).toBeNull()
    expect(isPrimary(collect())).toBe(true)
  })

  it('pressing it starts the sale for this customer', async () => {
    grants.set = new Set(SELLER)
    await mountPage()
    newSale()!.click()
    await flushPromises()
    expect(startSale.start).toHaveBeenCalledTimes(1)
    expect(startSale.start).toHaveBeenCalledWith('c-1')
  })

  it('shows a loading, disabled state while the sale is being opened', async () => {
    grants.set = new Set(SELLER)
    await mountPage()
    startSale.pending.value = true
    await flushPromises()
    expect(newSale()!.disabled).toBe(true)
    expect(newSale()!.getAttribute('aria-busy')).toBe('true')
  })

  describe('phone', () => {
    const originalMatchMedia = window.matchMedia
    beforeEach(() => {
      window.matchMedia = vi.fn((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia
    })
    afterEach(() => {
      window.matchMedia = originalMatchMedia
    })
    const bar = () => q('[data-testid="customer-detail-mobile-bar"]')

    it('with debt the sticky bar keeps «Cobrar todo»; «Nueva venta» is a compact header button', async () => {
      grants.set = new Set(SELLER)
      await mountPage()
      expect(bar()?.querySelector('[data-testid="customer-detail-collect-mobile"]')).not.toBeNull()
      expect(bar()?.querySelector('[data-testid="customer-detail-new-sale-mobile"]')).toBeNull()
      expect(newSale()?.getAttribute('aria-label')).toBe('Nueva venta')
      expect(isPrimary(newSale())).toBe(false)
      newSale()!.click()
      expect(startSale.start).toHaveBeenCalledWith('c-1')
    })

    it('without debt the sticky bar offers «Nueva venta» as the primary', async () => {
      grants.set = new Set(SELLER)
      withSales(0)
      await mountPage()
      const button = bar()?.querySelector<HTMLButtonElement>('[data-testid="customer-detail-new-sale-mobile"]')
      expect(button?.textContent).toContain('Nueva venta')
      expect(isPrimary(button ?? null)).toBe(true)
      expect(newSale()).toBeNull()
      button!.click()
      expect(startSale.start).toHaveBeenCalledWith('c-1')
    })
  })
})

describe('CustomerDetailView — KPI strip (T5: GET /customers/:id/sales-summary)', () => {
  const kpi = (key: string) => q(`[data-testid="customer-kpi-${key}"]`)?.textContent?.replace(/\s+/g, ' ')

  it('maps Deuda, Vencido, Total comprado, Ticket promedio and Última compra from the sales summary', async () => {
    await mountPage()
    expect(detailApi.getSalesSummary).toHaveBeenCalledWith('c-1')
    expect(kpi('debt')).toContain('$1,284.00')
    expect(kpi('overdue')).toContain('$498.00')
    expect(kpi('overdue')).toContain('1 vencida · desde 20/11/2026')
    expect(kpi('total')).toContain('$18,460.50')
    expect(kpi('total')).toContain('23 ventas')
    expect(kpi('average')).toContain('$802.63')
    expect(kpi('last')).toContain('22 nov 2026')
  })

  it('reads the summary, not the sales list: a null average is «—» and no sales is «Sin compras»', async () => {
    detailApi.getSalesSummary.mockResolvedValue(summaryMetrics({
      openDebtCents: 0, overdueDebtCents: 0, overdueCount: 0, oldestOverdueDueDate: null,
      salesCount: 0, totalSoldCents: 0, averageTicketCents: null, lastPurchaseAt: null,
    }))
    await mountPage()
    expect(kpi('average')).toContain('—')
    expect(kpi('last')).toContain('Sin compras')
    expect(kpi('total')).toContain('0 ventas')
  })

  it('«Cobrar todo» uses the summary’s open debt', async () => {
    detailApi.getSalesSummary.mockResolvedValue(summaryMetrics({ openDebtCents: 50_000 }))
    await mountPage()
    expect(q('[data-testid="customer-detail-collect"]')?.textContent).toContain('$500.00')
  })

  it.each([403, 404])('a %s summary hides the strip without retrying', async (status) => {
    detailApi.getSalesSummary.mockRejectedValue({ response: { status } })
    await mountPage()
    expect(q('[data-testid="customer-kpis"]')).toBeNull()
    expect(q('[data-testid="customer-kpis-error"]')).toBeNull()
    expect(detailApi.getSalesSummary).toHaveBeenCalledTimes(1)
  })

  it('is hidden without read:Sale (and no sales request is made)', async () => {
    grants.set.delete('read:Sale')
    await mountPage()
    expect(q('[data-testid="customer-kpis"]')).toBeNull()
    expect(historyCalls.every((call) => !call.open())).toBe(true)
    expect(detailApi.getSalesSummary).not.toHaveBeenCalled()
  })
})

describe('CustomerDetailView — «Cliente de confianza» (T5)', () => {
  it('shows an info «De confianza» StatusBadge in the header meta for a trusted customer', async () => {
    api.getById.mockResolvedValue({ ...detail(), isTrusted: true })
    await mountPage()
    const badge = q('[data-testid="customer-detail-trusted"]')
    expect(badge?.textContent?.trim()).toBe('De confianza')
    expect(badge?.classList.contains('hf-status-badge')).toBe(true)
    expect(badge?.closest('[data-testid="customer-detail-meta"]')).not.toBeNull()
  })

  it('no badge when not trusted or unknown', async () => {
    api.getById.mockResolvedValue({ ...detail(), isTrusted: false })
    await mountPage()
    expect(q('[data-testid="customer-detail-trusted"]')).toBeNull()
  })

  it('«Datos y direcciones» says whether the customer is trusted', async () => {
    api.getById.mockResolvedValue({ ...detail(), isTrusted: true })
    route.query = { tab: 'datos' }
    await mountPage()
    const row = q('[data-testid="customer-data-trusted"]')?.textContent?.replace(/\s+/g, ' ')
    expect(row).toContain('Cliente de confianza')
    expect(row).toContain('Sí')
  })
})

describe('CustomerDetailView — tabs', () => {
  it('Resumen · Ventas · Cobros y recibos · Mascotas · Cotizaciones · Datos y direcciones, Resumen by default', async () => {
    await mountPage()
    expect(tabLabels()).toEqual(['Resumen', 'Ventas 23', 'Cobros y recibos', 'Mascotas 2', 'Cotizaciones', 'Datos y direcciones'])
    expect(q('[role="tab"][aria-selected="true"]')?.textContent).toContain('Resumen')
    expect(q('[data-testid="customer-tab-resumen"]')).not.toBeNull()
  })

  it('selecting a tab writes ?tab= with replace, keeping the other query', async () => {
    route.query = { foo: 'bar' }
    await mountPage()
    qa('[role="tab"]').find((tab) => tab.textContent?.includes('Ventas'))!.click()
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith({ query: { foo: 'bar', tab: 'ventas' } })
  })

  it('opens the tab named in the URL and loads only that tab', async () => {
    route.query = { tab: 'ventas' }
    await mountPage()
    expect(q('[data-testid="sales-body"]')).not.toBeNull()
    expect(q('[data-testid="sales-pager"]')).not.toBeNull()
    // The page's KPI strip hides the history's own metrics.
    expect(wrapper!.findComponent({ name: 'CustomerSalesHistoryBody' }).props('showMetrics')).toBe(false)
    expect(quotationsEnabled.every((enabled) => !enabled())).toBe(true)
    expect(q('[data-testid="pets-section"]')).toBeNull()
    expect(detailApi.getPayments).not.toHaveBeenCalled()
  })

  it('?tab=cobros opens «Cobros y recibos» and only then loads the payments feed', async () => {
    await mountPage()
    expect(detailApi.getPayments).not.toHaveBeenCalled()
    route.query = { tab: 'cobros' }
    await flushPromises()
    expect(q('[role="tab"][aria-selected="true"]')?.textContent).toContain('Cobros y recibos')
    expect(q('[data-testid="customer-tab-cobros"]')).not.toBeNull()
    expect(detailApi.getPayments).toHaveBeenCalledWith('c-1', 1, 50)
    expect(q('[data-testid="customer-payments-empty"]')?.textContent).toContain('Sin cobros todavía')
  })

  it('reacts to a URL change (back/forward) without remounting', async () => {
    await mountPage()
    route.query = { tab: 'mascotas' }
    await flushPromises()
    expect(q('[data-testid="pets-section"]')).not.toBeNull()
    route.query = { tab: 'cotizaciones' }
    await flushPromises()
    expect(quotationsEnabled.some((enabled) => enabled())).toBe(true)
    expect(q('[data-testid="customer-quotations-empty"]')).not.toBeNull()
  })

  it('without read:Sale or read:Quotation those tabs are absent and their URL falls back to Resumen', async () => {
    grants.set.delete('read:Sale')
    grants.set.delete('read:Quotation')
    route.query = { tab: 'cobros' }
    await mountPage()
    expect(tabLabels()).toEqual(['Resumen', 'Mascotas 2', 'Datos y direcciones'])
    expect(detailApi.getPayments).not.toHaveBeenCalled()
    expect(q('[role="tab"][aria-selected="true"]')?.textContent).toContain('Resumen')
    expect(q('[data-testid="sales-body"]')).toBeNull()
  })

  it('an unknown ?tab= falls back to Resumen', async () => {
    route.query = { tab: 'recibos' }
    await mountPage()
    expect(q('[role="tab"][aria-selected="true"]')?.textContent).toContain('Resumen')
  })

  it('Datos y direcciones is read-only: contact, fiscal data, addresses, price list and notes', async () => {
    route.query = { tab: 'datos' }
    await mountPage()
    const panel = q('[data-testid="customer-tab-datos"]')!.textContent!.replace(/\s+/g, ' ')
    for (const text of ['ana@example.com', 'TEGA800101AAA', 'Ana SA', 'Padre Mier #1450', 'Público', 'Prefiere entrega por la tarde', 'Notas']) {
      expect(panel).toContain(text)
    }
    expect(document.body.querySelectorAll('[data-testid="customer-tab-datos"] input')).toHaveLength(0)
  })

  it('Resumen warns about the debt and shows the latest sales and the monthly chart only while open', async () => {
    await mountPage()
    expect(q('[data-testid="customer-summary-debt"]')?.textContent).toContain('$1,284.00')
    expect(q('[data-testid="sales-list"]')).not.toBeNull()
    expect(monthlyOpen.some((open) => open())).toBe(true)
  })
})

describe('CustomerDetailView — not found and errors', () => {
  it('a 404 customer shows «Cliente no encontrado» with a way back', async () => {
    api.getById.mockRejectedValue({ response: { status: 404, data: { error: 'CUSTOMER_NOT_FOUND' } } })
    await mountPage()
    const empty = q('[data-testid="customer-detail-not-found"]')
    expect(empty?.textContent).toContain('Cliente no encontrado')
    const back = [...empty!.querySelectorAll('button')].find((b) => b.textContent?.includes('Volver a clientes'))
    back!.click()
    expect(router.push).toHaveBeenCalledWith({ name: 'pos-customers' })
    expect(q('[role="tab"]')).toBeNull()
  })

  it('any other failure offers a retry', async () => {
    api.getById.mockRejectedValueOnce({ response: { status: 500 } })
    await mountPage()
    expect(q('[data-testid="customer-detail-error"]')).not.toBeNull()
    api.getById.mockResolvedValue(detail())
    const retry = [...q('[data-testid="customer-detail-error"]')!.querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'))
    retry!.click()
    await flushPromises()
    expect(q('[data-testid="customer-detail-name"]')).not.toBeNull()
  })
})
