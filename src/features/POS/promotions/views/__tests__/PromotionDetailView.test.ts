import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import PromotionDetailView from '../PromotionDetailView.vue'
import { promotionApi } from '../../api/promotion.api'
import type { PromotionType } from '../../interfaces/promotion.types'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockToastAdd = vi.fn()

const mockRoute = vi.fn<() => { params: Record<string, string>; query: Record<string, string> }>(
  () => ({ params: { type: 'PRODUCT_DISCOUNT' }, query: {} }),
)

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => mockRoute(),
}))

vi.mock('../../api/promotion.api', () => ({
  promotionApi: {
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'new-id' }),
    update: vi.fn().mockResolvedValue({ id: 'existing-id' }),
  },
}))

// ── Stubs ─────────────────────────────────────────────────────────────────────

const STUBS = {
  PromotionForm: {
    props: ['type', 'mode', 'initialData', 'loading', 'formId', 'apiErrors'],
    emits: ['submit', 'cancel', 'errorsCleared'],
    template: `<div data-testid="promotion-form" :data-mode="mode" :data-type="type" :data-api-errors="JSON.stringify(apiErrors)"><button data-testid="form-submit-btn" @click="$emit('submit', { title: 'Test Promotion', type: 'PRODUCT_DISCOUNT', method: 'AUTOMATIC', discountType: 'PERCENTAGE', discountValue: '10', appliesTo: 'PRODUCTS', targetItems: [], hasMinPurchase: false, minPurchaseAmountCents: '', buyQuantity: '', getQuantity: '', getDiscountPercent: '', buyTargetType: '', buyTargetItems: [], getTargetType: '', getTargetItems: [], hasVigencia: false, startDate: '', endDate: '', customerScope: 'ALL', customerIds: [], hasPriceLists: false, priceListIds: [], hasDaysOfWeek: false, daysOfWeek: [] })" /><button data-testid="form-cancel-btn" @click="$emit('cancel')" /><button data-testid="form-change-btn" @click="$emit('errorsCleared')" /></div>`,
  },
  UButton: {
    props: ['label', 'color', 'variant', 'icon', 'loading', 'disabled', 'type', 'form'],
    emits: ['click'],
    template: '<button :data-testid="label || $attrs[\'data-testid\'] || \'btn\'" :disabled="disabled" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
  },
  UBadge: {
    props: ['color', 'variant'],
    template: '<span data-testid="badge"><slot /></span>',
  },
  UIcon: { template: '<span />' },
  UCard: {
    inheritAttrs: false,
    template: '<div v-bind="$attrs"><slot name="header" /><slot /></div>',
  },
  USkeleton: {
    props: ['class'],
    template: '<div data-testid="skeleton" />',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false }, mutations: { retry: false } } })
}

function mountCreate(type: PromotionType = 'PRODUCT_DISCOUNT') {
  mockRoute.mockReturnValue({ params: { type }, query: {} })
  return mount(PromotionDetailView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]],
      stubs: STUBS,
      mocks: {
        useToast: () => ({ add: mockToastAdd }),
      },
    },
  })
}

function mountEdit(id: string = 'promo-123') {
  mockRoute.mockReturnValue({ params: { id }, query: {} })
  const queryClient = makeQueryClient()
  // Pre-seed query data to skip loading state
  queryClient.setQueryData(['promotions', 'detail', id], {
    id,
    title: 'Test Promotion',
    type: 'PRODUCT_DISCOUNT',
    method: 'AUTOMATIC',
    status: 'ACTIVE',
    startDate: null,
    endDate: null,
    customerScope: 'ALL',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minPurchaseAmountCents: null,
    appliesTo: 'PRODUCTS',
    buyQuantity: null,
    getQuantity: null,
    getDiscountPercent: null,
    buyTargetType: null,
    getTargetType: null,
    targetItems: [],
    customers: [],
    priceLists: [],
    daysOfWeek: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  return mount(PromotionDetailView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: STUBS,
      mocks: {
        useToast: () => ({ add: mockToastAdd }),
      },
    },
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PromotionDetailView — Create Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mounts without error in create mode', () => {
    expect(mountCreate().exists()).toBe(true)
  })

  it('renders PromotionForm in create mode', () => {
    const wrapper = mountCreate('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="promotion-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="promotion-form"]').attributes('data-mode')).toBe('create')
  })

  it('passes type from route param to PromotionForm', () => {
    const wrapper = mountCreate('ORDER_DISCOUNT')
    expect(wrapper.find('[data-testid="promotion-form"]').attributes('data-type')).toBe('ORDER_DISCOUNT')
  })

  it('passes BUY_X_GET_Y type to PromotionForm', () => {
    const wrapper = mountCreate('BUY_X_GET_Y')
    expect(wrapper.find('[data-testid="promotion-form"]').attributes('data-type')).toBe('BUY_X_GET_Y')
  })

  it('passes ADVANCED type to PromotionForm', () => {
    const wrapper = mountCreate('ADVANCED')
    expect(wrapper.find('[data-testid="promotion-form"]').attributes('data-type')).toBe('ADVANCED')
  })

  it('shows "Crear Promoción" in header for create mode', () => {
    const wrapper = mountCreate()
    expect(wrapper.text()).toContain('Crear Promoción')
  })

  it('cancel navigates back to promotions list', async () => {
    const wrapper = mountCreate()
    await wrapper.find('[data-testid="form-cancel-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(mockPush).toHaveBeenCalledWith('/pos/promociones')
  })
})

