// BE handoff 24 in the sale detail: the live pay-in-store hold with «Cambiar plazo» (update:Sale),
// charging an ONLINE (bot) sale at the counter (update:Sale), and the deadline's own cancellation
// (HOLD_EXPIRED) cancelled by «Sistema».

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, type Ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { SaleDetail, SaleHold } from '../../interfaces/sale.types'
import SaleDetailView from '../SaleDetailView.vue'

vi.mock('../../api/sale.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sale.api')>()
  return { ...actual, saleApi: { ...actual.saleApi, getById: vi.fn(), getPdfBlob: vi.fn() } }
})

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: { getGlobalPriceLists: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@nuxt/ui/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nuxt/ui/composables/useToast')>()
  return { ...actual, useToast: () => ({ add: vi.fn(), update: vi.fn(), remove: vi.fn(), clear: vi.fn(), toasts: { value: [] } }) }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'sale-1' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

const detail = vi.hoisted(() => ({ sale: null as unknown as Ref<unknown> }))
vi.mock('../../composables/useSaleDetail', () => ({
  useSaleDetail: () => ({
    sale: computed(() => detail.sale.value),
    isLoading: computed(() => false),
    isError: computed(() => false),
    isNotFound: computed(() => false),
    refetch: vi.fn(),
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

vi.mock('../../components/AssignSellerSlideover.vue', () => ({
  default: { name: 'AssignSellerSlideover', template: '<div />', props: ['open', 'saleId'] },
}))
vi.mock('../../components/PaymentsListSection.vue', () => ({
  default: { name: 'PaymentsListSection', template: '<div />', props: ['payments', 'loading', 'readonly'] },
}))
vi.mock('../../components/SaleHoldDeadlineDialog.vue', () => ({
  default: {
    name: 'SaleHoldDeadlineDialog',
    props: ['open', 'saleId', 'hold', 'portalClass'],
    emits: ['update:open'],
    template: '<div v-if="open" data-testid="hold-deadline-dialog-stub">{{ hold.version }}</div>',
  },
}))

const grants = vi.hoisted(() => ({ value: new Set<string>() }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    user: { id: 'u-1' },
    userCan: (action: string, subject: string) => grants.value.has(`${action}:${subject}`),
  }),
}))

const hold: SaleHold = {
  paymentIntent: 'IN_STORE',
  expiresAt: '2026-11-19T18:30:00.000Z',
  reminderAt: '2026-11-19T15:30:00.000Z',
  stage: 0,
  version: 2,
}

const onlineHeld: SaleDetail = {
  id: 'sale-1',
  folio: 'A-202611-000031',
  status: 'CONFIRMED',
  channel: 'ONLINE',
  register: 'Bot',
  confirmedAt: '2026-11-18T18:30:00.000Z',
  dueDate: null,
  subtotalCents: 45000,
  discountCents: 0,
  totalCents: 45000,
  paidCents: 0,
  debtCents: 45000,
  changeDueCents: 0,
  paymentStatus: 'CREDIT',
  deliveryStatus: 'PENDING',
  customer: { id: 'c-1', name: 'María López' },
  cashier: { id: 'u-bot', name: 'Bot' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
  canceledAt: null,
  cancelReason: null,
  canceledBy: null,
  refunds: [],
  hold,
}

const holdExpired: SaleDetail = {
  ...onlineHeld,
  status: 'CANCELED',
  canceledAt: '2026-11-19T18:30:00.000Z',
  cancelReason: 'HOLD_EXPIRED',
  canceledBy: null,
  hold: { ...hold, stage: 2 },
}

function mountView(sale: SaleDetail = onlineHeld) {
  detail.sale = ref(sale)
  return mountWithUApp(SaleDetailView, {
    attachTo: document.body,
    global: {
      stubs: {
        DebtPaymentModal: { template: '<div />' },
        ConfirmModal: { template: '<div />' },
        SaleDetailItemsList: { template: '<div />' },
        SaleDetailTotalsCard: { template: '<div />' },
        SaleDetailHistoryCard: { template: '<div />' },
      },
    },
  })
}

describe('SaleDetailView — pay-in-store hold', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T21:00:00.000Z'))
    grants.value = new Set(['read:Sale', 'update:Sale', 'delete:Sale'])
    document.body.innerHTML = ''
  })

  it('shows the live hold with its deadline in the sucursal zone', () => {
    const section = mountView().get('[data-testid="sale-detail-hold"]')
    expect(section.get('h3').text()).toBe('Apartado')
    expect(section.get('[data-testid="sale-detail-hold-line"]').text()).toBe(
      'Apartado · pagar en tienda · vence jue 19 nov, 12:30',
    )
  })

  it('«Cambiar plazo» opens the deadline dialog with the shown hold', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-testid="sale-detail-hold-edit"]').trigger('click')
    await nextTick()
    const dialog = wrapper.findComponent({ name: 'SaleHoldDeadlineDialog' })
    expect(dialog.props('open')).toBe(true)
    expect(dialog.props('saleId')).toBe('sale-1')
    expect(dialog.props('hold')).toEqual(hold)
  })

  it('without update:Sale the hold shows but cannot be changed', () => {
    grants.value.delete('update:Sale')
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="sale-detail-hold"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sale-detail-hold-edit"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'SaleHoldDeadlineDialog' }).exists()).toBe(false)
  })

  it('a payment ends the hold: the refetched sale no longer shows it', async () => {
    const wrapper = mountView()
    detail.sale.value = { ...onlineHeld, paymentStatus: 'PARTIAL', paidCents: 10000, debtCents: 35000 }
    await nextTick()
    expect(wrapper.find('[data-testid="sale-detail-hold"]').exists()).toBe(false)
  })

  // Live check G1: opened from the SALE_HOLD_REVIEW notice, an expired hold still explains itself.
  it('an expired hold with a partial payment shows «Apartado vencido · revisar» and cannot be changed', () => {
    const wrapper = mountView({
      ...onlineHeld,
      paymentStatus: 'PARTIAL',
      paidCents: 9450,
      debtCents: 35550,
      hold: { ...hold, stage: 2 },
    })
    const section = wrapper.get('[data-testid="sale-detail-hold"]')
    expect(section.get('[data-testid="sale-detail-hold-line"]').text()).toBe('Apartado vencido · revisar')
    expect(wrapper.find('[data-testid="sale-detail-hold-edit"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'SaleHoldDeadlineDialog' }).exists()).toBe(false)
  })

  it('an expired hold still unpaid (stage 2, CREDIT) shows the review line and stays editable', () => {
    const wrapper = mountView({ ...onlineHeld, hold: { ...hold, stage: 2 } })
    expect(wrapper.get('[data-testid="sale-detail-hold-line"]').text()).toBe('Apartado vencido · revisar')
    expect(wrapper.find('[data-testid="sale-detail-hold-edit"]').exists()).toBe(true)
  })

  it('a sale without a hold has no hold section', () => {
    expect(mountView({ ...onlineHeld, hold: null }).find('[data-testid="sale-detail-hold"]').exists()).toBe(false)
  })

  describe('charging at the counter (S4)', () => {
    it('offers «Registrar pago» on an ONLINE sale to staff with update:Sale', () => {
      expect(mountView().find('[data-testid="register-payment-header"]').exists()).toBe(true)
    })

    it('hides «Registrar pago» without update:Sale', () => {
      grants.value.delete('update:Sale')
      expect(mountView().find('[data-testid="register-payment-header"]').exists()).toBe(false)
    })
  })

  describe('cancelled by the deadline (HOLD_EXPIRED)', () => {
    it('shows «Apartado vencido» cancelled by «Sistema» and no live hold', () => {
      const wrapper = mountView(holdExpired)
      const block = wrapper.get('[data-testid="sale-detail-cancellation"]')
      expect(block.text()).toContain('Apartado vencido (no se pagó a tiempo)')
      expect(block.text()).toContain('Cancelada por Sistema')
      expect(wrapper.find('[data-testid="sale-detail-hold"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="register-payment-header"]').exists()).toBe(false)
    })
  })
})
