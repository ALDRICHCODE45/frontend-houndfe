import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import QuotationDetailView from '../QuotationDetailView.vue'
import QuotationItemRow from '../../components/QuotationItemRow.vue'
import QuotationPriceOverrideModal from '../../components/QuotationPriceOverrideModal.vue'
import QuotationExpiryPicker from '../../components/QuotationExpiryPicker.vue'
import QuotationTotalsFooter from '../../components/QuotationTotalsFooter.vue'
import ProductSearchPanel from '@/features/POS/sales/components/ProductSearchPanel.vue'
import type { QuotationResponseDto } from '../../interfaces/quotation.types'
import type { PromotionResponse } from '@/features/POS/promotions/interfaces/promotion.types'

const state = {
  quotation: ref<QuotationResponseDto | undefined>(),
  isLoading: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  createDraft: vi.fn(),
  assignCustomer: vi.fn(),
  changePriceList: vi.fn(),
  addItem: vi.fn(),
  updateQuantity: vi.fn(),
  removeItem: vi.fn(),
  overridePrice: vi.fn(),
  applyManualPromotion: vi.fn(),
  removeManualPromotion: vi.fn(),
  vetoPromotion: vi.fn(),
  unvetoPromotion: vi.fn(),
  setExpiry: vi.fn(),
  clearExpiry: vi.fn(),
  sendQuotation: vi.fn(),
  cancelQuotation: vi.fn(),
}

// quotation.api is mocked so the S7 PDF preview test can intercept the
// getPdfBlob promise without spinning up the real http client. The mock
// factory is hoisted to the top of the file — declare the references in
// `vi.hoisted` so they're available inside the factory closure.
const quotationApiMock = vi.hoisted(() => ({
  getPdfBlob: vi.fn(),
}))
const quotationPdfErrorMock = vi.hoisted(() =>
  class extends Error {
    readonly code: string
    constructor(code: string) {
      super(code)
      this.code = code
      this.name = 'QuotationPdfError'
    }
  },
)
vi.mock('../../api/quotation.api', () => ({
  quotationApi: quotationApiMock,
  QuotationPdfError: quotationPdfErrorMock,
}))

vi.mock('../../composables/useQuotationDetail', () => ({
  useQuotationDetail: () => ({
    quotation: computed(() => state.quotation.value),
    isLoading: computed(() => state.isLoading.value),
    isError: computed(() => state.isError.value),
    error: computed(() => state.error.value),
    createDraft: state.createDraft,
    assignCustomer: state.assignCustomer,
    changePriceList: state.changePriceList,
  }),
}))

vi.mock('../../composables/useQuotationDraft', () => ({
  useQuotationDraft: () => ({
    addItem: state.addItem,
    updateQuantity: state.updateQuantity,
    removeItem: state.removeItem,
    overridePrice: state.overridePrice,
    applyManualPromotion: state.applyManualPromotion,
    removeManualPromotion: state.removeManualPromotion,
    vetoPromotion: state.vetoPromotion,
    unvetoPromotion: state.unvetoPromotion,
    setExpiry: state.setExpiry,
    clearExpiry: state.clearExpiry,
    sendQuotation: state.sendQuotation,
    cancelQuotation: state.cancelQuotation,
  }),
}))

const availablePromotionsMock = vi.hoisted(() => ({
  manual: { promotions: [] as PromotionResponse[], isLoading: false, isError: false },
  automatic: { promotions: [] as PromotionResponse[], isLoading: false, isError: false },
}))

vi.mock('../../composables/useAvailablePromotions', () => ({
  useAvailablePromotions: (_tenantId: unknown, method: 'MANUAL' | 'AUTOMATIC') =>
    method === 'MANUAL'
      ? {
          promotions: computed(() => availablePromotionsMock.manual.promotions),
          isLoading: computed(() => availablePromotionsMock.manual.isLoading),
          isError: computed(() => availablePromotionsMock.manual.isError),
        }
      : {
          promotions: computed(() => availablePromotionsMock.automatic.promotions),
          isLoading: computed(() => availablePromotionsMock.automatic.isLoading),
          isError: computed(() => availablePromotionsMock.automatic.isError),
        },
}))

const route = {
  path: '/pos/cotizaciones/quotation-12345678',
  params: { id: 'quotation-12345678' } as Record<string, string>,
  query: {} as Record<string, string>,
}
const routerPush = vi.fn()

const authMock = {
  userCan: vi.fn((_action: string, _subject: string) => true),
  currentTenantId: 'tenant-1',
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => route,
    useRouter: () => ({ push: routerPush }),
  }
})

