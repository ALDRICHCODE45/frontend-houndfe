import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import PromotionsView from '../PromotionsView.vue'
import { promotionApi } from '../../api/promotion.api'
import type { PromotionResponse } from '../../interfaces/promotion.types'

// ── Global mocks ──────────────────────────────────────────────────────────────

const mockRouterPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useRoute: () => ({ params: {}, query: {} }),
}))

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: () => ({
    pagination: { value: { pageIndex: 0, pageSize: 20 } },
    sorting: { value: [] },
    globalFilter: { value: '' },
    rowSelection: { value: {} },
    columnPinning: { value: { left: [], right: ['actions'] } },
    columnVisibility: { value: {} },
    data: { value: [] },
    totalCount: { value: 0 },
    pageCount: { value: 0 },
    isLoading: { value: false },
    isFetching: { value: false },
    refresh: vi.fn(),
    pageSizeOptions: { value: [10, 20, 50] },
    showingFrom: { value: 0 },
    showingTo: { value: 0 },
  }),
}))

vi.mock('../../api/promotion.api', () => ({
  promotionApi: {
    getPaginated: vi.fn(),
    end: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../composables/usePromotionColumns', () => ({
  usePromotionColumns: () => ({
    columns: [],
    getStatusConfig: (status: string) => ({ label: status, color: 'green', icon: '' }),
    getTypeConfig: (type: string) => ({ label: type, icon: '' }),
    getMethodConfig: (method: string) => ({ label: method, icon: '' }),
  }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: () => true,
    permissionCodes: { value: [] },
  }),
}))

// ── Stubs ─────────────────────────────────────────────────────────────────────

const STUBS = {
  AppDataTable: {
    inheritAttrs: false,
    props: ['columns', 'data', 'loading', 'empty'],
    emits: ['add', 'refresh'],
    template: `
      <div data-testid="app-data-table">
        <slot name="empty-state" />
        <button data-testid="add-btn" @click="$emit('add')">Add</button>
      </div>
    `,
  },
  TableHeaderDescription: {
    props: ['title', 'description'],
    template: '<div data-testid="table-header"><span data-testid="header-title">{{ title }}</span></div>',
  },
  ConfirmModal: {
    props: ['open', 'description', 'confirmLabel', 'confirmColor', 'loading'],
    emits: ['update:open', 'confirm'],
    template: '<div data-testid="confirm-modal" :data-open="String(open)" :data-description="description"><button data-testid="confirm-btn" @click="$emit(\'confirm\')" /></div>',
  },
  PromotionTypeSelector: {
    props: ['open'],
    emits: ['update:open', 'select'],
    template: '<div data-testid="type-selector" :data-open="String(open)" />',
  },
  UCard: {
    inheritAttrs: false,
    template: '<div v-bind="$attrs"><slot name="header" /><slot /></div>',
  },
  UButton: {
    props: ['label', 'color', 'variant', 'icon', 'loading'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
  },
  USelect: {
    props: ['modelValue', 'items', 'placeholder', 'valueKey', 'labelKey'],
    emits: ['update:modelValue'],
    template: '<div :data-value="modelValue" class="u-select-stub" />',
  },
  UBadge: {
    props: ['color', 'variant'],
    template: '<span data-testid="badge"><slot /></span>',
  },
  UDropdownMenu: {
    props: ['items'],
    template: '<div data-testid="dropdown"><slot /></div>',
  },
  UIcon: { template: '<span />' },
  SortableHeader: {
    props: ['column', 'label'],
    template: '<th>{{ label }}</th>',
  },
  SelectColumn: {
    props: ['mode', 'table', 'row'],
    template: '<div />',
  },
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
}

function mountView() {
  return mount(PromotionsView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]],
      stubs: {
        ...STUBS,
        // Ensure Nuxt UI components are all stubbed (component names vary)
        Select: true,
        USelect: {
          props: ['modelValue', 'items', 'placeholder', 'valueKey', 'labelKey'],
          emits: ['update:modelValue'],
          template: '<div :data-value="modelValue" class="u-select-stub" />',
        },
      },
    },
  })
}



// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PromotionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Renders ───────────────────────────────────────────────────────────────
  it('renders page title "Promociones"', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="header-title"]').text()).toBe('Promociones')
  })

  it('renders the AppDataTable component', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="app-data-table"]').exists()).toBe(true)
  })

  it('mounts without error', () => {
    expect(mountView().exists()).toBe(true)
  })

  // ── Type selector modal ───────────────────────────────────────────────────
  it('PromotionTypeSelector starts closed', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="type-selector"]').attributes('data-open')).toBe('false')
  })

  it('opens PromotionTypeSelector when add button is clicked', async () => {
    const wrapper = mountView()
    await wrapper.find('[data-testid="add-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="type-selector"]').attributes('data-open')).toBe('true')
  })

  // ── Confirm modal ─────────────────────────────────────────────────────────
  it('renders ConfirmModal initially closed', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('false')
  })

  // ── Filter toolbar ────────────────────────────────────────────────────────
  it('renders filter toolbar', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="filter-toolbar"]').exists()).toBe(true)
  })

  it('renders type filter select', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="filter-type"]').exists()).toBe(true)
  })

  it('renders status filter select', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="filter-status"]').exists()).toBe(true)
  })

  it('renders method filter select', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="filter-method"]').exists()).toBe(true)
  })

  it('clear filters button is hidden initially (no active filters)', () => {
    const wrapper = mountView()
    // Clear button only shows when filters are active
    expect(wrapper.find('[data-testid="clear-filters-btn"]').exists()).toBe(false)
  })

  // ── S02: Filter by type ───────────────────────────────────────────────────
  // Note: USelect from Nuxt UI is not resolved by stub name — it renders as select-stub
  // with modelvalue attribute (lowercase). We use wrapper.vm (defineExpose) for ref access.
  it('S02: filterType ref starts as empty string (default state)', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { filterType: string }
    // filterType ref is auto-unwrapped via defineExpose on wrapper.vm
    expect(vm.filterType).toBe('')
    // The select-stub element reflects modelvalue attribute (USelect auto-import behavior)
    expect(wrapper.find('[data-testid="filter-type"]').attributes('modelvalue')).toBe('')
  })

  it('S02: filterType ref updates and clear-filters button appears when type is set', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { filterType: string }
    expect(wrapper.find('[data-testid="clear-filters-btn"]').exists()).toBe(false)
    // Mutate filterType via defineExpose auto-unwrapped ref on wrapper.vm
    ;(wrapper.vm as unknown as Record<string, string>)['filterType'] = 'PRODUCT_DISCOUNT'
    await wrapper.vm.$nextTick()
    expect(vm.filterType).toBe('PRODUCT_DISCOUNT')
    // select-stub reflects the updated modelvalue
    expect(wrapper.find('[data-testid="filter-type"]').attributes('modelvalue')).toBe('PRODUCT_DISCOUNT')
    // v-if on clear-filters button becomes true
    expect(wrapper.find('[data-testid="clear-filters-btn"]').exists()).toBe(true)
  })

  it('S02: clear-filters button resets filterType to empty string on click', async () => {
    const wrapper = mountView()
    ;(wrapper.vm as unknown as Record<string, string>)['filterType'] = 'BUY_X_GET_Y'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="clear-filters-btn"]').exists()).toBe(true)
    await wrapper.find('[data-testid="clear-filters-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { filterType: string }
    expect(vm.filterType).toBe('')
    expect(wrapper.find('[data-testid="filter-type"]').attributes('modelvalue')).toBe('')
    expect(wrapper.find('[data-testid="clear-filters-btn"]').exists()).toBe(false)
  })

  // ── S03: Filter by status ─────────────────────────────────────────────────
  it('S03: filterStatus ref starts as empty string (default state)', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { filterStatus: string }
    expect(vm.filterStatus).toBe('')
    expect(wrapper.find('[data-testid="filter-status"]').attributes('modelvalue')).toBe('')
  })

  it('S03: filterStatus ref updates and clear-filters button appears when status is set', async () => {
    const wrapper = mountView()
    ;(wrapper.vm as unknown as Record<string, string>)['filterStatus'] = 'ACTIVE'
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { filterStatus: string }
    expect(vm.filterStatus).toBe('ACTIVE')
    expect(wrapper.find('[data-testid="filter-status"]').attributes('modelvalue')).toBe('ACTIVE')
    expect(wrapper.find('[data-testid="clear-filters-btn"]').exists()).toBe(true)
  })

  it('S03: clear-filters button resets filterStatus to empty on click', async () => {
    const wrapper = mountView()
    ;(wrapper.vm as unknown as Record<string, string>)['filterStatus'] = 'ENDED'
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="clear-filters-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { filterStatus: string }
    expect(vm.filterStatus).toBe('')
    expect(wrapper.find('[data-testid="filter-status"]').attributes('modelvalue')).toBe('')
  })
})

