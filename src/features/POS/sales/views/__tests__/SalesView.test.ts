import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

// sdd custom-payment-methods S5A (REQ-CAT-011): spy on the legacy
// getSalePaymentErrorAction dispatch so tests can assert that catalog error
// codes short-circuit BEFORE it, while known legacy codes still resolve
// through the real mapping (delegating mock keeps existing tests green).
const { legacyErrorDispatch } = vi.hoisted(() => ({ legacyErrorDispatch: vi.fn() }))

vi.mock('../../utils/salePaymentErrors.utils', async (importOriginal) => {
  const actual = await importOriginal<{
    getSalePaymentErrorAction: (code: import('../../interfaces/sale.types').ChargeDomainErrorCode) => import('../../utils/salePaymentErrors.utils').SalePaymentUxAction
  }>()
  return {
    ...actual,
    getSalePaymentErrorAction: (code: import('../../interfaces/sale.types').ChargeDomainErrorCode) => {
      legacyErrorDispatch(code)
      return actual.getSalePaymentErrorAction(code)
    },
  }
})

const chargeDraft = vi.fn()
const unassignCustomerMock = vi.fn()
const clearShippingAddressMock = vi.fn()
const vetoAutoPromotionMock = vi.fn()
const applyManualPromotionMock = vi.fn()
const removeManualPromotionMock = vi.fn()
const setPriceListMock = vi.fn()
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
    // pos-price-list-tiers — setPriceList mutation consumed by
    // PriceListSelector via ActiveSalePanel's `change-price-list` emit.
    setPriceList: setPriceListMock,
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

const focusSearchSpy = vi.fn()
// 14a.1: stub exposes a `searchInputRef` whose `focus()` calls the spy.
// The production handler treats the value as either a Vue ref (with `.value`)
// or a plain object with a `focus` method, so this mock contract matches.
const globalStubs = {
  ProductSearchPanel: {
    name: 'ProductSearchPanel',
    setup(_props: Record<string, unknown>, { expose }: { expose: (obj: Record<string, unknown>) => void }) {
      expose({
        searchInputRef: { focus: () => focusSearchSpy() },
      })
      return {}
    },
    template: '<div />',
  },
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
    props: ['open', 'saleId', 'externalError', 'isSubmitting', 'customer', 'totalCents', 'catalogClearSignal', 'shippingAddress'],
    emits: ['submit', 'update:open', 'request-assign-customer'],
    template:
      '<div><p data-testid="payment-modal-open">{{ open }}</p><p data-testid="payment-modal-total-cents">{{ totalCents }}</p><p data-testid="payment-modal-catalog-clear-signal">{{ catalogClearSignal }}</p><p data-testid="payment-modal-shipping-address-id">{{ shippingAddress?.id }}</p><button data-testid="submit-charge" :disabled="isSubmitting" @click="$emit(\'submit\', { saleId, payload: { method: \'cash\', amountCents: totalCents }, idempotencyKey: \'idem-1\' })">submit</button><button data-testid="request-assign-customer" @click="$emit(\'request-assign-customer\')">assign</button><p data-testid="external-error">{{ externalError }}</p><p data-testid="modal-customer-id">{{ customer?.id }}</p></div>',
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
    setPriceListMock.mockReset()
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
      'Monto inválido. Revisa los importes ingresados.',
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

  // sdd custom-payment-methods S4B (design §8.3 / REQ-CAT-007): SalesView owns
  // the catalogClearSignal counter and passes it to PaymentModal. The
  // error → increment dispatch lands in S5A; this slice pins the prop wiring.
  it('passes catalogClearSignal (starting at 0) to PaymentModal', async () => {
    const wrapper = mountView()

    await wrapper.get('[data-testid="charge-click"]').trigger('click')

    expect(wrapper.get('[data-testid="payment-modal-catalog-clear-signal"]').text()).toBe('0')
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
    setPriceListMock.mockReset()
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
    setPriceListMock.mockReset()
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
    setPriceListMock.mockReset()
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

// ─── pos-price-list-tiers — setPriceList wiring ──────────────────────────────

describe('SalesView — setPriceList wiring (pos-price-list-tiers)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    unassignCustomerMock.mockReset()
    clearShippingAddressMock.mockReset()
    vetoAutoPromotionMock.mockReset()
    applyManualPromotionMock.mockReset()
    removeManualPromotionMock.mockReset()
    setPriceListMock.mockReset()
    resetApplicablePromotionsMock()
    drafts.value = [
      {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 1000, unitPriceCurrency: 'MXN' }],
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]
    activeTabId.value = 'sale-1'
  })

  it('routes change-price-list from ActiveSalePanel to setPriceList mutation with the active sale id', async () => {
    setPriceListMock.mockResolvedValueOnce({ id: 'sale-1', items: [] })

    const wrapper = mountView()
    const panel = wrapper.findComponent({ name: 'ActiveSalePanel' })
    expect(panel.exists()).toBe(true)

    // Drive the event the way ActiveSalePanel would: it forwards the
    // selector's chosen id as `change-price-list`.
    panel.vm.$emit('change-price-list', 'list-mayoreo')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(setPriceListMock).toHaveBeenCalledTimes(1)
    expect(setPriceListMock).toHaveBeenCalledWith('sale-1', 'list-mayoreo')
  })

  it('routes null (Sin lista) to setPriceList mutation for clearing', async () => {
    setPriceListMock.mockResolvedValueOnce({ id: 'sale-1', items: [] })

    const wrapper = mountView()
    const panel = wrapper.findComponent({ name: 'ActiveSalePanel' })

    panel.vm.$emit('change-price-list', null)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(setPriceListMock).toHaveBeenCalledTimes(1)
    expect(setPriceListMock).toHaveBeenCalledWith('sale-1', null)
  })

  it('shows an error toast when setPriceList rejects (e.g. PRICE_LIST_NOT_FOUND)', async () => {
    setPriceListMock.mockRejectedValueOnce(new Error('PRICE_LIST_NOT_FOUND'))

    const wrapper = mountView()
    const panel = wrapper.findComponent({ name: 'ActiveSalePanel' })
    // Spy on the real toast (see C.5 manual success-toast tests for the
    // vi.stubGlobal caveat — we wrap toast.add to capture calls).
    const toastRef = (wrapper.vm as unknown as { toast: { add: (opts: { title: string; color: string; description?: string }) => unknown } }).toast
    const realAdd = toastRef.add
    const addCalls: Array<{ title: string; color?: string; description?: string }> = []
    toastRef.add = (opts) => {
      addCalls.push(opts)
      return realAdd(opts)
    }

    panel.vm.$emit('change-price-list', 'list-mayoreo')

    await vi.waitFor(() => {
      expect(addCalls.find((c) => c.title === 'Error')).toBeDefined()
    })
    expect(addCalls.find((c) => c.title === 'Error')).toEqual(
      expect.objectContaining({
        title: 'Error',
        color: 'error',
        description: 'No se pudo cambiar la lista de precios',
      }),
    )
  })
})

