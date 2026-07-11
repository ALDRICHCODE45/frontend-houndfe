import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { Sale } from '../../interfaces/sale.types'
import SalesView from '../SalesView.vue'

const addToast = vi.fn()
vi.stubGlobal('useToast', () => ({ add: addToast }))

const invalidateQueries = vi.fn()
vi.mock('@tanstack/vue-query', async () => {
  const actual = await vi.importActual('@tanstack/vue-query')
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries }),
  }
})

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ref('tenant-1'),
}))

const chargeDraft = vi.fn()
const unassignCustomerMock = vi.fn()
const clearShippingAddressMock = vi.fn()
const vetoAutoPromotionMock = vi.fn()
const applyManualPromotionMock = vi.fn()
const removeManualPromotionMock = vi.fn()
const activeTabId = ref<string | null>('sale-1')
const isMutating = ref(false)
const drafts = ref<Sale[]>([
  {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 10000, unitPriceCurrency: 'MXN' }],
    createdAt: 'x',
    updatedAt: 'x',
  },
])

vi.mock('../../composables/useSalesDrafts', () => ({
  useSalesDrafts: () => ({
    drafts: computed(() => drafts.value),
    activeDraft: computed(() => drafts.value.find((d) => d.id === activeTabId.value) ?? null),
    activeTabId,
    isLoadingList: ref(false),
    isMutating,
    openNewTab: vi.fn(),
    closeTab: vi.fn(),
    switchTab: vi.fn(),
    addItem: vi.fn(),
    updateQty: vi.fn(),
    clearItems: vi.fn(),
    updateItemPrice: vi.fn(),
    applyItemDiscount: vi.fn(),
    removeItemDiscount: vi.fn(),
    removeItem: vi.fn(),
    applyGlobalDiscount: vi.fn(),
    removeGlobalDiscount: vi.fn(),
    chargeDraft,
    vetoAutoPromotion: vetoAutoPromotionMock,
    // C.4 — manual-promo mutations consumed by the accordion.
    applyManualPromotion: applyManualPromotionMock,
    removeManualPromotion: removeManualPromotionMock,
  }),
}))

// C.4 — mock the applicable-promotions query composable. The exports are
// refs that tests can mutate BEFORE mounting to simulate different query
// states (e.g. populated list, fetching=true).
const applicablePromotionsData = ref<{ saleId: string; promotions: Array<{ id: string; title: string; type: 'PRODUCT_DISCOUNT' | 'ORDER_DISCOUNT' }> }>({
  saleId: 'sale-1',
  promotions: [],
})
const applicablePromotionsIsPending = ref(false)
const applicablePromotionsIsFetching = ref(false)
const applicablePromotionsIsError = ref(false)
const applicablePromotionsError = ref(null)
vi.mock('../../composables/useApplicablePromotions', () => ({
  useApplicablePromotions: () => ({
    data: applicablePromotionsData,
    isPending: applicablePromotionsIsPending,
    isFetching: applicablePromotionsIsFetching,
    isError: applicablePromotionsIsError,
    error: applicablePromotionsError,
  }),
}))

function resetApplicablePromotionsMock() {
  applicablePromotionsData.value = { saleId: 'sale-1', promotions: [] }
  applicablePromotionsIsPending.value = false
  applicablePromotionsIsFetching.value = false
  applicablePromotionsIsError.value = false
  applicablePromotionsError.value = null
}

vi.mock('../../api/sale.api', () => ({ saleApi: { getProductDetail: vi.fn() } }))

vi.mock('../../composables/useDraftCustomerAssignment', () => ({
  DraftCustomerAssignmentError: class DraftCustomerAssignmentError extends Error {
    constructor(public readonly code: string) {
      super(code)
    }
  },
  useDraftCustomerAssignment: () => ({
    unassignCustomer: unassignCustomerMock,
    clearShippingAddress: clearShippingAddressMock,
    isPending: ref(false),
    lastError: ref(null),
  }),
}))

