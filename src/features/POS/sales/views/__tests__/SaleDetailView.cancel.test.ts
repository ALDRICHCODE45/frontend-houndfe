// PCA-3 (promotion-capacity-alerts): SaleDetailView cancellation action.
//
// Contract asserted here:
//   - The action is rendered ONLY for CONFIRMED sales AND the exact
//     `delete:Sale` permission.
//   - It lives INSIDE the existing action dropdown (mobile-safe) instead of a
//     wide header button, and the trigger carries an honest accessible label
//     now that the menu holds non-PDF actions.
//   - Confirmation uses ConfirmModal with destructive Spanish copy and an
//     error-colored confirm button.
//   - Success closes the modal; failure keeps it open so the user can recover.
//   - Existing receipt PDF behavior/permissions are preserved.
//
// NOTE: `UDropdownMenu` is auto-imported by the Nuxt UI vite plugin, so VTU
// stubs do not intercept it (its items render in a portal only after a click).
// Like the pre-existing SaleDetailView PDF tests, this spec drives the
// `actionItems` wiring directly — the item's `onSelect` IS the click handler.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailView from '../SaleDetailView.vue'

vi.mock('../../api/sale.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sale.api')>()
  return {
    ...actual,
    saleApi: {
      ...actual.saleApi,
      getById: vi.fn(),
      getPdfBlob: vi.fn(),
      cancelSale: vi.fn(),
    },
  }
})

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: {
    getGlobalPriceLists: vi.fn().mockResolvedValue([]),
  },
}))

const addToast = vi.fn()
vi.mock('@nuxt/ui/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nuxt/ui/composables/useToast')>()
  return {
    ...actual,
    useToast: () => ({
      add: addToast,
      update: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      toasts: { value: [] },
    }),
  }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'sale-1' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

const mockSaleDetail = vi.hoisted(() => ({ value: null as unknown }))

vi.mock('../../composables/useSaleDetail', () => ({
  useSaleDetail: () => ({
    sale: computed(() => mockSaleDetail.value),
    isLoading: computed(() => false),
    isError: computed(() => false),
  }),
}))