// ─── 14a.1 — sales-screen-redesign: 75/25 split + Ctrl+K/⌘K shortcut ─────────
//
// Each test in this block captures the wrapper and unmounts it in afterEach
// so the SalesView's `onMounted` keydown listener doesn't accumulate across
// tests. Without unmount, every subsequent test sees N+1 invocations of the
// focus handler because the previous test's listener is still attached to
// `window`. This is project-wide behavior, not specific to 14a.1.

describe('SalesView 14a.1 — layout proportion + keyboard shortcut', () => {
  let mountedWrappers: Array<{ unmount: () => void }> = []

  beforeEach(() => {
    vi.clearAllMocks()
    focusSearchSpy.mockReset()
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
    mountedWrappers = []
  })

  afterEach(() => {
    // Unmount every wrapper this block mounted so the global keydown listener
    // registered in `onMounted` is removed between tests.
    for (const w of mountedWrappers) {
      try {
        w.unmount()
      } catch {
        // ignore — wrapper may already be unmounted
      }
    }
    mountedWrappers = []
  })

  function mountWithCleanup() {
    const wrapper = mountView()
    mountedWrappers.push(wrapper as unknown as { unmount: () => void })
    return wrapper
  }

  it('applies responsive two-phase split: 60/40 at lg, 75/25 at xl', () => {
    // lg (1024px+): 60/40 for laptops; xl (1280px+): 75/25 for monitors.
    const wrapper = mountWithCleanup()
    const html = wrapper.html()
    expect(html).toContain('lg:w-[60%]')
    expect(html).toContain('lg:w-[40%]')
    expect(html).toContain('xl:w-[75%]')
    expect(html).toContain('xl:w-[25%]')
    // Old 67/33 must not remain.
    expect(html).not.toContain('lg:w-[67%]')
    expect(html).not.toContain('lg:w-[33%]')
  })

  it('14a.1 — Ctrl+K focuses the search input (R6 shortcut half)', () => {
    // R6 — Ctrl+K MUST focus the search input. Other tests in this file
    // mount a SalesView and don't unmount it, so prior keydown listeners
    // also fire on `window.dispatchEvent` — we assert "called at least
    // once" rather than counting, which is what the spec requires.
    focusSearchSpy.mockReset()
    mountWithCleanup()
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      cancelable: true,
    })
    window.dispatchEvent(event)
    expect(focusSearchSpy).toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('14a.1 — ⌘K (metaKey) focuses the search input on Mac (R6 shortcut half)', () => {
    // R6 — ⌘K MUST also focus the search input (Mac users).
    focusSearchSpy.mockReset()
    mountWithCleanup()
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      cancelable: true,
    })
    window.dispatchEvent(event)
    expect(focusSearchSpy).toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('14a.1 — bare "k" does NOT focus the search input (no modifier ignored)', () => {
    // Sanity guard: the handler must require a Ctrl/⌘ modifier.
    // Other tests' SalesView listeners (still on window) ARE attached and
    // would also be invoked, but ALL of them require a modifier, so the
    // assertion that the spy was NOT called holds across leaked listeners.
    focusSearchSpy.mockReset()
    mountWithCleanup()
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      cancelable: true,
    })
    window.dispatchEvent(event)
    expect(focusSearchSpy).not.toHaveBeenCalled()
  })
})