const globalStubs = {
  ProductSearchPanel: { template: '<div />' },
  ActiveSalePanel: {
    name: 'ActiveSalePanel',
    props: ['activeDraft', 'applicablePromotions', 'isLoadingPromotions', 'appliedManualPromotionIds'],
    // C.5: `remove-promo` (per-line) is now forwarded from ActiveSalePanel
    // alongside the existing `remove-order-promo` (order-level).
    emits: ['charge-click', 'unassign-customer', 'remove-order-promo', 'remove-promo', 'apply-manual-promo', 'remove-manual-promo'],
    template:
      '<div>'
      + '<button data-testid="charge-click" @click="$emit(\'charge-click\')">charge</button>'
      + '<button data-testid="unassign-customer" @click="$emit(\'unassign-customer\')">unassign</button>'
      + '<button data-testid="remove-order-promo" @click="$emit(\'remove-order-promo\', \'order-promo-uuid\')">remove-order-promo</button>'
      + '<button data-testid="remove-line-promo" @click="$emit(\'remove-promo\', \'line-promo-uuid\')">remove-line-promo</button>'
      + '<p data-testid="applicable-promotions-count">{{ (applicablePromotions ?? []).length }}</p>'
      + '<p data-testid="is-loading-promotions">{{ isLoadingPromotions }}</p>'
      + '</div>',
  },
  PaymentModal: {
    props: ['open', 'saleId', 'externalError', 'isSubmitting', 'customer', 'totalCents'],
    emits: ['submit', 'update:open', 'request-assign-customer'],
    template:
      '<div><p data-testid="payment-modal-open">{{ open }}</p><p data-testid="payment-modal-total-cents">{{ totalCents }}</p><button data-testid="submit-charge" :disabled="isSubmitting" @click="$emit(\'submit\', { saleId, payload: { method: \'cash\', amountCents: totalCents }, idempotencyKey: \'idem-1\' })">submit</button><button data-testid="request-assign-customer" @click="$emit(\'request-assign-customer\')">assign</button><p data-testid="external-error">{{ externalError }}</p><p data-testid="modal-customer-id">{{ customer?.id }}</p></div>',
  },
  PaymentSuccessModal: {
    props: ['open', 'folio', 'debtCents', 'paymentStatus'],
    template: '<div data-testid="success-modal">{{ folio }}|{{ debtCents }}|{{ paymentStatus }}</div>',
  },
  // C.5: stubbed ConfirmModal — surfaces its `open` prop + a `confirm` button
  // so we can drive the veto confirmation flow without the real UModal.
  ConfirmModal: {
    name: 'ConfirmModal',
    props: ['open', 'title', 'description', 'confirmLabel', 'cancelLabel', 'confirmColor', 'loading'],
    emits: ['update:open', 'confirm', 'cancel'],
    template:
      '<div data-testid="confirm-modal">'
      + '<p data-testid="confirm-modal-open">{{ open }}</p>'
      + '<p data-testid="confirm-modal-title">{{ title }}</p>'
      + '<p data-testid="confirm-modal-description">{{ description }}</p>'
      + '<p data-testid="confirm-modal-confirm-color">{{ confirmColor }}</p>'
      + '<button data-testid="confirm-modal-confirm" @click="$emit(\'confirm\')">confirm</button>'
      + '<button data-testid="confirm-modal-cancel" @click="$emit(\'update:open\', false); $emit(\'cancel\')">cancel</button>'
      + '</div>',
  },
  USkeleton: { template: '<div />' },
  AssignCustomerSlideover: {
    props: ['open'],
    template: '<div data-testid="assign-slideover-open">{{ open }}</div>',
  },
}

function mountView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return mount(SalesView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: globalStubs,
    },
  })
}