function makeQuotation(overrides: Partial<QuotationResponseDto> = {}): QuotationResponseDto {
  return {
    id: 'quotation-12345678',
    customerId: null,
    customer: null,
    globalPriceListId: null,
    priceListExplicitlySet: false,
    status: 'DRAFT',
    expiresAt: '2026-09-01T00:00:00.000Z',
    cancelReason: null,
    canceledAt: null,
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
    manuallyEnded: false,
    items: [],
    appliedPromotions: [],
    vetoedPromotionIds: [],
    optedInManualPromotionIds: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePromotion(overrides: Partial<PromotionResponse> = {}): PromotionResponse {
  return {
    id: 'promo-1',
    title: 'Cupón 10%',
    type: 'ORDER_DISCOUNT',
    method: 'MANUAL',
    status: 'ACTIVE',
    startDate: null,
    endDate: null,
    customerScope: 'ALL',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minPurchaseAmountCents: null,
    appliesTo: null,
    buyQuantity: null,
    getQuantity: null,
    getDiscountPercent: null,
    buyTargetType: null,
    getTargetType: null,
    targetItems: [],
    customers: [],
    priceLists: [],
    daysOfWeek: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

const USelectMenuStub = {
  name: 'USelectMenuStub',
  props: ['modelValue', 'items', 'valueKey', 'loading'],
  emits: ['update:modelValue'],
  template:
    '<div v-bind="$attrs" :data-loading="loading"><slot v-if="(items ?? []).length === 0" name="empty" /><span v-if="(items ?? []).length > 0">{{ items[0].label }}</span></div>',
}

const stubs = {
  StatusDotBadge: {
    props: ['label', 'tone'],
    template: '<span data-testid="status-badge" :data-tone="tone">{{ label }}</span>',
  },
  AssignCustomerSlideover: {
    props: ['open', 'saleId'],
    emits: ['update:open', 'customer-selected'],
    template: '<div v-if="open" data-testid="customer-slideover" />',
  },
  PriceListSelector: {
    props: ['activeDraft', 'isMutating'],
    emits: ['change-price-list', 'request-confirm'],
    template: '<div data-testid="price-list-selector">Lista: {{ activeDraft?.globalPriceListId ?? "PUBLICO" }}</div>',
  },
  QuotationItemRow: {
    props: ['item', 'readonly'],
    emits: ['update-quantity', 'override-price', 'request-remove'],
    template:
      '<div class="quotation-item-row" :data-testid="`quotation-item-row-${item.id}`" :data-readonly="readonly"><span class="row-product">{{ item.product.name }}</span></div>',
  },
  ProductSearchPanel: {
    emits: ['add-product'],
    template: '<div data-testid="product-search-panel" />',
  },
  ConfirmModal: {
    props: ['open', 'title', 'description', 'confirmLabel', 'loading'],
    emits: ['update:open', 'confirm'],
    template:
      '<div v-if="open" data-testid="confirm-modal"><button data-testid="confirm-modal-confirm" type="button" @click="$emit(\'confirm\')">{{ confirmLabel ?? "Confirmar" }}</button><button data-testid="confirm-modal-cancel" type="button" @click="$emit(\'update:open\', false)">Cancelar</button></div>',
  },
  QuotationExpiryPicker: {
    props: ['expiresAt', 'readonly'],
    emits: ['update:expiresAt'],
    template:
      '<div data-testid="quotation-expiry-picker" :data-readonly="readonly"><span data-testid="expiry-display">{{ expiresAt ?? "Sin expiración" }}</span></div>',
  },
  QuotationTotalsFooter: {
    props: ['quotation'],
    template:
      '<div data-testid="quotation-totals-footer"><span data-testid="subtotal-amount">subtotal-stub</span><span data-testid="total-amount">total-stub</span></div>',
  },
  QuotationSendDialog: {
    props: ['quotation', 'open', 'send'],
    emits: ['close', 'sent'],
    template:
      '<div v-if="open" data-testid="quotation-send-dialog"><button data-testid="send-dialog-stub-confirm" type="button" @click="(async () => { await send(true); $emit(\'sent\') })()">stub-send</button><button data-testid="send-dialog-stub-close" type="button" @click="$emit(\'close\')">stub-close</button></div>',
  },
  QuotationCancelDialog: {
    props: ['quotation', 'open', 'cancel'],
    emits: ['close', 'cancelled'],
    template:
      '<div v-if="open" data-testid="quotation-cancel-dialog"><button data-testid="cancel-dialog-stub-confirm" type="button" @click="(async () => { await cancel(\'OTHER\'); $emit(\'cancelled\') })()">stub-cancel</button><button data-testid="cancel-dialog-stub-close" type="button" @click="$emit(\'close\')">stub-close</button></div>',
  },
  // Nuxt UI primitives used by the real QuotationPriceOverrideModal (which is
  // intentionally NOT stubbed — the modal tests drive its input + submit).
  UModal: {
    props: ['open', 'title', 'dismissible', 'close'],
    emits: ['update:open'],
    template: '<div data-testid="price-override-modal"><slot name="body" /><slot name="footer" /></div>',
  },
  Modal: {
    props: ['open', 'title', 'dismissible', 'close'],
    emits: ['update:open'],
    template: '<div data-testid="price-override-modal"><slot name="body" /><slot name="footer" /></div>',
  },
  UButton: {
    props: ['label', 'color', 'variant', 'loading', 'disabled'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  },
  Button: {
    props: ['label', 'color', 'variant', 'loading', 'disabled'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  },
  UFormField: { template: '<div><slot /></div>' },
  FormField: { template: '<div><slot /></div>' },
  UInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  Input: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UAlert: { props: ['description'], template: '<p>{{ description }}</p>' },
  Alert: { props: ['description'], template: '<p>{{ description }}</p>' },
  // USelectMenu (and its non-prefixed alias SelectMenu — the real nuxt/ui
  // component registers under the unprefixed name, so both keys are needed)
  // renders the items count + the #empty slot so the pickers' empty/loading
  // states can be asserted.
  USelectMenu: USelectMenuStub,
  SelectMenu: USelectMenuStub,
}

function mountView() {
  return mount(QuotationDetailView, { global: { stubs } })
}

beforeEach(() => {
  state.quotation.value = makeQuotation()
  authMock.userCan.mockReset().mockReturnValue(true)
  state.isLoading.value = false
  state.isLoading.value = false
  state.isError.value = false
  state.error.value = null
  state.createDraft.mockReset().mockResolvedValue(makeQuotation())
  state.assignCustomer.mockReset().mockResolvedValue(makeQuotation())
  state.changePriceList.mockReset().mockResolvedValue(makeQuotation())
  state.addItem.mockReset().mockResolvedValue(makeQuotation())
  state.updateQuantity.mockReset().mockResolvedValue(makeQuotation())
  state.removeItem.mockReset().mockResolvedValue(makeQuotation())
  state.overridePrice.mockReset().mockResolvedValue(makeQuotation())
  state.applyManualPromotion.mockReset().mockResolvedValue(makeQuotation())
  state.removeManualPromotion.mockReset().mockResolvedValue(makeQuotation())
  state.vetoPromotion.mockReset().mockResolvedValue(makeQuotation())
  state.unvetoPromotion.mockReset().mockResolvedValue(makeQuotation())
  state.setExpiry.mockReset().mockResolvedValue(makeQuotation())
  state.clearExpiry.mockReset().mockResolvedValue(makeQuotation())
  state.sendQuotation.mockReset().mockResolvedValue(makeQuotation())
  state.cancelQuotation.mockReset().mockResolvedValue(makeQuotation())
  quotationApiMock.getPdfBlob.mockReset()
  availablePromotionsMock.manual.promotions = []
  availablePromotionsMock.manual.isLoading = false
  availablePromotionsMock.manual.isError = false
  availablePromotionsMock.automatic.promotions = []
  availablePromotionsMock.automatic.isLoading = false
  availablePromotionsMock.automatic.isError = false
  route.path = '/pos/cotizaciones/quotation-12345678'
  route.params = { id: 'quotation-12345678' }
  route.query = {}
  routerPush.mockReset()
})

describe('QuotationDetailView header', () => {
  it('renders the truncated folio, status badge, expiry, and created date', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Cotización #quotatio')
    expect(wrapper.get('[data-testid="status-badge"]').text()).toBe('Borrador')
    expect(wrapper.get('[data-testid="status-badge"]').attributes('data-tone')).toBe('info')
    expect(wrapper.text()).toContain('Expira')
    expect(wrapper.text()).toContain('Creada')
  })

  it('navigates back to the quotation list', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-testid="back-button"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/cotizaciones')
  })
})

describe('QuotationDetailView customer section', () => {
  it('shows assigned customer name and email', () => {
    state.quotation.value = makeQuotation({
      customerId: 'customer-1',
      customer: {
        id: 'customer-1',
        firstName: 'María',
        lastName: 'Pérez',
        email: 'maria@example.com',
      },
    })

    const wrapper = mountView()
    expect(wrapper.text()).toContain('María Pérez')
    expect(wrapper.text()).toContain('maria@example.com')
  })

  it('shows the assign action for a DRAFT without customer', async () => {
    const wrapper = mountView()
    const button = wrapper.get('[data-testid="assign-customer-button"]')

    expect(button.text()).toContain('Asignar cliente')
    await button.trigger('click')
    expect(wrapper.find('[data-testid="customer-slideover"]').exists()).toBe(true)
  })

  it('shows Sin cliente and hides customer editing for non-DRAFT', () => {
    state.quotation.value = makeQuotation({ status: 'SENT' })
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Sin cliente')
    expect(wrapper.find('[data-testid="assign-customer-button"]').exists()).toBe(false)
  })
})

describe('QuotationDetailView price list and mode switch', () => {
  it('shows the price list selector in DRAFT mode', () => {
    state.quotation.value = makeQuotation({ globalPriceListId: 'MAYOREO' })
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Lista de precios')
    expect(wrapper.find('[data-testid="price-list-selector"]').exists()).toBe(true)
  })

  it('shows the products section with add-product button in DRAFT', () => {
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="items-section"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Productos')
    expect(wrapper.find('[data-testid="add-product-button"]').exists()).toBe(true)
  })

  it('hides edit controls for non-DRAFT quotations', () => {
    state.quotation.value = makeQuotation({ status: 'CANCELLED' })
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="add-product-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="price-list-selector"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Solo lectura')
  })
})

describe('QuotationDetailView create flow', () => {
  it('shows loading and creates a draft with the optional customerId query param', async () => {
    route.path = '/pos/cotizaciones/nueva'
    route.params = {}
    route.query = { customerId: 'customer-9' }
    state.quotation.value = undefined
    let resolveCreate!: (value: QuotationResponseDto) => void
    state.createDraft.mockReturnValue(
      new Promise<QuotationResponseDto>((resolve) => { resolveCreate = resolve }),
    )

    const wrapper = mountView()
    await flushPromises()

    expect(state.createDraft).toHaveBeenCalledWith('customer-9')
    expect(wrapper.find('[data-testid="create-loading"]').exists()).toBe(true)

    resolveCreate(makeQuotation({ id: 'created-9' }))
    await flushPromises()
    expect(wrapper.find('[data-testid="create-loading"]').exists()).toBe(false)
  })

  it('does not create another draft on a detail route', async () => {
    mountView()
    await flushPromises()
    expect(state.createDraft).not.toHaveBeenCalled()
  })
})

describe('QuotationDetailView items section (S5)', () => {
  it('renders an empty-state message when the quotation has no items', () => {
    state.quotation.value = makeQuotation({ items: [] })
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="items-empty-state"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No hay productos en esta cotización')
  })

  it('renders one QuotationItemRow per item', () => {
    state.quotation.value = makeQuotation({
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: null,
              productName: 'Test Product',
        variantName: null,
    quantity: 2,
          product: { id: 'product-1', name: 'Playera M', sku: 'SKU-1', imageUrl: null },
          variant: null,
          unitPriceCents: 15000,
          priceSource: 'PRICE_LIST',
          discountType: null,
          discountValue: null,
          discountAmountCents: 0,
          discountTitle: null,
          promotionId: null,
          manuallyAdjusted: false,
          overrideNote: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
        {
          id: 'item-2',
          productId: 'product-2',
          variantId: null,
              productName: 'Test Product',
        variantName: null,
    quantity: 1,
          product: { id: 'product-2', name: 'Jeans 32', sku: 'SKU-2', imageUrl: null },
          variant: null,
          unitPriceCents: 45000,
          priceSource: 'PRICE_LIST',
          discountType: null,
          discountValue: null,
          discountAmountCents: 0,
          discountTitle: null,
          promotionId: null,
          manuallyAdjusted: false,
          overrideNote: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="quotation-item-row-item-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quotation-item-row-item-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="items-empty-state"]').exists()).toBe(false)
  })

  it('shows the "Agregar producto" button in DRAFT mode', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="add-product-button"]').exists()).toBe(true)
  })

  it('hides the "Agregar producto" button for non-DRAFT quotations', () => {
    state.quotation.value = makeQuotation({ status: 'CANCELLED', items: [] })
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="add-product-button"]').exists()).toBe(false)
  })

  it('opens the product search slideover when "Agregar producto" is clicked', async () => {
    const wrapper = mountView()

    // ProductSearchPanel is gated behind v-if on the USlideover
    expect(wrapper.findComponent(ProductSearchPanel).exists()).toBe(false)
    await wrapper.get('[data-testid="add-product-button"]').trigger('click')
    // After click, the slideover mounts and the ProductSearchPanel inside it
    // becomes findable via findComponent.
    expect(wrapper.findComponent(ProductSearchPanel).exists()).toBe(true)
  })

  it('calls addItem when ProductSearchPanel emits add-product', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-testid="add-product-button"]').trigger('click')

    const panel = wrapper.findComponent(ProductSearchPanel)
    panel.vm.$emit('add-product', 'product-1', null)
    await flushPromises()

    expect(state.addItem).toHaveBeenCalledWith('product-1', 1, undefined)
  })

  it('passes the variant id through to addItem when the panel emits one', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-testid="add-product-button"]').trigger('click')

    const panel = wrapper.findComponent(ProductSearchPanel)
    panel.vm.$emit('add-product', 'product-1', 'variant-7')
    await flushPromises()

    expect(state.addItem).toHaveBeenCalledWith('product-1', 1, 'variant-7')
  })

  it('forwards QuotationItemRow update-quantity events to updateQuantity', async () => {
    state.quotation.value = makeQuotation({
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: null,
              productName: 'Test Product',
        variantName: null,
    quantity: 2,
          product: { id: 'product-1', name: 'Playera M', sku: 'SKU-1', imageUrl: null },
          variant: null,
          unitPriceCents: 15000,
          priceSource: 'PRICE_LIST',
          discountType: null,
          discountValue: null,
          discountAmountCents: 0,
          discountTitle: null,
          promotionId: null,
          manuallyAdjusted: false,
          overrideNote: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    const wrapper = mountView()

    const row = wrapper.findComponent(QuotationItemRow)
    row.vm.$emit('update-quantity', 'item-1', 5)
    expect(state.updateQuantity).toHaveBeenCalledWith('item-1', 5)
  })

  it('opens the confirm modal when QuotationItemRow emits request-remove', async () => {
    state.quotation.value = makeQuotation({
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: null,
              productName: 'Test Product',
        variantName: null,
    quantity: 2,
          product: { id: 'product-1', name: 'Playera M', sku: 'SKU-1', imageUrl: null },
          variant: null,
          unitPriceCents: 15000,
          priceSource: 'PRICE_LIST',
          discountType: null,
          discountValue: null,
          discountAmountCents: 0,
          discountTitle: null,
          promotionId: null,
          manuallyAdjusted: false,
          overrideNote: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
    const row = wrapper.findComponent(QuotationItemRow)
    row.vm.$emit('request-remove', 'item-1')
    await flushPromises()
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(true)
  })

  it('calls removeItem only after the confirm modal is confirmed', async () => {
    state.quotation.value = makeQuotation({
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: null,
              productName: 'Test Product',
        variantName: null,
    quantity: 2,
          product: { id: 'product-1', name: 'Playera M', sku: 'SKU-1', imageUrl: null },
          variant: null,
          unitPriceCents: 15000,
          priceSource: 'PRICE_LIST',
          discountType: null,
          discountValue: null,
          discountAmountCents: 0,
          discountTitle: null,
          promotionId: null,
          manuallyAdjusted: false,
          overrideNote: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    const wrapper = mountView()

    const row = wrapper.findComponent(QuotationItemRow)
    row.vm.$emit('request-remove', 'item-1')
    await flushPromises()
    expect(state.removeItem).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(state.removeItem).toHaveBeenCalledWith('item-1')
  })

  it('opens the price override modal when QuotationItemRow emits request-price-override', async () => {
    state.quotation.value = makeQuotation({
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: null,
              productName: 'Test Product',
        variantName: null,
    quantity: 2,
          product: { id: 'product-1', name: 'Playera M', sku: 'SKU-1', imageUrl: null },
          variant: null,
          unitPriceCents: 15000,
          priceSource: 'PRICE_LIST',
          discountType: null,
          discountValue: null,
          discountAmountCents: 0,
          discountTitle: null,
          promotionId: null,
          manuallyAdjusted: false,
          overrideNote: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    const wrapper = mountView()

    expect(wrapper.findComponent(QuotationPriceOverrideModal).exists()).toBe(false)
    const row = wrapper.findComponent(QuotationItemRow)
    row.vm.$emit('request-price-override', 'item-1')
    await flushPromises()

    const modal = wrapper.findComponent(QuotationPriceOverrideModal)
    expect(modal.exists()).toBe(true)
    expect(modal.props('open')).toBe(true)
    expect(state.overridePrice).not.toHaveBeenCalled()
  })

  it('submits the typed price through the override modal to overridePrice', async () => {
    state.quotation.value = makeQuotation({
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: null,
              productName: 'Test Product',
        variantName: null,
    quantity: 2,
          product: { id: 'product-1', name: 'Playera M', sku: 'SKU-1', imageUrl: null },
          variant: null,
          unitPriceCents: 15000,
          priceSource: 'PRICE_LIST',
          discountType: null,
          discountValue: null,
          discountAmountCents: 0,
          discountTitle: null,
          promotionId: null,
          manuallyAdjusted: false,
          overrideNote: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    const wrapper = mountView()

    const row = wrapper.findComponent(QuotationItemRow)
    row.vm.$emit('request-price-override', 'item-1')
    await flushPromises()

    await wrapper.get('[data-testid="price-override-input"]').setValue('199')
    await flushPromises()
    await wrapper.get('form#quotation-price-override-form').trigger('submit')
    await flushPromises()

    expect(state.overridePrice).toHaveBeenCalledWith('item-1', 19900)
  })
})

// ─── S6: promotions + expiry + totals footer ─────────────────────────────────
// The detail view integrates three new pieces:
//   - QuotationExpiryPicker (DRAFT only editable; readonly in SENT/EXPIRED/CANCELLED)
//   - QuotationTotalsFooter (always rendered; reads from `quotation`)
//   - A promotions section that lists applied promos (with Quitar) and
//     vetoed promos (with Re-activar), plus two USelectMenu pickers over the
//     ACTIVE promotions of each method that apply/veto immediately on
//     selection.

describe('QuotationDetailView expiry picker (S6)', () => {
  it('renders the expiry picker in DRAFT mode (editable)', () => {
    const wrapper = mountView()
    const picker = wrapper.find('[data-testid="quotation-expiry-picker"]')
    expect(picker.exists()).toBe(true)
    expect(picker.attributes('data-readonly')).toBe('false')
  })

  it('renders the expiry picker in readonly mode for non-DRAFT statuses', () => {
    state.quotation.value = makeQuotation({ status: 'SENT' })
    const wrapper = mountView()
    const picker = wrapper.find('[data-testid="quotation-expiry-picker"]')
    expect(picker.exists()).toBe(true)
    expect(picker.attributes('data-readonly')).toBe('true')
  })

  it('forwards the picker emit through setExpiry on the draft composable', async () => {
    const wrapper = mountView()
    const picker = wrapper.findComponent(QuotationExpiryPicker)
    picker.vm.$emit('update:expiresAt', '2026-12-01T00:00:00.000Z')
    await flushPromises()
    expect(state.setExpiry).toHaveBeenCalledWith('2026-12-01T00:00:00.000Z')
  })

  it('forwards a null emit through clearExpiry', async () => {
    const wrapper = mountView()
    const picker = wrapper.findComponent(QuotationExpiryPicker)
    picker.vm.$emit('update:expiresAt', null)
    await flushPromises()
    expect(state.clearExpiry).toHaveBeenCalledWith()
  })
})

describe('QuotationDetailView totals footer (S6)', () => {
  it('renders the totals footer at the bottom of the detail view', () => {
    state.quotation.value = makeQuotation({
      subtotalCents: 15000,
      discountCents: 1500,
      totalCents: 13500,
    })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="quotation-totals-footer"]').exists()).toBe(true)
  })

  it('renders the totals footer for non-DRAFT statuses too (read-only display)', () => {
    state.quotation.value = makeQuotation({
      status: 'SENT',
      subtotalCents: 15000,
      discountCents: 1500,
      totalCents: 13500,
    })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="quotation-totals-footer"]').exists()).toBe(true)
  })
})

describe('QuotationDetailView promotions section (S6)', () => {
  it('renders the list of applied promotions from the quotation', () => {
    state.quotation.value = makeQuotation({
      appliedPromotions: [
        { id: 'ap-1', promotionId: 'promo-1', title: 'Cupón 10%', discountCents: 500 },
        { id: 'ap-2', promotionId: 'promo-2', title: 'Promo Verano', discountCents: 800 },
      ],
    })
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="applied-promotions-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Cupón 10%')
    expect(wrapper.text()).toContain('Promo Verano')
  })

  it('hides the applied-promotions section when there are no applied promos', () => {
    state.quotation.value = makeQuotation({ appliedPromotions: [] })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="applied-promotions-list"]').exists()).toBe(false)
  })

  it('calls removeManualPromotion for an applied MANUAL promotion', async () => {
    state.quotation.value = makeQuotation({
      appliedPromotions: [
        { id: 'ap-1', promotionId: 'promo-1', title: 'Cupón 10%', discountCents: 500 },
      ],
      optedInManualPromotionIds: ['promo-1'],
    })
    const wrapper = mountView()

    await wrapper.get('[data-testid="remove-manual-promo-promo-1"]').trigger('click')
    expect(state.removeManualPromotion).toHaveBeenCalledWith('promo-1')
    expect(state.vetoPromotion).not.toHaveBeenCalled()
  })

  it('calls vetoPromotion for an applied AUTOMATIC promotion', async () => {
    state.quotation.value = makeQuotation({
      appliedPromotions: [
        { id: 'ap-1', promotionId: 'promo-auto-1', title: 'Promo Auto', discountCents: 800 },
      ],
    })
    const wrapper = mountView()

    await wrapper.get('[data-testid="remove-manual-promo-promo-auto-1"]').trigger('click')
    expect(state.vetoPromotion).toHaveBeenCalledWith('promo-auto-1')
    expect(state.removeManualPromotion).not.toHaveBeenCalled()
  })

  it('renders vetoed promotion titles from the lookup', () => {
    availablePromotionsMock.automatic.promotions = [
      makePromotion({ id: 'promo-auto-1', title: 'Promo de envío', method: 'AUTOMATIC', type: 'ORDER_DISCOUNT' }),
    ]
    state.quotation.value = makeQuotation({ vetoedPromotionIds: ['promo-auto-1'] })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="vetoed-promotions-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Promo de envío')
    expect(wrapper.text()).toContain('Automática')
  })

  it('calls unvetoPromotion when Re-activar is clicked', async () => {
    availablePromotionsMock.automatic.promotions = [
      makePromotion({ id: 'promo-auto-1', title: 'Promo de envío', method: 'AUTOMATIC', type: 'ORDER_DISCOUNT' }),
    ]
    state.quotation.value = makeQuotation({ vetoedPromotionIds: ['promo-auto-1'] })
    const wrapper = mountView()

    await wrapper.get('[data-testid="unveto-promo-promo-auto-1"]').trigger('click')
    expect(state.unvetoPromotion).toHaveBeenCalledWith('promo-auto-1')
  })

  it('hides the entire promotions section for non-DRAFT statuses', () => {
    state.quotation.value = makeQuotation({
      status: 'SENT',
      appliedPromotions: [
        { id: 'ap-1', promotionId: 'promo-1', title: 'Cupón 10%', discountCents: 500 },
      ],
      vetoedPromotionIds: ['promo-auto-1'],
    })
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="applied-promotions-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="vetoed-promotions-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="apply-manual-promo-select"]').exists()).toBe(false)
  })

  it('renders the unified promotion picker in DRAFT mode', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="apply-manual-promo-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="manual-promo-select"]').exists()).toBe(true)
  })

  it('applies any selected promotion via applyManualPromotion', async () => {
    availablePromotionsMock.manual.promotions = [
      makePromotion({ id: 'promo-manual-1', title: 'Cupón 10%', type: 'ORDER_DISCOUNT' }),
    ]
    availablePromotionsMock.automatic.promotions = [
      makePromotion({ id: 'promo-auto-1', title: 'Promo Verano', method: 'AUTOMATIC', type: 'BUY_X_GET_Y' }),
    ]
    const wrapper = mountView()

    const selector = wrapper.findAllComponents(USelectMenuStub)[0]!
    selector.vm.$emit('update:modelValue', 'promo-auto-1')
    await flushPromises()
    expect(state.applyManualPromotion).toHaveBeenCalledWith('promo-auto-1')
  })

  it('shows Manual badge for opted-in promotion and Automática badge for others', () => {
    state.quotation.value = makeQuotation({
      appliedPromotions: [
        { id: 'ap-1', promotionId: 'promo-1', title: 'Cupón 10%', discountCents: 500 },
        { id: 'ap-2', promotionId: 'promo-2', title: 'Promo Auto', discountCents: 800 },
      ],
      optedInManualPromotionIds: ['promo-1'],
    })
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Manual')
    expect(wrapper.text()).toContain('Automática')
    expect(wrapper.get('[data-testid="remove-manual-promo-promo-1"]').text()).toContain('Quitar')
    expect(wrapper.get('[data-testid="remove-manual-promo-promo-2"]').text()).toContain('Vetar')
  })

  it('shows all promotions in the unified picker with "(Aplicada)" prefix for applied ones', () => {
    state.quotation.value = makeQuotation({
      appliedPromotions: [
        { id: 'ap-1', promotionId: 'promo-applied', title: 'Cupón 10%', discountCents: 500 },
      ],
    })
    availablePromotionsMock.manual.promotions = [
      makePromotion({ id: 'promo-applied', title: 'Cupón 10%', type: 'ORDER_DISCOUNT' }),
      makePromotion({ id: 'promo-free-manual', title: 'Promo Manual', type: 'PRODUCT_DISCOUNT' }),
    ]
    availablePromotionsMock.automatic.promotions = [
      makePromotion({ id: 'promo-auto-free', title: 'Promo Auto', method: 'AUTOMATIC', type: 'ADVANCED' }),
    ]
    const wrapper = mountView()

    const selector = wrapper.findAllComponents(USelectMenuStub)[0]!
    const items = selector.props('items') as Array<{ value: string; label: string; description: string }>
    // All promos appear (no filtering), applied one has "(Aplicada)" prefix
    expect(items.map((i) => i.value)).toEqual(['promo-applied', 'promo-free-manual', 'promo-auto-free'])
    const appliedItem = items.find((i) => i.value === 'promo-applied')!
    expect(appliedItem.description).toContain('(Aplicada)')
    const freeItem = items.find((i) => i.value === 'promo-free-manual')!
    expect(freeItem.description).not.toContain('(Aplicada)')
  })

  it('removes an already-applied manual promotion when re-selected (toggle off)', async () => {
    state.quotation.value = makeQuotation({
      appliedPromotions: [
        { id: 'ap-1', promotionId: 'promo-1', title: 'Cupón 10%', discountCents: 500 },
      ],
      optedInManualPromotionIds: ['promo-1'],
    })
    availablePromotionsMock.manual.promotions = [
      makePromotion({ id: 'promo-1', title: 'Cupón 10%', type: 'ORDER_DISCOUNT' }),
    ]
    const wrapper = mountView()

    const selector = wrapper.findAllComponents(USelectMenuStub)[0]!
    selector.vm.$emit('update:modelValue', 'promo-1')
    await flushPromises()
    expect(state.applyManualPromotion).not.toHaveBeenCalled()
    expect(state.removeManualPromotion).toHaveBeenCalledWith('promo-1')
  })

  it('vetoes an already-applied automatic promotion when re-selected (toggle off)', async () => {
    state.quotation.value = makeQuotation({
      appliedPromotions: [
        { id: 'ap-1', promotionId: 'promo-auto-1', title: 'Promo Auto', discountCents: 800 },
      ],
    })
    availablePromotionsMock.automatic.promotions = [
      makePromotion({ id: 'promo-auto-1', title: 'Promo Auto', method: 'AUTOMATIC', type: 'PRODUCT_DISCOUNT' }),
    ]
    const wrapper = mountView()

    const selector = wrapper.findAllComponents(USelectMenuStub)[0]!
    selector.vm.$emit('update:modelValue', 'promo-auto-1')
    await flushPromises()
    expect(state.applyManualPromotion).not.toHaveBeenCalled()
    expect(state.vetoPromotion).toHaveBeenCalledWith('promo-auto-1')
  })

  it('shows the empty message when there are no active promotions', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('No hay promociones activas')
  })

  it('shows the loading message while promotions are being fetched', () => {
    availablePromotionsMock.manual.isLoading = true
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Cargando promociones…')
  })
})

// ─── S7: PDF preview + send dialog + cancel dialog ───────────────────────────
// The view integrates three new affordances in the actions bar:
//   - "Previsualizar PDF" — always visible, mirrors SaleDetailView's blob →
//     objectURL → window.open pattern.
//   - "Enviar" — DRAFT only, gated by `update:Quotation`, opens the
//     QuotationSendDialog.
//   - "Cancelar" — DRAFT only, gated by `update:Quotation`, opens the
//     QuotationCancelDialog.

describe('QuotationDetailView — PDF preview (S7)', () => {
  it('renders the "Previsualizar PDF" button', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="preview-pdf-button"]').exists()).toBe(true)
  })

  it('renders the PDF preview button for non-DRAFT quotations too', () => {
    state.quotation.value = makeQuotation({ status: 'SENT' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="preview-pdf-button"]').exists()).toBe(true)
  })

  it('PDF preview is disabled while a fetch is already in-flight', async () => {
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const originalOpen = window.open
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake')
    URL.revokeObjectURL = vi.fn()
    let resolveFetch!: (blob: Blob) => void
    window.open = vi.fn().mockReturnValue(null) as unknown as typeof window.open
    const { quotationApi } = await import('../../api/quotation.api')
    vi.mocked(quotationApi.getPdfBlob).mockImplementationOnce(
      () => new Promise<Blob>((resolve) => { resolveFetch = resolve }),
    )

    const wrapper = mountView()
    await wrapper.get('[data-testid="preview-pdf-button"]').trigger('click')
    await flushPromises()

    expect(URL.createObjectURL).not.toHaveBeenCalled()

    // Re-click while the first request is still in-flight — must be ignored.
    await wrapper.get('[data-testid="preview-pdf-button"]').trigger('click')
    expect(quotationApi.getPdfBlob).toHaveBeenCalledTimes(1)

    resolveFetch(new Blob(['pdf']))
    await flushPromises()

    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    window.open = originalOpen
  })
})

describe('QuotationDetailView — send dialog (S7)', () => {
  it('renders the "Enviar" button in DRAFT mode', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="send-button"]').exists()).toBe(true)
  })

  it('hides the "Enviar" button for non-DRAFT statuses', () => {
    state.quotation.value = makeQuotation({ status: 'SENT' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="send-button"]').exists()).toBe(false)
  })

  it('hides the "Enviar" button when the user lacks update:Quotation', () => {
    authMock.userCan.mockImplementation((action, subject) => {
      if (action === 'update' && subject === 'Quotation') return false
      return true
    })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="send-button"]').exists()).toBe(false)
  })

  it('opens the send dialog when "Enviar" is clicked', async () => {
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="quotation-send-dialog"]').exists()).toBe(false)
    await wrapper.get('[data-testid="send-button"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="quotation-send-dialog"]').exists()).toBe(true)
  })

  it('closes the send dialog on the dialog "close" event', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-testid="send-button"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="send-dialog-stub-close"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="quotation-send-dialog"]').exists()).toBe(false)
  })
})

