import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import QuotationDetailView from '../QuotationDetailView.vue'
import type { QuotationResponseDto } from '../../interfaces/quotation.types'

const state = {
  quotation: ref<QuotationResponseDto | undefined>(),
  isLoading: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  createDraft: vi.fn(),
  assignCustomer: vi.fn(),
  changePriceList: vi.fn(),
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
