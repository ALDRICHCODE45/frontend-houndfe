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
  }),
}))

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
    props: ['activeDraft'],
    emits: ['charge-click', 'unassign-customer'],
    template: '<div><button data-testid="charge-click" @click="$emit(\'charge-click\')">charge</button><button data-testid="unassign-customer" @click="$emit(\'unassign-customer\')">unassign</button></div>',
  },
  PaymentModal: {
    props: ['open', 'saleId', 'externalError', 'isSubmitting'],
    emits: ['submit', 'update:open'],
    template:
      '<div><button data-testid="submit-charge" :disabled="isSubmitting" @click="$emit(\'submit\', { saleId, payload: { method: \'cash\', amountCents: 10000 }, idempotencyKey: \'idem-1\' })">submit</button><p data-testid="external-error">{{ externalError }}</p></div>',
  },
  PaymentSuccessModal: {
    props: ['open', 'folio'],
    template: '<div data-testid="success-modal">{{ folio }}</div>',
  },
  USkeleton: { template: '<div />' },
  AssignCustomerSlideover: { template: '<div />' },
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

    const wrapper = mountView()
    await wrapper.get('[data-testid="charge-click"]').trigger('click')
    await wrapper.get('[data-testid="submit-charge"]').trigger('click')

    expect(chargeDraft).toHaveBeenCalledWith('sale-1', { method: 'cash', amountCents: 10000 }, 'idem-1')
    expect(wrapper.get('[data-testid="success-modal"]').text()).toContain('A-202605-000123')
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
