import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import type { Sale, PosCatalogItem } from '../../interfaces/sale.types'
import type { CategoryChip } from '../../composables/useProductSearch'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import SalesView from '../../views/SalesView.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ProductSearchPanel from '../ProductSearchPanel.vue'

/*
 * S8 / S10 — the REQUESTED catalog composition (T2, workspace unit A).
 *
 * The user's last fidelity report is specific and public:
 *   1. the v0 workspace heading `PUNTO DE VENTA` / `Nueva venta` is missing and
 *      must sit on the page canvas BEFORE the draft strip;
 *   2. the catalog controls are one titled SURFACE, not a tall decorative card
 *      that also holds the whole product grid; the title carries the REAL
 *      catalog count already exposed by `useProductSearch`;
 *   3. the products stay on the page canvas under that surface.
 *
 * These assertions are PRODUCTION DOM contracts against the real components.
 * jsdom has no layout engine, so column geometry, radii, contrast and touch
 * ergonomics are pinned as structural CSS contracts in
 * `styles/__tests__/sales-pos-workspace.spec.ts` and
 * `components/__tests__/SalesUltrawideLayout.spec.ts` — never here. Visual
 * smoke checks remain exclusively user-owned (S5).
 */

const ENTRY_PORTAL = 'hf-theme hf-ui sales-entry-portal'

// ── SalesView harness (same seam the sibling workspace specs use) ───────────

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
  ActiveSalePanel: {
    name: 'ActiveSalePanel',
    props: ['mobileSheet', 'portalClass'],
    template: '<div data-testid="active-sale-panel-stub" />',
  },
  SalesTabsStrip: { name: 'SalesTabsStrip', template: '<div data-testid="draft-strip-stub" />' },
  PaymentModal: { name: 'PaymentModal', template: '<div />' },
  PromotionCapacityRequoteModal: { template: '<div />' },
  PaymentSuccessModal: { template: '<div />' },
  ConfirmModal: { template: '<div />' },
  AssignCustomerSlideover: { name: 'AssignCustomerSlideover', template: '<div />' },
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

// ── E1 — the requested workspace heading, before the draft strip ────────────

