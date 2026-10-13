import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import type { Sale, SaleItem, PosCatalogItem } from '../../interfaces/sale.types'
import type { CategoryChip } from '../../composables/useProductSearch'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import SalesView from '../../views/SalesView.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ActiveSalePanel from '../ActiveSalePanel.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ProductSearchPanel from '../ProductSearchPanel.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ProductSearchResults from '../ProductSearchResults.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ProductSearchResultItem from '../ProductSearchResultItem.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import SaleItemRow from '../SaleItemRow.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import SaleTotalsFooter from '../SaleTotalsFooter.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import SalesTabsStrip from '../SalesTabsStrip.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import PromocionesDisponiblesAccordion from '../PromocionesDisponiblesAccordion.vue'
import { mountWithUApp } from '@/test/mountWithUApp'

/*
 * Workspace / catalog / cart presentation contracts (T2 / S1-S5).
 *
 * These mounts prove the additive presentation hooks and the exact opt-in
 * composition against the real components and the installed primitives —
 * never against a screenshot. They also re-assert the public events and the
 * omitted-opt-in defaults of every touched component, so the shared catalog
 * (quotations) and the unopted consumers keep their prior paint and behavior.
 *
 * jsdom has no layout engine: computed paint, contrast, media queries and
 * touch ergonomics are NOT proven here. Visual smoke remains user-owned.
 */
const ENTRY_PORTAL = 'hf-theme hf-ui sales-entry-portal'
const CART_PORTAL = `${ENTRY_PORTAL} sales-pos-cart`
const CUSTOMER_PORTAL = `${ENTRY_PORTAL} sales-pos-customer`

// ── SalesView harness (same seam the view's own spec uses) ──────────────────

const addToast = vi.fn()
vi.stubGlobal('useToast', () => ({ add: addToast }))

vi.mock('@tanstack/vue-query', async () => {
  const actual = await vi.importActual('@tanstack/vue-query')
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  }
})

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ref('tenant-1'),
}))

const { mobileViewport, listLoading } = vi.hoisted(() => ({
  mobileViewport: { value: false },
  listLoading: { value: false },
}))
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { computed: vueComputed } = await import('vue')
  return {
    ...actual,
    useBreakpoints: () => ({ smaller: () => vueComputed(() => mobileViewport.value) }),
  }
})

const activeTabId = ref<string | null>('sale-1')
const drafts = ref<Sale[]>([
  {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        variantId: null,
        productName: 'A',
        variantName: null,
        quantity: 1,
        unitPriceCents: 10000,
        unitPriceCurrency: 'MXN',
      },
    ],
    createdAt: 'x',
    updatedAt: 'x',
  },
])

vi.mock('../../composables/useSalesDrafts', () => ({
  useSalesDrafts: () => ({
    drafts: computed(() => drafts.value),
    activeDraft: computed(() => drafts.value.find((d) => d.id === activeTabId.value) ?? null),
    activeTabId,
    isLoadingList: computed(() => listLoading.value),
    isMutating: ref(false),
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
    chargeDraft: vi.fn(),
    refetchDrafts: vi.fn(),
    vetoAutoPromotion: vi.fn(),
    applyManualPromotion: vi.fn(),
    removeManualPromotion: vi.fn(),
    setPriceList: vi.fn(),
  }),
}))

const applicablePromotionsData = ref<{ saleId: string; promotions: never[] }>({
  saleId: 'sale-1',
  promotions: [],
})
vi.mock('../../composables/useApplicablePromotions', () => ({
  useApplicablePromotions: () => ({
    data: applicablePromotionsData,
    isPending: ref(false),
    isFetching: ref(false),
    isError: ref(false),
    error: ref(null),
  }),
}))

vi.mock('../../api/sale.api', () => ({
  saleApi: { getProductDetail: vi.fn(async () => ({ mainImage: null, variants: [] })) },
}))

vi.mock('../../composables/useDraftCustomerAssignment', () => ({
  DraftCustomerAssignmentError: class DraftCustomerAssignmentError extends Error {
    constructor(public readonly code: string) {
      super(code)
    }
  },
  useDraftCustomerAssignment: () => ({
    unassignCustomer: vi.fn(),
    clearShippingAddress: vi.fn(),
    isPending: ref(false),
    lastError: ref(null),
  }),
}))

