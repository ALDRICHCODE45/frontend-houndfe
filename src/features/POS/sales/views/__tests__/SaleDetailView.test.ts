import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailView from '../SaleDetailView.vue'

const debtSubmit = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'sale-1' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

const mockSaleDetail = vi.hoisted(() => ({ value: null as any }))

vi.mock('../../composables/useSaleDetail', () => ({
  useSaleDetail: () => ({
    sale: computed(() => mockSaleDetail.value),
    isLoading: computed(() => false),
    isError: computed(() => false),
  }),
}))

vi.mock('../../composables/useDebtPayment', () => ({
  useDebtPayment: () => ({
    submit: debtSubmit,
    isSubmitting: computed(() => false),
    externalError: computed(() => null),
  }),
}))

vi.mock('../../composables/useSaleComments', () => ({
  useSaleComments: () => ({
    addComment: vi.fn().mockResolvedValue(undefined),
    updateComment: vi.fn().mockResolvedValue(undefined),
    deleteComment: vi.fn().mockResolvedValue(undefined),
    isPending: computed(() => false),
    lastError: computed(() => null),
  }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ userCan: vi.fn(() => true) }),
}))

const defaultSale = {
  id: 'sale-1',
  folio: 'A-202605-000012',
  status: 'CONFIRMED' as const,
  channel: 'POS',
  register: 'Principal',
  confirmedAt: '2026-05-06T14:43:00.000Z',
  subtotalCents: 127000,
  discountCents: 0,
  totalCents: 127000,
  paidCents: 127000,
  debtCents: 0,
  changeDueCents: 0,
  paymentStatus: 'PAID' as const,
  deliveryStatus: 'DELIVERED' as const,
  customer: null,
  cashier: { id: 'u1', name: 'Cajero' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
}

describe('SaleDetailView', () => {
  beforeEach(() => {
    mockSaleDetail.value = defaultSale
  })

  it('renders two-column detail layout and title', () => {
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { template: '<div data-testid="dropdown"><slot /></div>' },

          SaleDetailItemsTable: { template: '<div data-testid="items" />' },
          SaleDetailTotalsCard: { template: '<div data-testid="totals" />' },
          SaleDetailTimeline: { template: '<div data-testid="timeline" />' },
          SaleCommentInput: { template: '<div data-testid="comment-input" />' },
          SaleDetailSidebar: { template: '<div data-testid="sidebar" />' },
        },
      },
    })

    expect(wrapper.get('[data-testid="sale-detail-layout"]')).toBeTruthy()
    expect(wrapper.text()).toContain('Venta #12')
    expect(wrapper.find('[data-testid="sidebar"]').exists()).toBe(true)
  })

  it('renders payment badge with correct label for PAID status', () => {
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span data-testid="badge"><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { template: '<div><slot /></div>' },

          SaleDetailItemsTable: { template: '<div />' },
          SaleDetailTotalsCard: { template: '<div />' },
          SaleDetailTimeline: { template: '<div />' },
          SaleCommentInput: { template: '<div />' },
          SaleDetailSidebar: { template: '<div />' },
        },
      },
    })

    const badges = wrapper.findAll('[data-testid="badge"]')
    expect(badges).toHaveLength(2) // delivery + payment
    expect(badges[1]?.text()).toBe('Pagada')
  })

  it('renders "Más Acciones" dropdown trigger', () => {
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { 
            props: ['items'],
            template: '<div data-testid="dropdown"><slot /></div>' 
          },
          SaleDetailItemsTable: { template: '<div />' },
          SaleDetailTotalsCard: { template: '<div />' },
          SaleDetailTimeline: { template: '<div />' },
          SaleCommentInput: { template: '<div />' },
          SaleDetailSidebar: { template: '<div />' },
        },
      },
    })

    expect(wrapper.text()).toContain('Más Acciones')
    // The dropdown trigger button has aria-haspopup="menu"
    expect(wrapper.find('[aria-haspopup="menu"]').exists()).toBe(true)
  })

  it('renders payment badge with correct label for PARTIAL status', () => {
    mockSaleDetail.value = { ...defaultSale, paymentStatus: 'PARTIAL' }
    
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span data-testid="badge"><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { template: '<div><slot /></div>' },

          SaleDetailItemsTable: { template: '<div />' },
          SaleDetailTotalsCard: { template: '<div />' },
          SaleDetailTimeline: { template: '<div />' },
          SaleCommentInput: { template: '<div />' },
          SaleDetailSidebar: { template: '<div />' },
        },
      },
    })

    const badges = wrapper.findAll('[data-testid="badge"]')
    expect(badges[1]?.text()).toBe('Impaga')
  })

  it('renders payment badge with correct label for CREDIT status', () => {
    mockSaleDetail.value = { ...defaultSale, paymentStatus: 'CREDIT' }
    
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span data-testid="badge"><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { template: '<div><slot /></div>' },

          SaleDetailItemsTable: { template: '<div />' },
          SaleDetailTotalsCard: { template: '<div />' },
          SaleDetailTimeline: { template: '<div />' },
          SaleCommentInput: { template: '<div />' },
          SaleDetailSidebar: { template: '<div />' },
        },
      },
    })

    const badges = wrapper.findAll('[data-testid="badge"]')
    expect(badges[1]?.text()).toBe('Deuda')
  })

  it('does not render payment badge when paymentStatus is null', () => {
    mockSaleDetail.value = { ...defaultSale, paymentStatus: null }
    
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span data-testid="badge"><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { template: '<div><slot /></div>' },

          SaleDetailItemsTable: { template: '<div />' },
          SaleDetailTotalsCard: { template: '<div />' },
          SaleDetailTimeline: { template: '<div />' },
          SaleCommentInput: { template: '<div />' },
          SaleDetailSidebar: { template: '<div />' },
        },
      },
    })

    const badges = wrapper.findAll('[data-testid="badge"]')
    expect(badges).toHaveLength(1) // only delivery badge
  })

  it('shows debt payment CTA for non-PAID sale and opens modal', async () => {
    vi.mocked(debtSubmit).mockResolvedValue(undefined)

    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          SaleDetailItemsTable: { template: '<div data-testid="items" />' },
          SaleDetailTotalsCard: { template: '<div data-testid="totals" />' },
          SaleDetailTimeline: { template: '<div data-testid="timeline" />' },
          SaleCommentInput: { template: '<div data-testid="comment-input" />' },
          SaleDetailSidebar: {
            props: ['sale'],
            emits: ['register-payment'],
            template:
              '<button data-testid="register-debt-payment" @click="$emit(\'register-payment\')">Registrar Pago</button>',
          },
          DebtPaymentModal: {
            props: ['open', 'saleId', 'debtCents'],
            emits: ['submit', 'update:open'],
            template:
              '<div v-if="open"><button data-testid="submit-debt-payment" @click="$emit(\'submit\', { method: \'cash\', amountCents: debtCents })">submit</button></div>',
          },
        },
      },
    })

    await wrapper.get('[data-testid="register-debt-payment"]').trigger('click')
    expect(wrapper.find('[data-testid="submit-debt-payment"]').exists()).toBe(true)
  })
})