describe('E1 — PUNTO DE VENTA / Nueva venta heading', () => {
  beforeEach(() => {
    mobileViewport.value = false
    listLoading.value = false
    activeTabId.value = 'sale-1'
  })

  it('renders the reference heading inside the sale workspace', () => {
    const wrapper = mountView()

    const header = wrapper.get('.sales-pos-workspace-header')
    expect(header.get('.sales-pos-workspace-eyebrow').text()).toBe('PUNTO DE VENTA')
    expect(header.get('.sales-pos-workspace-title').text()).toBe('Nueva venta')
  })

  it('places the heading before the draft strip in document order', () => {
    const wrapper = mountView()

    const header = wrapper.get('.sales-pos-workspace-header').element
    const strip = wrapper.get('[data-testid="draft-strip-stub"]').element

    expect(header.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the heading out of the loading skeleton geometry', () => {
    listLoading.value = true
    const wrapper = mountView()

    // The heading belongs to the loaded page canvas, not to the panes row.
    expect(wrapper.get('.sales-pos-split').find('.sales-pos-workspace-header').exists()).toBe(false)
  })
})

// ── E2 — the titled catalog controls surface and the real count ─────────────

const mockCategories = ref<CategoryChip[]>([])
const mockCategoryId = ref<string | undefined>(undefined)
const mockQuery = ref('')
const mockItems = ref<PosCatalogItem[]>([])
const mockIsLoading = ref(false)
const mockIsEmpty = ref(false)
const mockHasQuery = ref(false)
const mockTotalUnfiltered = ref(0)

vi.mock('../../composables/useProductSearch', () => ({
  useProductSearch: () => ({
    query: mockQuery,
    items: computed(() => mockItems.value),
    isLoading: computed(() => mockIsLoading.value),
    isEmpty: computed(() => mockIsEmpty.value),
    hasQuery: computed(() => mockHasQuery.value),
    categoryId: mockCategoryId,
    categories: computed(() => mockCategories.value),
    totalUnfiltered: computed(() => mockTotalUnfiltered.value),
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

const panelStubs = {
  VariantPickerModal: {
    name: 'VariantPickerModal',
    props: ['portalClass'],
    template: '<div data-testid="variant-modal-stub" />',
  },
}

function resetSearchState() {
  mockCategories.value = []
  mockCategoryId.value = undefined
  mockQuery.value = ''
  mockItems.value = []
  mockIsLoading.value = false
  mockIsEmpty.value = false
  mockHasQuery.value = false
  mockTotalUnfiltered.value = 0
}

function mountPanel(portalClass?: string) {
  return track(
    mount(ProductSearchPanel, {
      props: portalClass ? { portalClass } : {},
      global: { stubs: panelStubs },
    }),
  )
}

describe('E2 — titled catalog controls surface', () => {
  beforeEach(() => {
    resetSearchState()
  })
  afterEach(() => {
    resetSearchState()
  })

  it('renders the title, the real catalog count and the search label in the sale opt-in', () => {
    mockTotalUnfiltered.value = 6
    mockItems.value = [catalogItem]
    mockCategories.value = [{ id: 'cat-1', name: 'Medicamentos', count: 3 }]

    const wrapper = mountPanel(ENTRY_PORTAL)

    const surface = wrapper.get('.sales-pos-catalog-controls-surface')
    expect(surface.get('.sales-pos-catalog-title').text()).toBe('Catálogo de productos')
    expect(surface.get('.sales-pos-catalog-count').text()).toContain('6')
    expect(surface.text()).toContain('Buscar producto')
    // The count is the real exposed computation, not a prototype literal.
    expect(surface.get('.sales-pos-catalog-count').text()).not.toContain('3 productos')
  })

  it('uses the singular product label for a single catalog product', () => {
    mockTotalUnfiltered.value = 1

    const wrapper = mountPanel(ENTRY_PORTAL)

    expect(wrapper.get('.sales-pos-catalog-count').text()).toBe('1 producto')
  })

  it('keeps the search input, the category chips and the real result grid outside the surface', () => {
    mockItems.value = [catalogItem]
    mockCategories.value = [{ id: 'cat-1', name: 'Medicamentos', count: 3 }]
    mockTotalUnfiltered.value = 4

    const wrapper = mountPanel(ENTRY_PORTAL)

    const surface = wrapper.get('.sales-pos-catalog-controls-surface')
    // Search control and category controls live INSIDE the titled surface.
    expect(surface.find('input').exists()).toBe(true)
    expect(surface.find('[data-testid="category-chip-todo"]').exists()).toBe(true)
    // The product grid is a sibling on the page canvas, never inside the card.
    expect(surface.find('.sales-pos-product-grid').exists()).toBe(false)
    expect(wrapper.find('.sales-pos-results').exists()).toBe(true)
    expect(wrapper.find('.sales-pos-product-grid').exists()).toBe(true)
  })

  it('labels the search input from the surface label', () => {
    mockItems.value = [catalogItem]

    const wrapper = mountPanel(ENTRY_PORTAL)

    const label = wrapper.get('.sales-pos-catalog-search-label')
    const forId = label.attributes('for')
    expect(forId).toBeTruthy()
    expect(wrapper.get(`#${forId}`).element.tagName.toLowerCase()).toBe('input')
  })

  it('keeps the omitted-opt-in consumer inert (no title, no label, no sale-only id)', () => {
    mockCategories.value = [{ id: 'cat-1', name: 'Medicamentos', count: 3 }]

    const wrapper = mountPanel()

    // The surface hook is an unconditional additive class (like the other
    // workspace hooks); with no opt-in it carries only the shared chrome, so
    // no sale-only paint or content can leak from the scoped stylesheet.
    const surface = wrapper.get('.sales-pos-catalog-controls-surface')
    expect(surface.find('.sales-pos-catalog-title').exists()).toBe(false)
    expect(surface.find('.sales-pos-catalog-count').exists()).toBe(false)
    expect(surface.find('.sales-pos-catalog-search-label').exists()).toBe(false)
    expect(surface.find('input').attributes('id')).toBeUndefined()
    // The existing shared chrome is untouched.
    expect(wrapper.find('.sales-pos-catalog-controls').exists()).toBe(true)
    expect(wrapper.find('[data-testid="category-chip-todo"]').exists()).toBe(true)
  })
})