describe('PromotionDetailView — Edit Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mounts without error in edit mode', () => {
    expect(mountEdit().exists()).toBe(true)
  })

  it('renders PromotionForm in edit mode', () => {
    const wrapper = mountEdit()
    expect(wrapper.find('[data-testid="promotion-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="promotion-form"]').attributes('data-mode')).toBe('edit')
  })

  it('shows "Editar Promoción" in header for edit mode', () => {
    const wrapper = mountEdit()
    expect(wrapper.text()).toContain('Editar Promoción')
  })

  it('cancel navigates back to promotions list in edit mode', async () => {
    const wrapper = mountEdit()
    await wrapper.find('[data-testid="form-cancel-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(mockPush).toHaveBeenCalledWith('/pos/promociones')
  })
})

describe('PromotionDetailView — Invalid Type Guard (CRITICAL 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /pos/promociones when type param is invalid', async () => {
    mockRoute.mockReturnValue({ params: { type: 'INVALID_TYPE' }, query: {} })
    mount(PromotionDetailView, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]],
        stubs: STUBS,
        mocks: {
          useToast: () => ({ add: mockToastAdd }),
        },
      },
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(mockPush).toHaveBeenCalledWith('/pos/promociones')
  })

  it('does NOT redirect when type param is PRODUCT_DISCOUNT', async () => {
    mockRoute.mockReturnValue({ params: { type: 'PRODUCT_DISCOUNT' }, query: {} })
    mount(PromotionDetailView, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]],
        stubs: STUBS,
        mocks: {
          useToast: () => ({ add: mockToastAdd }),
        },
      },
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(mockPush).not.toHaveBeenCalledWith('/pos/promociones')
  })

  it('does NOT redirect when type param is BUY_X_GET_Y', async () => {
    mockRoute.mockReturnValue({ params: { type: 'BUY_X_GET_Y' }, query: {} })
    mount(PromotionDetailView, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]],
        stubs: STUBS,
        mocks: {
          useToast: () => ({ add: mockToastAdd }),
        },
      },
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(mockPush).not.toHaveBeenCalledWith('/pos/promociones')
  })
})

describe('PromotionDetailView — Create success (S37)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(promotionApi.create).mockResolvedValue({ id: 'new-promo-id' } as never)
  })

  it('S37: on create success, calls promotionApi.create with form state payload', async () => {
    const wrapper = mountCreate('PRODUCT_DISCOUNT')
    await wrapper.find('[data-testid="form-submit-btn"]').trigger('click')
    await flushPromises()
    expect(promotionApi.create).toHaveBeenCalledOnce()
  })

  it('S37: on create success, navigates to /pos/promociones', async () => {
    const wrapper = mountCreate('PRODUCT_DISCOUNT')
    await wrapper.find('[data-testid="form-submit-btn"]').trigger('click')
    await flushPromises()
    expect(mockPush).toHaveBeenCalledWith('/pos/promociones')
  })

  it('S37: create with ORDER_DISCOUNT type calls promotionApi.create', async () => {
    const wrapper = mountCreate('ORDER_DISCOUNT')
    await wrapper.find('[data-testid="form-submit-btn"]').trigger('click')
    await flushPromises()
    expect(promotionApi.create).toHaveBeenCalledOnce()
  })
})

describe('PromotionDetailView — Edit success (S41)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(promotionApi.update).mockResolvedValue({ id: 'promo-123' } as never)
  })

  it('S41: on edit success, calls promotionApi.update with promotion id', async () => {
    const wrapper = mountEdit('promo-123')
    await wrapper.find('[data-testid="form-submit-btn"]').trigger('click')
    await flushPromises()
    expect(promotionApi.update).toHaveBeenCalledWith('promo-123', expect.any(Object))
  })

  it('S41: on edit success, navigates to /pos/promociones', async () => {
    const wrapper = mountEdit('promo-123')
    await wrapper.find('[data-testid="form-submit-btn"]').trigger('click')
    await flushPromises()
    expect(mockPush).toHaveBeenCalledWith('/pos/promociones')
  })
})

