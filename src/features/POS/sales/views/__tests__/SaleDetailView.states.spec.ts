/**
 * S10: the page states of the sale detail (loading, data, error, forbidden)
 * against the real view. Only its data sources are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailView from '../SaleDetailView.vue'

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: { getGlobalPriceLists: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@nuxt/ui/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nuxt/ui/composables/useToast')>()
  return {
    ...actual,
    useToast: () => ({ add: vi.fn(), update: vi.fn(), remove: vi.fn(), clear: vi.fn(), toasts: ref([]) }),
  }
})

const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'sale-1' } }),
  useRouter: () => ({ push }),
}))

const detail = vi.hoisted(() => ({
  sale: null as unknown,
  isLoading: false,
  isError: false,
  isNotFound: false,
  refetch: vi.fn(),
}))

vi.mock('../../composables/useSaleDetail', () => ({
  useSaleDetail: () => ({
    sale: computed(() => detail.sale),
    isLoading: computed(() => detail.isLoading),
    isError: computed(() => detail.isError),
    isNotFound: computed(() => detail.isNotFound),
    refetch: detail.refetch,
  }),
}))

vi.mock('../../composables/useDebtPayment', () => ({
  useDebtPayment: () => ({ isSubmitting: computed(() => false) }),
}))
vi.mock('../../composables/useSaleComments', () => ({
  useSaleComments: () => ({
    addComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    isPending: computed(() => false),
    lastError: computed(() => null),
  }),
}))
vi.mock('../../composables/useUpdatePaymentReference', () => ({
  useUpdatePaymentReference: () => ({ updateReference: vi.fn(), isPending: computed(() => false) }),
}))
vi.mock('../../composables/useSaleCancellation', () => ({
  useSaleCancellation: () => ({ cancelSale: vi.fn(), isPending: computed(() => false) }),
}))
vi.mock('../../composables/useSalePaymentMethods', () => ({
  useSalePaymentMethods: () => ({
    data: computed(() => []),
    isLoading: computed(() => false),
    isFetching: computed(() => false),
    isError: computed(() => false),
    error: computed(() => null),
    refetch: vi.fn(),
  }),
}))

const authMock = vi.hoisted(() => ({
  userCan: vi.fn<(action: string, subject: string) => boolean>(() => true),
  user: { id: 'u1' },
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

const sale = {
  id: 'sale-1',
  folio: 'A-202605-000012',
  status: 'CONFIRMED' as const,
  channel: 'POS',
  register: 'Principal',
  confirmedAt: '2026-05-06T14:43:00.000Z',
  subtotalCents: 127000,
  discountCents: 0,
  totalCents: 127000,
  paidCents: 77000,
  debtCents: 50000,
  changeDueCents: 0,
  paymentStatus: 'PARTIAL' as const,
  deliveryStatus: 'PENDING' as const,
  customer: null,
  cashier: { id: 'u1', name: 'Cajero' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
}

const stubs = {
  AssignSellerSlideover: { template: '<div />' },
  DebtPaymentModal: { template: '<div />' },
  PaymentsListSection: { template: '<div data-testid="payments-list-section" />' },
}

function stubMobileViewport(mobile: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: mobile && query.includes('max-width'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
}

function mountDetail() {
  return mountWithUApp(SaleDetailView, { global: { stubs } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.clearAllMocks()
  detail.sale = sale
  detail.isLoading = false
  detail.isError = false
  detail.isNotFound = false
  authMock.userCan.mockReturnValue(true)
})

describe('SaleDetailView states — loading', () => {
  it('shows a busy skeleton shaped like the two columns, with no header or data', () => {
    detail.sale = undefined
    detail.isLoading = true
    const wrapper = mountDetail()

    expect(wrapper.get('[data-testid="sale-detail-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="sale-detail-header"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-detail-layout-body"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-detail-error"]').exists()).toBe(false)
  })

  it('keeps a header bar skeleton and shapes the body as titled cards with rows', () => {
    detail.sale = undefined
    detail.isLoading = true
    const wrapper = mountDetail()

    expect(wrapper.find('[data-testid="sale-detail-header-skeleton"]').exists()).toBe(true)
    const cards = wrapper.findAll('[data-testid="sale-detail-skeleton"] [data-testid="sale-detail-skeleton-card"]')
    expect(cards.length).toBeGreaterThanOrEqual(3)
    for (const card of cards) {
      // a title bar plus at least two content rows, never one blank box
      expect(card.findAll('[data-slot="skeleton"], .animate-pulse').length).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('SaleDetailView states — section order', () => {
  // Below lg the two columns flow as one list; `order-N` is the mobile order and
  // `lg:order-none` hands the order back to the two-column layout.
  const mobileOrder = (el: { classes: () => string[] }) => {
    const found = el.classes().find((name) => /^order-\d+$/.test(name))
    return found ? Number(found.slice('order-'.length)) : Number.NaN
  }

  it('shows Productos first on mobile, then Totales, Pagos, Datos and Historial', () => {
    const wrapper = mountDetail()

    const sections = ['items', 'totals', 'payments', 'data', 'history'].map((key) =>
      wrapper.get(`[data-testid="sale-detail-section-${key}"]`),
    )
    expect(sections.map(mobileOrder)).toEqual([1, 2, 3, 4, 5])
    for (const section of sections) expect(section.classes()).toContain('lg:order-none')
  })

  it('keeps the two columns on desktop: Productos, Datos and Historial left, Totales and Pagos right', () => {
    const wrapper = mountDetail()

    const left = wrapper.get('[data-testid="sale-detail-column-main"]')
    const right = wrapper.get('[data-testid="sale-detail-column-side"]')
    expect(left.findAll('[data-testid^="sale-detail-section-"]').map((el) => el.attributes('data-testid'))).toEqual([
      'sale-detail-section-items',
      'sale-detail-section-data',
      'sale-detail-section-history',
    ])
    expect(right.findAll('[data-testid^="sale-detail-section-"]').map((el) => el.attributes('data-testid'))).toEqual([
      'sale-detail-section-totals',
      'sale-detail-section-payments',
    ])
    // Below lg the columns dissolve so the sections can interleave by order.
    expect(left.classes()).toContain('contents')
    expect(right.classes()).toContain('contents')
  })

  it('shapes the loading skeleton in the same order, with the products card first', () => {
    detail.sale = undefined
    detail.isLoading = true
    const wrapper = mountDetail()

    const cards = wrapper.findAll('[data-testid="sale-detail-skeleton-card"]')
    const byOrder = [...cards].sort((a, b) => mobileOrder(a) - mobileOrder(b))
    expect(byOrder[0]!.attributes('data-section')).toBe('items')
    expect(byOrder[1]!.attributes('data-section')).toBe('totals')
  })

  it('shapes the header skeleton like the real header: title, badges and the primary', () => {
    detail.sale = undefined
    detail.isLoading = true
    const wrapper = mountDetail()

    const header = wrapper.get('[data-testid="sale-detail-header-skeleton"]')
    expect(header.findAll('[data-slot="skeleton"], .animate-pulse').length).toBeGreaterThanOrEqual(5)
  })
})

describe('SaleDetailView states — data', () => {
  it('shows the status badges with mapped tones, one primary and the ⋮ menu', () => {
    const wrapper = mountDetail()

    const badges = wrapper.findAll('[data-testid="sale-detail-header"] .hf-status-badge')
    expect(badges.map((b) => [b.text(), b.attributes('data-tone')])).toEqual([
      ['No entregada', 'danger'],
      ['Impaga', 'warning'],
    ])
    expect(wrapper.get('[data-testid="header-folio"]').text()).toBe('Venta #12')
    expect(wrapper.findAll('.hf-primary-control').filter((el) => el.text() === 'Registrar pago')).toHaveLength(1)
    expect(wrapper.get('[aria-label="Más acciones de la venta"]').attributes('aria-haspopup')).toBe('menu')
    expect(wrapper.find('[data-testid="sale-detail-layout-body"]').exists()).toBe(true)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('shows the sale facts as a neutral read-only list, not tinted boxes', () => {
    const wrapper = mountDetail()

    const facts = wrapper.get('[data-testid="sidebar-data-reflow"] dl')
    expect(facts.findAll('dt').map((dt) => dt.text())).toEqual([
      'Cajero',
      'Vendedor',
      'Cliente',
      'Lista de precios',
      'Métodos de pago',
    ])
    expect(wrapper.find('.sales-detail-fact').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/click/i)
  })

  it('offers a real "Asignar vendedor" button when there is no seller', async () => {
    const wrapper = mountDetail()

    const assign = wrapper
      .findAll('[data-testid="sidebar-data-reflow"] button')
      .find((b) => b.text() === 'Asignar vendedor')
    expect(assign).toBeDefined()
  })

  it('writes the history labels in sentence case', () => {
    detail.sale = {
      ...sale,
      timeline: [
        { type: 'SALE_REGISTERED', at: '2026-05-06T14:43:00.000Z', actor: { id: 'u1', name: 'Cajero' } },
        { type: 'PRODUCTS_DELIVERED', at: '2026-05-06T15:43:00.000Z', actor: { id: 'u1', name: 'Cajero' } },
      ],
    }
    const text = mountDetail().text()

    expect(text).toContain('Venta registrada')
    expect(text).toContain('Entrega de productos')
    expect(text).not.toContain('Venta Registrada')
  })

  it('keeps the one primary in the header on desktop, with none in the totals card', () => {
    stubMobileViewport(false)
    const wrapper = mountDetail()

    expect(wrapper.find('[data-testid="sale-detail-mobile-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="register-payment-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="register-debt-payment"]').exists()).toBe(false)
  })

  it('moves the one primary to the sticky bottom bar on mobile', () => {
    stubMobileViewport(true)
    const wrapper = mountDetail()

    const bar = wrapper.get('[data-testid="sale-detail-mobile-bar"]')
    expect(bar.text()).toContain('Registrar pago')
    expect(wrapper.find('[data-testid="register-payment-header"]').exists()).toBe(false)
    expect(wrapper.findAll('.hf-primary-control').filter((el) => el.text() === 'Registrar pago')).toHaveLength(1)
    // the title wraps instead of truncating to a few letters
    expect(wrapper.get('[data-testid="header-folio"]').classes()).not.toContain('truncate')
  })

  it('shows the lines as compact rows on mobile', () => {
    stubMobileViewport(true)
    detail.sale = {
      ...sale,
      items: [
        {
          productName: 'Collar ajustable de nailon reflejante',
          variantName: 'Chico · Azul',
          quantity: 2,
          unitPriceCents: 10000,
          subtotalCents: 20000,
          discountAmountCents: 0,
        },
      ],
    }
    const wrapper = mountDetail()

    expect(wrapper.find('[data-testid="items-table"]').exists()).toBe(false)
    const row = wrapper.get('[data-testid="item-compact-0"]')
    expect(row.text()).toContain('Collar ajustable de nailon reflejante')
    expect(row.text()).toContain('2 × $100.00')
    expect(row.text()).toContain('$200.00')
  })
})

describe('SaleDetailView states — not found', () => {
  it('shows an empty state with one way back, and never an error, redirect or header', async () => {
    detail.sale = undefined
    detail.isNotFound = true
    const wrapper = mountDetail()

    const state = wrapper.get('[data-testid="sale-detail-not-found"] .hf-empty-state')
    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.text()).toContain('No encontramos la venta')
    expect(wrapper.find('[data-testid="sale-detail-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-detail-header"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-detail-skeleton"]').exists()).toBe(false)
    expect(push).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="sale-detail-back"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/pos/ventas')
  })
})

describe('SaleDetailView states — error', () => {
  it('shows the error state with Reintentar that refetches, and no skeleton', async () => {
    detail.sale = undefined
    detail.isError = true
    const wrapper = mountDetail()

    const error = wrapper.get('[data-testid="sale-detail-error"] .hf-empty-state')
    expect(error.attributes('data-kind')).toBe('error')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudo cargar la venta')
    expect(wrapper.find('[data-testid="sale-detail-skeleton"]').exists()).toBe(false)

    await wrapper.get('[data-testid="sale-detail-retry"]').trigger('click')
    expect(detail.refetch).toHaveBeenCalledTimes(1)
  })
})

describe('SaleDetailView states — forbidden', () => {
  it('shows the forbidden state instead of a blank page when the role cannot read sales', () => {
    authMock.userCan.mockImplementation((action: string) => action !== 'read')
    const wrapper = mountDetail()

    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('forbidden')
    expect(wrapper.find('[data-testid="sale-detail-header"]').exists()).toBe(false)
  })
})
