import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import QuotationDetailView from '../QuotationDetailView.vue'
import QuotationItemRow from '../../components/QuotationItemRow.vue'
import ProductSearchPanel from '@/features/POS/sales/components/ProductSearchPanel.vue'
import type { QuotationResponseDto } from '../../interfaces/quotation.types'

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
}

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
  }),
}))

const route = {
  path: '/pos/cotizaciones/quotation-12345678',
  params: { id: 'quotation-12345678' } as Record<string, string>,
  query: {} as Record<string, string>,
}
const routerPush = vi.fn()

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
}

function mountView() {
  return mount(QuotationDetailView, { global: { stubs } })
}

beforeEach(() => {
  state.quotation.value = makeQuotation()
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

  it('shows draft editing controls', () => {
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="draft-edit-controls"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Agregar productos')
  })

  it('hides all edit controls for non-DRAFT quotations', () => {
    state.quotation.value = makeQuotation({ status: 'CANCELLED' })
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="draft-edit-controls"]').exists()).toBe(false)
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

  it('opens the product search panel when "Agregar producto" is clicked', async () => {
    const wrapper = mountView()

    expect(wrapper.find('[data-testid="product-search-panel"]').exists()).toBe(false)
    await wrapper.get('[data-testid="add-product-button"]').trigger('click')
    expect(wrapper.find('[data-testid="product-search-panel"]').exists()).toBe(true)
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

  it('forwards QuotationItemRow override-price events to overridePrice', async () => {
    state.quotation.value = makeQuotation({
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: null,
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
    row.vm.$emit('override-price', 'item-1', 19900)
    expect(state.overridePrice).toHaveBeenCalledWith('item-1', 19900)
  })
})
