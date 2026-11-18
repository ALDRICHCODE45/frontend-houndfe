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

const expire = vi.hoisted(() => ({
  expireHold: vi.fn(),
  resetAttempt: vi.fn(),
  pending: { value: false },
}))
vi.mock('../../composables/useSaleHoldExpire', () => ({
  useSaleHoldExpire: () => ({
    expireHold: expire.expireHold,
    resetAttempt: expire.resetAttempt,
    isPending: computed(() => expire.pending.value),
  }),
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
        ConfirmModal: {
          name: 'ConfirmModal',
          props: ['open', 'title', 'description', 'confirmLabel', 'cancelLabel', 'confirmColor', 'loading', 'ui'],
          emits: ['update:open', 'confirm'],
          template: '<div />',
        },
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

  it('a payment ends the hold: the refetched sale no longer shows it to a read-only user', async () => {
    grants.value.delete('update:Sale')
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

  // hold-expire-now T2 / BE handoff 24 §6: «Vencer apartado ahora».
  describe('«Vencer apartado ahora»', () => {
    const partial: SaleDetail = { ...onlineHeld, paymentStatus: 'PARTIAL', paidCents: 10000, debtCents: 35000 }

    function expireModal(wrapper: ReturnType<typeof mountView>) {
      const modal = wrapper
        .findAllComponents({ name: 'ConfirmModal' })
        .find((candidate) => candidate.props('title') === '¿Vencer el apartado ahora?')
      if (!modal) throw new Error('expire ConfirmModal not mounted')
      return modal
    }

    beforeEach(() => {
      expire.expireHold.mockReset()
      expire.resetAttempt.mockReset()
      expire.pending.value = false
    })

    it('shows the destructive-secondary action on a live unpaid hold with update:Sale', () => {
      const button = mountView().get('[data-testid="sale-detail-hold-expire"]')
      expect(button.text()).toBe('Vencer apartado ahora')
      expect(button.classes().join(' ')).toMatch(/error/)
    })

    it('shows it at stage 1 (reminder sent) and on a partly paid hold, with the card', () => {
      expect(mountView({ ...onlineHeld, hold: { ...hold, stage: 1 } }).find('[data-testid="sale-detail-hold-expire"]').exists()).toBe(true)
      const wrapper = mountView(partial)
      expect(wrapper.find('[data-testid="sale-detail-hold"]').exists()).toBe(true)
      expect(wrapper.get('[data-testid="sale-detail-hold-line"]').text()).toBe(
        'Apartado · vence jue 19 nov, 12:30 · tiene un pago registrado',
      )
      expect(wrapper.find('[data-testid="sale-detail-hold-expire"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="sale-detail-hold-edit"]').exists()).toBe(false)
    })

    it.each([
      ['without update:Sale', onlineHeld, true],
      ['at stage 2', { ...onlineHeld, hold: { ...hold, stage: 2 as const } }, false],
      ['when fully paid', { ...onlineHeld, paymentStatus: 'PAID' as const, paidCents: 45000, debtCents: 0 }, false],
      ['when cancelled', { ...onlineHeld, status: 'CANCELED' as const, cancelReason: 'CUSTOMER_REQUEST' as const }, false],
      ['without a hold', { ...onlineHeld, hold: null }, false],
    ])('is hidden %s', (_label, sale, dropUpdate) => {
      if (dropUpdate) grants.value.delete('update:Sale')
      const wrapper = mountView(sale as SaleDetail)
      expect(wrapper.find('[data-testid="sale-detail-hold-expire"]').exists()).toBe(false)
    })

    it('asks first, explaining that an unpaid sale is cancelled and the customer told', async () => {
      const wrapper = mountView()
      expect(expireModal(wrapper).props('open')).toBe(false)
      await wrapper.get('[data-testid="sale-detail-hold-expire"]').trigger('click')
      const modal = expireModal(wrapper)
      expect(modal.props('open')).toBe(true)
      expect(modal.props('description')).toBe('La venta se cancela como plazo vencido y el cliente recibe el aviso.')
      expect(modal.props('confirmLabel')).toBe('Vencer apartado')
      expect(modal.props('confirmColor')).toBe('error')
      expect(expire.resetAttempt).toHaveBeenCalledTimes(1)
      expect(expire.expireHold).not.toHaveBeenCalled()
    })

    it('with a payment, explains the sale waits for review and is not cancelled', async () => {
      const wrapper = mountView(partial)
      await wrapper.get('[data-testid="sale-detail-hold-expire"]').trigger('click')
      expect(expireModal(wrapper).props('description')).toBe(
        'El apartado vence y la venta queda para revisar; no se cancela porque tiene un pago registrado.',
      )
    })

    it('confirm expires with the shown hold version and closes on success', async () => {
      expire.expireHold.mockResolvedValue({ ok: true, outcome: 'CANCELLED' })
      const wrapper = mountView()
      await wrapper.get('[data-testid="sale-detail-hold-expire"]').trigger('click')
      expireModal(wrapper).vm.$emit('confirm')
      await nextTick()
      await nextTick()
      expect(expire.expireHold).toHaveBeenCalledWith(2)
      expect(expireModal(wrapper).props('open')).toBe(false)
    })

    it('a conflict closes the dialog (the sale reloads); an uncertain failure keeps it open to retry', async () => {
      const wrapper = mountView()
      expire.expireHold.mockResolvedValueOnce({ ok: false, code: 'NETWORK' })
      await wrapper.get('[data-testid="sale-detail-hold-expire"]').trigger('click')
      expireModal(wrapper).vm.$emit('confirm')
      await nextTick()
      await nextTick()
      expect(expireModal(wrapper).props('open')).toBe(true)

      expire.expireHold.mockResolvedValueOnce({ ok: false, code: 'HOLD_VERSION_CONFLICT' })
      expireModal(wrapper).vm.$emit('confirm')
      await nextTick()
      await nextTick()
      expect(expireModal(wrapper).props('open')).toBe(false)
    })

    it('forwards the pending state to the dialog', async () => {
      expire.pending.value = true
      const wrapper = mountView()
      expect(expireModal(wrapper).props('loading')).toBe(true)
    })
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
    it('the header reads «Venta cancelada» with a «Plazo vencido» warning tag', () => {
      const header = mountView(holdExpired).get('[data-testid="sale-detail-header"]')
      const badges = header.findAll('.hf-status-badge')
      expect(badges.map((badge) => badge.text())).toEqual(['Venta cancelada', 'Plazo vencido'])
      expect(badges[0]!.attributes('data-tone')).toBe('neutral')
      expect(badges[1]!.attributes('data-tone')).toBe('warning')
      expect(badges[1]!.find('[data-icon="i-lucide-clock-alert"]').exists()).toBe(true)
    })

    it('the card explains the expiry, cancelled by «Sistema», and no live hold', () => {
      const wrapper = mountView(holdExpired)
      const block = wrapper.get('[data-testid="sale-detail-cancellation"]')
      expect(block.text()).toContain('Plazo vencido')
      expect(block.get('[data-testid="sale-detail-cancel-explanation"]').text()).toBe(
        'Cancelada porque venció el plazo del apartado sin pagarse',
      )
      expect(block.text()).toContain('Cancelada por Sistema')
      expect(block.text()).not.toContain('Apartado vencido')
      expect(wrapper.find('[data-testid="sale-detail-hold"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="register-payment-header"]').exists()).toBe(false)
    })

    it('a person who made it expire is named instead of «Sistema»', () => {
      const block = mountView({ ...holdExpired, canceledBy: { id: 'u-2', name: 'Ana Ruiz' } })
        .get('[data-testid="sale-detail-cancellation"]')
      expect(block.text()).toContain('Cancelada por Ana Ruiz')
      expect(block.text()).not.toContain('Sistema')
    })
  })
})