describe('QuotationDetailView — cancel dialog (S7)', () => {
  it('renders the "Cancelar" button in DRAFT mode', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="cancel-button"]').exists()).toBe(true)
  })

  it('hides the "Cancelar" button for non-DRAFT statuses', () => {
    state.quotation.value = makeQuotation({ status: 'CANCELLED' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="cancel-button"]').exists()).toBe(false)
  })

  it('hides the "Cancelar" button when the user lacks update:Quotation', () => {
    authMock.userCan.mockImplementation((action, subject) => {
      if (action === 'update' && subject === 'Quotation') return false
      return true
    })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="cancel-button"]').exists()).toBe(false)
  })

  it('opens the cancel dialog when "Cancelar" is clicked', async () => {
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="quotation-cancel-dialog"]').exists()).toBe(false)
    await wrapper.get('[data-testid="cancel-button"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="quotation-cancel-dialog"]').exists()).toBe(true)
  })

  it('closes the cancel dialog on the dialog "close" event', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-testid="cancel-button"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="cancel-dialog-stub-close"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="quotation-cancel-dialog"]').exists()).toBe(false)
  })
})

// ─── S8: read-only hardening + lazy EXPIRED detection (REQ-QTN-012) ─────────
// Per the spec: "SENT/EXPIRED/CANCELLED quotations MUST render without edit
// controls". These tests pin every single control surface to make sure
// nothing slips past QA in a future refactor.

