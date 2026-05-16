import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed } from 'vue'
import SaleDetailView from '../SaleDetailView.vue'

const debtSubmit = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'sale-1' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../../composables/useSaleDetail', () => ({
  useSaleDetail: () => ({
    sale: computed(() => ({
        id: 'sale-1',
        folio: 'A-202605-000012',
        status: 'CONFIRMED',
        channel: 'POS',
        register: 'Principal',
        confirmedAt: '2026-05-06T14:43:00.000Z',
        subtotalCents: 127000,
        discountCents: 0,
        totalCents: 127000,
        paidCents: 127000,
        debtCents: 0,
        changeDueCents: 0,
        paymentStatus: 'PAID',
        deliveryStatus: 'DELIVERED',
        customer: null,
        cashier: { id: 'u1', name: 'Cajero' },
        seller: null,
        items: [],
        payments: [],
        timeline: [],
      })),
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

describe('SaleDetailView', () => {
  it('renders two-column detail layout and title', () => {
    const wrapper = mount(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
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

  it('shows debt payment CTA for non-PAID sale and opens modal', async () => {
    vi.mocked(debtSubmit).mockResolvedValue(undefined)

    const wrapper = mount(SaleDetailView, {
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