const viewStubs = {
  ProductSearchPanel: {
    name: 'ProductSearchPanel',
    props: ['portalClass'],
    template: '<div data-testid="product-search-stub" />',
  },
  ActiveSalePanel: {
    name: 'ActiveSalePanel',
    props: ['mobileSheet', 'portalClass'],
    emits: [
      'charge-click',
      'open-customer-assignment',
      'update-qty',
      'remove-promo',
      'remove-order-promo',
      'apply-manual-promo',
      'remove-manual-promo',
      'change-price-list',
    ],
    template:
      '<div data-testid="active-sale-panel-stub">' +
      '<button data-testid="panel-open-customer" @click="$emit(\'open-customer-assignment\')">c</button>' +
      '<button data-testid="panel-charge" @click="$emit(\'charge-click\')">charge</button>' +
      '</div>',
  },
  SalesTabsStrip: { template: '<div data-testid="draft-strip-stub" />' },
  PaymentModal: {
    name: 'PaymentModal',
    props: ['open', 'portalClass'],
    template: '<div data-testid="payment-modal-stub" :data-open="open" />',
  },
  PromotionCapacityRequoteModal: { template: '<div />' },
  PaymentSuccessModal: { template: '<div />' },
  ConfirmModal: { template: '<div />' },
  AssignCustomerSlideover: {
    name: 'AssignCustomerSlideover',
    props: ['open', 'portalClass', 'saleId'],
    template: '<div data-testid="assign-customer-stub" />',
  },
  AppResponsiveDrawer: {
    name: 'AppResponsiveDrawer',
    props: ['open', 'portalClass', 'title'],
    emits: ['after:leave', 'update:open'],
    template: '<div data-testid="mobile-cart-drawer"><slot name="body" /></div>',
  },
  USkeleton: { template: '<div />' },
}

const tracked: VueWrapper[] = []
function track<T extends VueWrapper>(wrapper: T): T {
  tracked.push(wrapper)
  return wrapper
}

afterEach(() => {
  while (tracked.length) {
    const wrapper = tracked.pop()!
    try {
      wrapper.unmount()
    } catch {
      /* already unmounted */
    }
  }
  document.body.innerHTML = ''
})

function mountView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return track(
    mount(SalesView, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        stubs: viewStubs,
      },
    }),
  )
}

// ── D1 — exact opt-in composition and workspace hooks at the view seam ──────