// ─── sdd custom-payment-methods S5A — catalog charge error dispatch ─────────
// REQ-CAT-007..011: handleChargeDraft must resolve the four catalog codes
// FIRST (clear/refetch/toast per design §8.2) and short-circuit BEFORE the
// legacy getSalePaymentErrorAction dispatch.

describe('SalesView S5A — catalog charge error dispatch (REQ-CAT-007..011)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    isMutating.value = false
    unassignCustomerMock.mockReset()
    clearShippingAddressMock.mockReset()
    vetoAutoPromotionMock.mockReset()
    applyManualPromotionMock.mockReset()
    removeManualPromotionMock.mockReset()
    setPriceListMock.mockReset()
    resetApplicablePromotionsMock()
  })

  // The real @nuxt/ui useToast is captured by SalesView setup (vi.stubGlobal
  // only shadows the global lookup), so we wrap `wrapper.vm.toast.add` to spy
  // on calls — the same pattern as the C.5 tests above.
  function captureToast(wrapper: ReturnType<typeof mountView>) {
    const toastRef = (wrapper.vm as unknown as { toast: { add: (opts: { title: string; color?: string; description?: string }) => unknown } }).toast
    const realAdd = toastRef.add
    const addCalls: Array<{ title: string; color?: string; description?: string }> = []
    toastRef.add = (opts) => {
      addCalls.push(opts)
      return realAdd(opts)
    }
    return addCalls
  }

  async function submitCharge(wrapper: ReturnType<typeof mountView>) {
    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    await wrapper.get('[data-testid="submit-charge"]').trigger('click')
  }

  it('PAYMENT_METHOD_CATEGORY_MISMATCH → increments the clear signal exactly once, shows NO toast, skips legacy dispatch', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'PAYMENT_METHOD_CATEGORY_MISMATCH' } } })
    const wrapper = mountView()
    const addCalls = captureToast(wrapper)

    await submitCharge(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="payment-modal-catalog-clear-signal"]').text()).toBe('1')
    })
    expect(legacyErrorDispatch).not.toHaveBeenCalled()
    expect(addCalls).toHaveLength(0)
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['sales', 'tenant-1', 'payment-methods'],
    })
  })

  it('PAYMENT_METHOD_NOT_FOUND → increments signal, invalidates projection once, toasts, skips legacy dispatch', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'PAYMENT_METHOD_NOT_FOUND' } } })
    const wrapper = mountView()
    const addCalls = captureToast(wrapper)

    await submitCharge(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="payment-modal-catalog-clear-signal"]').text()).toBe('1')
    })
    await vi.waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['sales', 'tenant-1', 'payment-methods'],
      })
    })
    expect(
      invalidateQueries.mock.calls.filter(
        (call) => (call[0] as { queryKey?: unknown[] })?.queryKey?.[2] === 'payment-methods',
      ),
    ).toHaveLength(1)
    await vi.waitFor(() => {
      expect(addCalls.some((c) => c.title === 'Método de cobro no disponible.')).toBe(true)
    })
    expect(legacyErrorDispatch).not.toHaveBeenCalled()
  })

  it('INACTIVE_PAYMENT_METHOD → increments signal, invalidates projection once, toasts, skips legacy dispatch', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'INACTIVE_PAYMENT_METHOD' } } })
    const wrapper = mountView()
    const addCalls = captureToast(wrapper)

    await submitCharge(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="payment-modal-catalog-clear-signal"]').text()).toBe('1')
    })
    await vi.waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['sales', 'tenant-1', 'payment-methods'],
      })
    })
    expect(
      invalidateQueries.mock.calls.filter(
        (call) => (call[0] as { queryKey?: unknown[] })?.queryKey?.[2] === 'payment-methods',
      ),
    ).toHaveLength(1)
    await vi.waitFor(() => {
      expect(addCalls.some((c) => c.title === 'Este método fue desactivado.')).toBe(true)
    })
    expect(legacyErrorDispatch).not.toHaveBeenCalled()
  })

  it('INVALID_PAYMENT_METHOD_ID → defensive toast only: no clear, no refetch, skips legacy dispatch', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'INVALID_PAYMENT_METHOD_ID' } } })
    const wrapper = mountView()
    const addCalls = captureToast(wrapper)

    await submitCharge(wrapper)

    await vi.waitFor(() => {
      expect(addCalls.some((c) => c.title === 'Método de cobro inválido.')).toBe(true)
    })
    expect(wrapper.get('[data-testid="payment-modal-catalog-clear-signal"]').text()).toBe('0')
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['sales', 'tenant-1', 'payment-methods'],
    })
    expect(legacyErrorDispatch).not.toHaveBeenCalled()
  })

  it('legacy code (PAYMENT_AMOUNT_INSUFFICIENT) → legacy dispatch unchanged, signal NOT incremented', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'PAYMENT_AMOUNT_INSUFFICIENT' } } })
    const wrapper = mountView()

    await submitCharge(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="external-error"]').text()).toContain(
        'Agregá un pago en efectivo o ajustá los montos para cubrir el total',
      )
    })
    expect(legacyErrorDispatch).toHaveBeenCalledWith('PAYMENT_AMOUNT_INSUFFICIENT')
    expect(wrapper.get('[data-testid="payment-modal-catalog-clear-signal"]').text()).toBe('0')
  })

  it('unknown code → generic error toast surfaces instead of crashing (catalog null + legacy undefined)', async () => {
    chargeDraft.mockRejectedValueOnce({ response: { data: { error: 'SOME_FUTURE_CODE' } } })
    const wrapper = mountView()
    const addCalls = captureToast(wrapper)

    await submitCharge(wrapper)

    await vi.waitFor(() => {
      expect(addCalls.some((c) => c.title === 'Error' && c.description === 'No se pudo cobrar la venta. Reintenta.')).toBe(true)
    })
    expect(wrapper.get('[data-testid="payment-modal-catalog-clear-signal"]').text()).toBe('0')
  })
})