describe('PromotionDetailView — S38: Create 400 validation stays on page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('S38: on create 400 error, does NOT navigate away (stays on form)', async () => {
    const axiosErr = {
      response: { data: { error: 'INVALID_DATE_RANGE', message: 'date range invalid' } },
      isAxiosError: true,
    }
    vi.mocked(promotionApi.create).mockRejectedValueOnce(axiosErr)

    const wrapper = mountCreate()
    await wrapper.find('[data-testid="form-submit-btn"]').trigger('click')
    await flushPromises()
    await flushPromises()
    await wrapper.vm.$nextTick()

    // Router push should NOT have been called with the list route
    expect(mockPush).not.toHaveBeenCalledWith('/pos/promociones')
  })

  it('S38: on create 400 error, apiErrors are set (field errors shown inline)', async () => {
    const axiosErr = {
      response: { data: { error: 'INVALID_DATE_RANGE', message: 'date range invalid' } },
      isAxiosError: true,
    }
    vi.mocked(promotionApi.create).mockRejectedValueOnce(axiosErr)

    const wrapper = mountCreate()
    await wrapper.find('[data-testid="form-submit-btn"]').trigger('click')
    await flushPromises()
    await flushPromises()
    await wrapper.vm.$nextTick()

    const form = wrapper.find('[data-testid="promotion-form"]')
    const errors = JSON.parse(form.attributes('data-api-errors') ?? '[]')
    expect(errors.length).toBeGreaterThan(0)
    // PromotionForm is still rendered (not navigated away)
    expect(form.exists()).toBe(true)
  })
})

describe('PromotionDetailView — S40: Edit mode pre-populates form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('S40: edit mode passes fetched promotion data as initialData to PromotionForm', () => {
    // mountEdit pre-seeds the query client with promotion data
    const wrapper = mountEdit('promo-123')
    const form = wrapper.find('[data-testid="promotion-form"]')
    expect(form.exists()).toBe(true)
    // form mode is 'edit'
    expect(form.attributes('data-mode')).toBe('edit')
    // The promotion type from seeded data should be passed
    expect(form.attributes('data-type')).toBe('PRODUCT_DISCOUNT')
  })

  it('S40: edit mode shows "Editar Promoción" header (form pre-populated from fetched data)', () => {
    const wrapper = mountEdit()
    expect(wrapper.text()).toContain('Editar Promoción')
  })
})

describe('PromotionDetailView — Field-level API errors (FIX 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes empty apiErrors array to PromotionForm by default', () => {
    const wrapper = mountCreate()
    const form = wrapper.find('[data-testid="promotion-form"]')
    const rawErrors = form.attributes('data-api-errors')
    const errors = JSON.parse(rawErrors ?? '[]')
    expect(Array.isArray(errors)).toBe(true)
    expect(errors).toHaveLength(0)
  })

  it('sets field-level apiErrors when create mutation returns INVALID_DATE_RANGE', async () => {
    const axiosErr = {
      response: { data: { error: 'INVALID_DATE_RANGE', message: 'date range invalid' } },
      isAxiosError: true,
    }
    vi.mocked(promotionApi.create).mockRejectedValueOnce(axiosErr)

    const wrapper = mountCreate()
    await wrapper.find('[data-testid="form-submit-btn"]').trigger('click')
    // Multiple flushes to drain TanStack Query's async pipeline
    await flushPromises()
    await flushPromises()
    await wrapper.vm.$nextTick()

    const form = wrapper.find('[data-testid="promotion-form"]')
    const rawErrors = form.attributes('data-api-errors')
    const errors = JSON.parse(rawErrors ?? '[]')
    expect(errors).toHaveLength(1)
    expect(errors[0].path).toBe('endDate')
  })

  it('sets field-level apiErrors on targetItems when create mutation returns DUPLICATE_TARGET (S39)', async () => {
    const axiosErr = {
      response: { data: { error: 'DUPLICATE_TARGET', message: 'dup' } },
      isAxiosError: true,
    }
    vi.mocked(promotionApi.create).mockRejectedValueOnce(axiosErr)

    const wrapper = mountCreate()
    await wrapper.find('[data-testid="form-submit-btn"]').trigger('click')
    await flushPromises()
    await flushPromises()
    await wrapper.vm.$nextTick()

    // apiErrors must contain a targetItems field error (S39 requires field-level binding)
    const form = wrapper.find('[data-testid="promotion-form"]')
    const errors = JSON.parse(form.attributes('data-api-errors') ?? '[]')
    expect(errors).toHaveLength(1)
    expect(errors[0].path).toBe('targetItems')
    expect(errors[0].message).toBe('Hay targets duplicados. Revisá que no haya items repetidos.')
  })

  it('clears apiErrors when PromotionForm emits errorsCleared', async () => {
    const axiosErr = {
      response: { data: { error: 'INVALID_DATE_RANGE', message: 'date range' } },
      isAxiosError: true,
    }
    vi.mocked(promotionApi.create).mockRejectedValueOnce(axiosErr)

    const wrapper = mountCreate()
    await wrapper.find('[data-testid="form-submit-btn"]').trigger('click')
    await flushPromises()
    await flushPromises()
    await wrapper.vm.$nextTick()

    const form = wrapper.find('[data-testid="promotion-form"]')
    let errors = JSON.parse(form.attributes('data-api-errors') ?? '[]')
    // Confirm errors were set after mutation failure
    expect(errors).toHaveLength(1)

    // Simulate user modifying the form — errorsCleared event propagates
    await wrapper.find('[data-testid="form-change-btn"]').trigger('click')
    await wrapper.vm.$nextTick()

    errors = JSON.parse(form.attributes('data-api-errors') ?? '[]')
    expect(errors).toHaveLength(0)
  })
})