// ── Row action tests ──────────────────────────────────────────────────────────

describe('PromotionsView — Row Actions', () => {
  const samplePromotion: PromotionResponse = {
    id: 'promo-001',
    title: 'Test Promo',
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
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(promotionApi.end).mockResolvedValue({} as never)
    vi.mocked(promotionApi.remove).mockResolvedValue(undefined as never)
  })

  // ── S08: Edit navigates ──────────────────────────────────────────────────
  it('S08: Edit action navigates to /pos/promociones/:id', async () => {
    const wrapper = mountView()
    // Access getRowItems via defineExpose
    const vm = wrapper.vm as unknown as { getRowItems: (p: PromotionResponse) => unknown[][] }
    const rowItems = vm.getRowItems(samplePromotion)
    const allItems = rowItems.flat() as Array<{ label: string; onSelect: () => void }>
    const editAction = allItems.find((a) => a.label === 'Editar')
    expect(editAction).toBeDefined()
    editAction!.onSelect()
    await wrapper.vm.$nextTick()
    expect(mockRouterPush).toHaveBeenCalledWith('/pos/promociones/promo-001')
  })

  // ── S09: End action → confirm modal → API call ───────────────────────────
  it('S09: End action opens confirm modal with promotion title in description', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { getRowItems: (p: PromotionResponse) => unknown[][] }
    // Initially confirm modal is closed
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('false')
    // Trigger 'Finalizar' row action
    const rowItems = vm.getRowItems(samplePromotion)
    const allItems = rowItems.flat() as Array<{ label: string; onSelect: () => void }>
    const endAction = allItems.find((a) => a.label === 'Finalizar')
    expect(endAction).toBeDefined()
    endAction!.onSelect()
    await wrapper.vm.$nextTick()
    // Confirm modal should be open with description mentioning the promotion title
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-description')).toContain('Test Promo')
  })

  it('S09: Confirming End calls promotionApi.end with promotion id', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { getRowItems: (p: PromotionResponse) => unknown[][] }
    // Trigger end action
    const allItems = vm.getRowItems(samplePromotion).flat() as Array<{ label: string; onSelect: () => void }>
    allItems.find((a) => a.label === 'Finalizar')!.onSelect()
    await wrapper.vm.$nextTick()
    // Click confirm button
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()
    expect(promotionApi.end).toHaveBeenCalledWith('promo-001')
  })

  // ── S10: Delete action → confirm modal → API call ────────────────────────
  it('S10: Delete action opens confirm modal with promotion title in description', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { getRowItems: (p: PromotionResponse) => unknown[][] }
    const allItems = vm.getRowItems(samplePromotion).flat() as Array<{ label: string; onSelect: () => void }>
    const deleteAction = allItems.find((a) => a.label === 'Eliminar')
    expect(deleteAction).toBeDefined()
    deleteAction!.onSelect()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-description')).toContain('Test Promo')
  })

  it('S10: Confirming Delete calls promotionApi.remove with promotion id', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { getRowItems: (p: PromotionResponse) => unknown[][] }
    const allItems = vm.getRowItems(samplePromotion).flat() as Array<{ label: string; onSelect: () => void }>
    allItems.find((a) => a.label === 'Eliminar')!.onSelect()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()
    expect(promotionApi.remove).toHaveBeenCalledWith('promo-001')
  })

  // ── Promotion with ENDED status has no Finalizar action ─────────────────
  it('ENDED promotion does not show Finalizar action', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { getRowItems: (p: PromotionResponse) => unknown[][] }
    const endedPromotion: PromotionResponse = { ...samplePromotion, status: 'ENDED' }
    const allItems = vm.getRowItems(endedPromotion).flat() as Array<{ label: string; onSelect: () => void }>
    const endAction = allItems.find((a) => a.label === 'Finalizar')
    expect(endAction).toBeUndefined()
  })
})