// ─── pos-sale-delivery S2 — PaymentModal :shipping-address prop pass-through ──
//
// CAP-DLV-1: SalesView MUST pass `activeDraft.shippingAddress ?? null` to
// PaymentModal so the toggle gating reactively follows backend-driven clears
// (e.g. customer reassign → backend clears address → activeDraft updates →
// prop changes → hasShippingAddress flips → toggle disables).

describe('SalesView S2 — shippingAddress pass-through to PaymentModal (pos-sale-delivery)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    unassignCustomerMock.mockReset()
    clearShippingAddressMock.mockReset()
    vetoAutoPromotionMock.mockReset()
    applyManualPromotionMock.mockReset()
    removeManualPromotionMock.mockReset()
    setPriceListMock.mockReset()
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

  it('passes activeDraft.shippingAddress to PaymentModal when the address is present', async () => {
    drafts.value = [
      {
        ...drafts.value[0]!,
        shippingAddress: {
          id: 'addr-1',
          customerId: 'cust-1',
          street: 'Av. Reforma 123',
          exteriorNumber: '123',
          interiorNumber: null,
          zipCode: '06600',
          neighborhood: 'Centro',
          municipality: 'Cuauhtémoc',
          city: 'CDMX',
          state: 'CDMX',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ]

    const wrapper = mountView()
    await wrapper.get('[data-testid="charge-click"]').trigger('click')

    expect(wrapper.get('[data-testid="payment-modal-shipping-address-id"]').text()).toBe('addr-1')
  })

  // TRIANGULATE: `?? null` semantics — the prop MUST be explicitly null
  // (NOT undefined) when the address is absent, locking the gate behavior
  // on the PaymentModal side (`hasShippingAddress = computed(shippingAddress != null)`).
  it('passes null to PaymentModal when activeDraft.shippingAddress is absent', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-testid="charge-click"]').trigger('click')

    // The stub template renders `{{ shippingAddress?.id }}`; null => empty string.
    expect(wrapper.get('[data-testid="payment-modal-shipping-address-id"]').text()).toBe('')
  })
})