describe('D1 — SalesView workspace composition', () => {
  beforeEach(() => {
    mobileViewport.value = false
    activeTabId.value = 'sale-1'
    drafts.value = [{ ...drafts.value[0]!, items: [...drafts.value[0]!.items] }]
  })
  afterEach(() => {
    listLoading.value = false
  })

  it('opts into the workspace boundary and marks the two panes', () => {
    const wrapper = mountView()

    expect(wrapper.classes()).toContain('sales-pos-workspace')
    expect(wrapper.find('.sales-pos-catalog-pane').exists()).toBe(true)
    expect(wrapper.find('.sales-pos-cart-pane').exists()).toBe(true)
    // The catalog caller keeps its existing class and gains the composition hook.
    const catalog = wrapper.get('[data-testid="product-search-stub"]')
    expect(catalog.classes()).toContain('sales-entry-product-search')
    expect(catalog.classes()).toContain('sales-pos-catalog')
  })

  it('keeps the bare entry marker on every unappended teleport caller', () => {
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'ProductSearchPanel' }).props('portalClass')).toBe(
      ENTRY_PORTAL,
    )
    expect(wrapper.findComponent({ name: 'PaymentModal' }).props('portalClass')).toBe(ENTRY_PORTAL)
    for (const panel of wrapper.findAllComponents({ name: 'ActiveSalePanel' })) {
      expect(panel.props('portalClass')).toBe(ENTRY_PORTAL)
    }
  })

  it('appends the cart marker only on the mobile drawer root', async () => {
    mobileViewport.value = true
    const wrapper = mountView()
    await flushPromises()

    const drawer = wrapper.findComponent({ name: 'AppResponsiveDrawer' })
    expect(drawer.exists()).toBe(true)
    expect(drawer.props('portalClass')).toBe(CART_PORTAL)
    // The FAB keeps its existing testid and gains the composition hook.
    const fab = wrapper.get('[data-testid="mobile-cart-fab"]')
    expect(fab.classes()).toContain('sales-pos-cart-fab')
    expect(wrapper.get('[data-testid="mobile-cart-fab-count"]').classes()).toContain(
      'sales-pos-cart-fab-count',
    )
  })

  it('appends the customer marker only on the shared customer sheet caller', async () => {
    const wrapper = mountView()
    await wrapper.get('[data-testid="panel-open-customer"]').trigger('click')

    const sheet = wrapper.findComponent({ name: 'AssignCustomerSlideover' })
    expect(sheet.exists()).toBe(true)
    expect(sheet.props('portalClass')).toBe(CUSTOMER_PORTAL)
    expect(sheet.props('saleId')).toBe('sale-1')
  })

  it('preserves the mobile drawer → payment sequencing', async () => {
    mobileViewport.value = true
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="mobile-cart-fab"]').trigger('click')
    const drawer = wrapper.findComponent({ name: 'AppResponsiveDrawer' })
    expect(drawer.props('open')).toBe(true)

    await wrapper.get('[data-testid="panel-charge"]').trigger('click')
    expect(drawer.props('open')).toBe(false)
    expect(wrapper.get('[data-testid="payment-modal-stub"]').attributes('data-open')).toBe('false')

    drawer.vm.$emit('after:leave')
    await flushPromises()
    expect(wrapper.get('[data-testid="payment-modal-stub"]').attributes('data-open')).toBe('true')
  })
})

// ── D2 — catalog hooks with shared defaults untouched ───────────────────────

const panelCategories = ref<CategoryChip[]>([])
const panelCategoryId = ref<string | undefined>(undefined)
const panelQuery = ref('')
const panelItems = ref<PosCatalogItem[]>([])
const panelIsLoading = ref(false)
const panelIsEmpty = ref(false)
const panelHasQuery = ref(false)
const panelTotalUnfiltered = ref(0)

vi.mock('../../composables/useProductSearch', () => ({
  useProductSearch: () => ({
    query: panelQuery,
    items: computed(() => panelItems.value),
    isLoading: computed(() => panelIsLoading.value),
    isEmpty: computed(() => panelIsEmpty.value),
    hasQuery: computed(() => panelHasQuery.value),
    categoryId: panelCategoryId,
    categories: computed(() => panelCategories.value),
    totalUnfiltered: computed(() => panelTotalUnfiltered.value),
  }),
}))

const catalogItem: PosCatalogItem = {
  id: 'prod-1',
  name: 'Alimento para perro adulto',
  sku: 'ALI-002',
  barcode: null,
  unit: null,
  hasVariants: false,
  useStock: true,
  category: null,
  brand: { id: 'brand-1', name: 'CANINO' },
  mainImage: null,
  images: [],
  price: { priceCents: 45000, priceDecimal: 450, priceListName: 'PUBLICO' },
  stock: { quantity: 24, minQuantity: 5 },
  variants: [],
}

