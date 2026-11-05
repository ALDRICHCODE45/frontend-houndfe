// T20: a cancelled sale opens in the detail (BE ae0e951, handoff 06 «Cancelled sale detail»).
// It is read-only: a neutral «Cancelada» badge, the cancellation, its refunds with «Liquidar»
// through the refunds settle slideover, no seller change and no receipt.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, type Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { SaleDetail } from '../../interfaces/sale.types'
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

const detail = vi.hoisted(() => ({ sale: null as unknown as Ref<unknown>, refetch: vi.fn() }))
vi.mock('../../composables/useSaleDetail', () => ({
  useSaleDetail: () => ({
    sale: computed(() => detail.sale.value),
    isLoading: computed(() => false),
    isError: computed(() => false),
    isNotFound: computed(() => false),
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

vi.mock('../../components/AssignSellerSlideover.vue', () => ({
  default: { name: 'AssignSellerSlideover', template: '<div />', props: ['open', 'saleId'] },
}))
vi.mock('../../components/PaymentsListSection.vue', () => ({
  default: {
    name: 'PaymentsListSection',
    template: '<div data-testid="payments-list-section" />',
    props: ['payments', 'loading', 'readonly'],
  },
}))
vi.mock('@/features/POS/refunds/components/SettleRefundSlideover.vue', () => ({
  default: {
    name: 'SettleRefundSlideover',
    props: ['open', 'refund'],
    emits: ['update:open'],
    template: '<div v-if="open" data-testid="settle-panel">{{ refund && refund.id }}</div>',
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

const confirmed: SaleDetail = {
  id: 'sale-1',
  folio: 'A-202611-000023',
  status: 'CONFIRMED',
  channel: 'POS',
  register: 'Principal',
  confirmedAt: '2026-10-25T18:00:00.000Z',
  dueDate: null,
  subtotalCents: 92910,
  discountCents: 0,
  totalCents: 92910,
  paidCents: 92910,
  debtCents: 0,
  changeDueCents: 0,
  paymentStatus: 'PAID',
  deliveryStatus: 'DELIVERED',
  customer: { id: 'c-1', name: 'María López' },
  cashier: { id: 'u-2', name: 'Cajero' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
  canceledAt: null,
  cancelReason: null,
  canceledBy: null,
  refunds: [],
}

const canceled: SaleDetail = {
  ...confirmed,
  status: 'CANCELED',
  canceledAt: '2026-10-25T20:42:00.000Z',
  cancelReason: 'ORDER_ERROR',
  canceledBy: { id: 'u-9', name: 'Ana Ruiz' },
  refunds: [
    {
      id: 'cmw2iwsa00000r965efhf292s',
      method: 'cash',
      amountCents: 6555,
      settledCents: 6555,
      outstandingCents: 0,
      reason: 'ORDER_ERROR',
      status: 'PENDING',
      createdAt: '2026-10-25T20:42:00.000Z',
    },
    {
      id: 'cmw2iwsdh0001r965z1rmw0n0',
      method: 'transfer',
      amountCents: 92910,
      settledCents: 46500,
      outstandingCents: 46410,
      reason: 'ORDER_ERROR',
      status: 'PENDING',
      createdAt: '2026-10-25T20:42:00.000Z',
    },
  ],
}

function mountView(sale: SaleDetail = canceled) {
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

type ViewWrapper = ReturnType<typeof mountView>
const actionLabels = (wrapper: ViewWrapper) =>
  (wrapper.vm as unknown as { actionItems: { label: string }[] }).actionItems.map((item) => item.label)

describe('SaleDetailView — cancelled sale', () => {
  beforeEach(() => {
    grants.value = new Set(['read:Sale', 'update:Sale', 'delete:Sale', 'read:SaleRefund', 'update:SaleRefund'])
    detail.refetch.mockReset()
    document.body.innerHTML = ''
  })

  it('shows one neutral «Cancelada» badge instead of the delivery and payment badges', () => {
    const badges = mountView().findAll('[data-testid="sale-detail-header"] .hf-status-badge')
    expect(badges.map((badge) => badge.text())).toEqual(['Cancelada'])
    expect(badges[0]!.attributes('data-tone')).toBe('neutral')
  })

  it('shows the cancellation: the date, the reason and who cancelled it', () => {
    const block = mountView().get('[data-testid="sale-detail-cancellation"]')
    expect(block.get('h3').text()).toBe('Cancelación')
    expect(block.text()).toContain('25/10/2026')
    expect(block.text()).toContain('Error en el pedido')
    expect(block.text()).toContain('Cancelada por Ana Ruiz')
  })

  it('leaves out «Cancelada por» when the user who cancelled no longer exists', () => {
    const block = mountView({ ...canceled, canceledBy: null }).get('[data-testid="sale-detail-cancellation"]')
    expect(block.text()).not.toContain('Cancelada por')
  })

  it('lists each refund with its method, total, devuelto, pendiente and progress', () => {
    const rows = mountView().findAll('[data-testid="sale-refund"]')
    expect(rows).toHaveLength(2)
    expect(rows[1]!.text()).toContain('Transferencia')
    expect(rows[1]!.text()).toContain('$929.10')
    expect(rows[1]!.text()).toContain('$465.00')
    expect(rows[1]!.text()).toContain('$464.10')
    expect(rows[1]!.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('50')
  })

  it('marks a fully returned refund «Devuelto» (success) with no «Liquidar»', () => {
    const first = mountView().findAll('[data-testid="sale-refund"]')[0]!
    const badge = first.get('.hf-status-badge')
    expect(badge.text()).toBe('Devuelto')
    expect(badge.attributes('data-tone')).toBe('success')
    expect(first.find('[data-testid="sale-refund-settle"]').exists()).toBe(false)
  })

  it('«Liquidar» opens the refunds settle slideover for that refund, with the sale it belongs to', async () => {
    const wrapper = mountView()
    await wrapper.findAll('[data-testid="sale-refund"]')[1]!.get('[data-testid="sale-refund-settle"]').trigger('click')
    await nextTick()

    const panel = wrapper.findComponent({ name: 'SettleRefundSlideover' })
    expect(panel.props('open')).toBe(true)
    expect(panel.props('refund')).toMatchObject({
      id: 'cmw2iwsdh0001r965z1rmw0n0',
      saleId: 'sale-1',
      outstandingCents: 46410,
      folioLabel: 'A-202611-000023',
      customerLabel: 'María López',
    })
  })

  it('the open slideover follows the refreshed refund after a partial return', async () => {
    const wrapper = mountView()
    await wrapper.findAll('[data-testid="sale-refund"]')[1]!.get('[data-testid="sale-refund-settle"]').trigger('click')
    detail.sale.value = {
      ...canceled,
      refunds: canceled.refunds!.map((refund) =>
        refund.outstandingCents > 0 ? { ...refund, settledCents: 56500, outstandingCents: 36410 } : refund,
      ),
    }
    await flushPromises()

    expect(wrapper.findComponent({ name: 'SettleRefundSlideover' }).props('refund')).toMatchObject({
      id: 'cmw2iwsdh0001r965z1rmw0n0',
      outstandingCents: 36410,
    })
  })

  it('without SaleRefund update there is no «Liquidar» and no slideover', () => {
    grants.value.delete('update:SaleRefund')
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="sale-refund-settle"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'SettleRefundSlideover' }).exists()).toBe(false)
  })

  it('locks the seller with a short reason and hides the receipt and seller actions', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="assign-seller"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="seller-locked"]').text()).toBe('La venta está cancelada.')
    expect(actionLabels(wrapper)).toEqual([])
    expect(wrapper.find('[aria-label="Más acciones de la venta"]').exists()).toBe(false)
  })

  it('shows the payments without the reference editor', () => {
    expect(mountView().findComponent({ name: 'PaymentsListSection' }).props('readonly')).toBe(true)
  })

  it('a confirmed sale keeps its badges and has no cancellation or refunds block', () => {
    const wrapper = mountView(confirmed)
    expect(wrapper.find('[data-testid="sale-detail-cancellation"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sale-detail-refunds"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="assign-seller"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'PaymentsListSection' }).props('readonly')).toBe(false)
    expect(actionLabels(wrapper)).toContain('Recibo A4')
  })

  it('a cancelled sale with nothing paid says there is nothing to return', () => {
    const block = mountView({ ...canceled, refunds: [] }).get('[data-testid="sale-detail-refunds"]')
    expect(block.text()).toContain('No hay dinero por devolver.')
  })
})