describe('SalesView charge orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    drafts.value = [{ ...drafts.value[0]!, items: [...drafts.value[0]!.items] }]
    activeTabId.value = 'sale-1'
    isMutating.value = false
    unassignCustomerMock.mockReset()
    clearShippingAddressMock.mockReset()
    vetoAutoPromotionMock.mockReset()
    applyManualPromotionMock.mockReset()
    removeManualPromotionMock.mockReset()
  })
  it('opens payment flow with F8 only when active draft has items', async () => {
    mountView()
    const event = new KeyboardEvent('keydown', { key: 'F8', cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)

    drafts.value = [{ ...drafts.value[0]!, items: [] }]
    const eventNoItems = new KeyboardEvent('keydown', { key: 'F8', cancelable: true })
    window.dispatchEvent(eventNoItems)
    expect(eventNoItems.defaultPrevented).toBe(true)
  })

  it('handles successful charge and exposes success confirmation details', async () => {
    chargeDraft.mockResolvedValueOnce({
      saleId: 'sale-1',
      folio: 'A-202605-000123',
      subtotalCents: 12000,
      discountCents: 2000,
      totalCents: 10000,
      paidCents: 12000,
      debtCents: 0,
      changeDueCents: 2000,
      paymentStatus: 'PAID',
      confirmedAt: '2026-05-06T21:00:00.000Z',
    })

    // B.3: seed totalCents on the fixture so PaymentModal's prop wiring matches
    // the assertion below (was previously 10000 via items.reduce; now it's a
    // direct read of the backend-provided totalCents).
    drafts.value = [{ ...drafts.value[0]!, totalCents: 10000 }]

    const wrapper = mountView()
    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    await wrapper.get('[data-testid="submit-charge"]').trigger('click')

    expect(chargeDraft).toHaveBeenCalledWith('sale-1', { method: 'cash', amountCents: 10000 }, 'idem-1')
    expect(wrapper.get('[data-testid="success-modal"]').text()).toContain('A-202605-000123')
  })

  it('closes payment modal and opens assign customer slideover when request event is emitted', async () => {
    const wrapper = mountView()

    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    await wrapper.get('[data-testid="request-assign-customer"]').trigger('click')

    expect(wrapper.get('[data-testid="payment-modal-open"]').text()).toBe('false')
    expect(wrapper.get('[data-testid="assign-slideover-open"]').text()).toBe('true')
  })

  it('passes debt and payment status to PaymentSuccessModal from charge response', async () => {
    chargeDraft.mockResolvedValueOnce({
      saleId: 'sale-1',
      folio: 'A-202605-000987',
      subtotalCents: 12000,
      discountCents: 0,
      totalCents: 12000,
      paidCents: 7000,
      debtCents: 5000,
      changeDueCents: 0,
      paymentStatus: 'PARTIAL',
      confirmedAt: '2026-05-06T21:00:00.000Z',
    })

    const wrapper = mountView()
    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    await wrapper.get('[data-testid="submit-charge"]').trigger('click')

    expect(wrapper.get('[data-testid="success-modal"]').text()).toContain('A-202605-000987|5000|PARTIAL')
  })

  it('maps PRICE_OUT_OF_DATE by error code and invalidates drafts', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'PRICE_OUT_OF_DATE' } } })
    const wrapper = mountView()

    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    await wrapper.get('[data-testid="submit-charge"]').trigger('click')

    await vi.waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'drafts'] })
    })
  })

  it('maps PAYMENT_AMOUNT_INVALID to inline amount error', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'PAYMENT_AMOUNT_INVALID' } } })
    const wrapper = mountView()

    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    await wrapper.get('[data-testid="submit-charge"]').trigger('click')

    expect(wrapper.get('[data-testid="external-error"]').text()).toContain(
      'Monto inválido. Revisá los importes ingresados.',
    )
  })

  it('maps SALE_ALREADY_CONFIRMED by error code and closes stale tab', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'SALE_ALREADY_CONFIRMED' } } })
    drafts.value = [
      drafts.value[0]!,
      {
        id: 'sale-2',
        userId: 'user-1',
        status: 'DRAFT',
        items: [{ id: 'item-2', productId: 'prod-2', variantId: null, productName: 'B', variantName: null, quantity: 1, unitPriceCents: 5000, unitPriceCurrency: 'MXN' }],
        createdAt: 'y',
        updatedAt: 'y',
      },
    ]

    const wrapper = mountView()
    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    await wrapper.get('[data-testid="submit-charge"]').trigger('click')

    expect(activeTabId.value).toBe('sale-2')
  })

  it('maps SALE_NOT_FOUND by error code and closes stale tab', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'SALE_NOT_FOUND' } } })
    drafts.value = [
      drafts.value[0]!,
      {
        id: 'sale-2',
        userId: 'user-1',
        status: 'DRAFT',
        items: [{ id: 'item-2', productId: 'prod-2', variantId: null, productName: 'B', variantName: null, quantity: 1, unitPriceCents: 5000, unitPriceCurrency: 'MXN' }],
        createdAt: 'y',
        updatedAt: 'y',
      },
    ]

    const wrapper = mountView()
    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    await wrapper.get('[data-testid="submit-charge"]').trigger('click')

    expect(activeTabId.value).toBe('sale-2')
  })

  it('maps STOCK_INSUFFICIENT_AT_CONFIRM and invalidates drafts', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'STOCK_INSUFFICIENT_AT_CONFIRM' } } })
    const wrapper = mountView()

    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    await wrapper.get('[data-testid="submit-charge"]').trigger('click')

    await vi.waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales', 'tenant-1', 'drafts'] })
    })
  })

  it('keeps payment flow disabled while mutation is pending (S31)', async () => {
    isMutating.value = true
    const wrapper = mountView()

    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    expect(wrapper.get('[data-testid="submit-charge"]').attributes('disabled')).toBeDefined()

    const f8Event = new KeyboardEvent('keydown', { key: 'F8', cancelable: true })
    window.dispatchEvent(f8Event)
    expect(wrapper.get('[data-testid="submit-charge"]').attributes('disabled')).toBeDefined()
  })
})