const ALL_EDIT_SELECTORS = [
  '[data-testid="add-product-button"]',
  '[data-testid="assign-customer-button"]',
  '[data-testid="manual-promo-select"]',
  '[data-testid="send-button"]',
  '[data-testid="cancel-button"]',
] as const

describe('QuotationDetailView — read-only enforcement (REQ-QTN-012 / S8)', () => {
  it.each([
    ['SENT', 'SENT'],
    ['EXPIRED', 'EXPIRED'],
    ['CANCELLED', 'CANCELLED'],
  ] as const)('hides every edit control when status is %s', (_label, status) => {
    state.quotation.value = makeQuotation({ status })
    const wrapper = mountView()

    for (const selector of ALL_EDIT_SELECTORS) {
      expect(wrapper.find(selector).exists(), `expected ${selector} to be hidden`).toBe(false)
    }
  })

  it('hides the "Agregar producto" button for SENT', () => {
    state.quotation.value = makeQuotation({ status: 'SENT' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="add-product-button"]').exists()).toBe(false)
  })

  it('hides the "Agregar producto" button for EXPIRED', () => {
    state.quotation.value = makeQuotation({ status: 'EXPIRED' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="add-product-button"]').exists()).toBe(false)
  })

  it('hides the "Agregar producto" button for CANCELLED', () => {
    state.quotation.value = makeQuotation({ status: 'CANCELLED' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="add-product-button"]').exists()).toBe(false)
  })

  it('forwards the readonly flag to QuotationItemRow when status is not DRAFT', () => {
    state.quotation.value = makeQuotation({
      status: 'SENT',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: null,
              productName: 'Test Product',
        variantName: null,
    quantity: 1,
          product: { id: 'product-1', name: 'Playera M', sku: 'SKU-1', imageUrl: null },
          variant: null,
          unitPriceCents: 15000,
          priceSource: 'PRICE_LIST',
          discountType: null,
          discountValue: null,
          discountAmountCents: 0,
          discountTitle: null,
          promotionId: null,
          manuallyAdjusted: false,
          overrideNote: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    const wrapper = mountView()
    const row = wrapper.get('[data-testid="quotation-item-row-item-1"]')
    expect(row.attributes('data-readonly')).toBe('true')
  })

  it('shows the read-only notice for SENT', () => {
    state.quotation.value = makeQuotation({ status: 'SENT' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="read-only-notice"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Solo lectura')
  })

  it('shows the read-only notice for EXPIRED', () => {
    state.quotation.value = makeQuotation({ status: 'EXPIRED' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="read-only-notice"]').exists()).toBe(true)
  })

  it('shows the read-only notice for CANCELLED', () => {
    state.quotation.value = makeQuotation({ status: 'CANCELLED' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="read-only-notice"]').exists()).toBe(true)
  })

  it('shows the cancel reason when status is CANCELLED (REQ-QTN-012)', () => {
    state.quotation.value = makeQuotation({
      status: 'CANCELLED',
      cancelReason: 'PRICE_OBJECTION',
      canceledAt: '2026-08-15T10:00:00.000Z',
    })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="cancel-reason-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('El cliente rechazó por precio')
  })

  it('does not show the cancel reason banner for non-CANCELLED statuses', () => {
    state.quotation.value = makeQuotation({ status: 'SENT' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="cancel-reason-banner"]').exists()).toBe(false)
  })

  it('shows the PDF preview button even in CANCELLED (PDF works for all statuses)', () => {
    state.quotation.value = makeQuotation({ status: 'CANCELLED' })
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="preview-pdf-button"]').exists()).toBe(true)
  })

  it('lazy EXPIRED detection renders the EXPIRED badge when status is SENT but expiresAt is in the past', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))
    try {
      state.quotation.value = makeQuotation({
        status: 'SENT',
        expiresAt: '2026-08-01T00:00:00.000Z',
      })
      const wrapper = mountView()
      // The header status badge should now reflect the lazy-EXPIRED view,
      // not the raw server SENT (REQ-QTN-008: client mirror of §7.4).
      const badge = wrapper.find('[data-testid="status-badge"]')
      expect(badge.attributes('data-tone')).toBe('warning')
      expect(badge.text()).toContain('Expirada')
      // Plus a dedicated notice banner so the cashier understands WHY the
      // view flipped from SENT (server) to EXPIRED (client).
      expect(wrapper.find('[data-testid="lazy-expired-notice"]').exists()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does NOT lazy-EXPIRE SENT quotations with a future expiresAt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'))
    try {
      state.quotation.value = makeQuotation({
        status: 'SENT',
        expiresAt: '2026-09-30T12:00:00.000Z',
      })
      const wrapper = mountView()
      const badge = wrapper.find('[data-testid="status-badge"]')
      expect(badge.text()).toContain('Enviada')
      expect(wrapper.find('[data-testid="lazy-expired-notice"]').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does NOT lazy-EXPIRE DRAFT quotations even when expiresAt is past (DRAFT is still editable)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))
    try {
      state.quotation.value = makeQuotation({
        status: 'DRAFT',
        expiresAt: '2026-08-01T00:00:00.000Z',
      })
      const wrapper = mountView()
      const badge = wrapper.find('[data-testid="status-badge"]')
      expect(badge.text()).toContain('Borrador')
      expect(wrapper.find('[data-testid="lazy-expired-notice"]').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('defensive check: skip addItem when the cached status is no longer DRAFT', async () => {
    state.quotation.value = makeQuotation({ status: 'SENT' })

    const wrapper = mountView()
    // In SENT mode the "Agregar producto" button is gated out of the DOM
    // entirely — that IS the first-line defense. As an extra layer, the
    // handler itself early-returns on `!isDraft` so any race-driven
    // invocation (e.g. Vue lifecycle on cache flip) doesn't fire a
    // mutation. We verify the button is hidden + no mutation was ever
    // called.
    expect(wrapper.find('[data-testid="add-product-button"]').exists()).toBe(false)
    await flushPromises()
    expect(state.addItem).not.toHaveBeenCalled()
  })

  it('defensive check: do not call sendQuotation / cancelQuotation when status is not DRAFT', async () => {
    state.quotation.value = makeQuotation({ status: 'CANCELLED' })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="send-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cancel-button"]').exists()).toBe(false)
    expect(state.sendQuotation).not.toHaveBeenCalled()
    expect(state.cancelQuotation).not.toHaveBeenCalled()
  })

  it('renders a NOT FOUND error surface when the detail query reports 404', async () => {
    state.quotation.value = undefined
    state.isError.value = true
    state.error.value = { response: { status: 404 } }
    state.createDraft.mockRejectedValueOnce(new Error('not found'))

    const wrapper = mountView()
    await flushPromises()

    // The view shows the standard "no se pudo cargar" surface. Future polish
    // could differentiate 404 from generic error; the contract is that the
    // user sees an actionable error, not a stack trace.
    expect(wrapper.find('[data-testid="detail-error"]').exists()).toBe(true)
  })
})
