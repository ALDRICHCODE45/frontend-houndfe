/**
 * S10: the page states of the sale detail (loading, data, error, forbidden)
 * against the real view. Only its data sources are mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'sale-1' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

const detail = vi.hoisted(() => ({
  sale: null as unknown,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}))

vi.mock('../../composables/useSaleDetail', () => ({
  useSaleDetail: () => ({
    sale: computed(() => detail.sale),
    isLoading: computed(() => detail.isLoading),
    isError: computed(() => detail.isError),
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

function mountDetail() {
  return mountWithUApp(SaleDetailView, { global: { stubs } })
}

beforeEach(() => {
  vi.clearAllMocks()
  detail.sale = sale
  detail.isLoading = false
  detail.isError = false
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
})

describe('SaleDetailView states — data', () => {
  it('shows the status badges with mapped tones, one primary and the ⋮ menu', () => {
    const wrapper = mountDetail()

    const badges = wrapper.findAll('[data-testid="sale-detail-header"] .hf-status-badge')
    expect(badges.map((b) => [b.text(), b.attributes('data-tone')])).toEqual([
      ['No Entregados', 'danger'],
      ['Impaga', 'warning'],
    ])
    expect(wrapper.get('[data-testid="header-folio"]').text()).toBe('Venta #12')
    expect(wrapper.findAll('.hf-primary-control').filter((el) => el.text() === 'Registrar pago')).toHaveLength(1)
    expect(wrapper.get('[aria-label="Más acciones de la venta"]').attributes('aria-haspopup')).toBe('menu')
    expect(wrapper.find('[data-testid="sale-detail-layout-body"]').exists()).toBe(true)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
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