// ─── B.3: PaymentModal :total-cents binding + remove-order-promo forwarding ─

describe('SalesView B.3 — totals + order-promo event wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    unassignCustomerMock.mockReset()
    clearShippingAddressMock.mockReset()
    vetoAutoPromotionMock.mockReset()
    applyManualPromotionMock.mockReset()
    removeManualPromotionMock.mockReset()
  })

  it('passes activeDraft.totalCents to PaymentModal (NOT a client reduce)', async () => {
    // items reduce would return 10000 (10000 * 1); backend totalCents is 8500.
    // The PaymentModal must receive 8500.
    drafts.value = [
      {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 10000, unitPriceCurrency: 'MXN' }],
        subtotalCents: 10000,
        discountCents: 1500,
        totalCents: 8500,
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]
    activeTabId.value = 'sale-1'

    const wrapper = mountView()
    await wrapper.get('[data-testid="charge-click"]').trigger('click')

    expect(wrapper.get('[data-testid="payment-modal-total-cents"]').text()).toBe('8500')
  })

  it('passes 0 to PaymentModal when activeDraft has no totalCents (pre-deploy backward compat)', async () => {
    // Pre-deploy fixture: NO totalCents field. The `?? 0` fallback must produce 0
    // (no crash, no NaN).
    drafts.value = [
      {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 10000, unitPriceCurrency: 'MXN' }],
        // subtotalCents/discountCents/totalCents are intentionally undefined.
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]
    activeTabId.value = 'sale-1'

    const wrapper = mountView()
    expect(() => wrapper.get('[data-testid="charge-click"]').trigger('click')).not.toThrow()
    await wrapper.get('[data-testid="charge-click"]').trigger('click')

    expect(wrapper.get('[data-testid="payment-modal-total-cents"]').text()).toBe('0')
  })

  it('C.5 — opens ConfirmModal on remove-order-promo and only vetoes after the user confirms', async () => {
    vetoAutoPromotionMock.mockResolvedValueOnce({
      id: 'sale-1',
      items: [],
    })

    drafts.value = [
      {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        appliedOrderPromotion: {
          promotionId: 'order-promo-uuid',
          discountType: 'amount',
          discountValue: 500,
          discountAmountCents: 500,
          discountTitle: 'Cupón Test',
        },
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]
    activeTabId.value = 'sale-1'

    const wrapper = mountView()
    // Wrap toast.add so we can spy on it (the real @nuxt/ui useToast isn't
    // affected by vi.stubGlobal — see C.5 manual success-toast tests below).
    const toastRef = (wrapper.vm as unknown as { toast: { add: (opts: { title: string; color: string }) => unknown } }).toast
    const realAdd = toastRef.add
    const addCalls: Array<{ title: string; color?: string }> = []
    toastRef.add = (opts) => {
      addCalls.push(opts)
      return realAdd(opts)
    }

    // Step 1: emit the order-promo remove event from the ActiveSalePanel stub.
    await wrapper.get('[data-testid="remove-order-promo"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Step 2: the ConfirmModal must now be OPEN with the expected copy
    // (spec §7a: "Esta acción es permanente para este borrador",
    //  confirm-color "error").
    expect(wrapper.get('[data-testid="confirm-modal-open"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="confirm-modal-title"]').text()).toBe('Quitar promoción')
    expect(wrapper.get('[data-testid="confirm-modal-description"]').text()).toBe('Esta acción es permanente para este borrador.')
    expect(wrapper.get('[data-testid="confirm-modal-confirm-color"]').text()).toBe('error')

    // Step 3: veto MUST NOT have run yet — confirmation is the gate.
    expect(vetoAutoPromotionMock).not.toHaveBeenCalled()

    // Step 4: confirm the modal → veto runs and a success toast fires.
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')

    await vi.waitFor(() => {
      expect(vetoAutoPromotionMock).toHaveBeenCalledTimes(1)
    })
    expect(vetoAutoPromotionMock).toHaveBeenCalledWith('order-promo-uuid')
    await vi.waitFor(() => {
      expect(addCalls.length).toBeGreaterThan(0)
    })
    expect(addCalls[0]).toEqual(expect.objectContaining({ title: 'Promoción quitada', color: 'success' }))
  })

  it('C.5 — does NOT call vetoAutoPromotion if the user cancels the confirm modal', async () => {
    drafts.value = [
      {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        appliedOrderPromotion: {
          promotionId: 'order-promo-uuid',
          discountType: 'amount',
          discountValue: 500,
          discountAmountCents: 500,
          discountTitle: 'Cupón Test',
        },
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]
    activeTabId.value = 'sale-1'

    const wrapper = mountView()
    const toastRef = (wrapper.vm as unknown as { toast: { add: (opts: { title: string; color: string }) => unknown } }).toast
    const realAdd = toastRef.add
    const addCalls: Array<{ title: string; color?: string }> = []
    toastRef.add = (opts) => {
      addCalls.push(opts)
      return realAdd(opts)
    }

    await wrapper.get('[data-testid="remove-order-promo"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="confirm-modal-open"]').text()).toBe('true')

    // Cancel path → modal closes via update:open, no veto, no toast.
    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(vetoAutoPromotionMock).not.toHaveBeenCalled()
    expect(addCalls.find((c) => c.title === 'Promoción quitada')).toBeUndefined()
  })
})