vi.mock('../../composables/useDebtPayment', () => ({
  useDebtPayment: () => ({
    submit: vi.fn(),
    submitSafe: vi.fn(),
    isSubmitting: computed(() => false),
    externalError: computed(() => null),
    externalErrorCode: computed(() => null),
    shouldClose: computed(() => false),
    resetError: vi.fn(),
  }),
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

vi.mock('../../composables/useSaleComments', () => ({
  useSaleComments: () => ({
    addComment: vi.fn().mockResolvedValue(undefined),
    updateComment: vi.fn().mockResolvedValue(undefined),
    deleteComment: vi.fn().mockResolvedValue(undefined),
    isPending: computed(() => false),
    lastError: computed(() => null),
  }),
}))

vi.mock('../../composables/useUpdatePaymentReference', () => ({
  useUpdatePaymentReference: () => ({
    updateReference: vi.fn(),
    isPending: computed(() => false),
    lastError: computed(() => null),
  }),
}))

vi.mock('../../components/AssignSellerSlideover.vue', () => ({
  default: { template: '<div />', props: ['open', 'saleId'], emits: ['update:open'] },
}))

vi.mock('../../components/PaymentsListSection.vue', () => ({
  default: {
    template: '<div data-testid="payments-list-section" />',
    props: ['payments', 'loading'],
    emits: ['submit'],
  },
}))

const cancelSaleMock = vi.fn()
const cancelPendingRef = ref(false)
vi.mock('../../composables/useSaleCancellation', () => ({
  useSaleCancellation: () => ({
    cancelSale: cancelSaleMock,
    isPending: computed(() => cancelPendingRef.value),
  }),
}))

const userCanMock = vi.hoisted(() =>
  vi.fn<(action: string, subject: string) => boolean>(() => true),
)
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ userCan: userCanMock }),
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

type TestStatus = 'CONFIRMED' | 'DRAFT' | 'CANCELED'

interface TestActionItem {
  label: string
  disabled?: boolean
  color?: string
  onSelect?: () => void
}

function confirmModalStub() {
  return {
    name: 'ConfirmModal',
    props: ['open', 'title', 'description', 'confirmLabel', 'confirmColor', 'loading'],
    emits: ['update:open', 'confirm', 'cancel'],
    template: `
      <div
        data-testid="confirm-modal"
        :data-open="open ? 'true' : 'false'"
        :data-description="description"
        :data-confirm-label="confirmLabel"
        :data-confirm-color="confirmColor"
        :data-loading="loading ? 'true' : 'false'"
      >
        <button data-testid="confirm-modal-confirm" @click="$emit('confirm')">confirm</button>
        <button data-testid="confirm-modal-dismiss" @click="$emit('update:open', false)">dismiss</button>
      </div>
    `,
  }
}

function mountView(status: TestStatus = 'CONFIRMED') {
  mockSaleDetail.value = { ...defaultSale, status }
  return mountWithUApp(SaleDetailView, {
    global: {
      stubs: {
        ConfirmModal: confirmModalStub(),
        DebtPaymentModal: { template: '<div />' },
        AssignSellerSlideover: { template: '<div />' },
        SaleDetailItemsList: { template: '<div />' },
        SaleDetailTotalsCard: { template: '<div />' },
        SaleDetailTimeline: { template: '<div />' },
        SaleCommentInput: { template: '<div />' },
      },
    },
  })
}

type ViewWrapper = ReturnType<typeof mountView>

function actionItems(wrapper: ViewWrapper): TestActionItem[] {
  return (wrapper.vm as unknown as { actionItems: TestActionItem[] }).actionItems
}

function findAction(wrapper: ViewWrapper, label: string): TestActionItem | undefined {
  return actionItems(wrapper).find((item) => item.label === label)
}

async function openCancelModal(wrapper: ViewWrapper) {
  const item = findAction(wrapper, 'Cancelar venta')
  expect(item?.onSelect).toBeTypeOf('function')
  item?.onSelect?.()
  await nextTick()
}

describe('SaleDetailView cancellation (PCA-3)', () => {
  beforeEach(() => {
    mockSaleDetail.value = defaultSale
    addToast.mockReset()
    cancelSaleMock.mockReset()
    cancelSaleMock.mockResolvedValue({
      saleId: 'sale-1',
      status: 'CANCELED',
      refundedCents: 127000,
      restockedItems: [{ productId: 'prod-1', variantId: null, quantity: 1 }],
      canceledAt: '2026-09-21T18:04:11.482Z',
    })
    cancelPendingRef.value = false
    userCanMock.mockReset()
    userCanMock.mockImplementation(() => true)
  })

  it('shows the cancellation action for a CONFIRMED sale with delete:Sale', () => {
    const wrapper = mountView('CONFIRMED')

    expect(findAction(wrapper, 'Cancelar venta')).toBeDefined()
    expect(userCanMock).toHaveBeenCalledWith('delete', 'Sale')
  })

  it('hides the cancellation action for a DRAFT sale', () => {
    const wrapper = mountView('DRAFT')

    expect(findAction(wrapper, 'Cancelar venta')).toBeUndefined()
  })

  it('hides the cancellation action for a CANCELED sale', () => {
    const wrapper = mountView('CANCELED')

    expect(findAction(wrapper, 'Cancelar venta')).toBeUndefined()
  })

  it('hides the cancellation action without the exact delete:Sale permission', () => {
    userCanMock.mockImplementation(
      (action: string, subject: string) => !(action === 'delete' && subject === 'Sale'),
    )

    const wrapper = mountView('CONFIRMED')

    expect(findAction(wrapper, 'Cancelar venta')).toBeUndefined()
  })

  it('keeps the receipt PDF entries alongside the cancel action', () => {
    const wrapper = mountView('CONFIRMED')
    const labels = actionItems(wrapper).map((item) => item.label)

    expect(labels).toContain('Recibo A4')
    expect(labels).toContain('Recibo Ticket')
    expect(labels).toContain('Cancelar venta')
  })

  it('places cancellation in the action dropdown (mobile-safe) with an honest trigger label', () => {
    const wrapper = mountView('CONFIRMED')

    // No new wide header button — the cancel affordance is a dropdown item.
    expect(wrapper.find('[data-testid="cancel-sale-header"]').exists()).toBe(false)
    const cancelItem = findAction(wrapper, 'Cancelar venta')
    expect(cancelItem).toBeDefined()
    expect(cancelItem?.color).toBe('error')

    // The trigger copy is honest now that the menu holds non-PDF actions.
    const trigger = wrapper.find('[aria-label="Acciones de venta"]')
    expect(trigger.exists()).toBe(true)
    expect(wrapper.text()).toContain('Acciones')
  })

  it('opens a destructive confirmation with full-sale Spanish copy and error color', async () => {
    const wrapper = mountView('CONFIRMED')

    expect(wrapper.get('[data-testid="confirm-modal"]').attributes('data-open')).toBe('false')

    await openCancelModal(wrapper)

    const modal = wrapper.get('[data-testid="confirm-modal"]')
    expect(modal.attributes('data-open')).toBe('true')
    const description = (modal.attributes('data-description') ?? '').toLowerCase()
    expect(description).toContain('venta completa')
    expect(description).toContain('stock')
    expect(description).toContain('promocion')
    expect(description).toContain('reembolso parcial')
    expect(modal.attributes('data-confirm-color')).toBe('error')
  })

  it('confirms cancellation through the composable fixed UI path and closes the modal on success', async () => {
    const wrapper = mountView('CONFIRMED')
    await openCancelModal(wrapper)

    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()

    // The view never passes a reason: the composable always sends
    // { reason: 'CUSTOMER_REQUEST' } (pinned by useSaleCancellation.test.ts).
    expect(cancelSaleMock).toHaveBeenCalledTimes(1)
    expect(cancelSaleMock.mock.calls[0]).toEqual([])
    expect(wrapper.get('[data-testid="confirm-modal"]').attributes('data-open')).toBe('false')
  })

  it('keeps the confirmation modal open when cancellation fails', async () => {
    cancelSaleMock.mockResolvedValue(undefined)
    const wrapper = mountView('CONFIRMED')
    await openCancelModal(wrapper)

    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()

    expect(wrapper.get('[data-testid="confirm-modal"]').attributes('data-open')).toBe('true')
  })

  it('does not let the view emit its own success toast (composable owns the authoritative copy)', async () => {
    const wrapper = mountView('CONFIRMED')
    await openCancelModal(wrapper)

    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()

    expect(addToast).not.toHaveBeenCalled()
  })

  it('marks the confirm button as loading while the cancellation is pending', async () => {
    cancelPendingRef.value = true
    const wrapper = mountView('CONFIRMED')
    await openCancelModal(wrapper)

    expect(wrapper.get('[data-testid="confirm-modal"]').attributes('data-loading')).toBe('true')
  })
})