describe('D2 — catalog hooks (shared components stay inert by default)', () => {
  afterEach(() => {
    panelCategories.value = []
    panelCategoryId.value = undefined
    panelQuery.value = ''
    panelItems.value = []
    panelIsLoading.value = false
    panelIsEmpty.value = false
    panelHasQuery.value = false
    panelTotalUnfiltered.value = 0
  })

  it('groups the shared search/categories chrome behind the caller hook', () => {
    panelCategories.value = [{ id: 'cat-1', name: 'Medicamentos', count: 4 }]
    panelTotalUnfiltered.value = 12

    const wrapper = track(
      mount(ProductSearchPanel, {
        props: { portalClass: ENTRY_PORTAL },
        attrs: { class: 'sales-entry-product-search sales-pos-catalog' },
        global: {
          stubs: {
            ProductSearchResults: { template: '<div data-testid="results-stub" />' },
            VariantPickerModal: {
              name: 'VariantPickerModal',
              props: ['portalClass'],
              template: '<div data-testid="variant-modal-stub" :data-portal-class="portalClass" />',
            },
          },
        },
      }),
    )

    expect(wrapper.classes()).toContain('sales-pos-catalog')
    expect(wrapper.find('.sales-pos-catalog-controls').exists()).toBe(true)
    expect(wrapper.find('.sales-pos-categories').exists()).toBe(true)
    // Prior testids and the nested portal forward stay exactly as they were.
    expect(wrapper.find('[data-testid="category-chip-todo"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="variant-modal-stub"]').attributes('data-portal-class')).toBe(
      ENTRY_PORTAL,
    )
  })

  it.each([
    ['loading skeleton', { items: [], isLoading: true, isEmpty: false, hasQuery: false }],
    ['populated results', { items: [catalogItem], isLoading: false, isEmpty: false, hasQuery: false }],
  ])('hooks the %s grid without changing the shared column classes', (_label, props) => {
    const wrapper = track(
      mount(ProductSearchResults, {
        props: props as { items: PosCatalogItem[]; isLoading: boolean; isEmpty: boolean; hasQuery: boolean },
      }),
    )
    expect(wrapper.find('.sales-pos-product-grid').exists()).toBe(true)
    // The shared responsive columns and root behaviour are preserved.
    expect(wrapper.classes()).toContain('overflow-y-auto')
    expect(wrapper.html()).toContain('sm:grid-cols-3')
  })

  it('keeps the empty/no-match state and adds its hook', () => {
    const wrapper = track(
      mount(ProductSearchResults, {
        props: { items: [], isLoading: false, isEmpty: true, hasQuery: true },
      }),
    )
    expect(wrapper.find('.sales-pos-catalog-empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sin resultados')
  })

  it('marks the product card facts and preserves the shared card defaults', () => {
    const wrapper = track(mount(ProductSearchResultItem, { props: { item: catalogItem } }))

    const card = wrapper.get('[data-testid="result-card"]')
    expect(card.classes()).toContain('sales-pos-product-card')
    expect(wrapper.get('[data-testid="image-area"]').classes()).toContain('sales-pos-product-media')
    expect(wrapper.find('img, [data-testid="placeholder-icon"]').exists()).toBe(true)
    expect(wrapper.find('.sales-pos-product-name').text()).toContain('Alimento para perro adulto')
    expect(wrapper.find('.sales-pos-product-price').text()).toContain('$450.00')
    expect(wrapper.find('.sales-pos-product-brand').text()).toContain('CANINO')
    expect(wrapper.get('[data-testid="stock-badge"]').classes()).toContain('sales-pos-product-stock')
    expect(wrapper.get('[data-testid="add-action"]').classes()).toContain('sales-pos-product-add')

    // Quotations still consume this card: the prior classes must survive.
    expect(wrapper.get('[data-testid="image-area"]').classes()).toEqual(
      expect.arrayContaining(['w-[43%]', 'min-h-28', 'sm:h-32', 'sm:w-full']),
    )
    expect(wrapper.get('.tabular-nums').classes()).toContain('dark:text-(--brand-accent)')
    expect(wrapper.get('[data-testid="add-action"]').classes()).toContain('sm:hidden')
  })
})

// ── D3 — cart hooks with public events preserved ────────────────────────────

const rowItem: SaleItem = {
  id: 'item-1',
  productId: 'prod-1',
  variantId: null,
  productName: 'Aspirina 100mg',
  variantName: null,
  quantity: 2,
  unitPriceCents: 5000,
  unitPriceCurrency: 'MXN',
}

const rowStubs = {
  UInputNumber: {
    name: 'UInputNumber',
    props: ['modelValue', 'min', 'disabled', 'size'],
    emits: ['update:modelValue', 'blur', 'change'],
    template: '<input type="number" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', Number($event.target.value))" @blur="$emit(\'blur\')" />',
  },
  UIcon: { template: '<i />' },
  UButton: {
    props: ['label', 'disabled', 'icon', 'size', 'color', 'variant'],
    emits: ['click'],
    template: '<button :disabled="disabled"><slot />{{ label }}</button>',
  },
  UBadge: { props: ['label'], template: '<span>{{ label }}</span>' },
  UDropdownMenu: { template: '<div><slot /></div>' },
  UTooltip: { props: ['text'], template: '<div><slot />{{ text }}</div>' },
  Tooltip: { props: ['text'], template: '<div><slot />{{ text }}</div>' },
  PriceOverrideModal: true,
  ItemDiscountModal: true,
  ProductDetailModal: true,
  AppBadge: { props: ['label'], template: '<span>{{ label }}</span>' },
  USeparator: true,
}

const totalsStubs = {
  UButton: {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  USeparator: true,
  UTooltip: { props: ['text'], template: '<span>{{ text }}<slot /></span>' },
  UIcon: true,
  UKbd: true,
  Tooltip: { props: ['text'], template: '<span><slot /></span>' },
}

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items: [rowItem],
    subtotalCents: 10000,
    discountCents: 0,
    totalCents: 10000,
    customer: null,
    shippingAddress: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/** Mounts the REAL cart panel with the same seam D3 uses (shared by D6). */
function mountCartPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const draft = makeSale()
  return track(
    mountWithUApp(ActiveSalePanel, {
      props: {
        drafts: [draft],
        activeDraft: draft,
        activeTabId: draft.id,
        portalClass: ENTRY_PORTAL,
        isLoadingList: false,
        isMutating: false,
        applicablePromotions: [],
        isLoadingPromotions: false,
        appliedManualPromotionIds: [],
        onSubmitPriceOverride: vi.fn(async () => undefined),
        onApplyDiscount: vi.fn(async () => undefined),
        onRemoveDiscount: vi.fn(async () => undefined),
        onRemoveItem: vi.fn(async () => undefined),
        onApplyGlobalDiscount: vi.fn(async () => undefined),
        onRemoveGlobalDiscount: vi.fn(async () => undefined),
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        stubs: {
          SaleItemRow: { name: 'SaleItemRow', template: '<div class="sales-pos-cart-row" />' },
          SaleTotalsFooter: {
            name: 'SaleTotalsFooter',
            props: ['sale', 'isChargePending'],
            emits: ['charge-click', 'remove-order-promo'],
            template: '<div class="sales-pos-totals" data-testid="totals-stub" />',
          },
          PriceListSelector: { name: 'PriceListSelector', template: '<div data-testid="price-list-stub" />' },
          PromocionesDisponiblesAccordion: { template: '<div />' },
          GlobalDiscountModal: { template: '<div />' },
          ConfirmModal: { template: '<div />' },
          UTabs: { template: '<div />' },
          UTooltip: { template: '<div><slot /></div>' },
          UDropdownMenu: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          USkeleton: { template: '<div />' },
          UIcon: { template: '<i />' },
        },
      },
    }),
  )
}

describe('D3 — cart hooks and public events', () => {
  it('marks the cart row and still emits the public update/remove events', async () => {
    const wrapper = track(
      mount(SaleItemRow, {
        props: {
          item: rowItem,
          saleId: 'sale-1',
          onSubmitPriceOverride: async () => undefined,
          onApplyDiscount: async () => undefined,
          onRemoveDiscount: async () => undefined,
        },
        global: { stubs: rowStubs },
      }),
    )

    expect(wrapper.get('[data-testid="sale-item-card"]').classes()).toContain('sales-pos-cart-row')
    expect(wrapper.get('[data-testid="sale-item-thumbnail"]').classes()).toContain(
      'sales-pos-cart-row-media',
    )
    expect(wrapper.get('[data-testid="sale-item-name"]').classes()).toContain(
      'sales-pos-cart-row-name',
    )

    const quantity = wrapper.get('input[role="spinbutton"]')
    await quantity.setValue('5')
    await quantity.trigger('blur')
    expect(wrapper.emitted('update-qty')).toEqual([['item-1', 5]])
  })

  it('marks the totals block and still emits charge-click', async () => {
    const wrapper = track(
      mount(SaleTotalsFooter, {
        props: { sale: makeSale(), isChargePending: false, themed: true },
        global: { stubs: totalsStubs },
      }),
    )

    expect(wrapper.classes()).toContain('sales-pos-totals')
    expect(wrapper.get('[data-testid="total-amount"]').classes()).toContain('sales-pos-total-amount')
    expect(wrapper.find('button.sales-pos-charge-button').exists()).toBe(true)

    await wrapper.get('button.sales-pos-charge-button').trigger('click')
    expect(wrapper.emitted('charge-click')).toHaveLength(1)
  })

  it('leaves the legacy charge classes byte-identical when the opt-in is omitted', () => {
    const wrapper = track(
      mount(SaleTotalsFooter, {
        props: { sale: makeSale(), isChargePending: false },
        global: { stubs: totalsStubs },
      }),
    )

    const button = wrapper.get('button')
    expect(button.classes()).toContain('!bg-(--brand-action)')
    expect(button.classes()).toContain('!text-black')
    expect(button.classes()).not.toContain('sales-pos-charge-button')
    expect(button.classes()).not.toContain('sales-entry-primary-action')
  })

  it('marks the available-promotions accordion and still emits apply/remove', async () => {
    const wrapper = track(
      mountWithUApp(PromocionesDisponiblesAccordion, {
        props: {
          promotions: [{ id: 'promo-a', title: '2x1 Aspirinas', type: 'PRODUCT_DISCOUNT' }],
        },
      }),
    )

    expect(wrapper.find('.sales-pos-promotions').exists()).toBe(true)
    expect(wrapper.find('[data-testid="promociones-disponibles-accordion"]').exists()).toBe(true)

    await wrapper.get('[data-testid="promo-apply-promo-a"]').trigger('click')
    expect(wrapper.emitted('apply')).toEqual([['promo-a']])
  })

  it('marks the cart sections and keeps the public charge/open-customer events', async () => {
    const wrapper = mountCartPanel()

    expect(wrapper.find('.sales-pos-cart-panel').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cart-body"]').classes()).toContain('sales-pos-cart-body')
    expect(wrapper.get('[data-testid="cart-footer"]').classes()).toContain('sales-pos-cart-footer')
    expect(wrapper.find('.sales-pos-customer-summary').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cart-actions-toolbar"]').classes()).toContain(
      'sales-pos-cart-toolbar',
    )

    await wrapper.get('[data-testid="assign-customer-trigger"]').trigger('click')
    expect(wrapper.emitted('open-customer-assignment')).toHaveLength(1)

    const footer = wrapper.findComponent({ name: 'SaleTotalsFooter' })
    footer.vm.$emit('charge-click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('charge-click')).toHaveLength(1)
  })
})

// ── D4 — draft strip hooks with emits preserved ─────────────────────────────

describe('D4 — draft strip hooks', () => {
  const stripDrafts: Sale[] = [
    { ...makeSale(), id: 'sale-1', items: [] },
    { ...makeSale(), id: 'sale-2', items: [rowItem] },
  ]

  it('marks the draft strip/tabs and preserves the switch/close/create events', async () => {
    const wrapper = track(
      mount(SalesTabsStrip, {
        props: { drafts: stripDrafts, activeTabId: 'sale-2' },
        global: { stubs: { UIcon: true, UButton: true } },
      }),
    )

    expect(wrapper.classes()).toContain('sales-pos-draft-strip')
    const activeTab = wrapper.get('[data-testid="tab-sale-2"]')
    expect(activeTab.classes()).toContain('sales-pos-draft-tab')
    // The prior active treatment (asserted by the component's own spec) stays.
    expect(activeTab.classes()).toContain('bg-elevated')
    expect(activeTab.classes()).toContain('shadow-sm')
    expect(activeTab.attributes('data-sales-pos-state')).toBe('active')
    expect(wrapper.get('[data-testid="tab-sale-1"]').attributes('data-sales-pos-state')).toBe(
      'idle',
    )

    await wrapper.get('[data-testid="tab-sale-1"]').trigger('click')
    expect(wrapper.emitted('switch')).toEqual([['sale-1']])
    await wrapper.get('[data-testid="close-tab-sale-1"]').trigger('click')
    expect(wrapper.emitted('close')).toEqual([['sale-1']])
    await wrapper.get('[data-testid="create-tab"]').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
  })
})

// ── D5 — the mobile cart root reached through the native drawer seam ────────

describe('D5 — native drawer keeps the exact composed boundary', () => {
  beforeEach(() => {
    mobileViewport.value = true
  })

  it('appends the cart marker to the installed Slideover content root', async () => {
    const wrapper = track(
      mount(AppResponsiveDrawer, {
        props: { open: true, title: 'Carrito', portalClass: CART_PORTAL },
        slots: { body: '<div data-testid="drawer-body" />' },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    const ui = wrapper.findComponent({ name: 'Slideover' }).props('ui') as { content: string }
    expect(ui.content).toBe(
      `h-[90dvh] max-h-[90dvh] rounded-t-2xl motion-reduce:transition-none ${CART_PORTAL}`,
    )

    const root = Array.from(
      document.body.querySelectorAll<HTMLElement>('[data-slot="content"]'),
    ).find((element) => element.classList.contains('sales-pos-cart'))!
    expect(root).toBeDefined()
    expect(root.classList.contains('sales-entry-portal')).toBe(true)
    expect(document.body.querySelector('[data-testid="drawer-body"]')).not.toBeNull()
  })
})

// ── D6 — S6 ultrawide composition and loading parity, through the real view ──

describe('D6 — bounded composition and skeleton parity (S6)', () => {
  beforeEach(() => {
    mobileViewport.value = false
    listLoading.value = false
    activeTabId.value = 'sale-1'
    drafts.value = [{ ...drafts.value[0]!, items: [...drafts.value[0]!.items] }]
  })
  afterEach(() => {
    listLoading.value = false
  })

  it('wraps the loaded two-pane split in the bounded composition row', () => {
    const wrapper = mountView()

    const split = wrapper.get('.sales-pos-split')
    // The panes are children of the bounded row, never siblings of it.
    expect(split.find('.sales-pos-catalog-pane').exists()).toBe(true)
    expect(split.find('.sales-pos-cart-pane').exists()).toBe(true)
    // Real search/catalog composition is still reached inside the bounded row.
    expect(split.find('[data-testid="product-search-stub"]').exists()).toBe(true)
    // The split stays the scrollable flex row it was: the accepted drawer
    // sequence and pane order are untouched.
    expect(split.classes()).toEqual(expect.arrayContaining(['flex-1', 'lg:flex-row', 'min-h-0']))
  })

  it('mirrors the loaded geometry while the drafts are loading', () => {
    listLoading.value = true
    const wrapper = mountView()

    const split = wrapper.get('.sales-pos-split')
    expect(split.find('.sales-pos-catalog-pane').exists()).toBe(true)
    expect(split.find('.sales-pos-cart-pane').exists()).toBe(true)
    // Same catalog grid the loaded composition uses, so the cards cannot jump
    // when the drafts arrive; the horizontal mobile cards stay single-column.
    expect(split.find('.sales-pos-product-grid').exists()).toBe(true)
    expect(split.find('.sales-pos-product-media').exists()).toBe(true)
    expect(wrapper.html()).not.toContain('grid-cols-2')
    expect(wrapper.html()).toContain('grid-cols-1')
  })

  it('keeps the customer summary in the fixed cart region, not the scrolling body', () => {
    const wrapper = mountCartPanel()

    const footer = wrapper.get('[data-testid="cart-footer"]')
    const body = wrapper.get('[data-testid="cart-body"]')
    const summary = wrapper.get('.sales-pos-customer-summary')

    // The summary lives in the shrink-proof footer, so a long cart can never
    // scroll it (or the totals/charge below it) out of the rail.
    expect(footer.element.contains(summary.element)).toBe(true)
    expect(body.element.contains(summary.element)).toBe(false)
    expect(footer.classes()).toContain('shrink-0')
    expect(body.classes()).toEqual(expect.arrayContaining(['overflow-y-auto', 'min-h-0']))
  })
})