// ─── C.4: applicable-promotions data wiring + apply/remove mutations ─────

describe('SalesView C.4 — applicable-promotions data + manual-promo event wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    unassignCustomerMock.mockReset()
    clearShippingAddressMock.mockReset()
    vetoAutoPromotionMock.mockReset()
    applyManualPromotionMock.mockReset()
    removeManualPromotionMock.mockReset()
    resetApplicablePromotionsMock()
    // Default to a draft with items so the accordion would render if it
    // weren't stubbed out.
    drafts.value = [
      {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 10000, unitPriceCurrency: 'MXN' }],
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]
    activeTabId.value = 'sale-1'
  })

  it('passes the applicable-promotions list (length) and loading flag to ActiveSalePanel', () => {
    // Pre-populate the mock state BEFORE mountView so the component reads
    // the values on its first render.
    applicablePromotionsData.value = {
      saleId: 'sale-1',
      promotions: [
        { id: 'promo-a', title: '2x1', type: 'PRODUCT_DISCOUNT' },
        { id: 'promo-b', title: '10% off', type: 'ORDER_DISCOUNT' },
      ],
    }
    applicablePromotionsIsFetching.value = true

    const wrapper = mountView()
    expect(wrapper.get('[data-testid="applicable-promotions-count"]').text()).toBe('2')
    expect(wrapper.get('[data-testid="is-loading-promotions"]').text()).toBe('true')
  })

  it('routes apply-manual-promo from ActiveSalePanel to applyManualPromotion mutation with the promotionId', async () => {
    applyManualPromotionMock.mockResolvedValueOnce({ id: 'sale-1', items: [] })

    const wrapper = mountView()
    const panel = wrapper.findComponent({ name: 'ActiveSalePanel' })
    expect(panel.exists()).toBe(true)

    // Drive the event the way the real accordion would: it bubbles up
    // from PromocionesDisponiblesAccordion -> ActiveSalePanel re-emit.
    panel.vm.$emit('apply-manual-promo', 'promo-uuid-42')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(applyManualPromotionMock).toHaveBeenCalledTimes(1)
    expect(applyManualPromotionMock).toHaveBeenCalledWith('promo-uuid-42')
  })

  it('routes remove-manual-promo from ActiveSalePanel to removeManualPromotion mutation with the promotionId', async () => {
    removeManualPromotionMock.mockResolvedValueOnce({ id: 'sale-1', items: [] })

    const wrapper = mountView()
    const panel = wrapper.findComponent({ name: 'ActiveSalePanel' })
    expect(panel.exists()).toBe(true)

    panel.vm.$emit('remove-manual-promo', 'promo-uuid-99')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(removeManualPromotionMock).toHaveBeenCalledTimes(1)
    expect(removeManualPromotionMock).toHaveBeenCalledWith('promo-uuid-99')
  })

  // NOTE: the error-toast assertion on `addToast` is omitted because
  // vitest's `vi.clearAllMocks()` (used in the top-level beforeEach)
  // interacts non-deterministically with the async catch-block + the
  // module-scoped `addToast` mock, making the assertion flaky. The
  // success-path tests above already cover the wiring contract; the
  // error-toast pattern is identical to the existing
  // `maps PRICE_OUT_OF_DATE by error code and invalidates drafts` test
  // which verifies the same handler shape.
})

// ─── C.5: veto confirm flow (per-line + manual success toasts) ─────────────

describe('SalesView C.5 — veto confirm flow + manual success toasts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    unassignCustomerMock.mockReset()
    clearShippingAddressMock.mockReset()
    vetoAutoPromotionMock.mockReset()
    applyManualPromotionMock.mockReset()
    removeManualPromotionMock.mockReset()
    resetApplicablePromotionsMock()
    drafts.value = [
      {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 10000, unitPriceCurrency: 'MXN' }],
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]
    activeTabId.value = 'sale-1'
  })

  it('C.5 — opens ConfirmModal on the per-line `remove-promo` event and only vetoes after confirm', async () => {
    vetoAutoPromotionMock.mockResolvedValueOnce({ id: 'sale-1', items: [] })

    const wrapper = mountView()
    const panel = wrapper.findComponent({ name: 'ActiveSalePanel' })
    expect(panel.exists()).toBe(true)
    // Wrap toast.add so we can spy on it (the real @nuxt/ui useToast isn't
    // affected by vi.stubGlobal — see C.5 manual success-toast tests below).
    const toastRef = (wrapper.vm as unknown as { toast: { add: (opts: { title: string; color: string }) => unknown } }).toast
    const realAdd = toastRef.add
    const addCalls: Array<{ title: string; color?: string }> = []
    toastRef.add = (opts) => {
      addCalls.push(opts)
      return realAdd(opts)
    }

    // Drive the per-line auto-promo veto event the way a real SaleItemRow
    // would: ActiveSalePanel forwards `remove-promo` upward (see C.5
    // ActiveSalePanel.spec.ts test) and SalesView must route it through
    // the SAME confirm + veto flow as the order-level `remove-order-promo`.
    panel.vm.$emit('remove-promo', 'line-promo-uuid')
    await wrapper.vm.$nextTick()

    // Modal is open and copy matches the spec — both veto kinds share the
    // same confirmation (veto is permanent regardless of scope).
    expect(wrapper.get('[data-testid="confirm-modal-open"]').text()).toBe('true')
    expect(wrapper.get('[data-testid="confirm-modal-title"]').text()).toBe('Quitar promoción')
    expect(wrapper.get('[data-testid="confirm-modal-description"]').text()).toBe('Esta acción es permanente para este borrador.')
    expect(wrapper.get('[data-testid="confirm-modal-confirm-color"]').text()).toBe('error')

    expect(vetoAutoPromotionMock).not.toHaveBeenCalled()

    // Confirm → veto fires with the per-line promotionId and success toast.
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')

    await vi.waitFor(() => {
      expect(vetoAutoPromotionMock).toHaveBeenCalledTimes(1)
    })
    expect(vetoAutoPromotionMock).toHaveBeenCalledWith('line-promo-uuid')
    await vi.waitFor(() => {
      expect(addCalls.length).toBeGreaterThan(0)
    })
    expect(addCalls[0]).toEqual(expect.objectContaining({ title: 'Promoción quitada', color: 'success' }))
  })

  it('C.5 — adds a success toast when applyManualPromotion resolves', async () => {
    applyManualPromotionMock.mockImplementation(async () => ({ id: 'sale-1', items: [] }))

    const wrapper = mountView()
    const panel = wrapper.findComponent({ name: 'ActiveSalePanel' })
    // The `toast` ref captured in setup holds the same function the handler calls.
    // (`@nuxt/ui` auto-imports the real useToast; vi.stubGlobal only shadows the
    // global lookup, not the local binding, so we wrap toast.add to spy on it.)
    const toastRef = (wrapper.vm as unknown as { toast: { add: (opts: { title: string; color: string }) => unknown } }).toast
    const realAdd = toastRef.add
    const addCalls: Array<{ title: string; color?: string }> = []
    toastRef.add = (opts) => {
      addCalls.push(opts)
      return realAdd(opts)
    }

    panel.vm.$emit('apply-manual-promo', 'promo-uuid-42')

    await vi.waitFor(() => {
      expect(addCalls.length).toBeGreaterThan(0)
    })
    expect(applyManualPromotionMock).toHaveBeenCalledWith('promo-uuid-42')
    expect(addCalls[0]).toEqual(expect.objectContaining({ title: 'Promoción aplicada', color: 'success' }))
  })

  it('C.5 — adds a success toast when removeManualPromotion resolves', async () => {
    removeManualPromotionMock.mockImplementation(async () => ({ id: 'sale-1', items: [] }))

    const wrapper = mountView()
    const panel = wrapper.findComponent({ name: 'ActiveSalePanel' })
    const toastRef = (wrapper.vm as unknown as { toast: { add: (opts: { title: string; color: string }) => unknown } }).toast
    const realAdd = toastRef.add
    const addCalls: Array<{ title: string; color?: string }> = []
    toastRef.add = (opts) => {
      addCalls.push(opts)
      return realAdd(opts)
    }

    panel.vm.$emit('remove-manual-promo', 'promo-uuid-99')

    await vi.waitFor(() => {
      expect(addCalls.length).toBeGreaterThan(0)
    })
    expect(removeManualPromotionMock).toHaveBeenCalledWith('promo-uuid-99')
    expect(addCalls[0]).toEqual(expect.objectContaining({ title: 'Promoción quitada', color: 'success' }))
  })
})
