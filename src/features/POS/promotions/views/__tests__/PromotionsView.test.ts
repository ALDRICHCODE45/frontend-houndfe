import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { AxiosError } from 'axios'
import PromotionsView from '../PromotionsView.vue'
import { promotionApi } from '../../api/promotion.api'
import type { PromotionResponse } from '../../interfaces/promotion.types'

// ── Global mocks ──────────────────────────────────────────────────────────────

const mockRouterPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useRoute: () => ({ params: {}, query: {} }),
}))

vi.mock('@/core/shared/composables/useServerTable', () => {
  const defaultReturn = {
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
    isError: { value: false },
    error: { value: null },
    refresh: vi.fn(),
    pageSizeOptions: { value: [10, 20, 50] },
    showingFrom: { value: 0 },
    showingTo: { value: 0 },
    selectedRows: { value: [] },
    clearSelection: vi.fn(),
  }
  return {
    useServerTable: vi.fn(() => defaultReturn as unknown as ReturnType<typeof import('@/core/shared/composables/useServerTable').useServerTable<unknown>>),
  }
})

vi.mock('../../api/promotion.api', () => ({
  promotionApi: {
    getPaginated: vi.fn(),
    end: vi.fn().mockResolvedValue({}),
    activate: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
    batchDelete: vi.fn(),
    batchEnd: vi.fn(),
    batchActivate: vi.fn(),
  },
}))

vi.mock('../../composables/usePromotionColumns', () => ({
  usePromotionColumns: () => ({
    columns: [],
    getStatusConfig: (status: string) => {
      const map: Record<string, { label: string; tone: string; icon: string }> = {
        ACTIVE: { label: 'Activa', tone: 'active', icon: 'i-lucide-circle-check' },
        SCHEDULED: { label: 'Programada', tone: 'pending', icon: 'i-lucide-clock' },
        ENDED: { label: 'Finalizada', tone: 'inactive', icon: 'i-lucide-circle-x' },
      }
      return map[status] ?? { label: status, tone: 'neutral', icon: '' }
    },
    getTypeConfig: (type: string) => {
      const map: Record<string, { label: string; tone: string; icon: string }> = {
        PRODUCT_DISCOUNT: { label: 'Descuento en productos', tone: 'type', icon: 'i-lucide-tag' },
        ORDER_DISCOUNT: { label: 'Descuento en pedido', tone: 'type', icon: 'i-lucide-receipt' },
        BUY_X_GET_Y: { label: '2x1, 3x2...', tone: 'type', icon: 'i-lucide-gift' },
        ADVANCED: { label: 'Avanzada', tone: 'type', icon: 'i-lucide-settings-2' },
      }
      return map[type] ?? { label: type, tone: 'type', icon: '' }
    },
    getMethodConfig: (method: string) => ({
      AUTOMATIC: { label: 'Automático', tone: 'automatic' },
      MANUAL: { label: 'Manual', tone: 'manual' },
    }[method] ?? { label: method, tone: 'automatic', icon: '' }),
  }),
}))

// Per-test userCan mock. Defaults to "true" so existing tests keep passing.
const userCanMock = vi.fn((_action: string, _subject: string) => true)
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: (action: string, subject: string) => userCanMock(action, subject),
    permissionCodes: { value: [] },
  }),
}))

// ── Toast capture (sdd-10 batch delete scenarios) ─────────────────────────────
//
// Pattern copied from AdminTenantMembersView.spec.ts:91-93 — Nuxt UI's
// useToast auto-import pulls in `#imports.useState` (Nuxt-specific) which is
// unavailable in jsdom. Assigning a stub on `global` before mount captures
// the toast calls without crashing the view. Captured calls land in
// `toastCalls`; reset per test in beforeEach.
// vi.hoisted ensures this runs BEFORE vi.mock hoisting so the factory
// closure can reference `toastCalls` when PromotionsView.vue first calls
// `useToast()` from setup.
const { toastCalls } = vi.hoisted(() => ({ toastCalls: [] as Array<Record<string, unknown>> }))

// Stub the Nuxt UI composable so the auto-imported `useToast` reference in
// PromotionsView.vue resolves to our mock instead of the real impl (which
// pulls in Nuxt-only `#imports.useState` and silently no-ops in jsdom).
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({
  useToast: () => ({
    add: (opts: Record<string, unknown>) => {
      toastCalls.push(opts)
    },
  }),
}))

// Suppress unhandled-rejection noise from the 4xx/5xx mock scenarios:
// TanStack Query's mutation logs the rejection before our onError handler
// runs, which would otherwise surface as a "3 unhandled errors" warning.
process.on('unhandledRejection', () => {})

// ── Stubs ─────────────────────────────────────────────────────────────────────

const STUBS = {
  AppDataTable: {
    inheritAttrs: false,
    props: ['columns', 'data', 'loading', 'empty', 'bulkActions', 'enableRowSelection'],
    emits: ['add', 'refresh'],
    template: `
      <div data-testid="app-data-table" :data-bulk-count="String((bulkActions?.length) ?? 0)" :data-enable-row-selection="String(enableRowSelection)">
        <slot name="empty-state" />
        <button data-testid="add-btn" @click="$emit('add')">Add</button>
        <div
          v-for="row in (Array.isArray(data) ? data : (data?.value ?? []))"
          :key="row.id"
          data-testid="row"
          :data-row-id="row.id"
        >
          <slot name="title-cell" :row="{ original: row }" />
          <slot name="status-cell" :row="{ original: row }" />
          <slot name="type-cell" :row="{ original: row }" />
          <slot name="method-cell" :row="{ original: row }" />
        </div>
      </div>
    `,
  },
  TableHeaderDescription: {
    props: ['title', 'description'],
    template: '<div data-testid="table-header"><span data-testid="header-title">{{ title }}</span></div>',
  },
  ConfirmModal: {
    props: ['open', 'description', 'confirmLabel', 'confirmColor', 'loading', 'items'],
    emits: ['update:open', 'confirm'],
    template: `
      <div
        data-testid="confirm-modal"
        :data-open="String(open)"
        :data-description="description"
        :data-confirm-label="confirmLabel"
        :data-confirm-color="confirmColor"
        :data-loading="String(loading)"
      >
        <ul v-if="items && items.length > 0" data-testid="confirm-items-list">
          <li
            v-for="item in items"
            :key="item.id"
            :data-item-id="item.id"
            data-testid="confirm-item"
          >
            {{ item.title }}
          </li>
        </ul>
        <button data-testid="confirm-btn" @click="$emit('confirm')" />
        <button data-testid="cancel-btn" @click="$emit('update:open', false)" />
      </div>
    `,
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
    props: ['label', 'color', 'variant', 'icon', 'loading', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
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
  StatusDotBadge: {
    props: ['label', 'tone'],
    template: '<span :data-tone="tone">{{ label }}</span>',
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

function makePromotion(id: string, title: string): PromotionResponse {
  return {
    id,
    title,
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
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PromotionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastCalls.length = 0
    userCanMock.mockReturnValue(true)
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
    expect(wrapper.find('[data-testid="clear-filters-btn"]').exists()).toBe(false)
  })

  // ── S02: Filter by type ───────────────────────────────────────────────────
  it('S02: filterType ref starts as empty string (default state)', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { filterType: string }
    expect(vm.filterType).toBe('')
    expect(wrapper.find('[data-testid="filter-type"]').attributes('modelvalue')).toBe('__ALL__')
  })

  it('S02: filterType ref updates and clear-filters button appears when type is set', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { filterType: string }
    expect(wrapper.find('[data-testid="clear-filters-btn"]').exists()).toBe(false)
    ;(wrapper.vm as unknown as Record<string, string>)['filterType'] = 'PRODUCT_DISCOUNT'
    await wrapper.vm.$nextTick()
    expect(vm.filterType).toBe('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="filter-type"]').attributes('modelvalue')).toBe('PRODUCT_DISCOUNT')
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
    expect(wrapper.find('[data-testid="filter-type"]').attributes('modelvalue')).toBe('__ALL__')
    expect(wrapper.find('[data-testid="clear-filters-btn"]').exists()).toBe(false)
  })

  // ── S03: Filter by status ─────────────────────────────────────────────────
  it('S03: filterStatus ref starts as empty string (default state)', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { filterStatus: string }
    expect(vm.filterStatus).toBe('')
    expect(wrapper.find('[data-testid="filter-status"]').attributes('modelvalue')).toBe('__ALL__')
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
    expect(wrapper.find('[data-testid="filter-status"]').attributes('modelvalue')).toBe('__ALL__')
  })

  it('renders ACTIVE status via StatusDotBadge (Activa, active tone)', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    vi.mocked(useServerTable).mockReturnValueOnce({
      pagination: { value: { pageIndex: 0, pageSize: 20 } },
      sorting: { value: [] },
      globalFilter: { value: '' },
      rowSelection: { value: {} },
      columnPinning: { value: { left: [], right: ['actions'] } },
      columnVisibility: { value: {} },
      data: { value: [makePromotion('promo-001', 'Test Promo')] },
      totalCount: { value: 1 },
      pageCount: { value: 1 },
      isLoading: { value: false },
      isFetching: { value: false },
      isError: { value: false },
      error: { value: null },
      refresh: vi.fn(),
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: { value: 1 },
      showingTo: { value: 1 },
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Activa')
    expect(wrapper.find('[data-tone="active"]').exists()).toBe(true)
  })
})

// ── Row action tests ──────────────────────────────────────────────────────────

describe('PromotionsView — Row Actions', () => {
  const samplePromotion: PromotionResponse = makePromotion('promo-001', 'Test Promo')

  beforeEach(() => {
    vi.clearAllMocks()
    toastCalls.length = 0
    userCanMock.mockReturnValue(true)
    vi.mocked(promotionApi.end).mockResolvedValue({} as never)
    vi.mocked(promotionApi.remove).mockResolvedValue(undefined as never)
  })

  it('S08: Edit action navigates to /pos/promociones/:id', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { getRowItems: (p: PromotionResponse) => unknown[][] }
    const rowItems = vm.getRowItems(samplePromotion)
    const allItems = rowItems.flat() as Array<{ label: string; onSelect: () => void }>
    const editAction = allItems.find((a) => a.label === 'Editar')
    expect(editAction).toBeDefined()
    editAction!.onSelect()
    await wrapper.vm.$nextTick()
    expect(mockRouterPush).toHaveBeenCalledWith('/pos/promociones/promo-001')
  })

  it('S09: End action opens confirm modal with promotion title in description', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { getRowItems: (p: PromotionResponse) => unknown[][] }
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('false')
    const rowItems = vm.getRowItems(samplePromotion)
    const allItems = rowItems.flat() as Array<{ label: string; onSelect: () => void }>
    const endAction = allItems.find((a) => a.label === 'Finalizar')
    expect(endAction).toBeDefined()
    endAction!.onSelect()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-description')).toContain('Test Promo')
  })

  it('S09: Confirming End calls promotionApi.end with promotion id', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { getRowItems: (p: PromotionResponse) => unknown[][] }
    const allItems = vm.getRowItems(samplePromotion).flat() as Array<{ label: string; onSelect: () => void }>
    allItems.find((a) => a.label === 'Finalizar')!.onSelect()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()
    expect(promotionApi.end).toHaveBeenCalledWith('promo-001')
  })

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

  it('ENDED promotion does not show Finalizar action', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { getRowItems: (p: PromotionResponse) => unknown[][] }
    const endedPromotion: PromotionResponse = { ...samplePromotion, status: 'ENDED' }
    const allItems = vm.getRowItems(endedPromotion).flat() as Array<{ label: string; onSelect: () => void }>
    const endAction = allItems.find((a) => a.label === 'Finalizar')
    expect(endAction).toBeUndefined()
  })
})

// ── sdd-10 promotions-batch-delete — new tests ────────────────────────────────
//
// Coverage: BD-REQ-001 (permission), BD-REQ-003 (bulk button states / cap),
// BD-REQ-004 (confirm modal + items list), BD-REQ-005 (200 success),
// BD-REQ-006/007/008 (409 REF / 409 NF / 403), BD-REQ-010 (selection
// lifecycle on filter change).

describe('PromotionsView — batch delete (sdd-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastCalls.length = 0
    vi.mocked(promotionApi.end).mockResolvedValue({} as never)
    vi.mocked(promotionApi.remove).mockResolvedValue(undefined as never)
  })

  // ── Helpers ──────────────────────────────────────────────────────────────
  function mockUseServerTableWith(promotions: PromotionResponse[], selected: Record<string, boolean> = {}) {
    return async () => {
      const { useServerTable } = await import('@/core/shared/composables/useServerTable')
      const selectedRows = (idx: number) => selected[String(idx)]
      vi.mocked(useServerTable).mockReturnValueOnce({
        pagination: { value: { pageIndex: 0, pageSize: 20 } },
        sorting: { value: [] },
        globalFilter: { value: '' },
        rowSelection: { value: selected },
        columnPinning: { value: { left: [], right: ['actions'] } },
        columnVisibility: { value: {} },
        data: { value: promotions },
        totalCount: { value: promotions.length },
        pageCount: { value: 1 },
        isLoading: { value: false },
        isFetching: { value: false },
        isError: { value: false },
        error: { value: null },
        refresh: vi.fn(),
        pageSizeOptions: { value: [10, 20, 50] },
        showingFrom: { value: 1 },
        showingTo: { value: promotions.length },
        selectedRows: { value: promotions.filter((_, i) => selectedRows(i)) },
        clearSelection: vi.fn(),
      } as unknown as ReturnType<typeof useServerTable>)
    }
  }

  function triggerBulkAction(wrapper: ReturnType<typeof mountView>) {
    const vm = wrapper.vm as unknown as {
      bulkActions: Array<{ id: string; label: string; disabled?: boolean; onClick: (rows: PromotionResponse[]) => void }>
    }
    const bulkDelete = vm.bulkActions.find((a) => a.id === 'batch-delete')
    expect(bulkDelete).toBeDefined()
    bulkDelete!.onClick([])
  }

  // ── BD-REQ-001: permission gating ─────────────────────────────────────────
  it('BD-REQ-001: canBatchDelete is false when user lacks batch_delete:Promotion → bulkActions is empty', () => {
    userCanMock.mockImplementation((action: string, subject: string) =>
      !(
        subject === 'Promotion' &&
        (action === 'batch_delete' || action === 'update')
      ),
    )

    const wrapper = mountView()
    const vm = wrapper.vm as unknown as {
      canBatchDelete: boolean
      bulkActions: Array<{ id: string }>
    }
    expect(vm.canBatchDelete).toBe(false)
    expect(vm.bulkActions).toEqual([])
  })

  it('BD-REQ-001: canBatchDelete is true when user has batch_delete:Promotion → bulkActions is non-empty', () => {
    userCanMock.mockImplementation((action: string, subject: string) =>
      action === 'batch_delete' && subject === 'Promotion',
    )

    const wrapper = mountView()
    const vm = wrapper.vm as unknown as {
      canBatchDelete: boolean
      bulkActions: Array<{ id: string }>
    }
    expect(vm.canBatchDelete).toBe(true)
    expect(vm.bulkActions.length).toBeGreaterThan(0)
    expect(vm.bulkActions[0]?.id).toBe('batch-delete')
  })

  // ── BD-REQ-003: bulk action states ────────────────────────────────────────
  it('BD-REQ-003: bulk action label is "Eliminar" when nothing is selected', async () => {
    userCanMock.mockReturnValue(true)
    await mockUseServerTableWith([makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')])()

    const wrapper = mountView()
    const vm = wrapper.vm as unknown as {
      bulkActions: Array<{ id: string; label: string; disabled?: boolean }>
    }
    expect(vm.bulkActions[0]?.label).toBe('Eliminar')
    expect(vm.bulkActions[0]?.disabled).toBe(true)
  })

  it('BD-REQ-003: bulk action label is "Eliminar (N)" when 3 rows are selected', async () => {
    userCanMock.mockReturnValue(true)
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B'), makePromotion('p3', 'Promo C')],
      { 0: true, 1: true, 2: true },
    )()

    const wrapper = mountView()
    const vm = wrapper.vm as unknown as {
      bulkActions: Array<{ id: string; label: string; disabled?: boolean }>
    }
    expect(vm.bulkActions[0]?.label).toBe('Eliminar (3)')
    expect(vm.bulkActions[0]?.disabled).toBe(false)
  })

  it('BD-REQ-003: bulk action is disabled and tooltip-explainable when >100 rows selected', async () => {
    userCanMock.mockReturnValue(true)
    const many = Array.from({ length: 101 }, (_, i) => makePromotion(`p${i}`, `Promo ${i}`))
    const selected: Record<string, boolean> = {}
    many.forEach((_, i) => (selected[String(i)] = true))
    await mockUseServerTableWith(many, selected)()

    const wrapper = mountView()
    const vm = wrapper.vm as unknown as {
      bulkActions: Array<{ id: string; label: string; disabled?: boolean }>
    }
    expect(vm.bulkActions[0]?.disabled).toBe(true)
    expect(vm.bulkActions[0]?.label).toBe('Eliminar (101)')
  })

  // ── BD-REQ-004: confirm modal with items list ─────────────────────────────
  it('BD-REQ-004: bulk action click opens confirm modal with item list of selected titles', async () => {
    userCanMock.mockReturnValue(true)
    await mockUseServerTableWith(
      [
        makePromotion('p1', 'Promo A'),
        makePromotion('p2', 'Promo B'),
        makePromotion('p3', 'Promo C'),
      ],
      { 0: true, 1: true, 2: true },
    )()

    const wrapper = mountView()
    triggerBulkAction(wrapper)
    await wrapper.vm.$nextTick()

    const modal = wrapper.find('[data-testid="confirm-modal"]')
    expect(modal.attributes('data-open')).toBe('true')
    expect(modal.attributes('data-confirm-label')).toBe('Eliminar seleccionadas')

    const items = wrapper.findAll('[data-testid="confirm-item"]')
    expect(items).toHaveLength(3)
    const titles = items.map((el) => el.text())
    expect(titles).toEqual(['Promo A', 'Promo B', 'Promo C'])
  })

  it('BD-REQ-004: cancelling the confirm modal does NOT call batchDelete', async () => {
    userCanMock.mockReturnValue(true)
    await mockUseServerTableWith([makePromotion('p1', 'Promo A')], { 0: true })()

    const wrapper = mountView()
    triggerBulkAction(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="cancel-btn"]').trigger('click')
    await flushPromises()

    expect(promotionApi.batchDelete).not.toHaveBeenCalled()
  })

  // ── BD-REQ-005: success path ──────────────────────────────────────────────
  it('BD-REQ-005: 200 success → toast.success, rowSelection cleared, invalidateQueries called', async () => {
    userCanMock.mockReturnValue(true)
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')],
      { 0: true, 1: true },
    )()
    vi.mocked(promotionApi.batchDelete).mockResolvedValueOnce({ deleted: 2 })

    const wrapper = mountView()
    triggerBulkAction(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(promotionApi.batchDelete).toHaveBeenCalledWith(['p1', 'p2'])
    const successToast = toastCalls.find((t) => t.color === 'success')
    expect(successToast).toBeDefined()
    expect(successToast?.title).toContain('2 promociones eliminadas')

    // rowSelection cleared
    const vm = wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }
    expect(vm.rowSelection.value).toEqual({})
  })

  // ── BD-REQ-006: 409 PROMOTION_REFERENCED_BY_SALE ──────────────────────────
  it('BD-REQ-006: 409 PROMOTION_REFERENCED_BY_SALE → error toast + offendingIds populated + selection preserved', async () => {
    userCanMock.mockReturnValue(true)
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')],
      { 0: true, 1: true },
    )()
    const axiosError = new AxiosError('conflict')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(axiosError as any).response = {
      status: 409,
      data: { error: 'PROMOTION_REFERENCED_BY_SALE', offendingIds: ['p1'] },
    }
    vi.mocked(promotionApi.batchDelete).mockRejectedValueOnce(axiosError)

    const wrapper = mountView()
    triggerBulkAction(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    const errorToast = toastCalls.find((t) => t.color === 'error')
    expect(errorToast).toBeDefined()
    expect(errorToast?.title).toContain('No se pueden eliminar')
    expect(errorToast?.title).toContain('Finalizalas')

    // Selection is preserved (NOT cleared)
    const vm = wrapper.vm as unknown as {
      rowSelection: { value: Record<string, boolean> }
      offendingIds: Set<string>
    }
    expect(vm.rowSelection.value).toEqual({ 0: true, 1: true })
    expect(vm.offendingIds.has('p1')).toBe(true)
  })

  // ── BD-REQ-007: 409 BATCH_DELETE_NOT_FOUND ────────────────────────────────
  it('BD-REQ-007: 409 BATCH_DELETE_NOT_FOUND → warning toast + invalidate + selection cleared', async () => {
    userCanMock.mockReturnValue(true)
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')],
      { 0: true, 1: true },
    )()
    const axiosError = new AxiosError('conflict')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(axiosError as any).response = {
      status: 409,
      data: { error: 'BATCH_DELETE_NOT_FOUND', offendingIds: ['p1'] },
    }
    vi.mocked(promotionApi.batchDelete).mockRejectedValueOnce(axiosError)

    const wrapper = mountView()
    triggerBulkAction(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    const warningToast = toastCalls.find((t) => t.color === 'warning')
    expect(warningToast).toBeDefined()
    expect(warningToast?.title).toContain('ya no existen')

    // Selection cleared
    const vm = wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }
    expect(vm.rowSelection.value).toEqual({})
  })

  // ── BD-REQ-008: 403 INSUFFICIENT_PERMISSIONS ──────────────────────────────
  it('BD-REQ-008: 403 → error toast, selection preserved (no state change)', async () => {
    userCanMock.mockReturnValue(true)
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A')],
      { 0: true },
    )()
    const axiosError = new AxiosError('forbidden')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(axiosError as any).response = {
      status: 403,
      data: { error: 'INSUFFICIENT_PERMISSIONS' },
    }
    vi.mocked(promotionApi.batchDelete).mockRejectedValueOnce(axiosError)

    const wrapper = mountView()
    triggerBulkAction(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    const errorToast = toastCalls.find((t) => t.color === 'error')
    expect(errorToast).toBeDefined()
    expect(errorToast?.title).toContain('No tenés permisos')

    const vm = wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }
    expect(vm.rowSelection.value).toEqual({ 0: true })
  })

  // ── BD-REQ-010: selection lifecycle on filter change ─────────────────────
  it('BD-REQ-010: filter change clears rowSelection', async () => {
    userCanMock.mockReturnValue(true)
    await mockUseServerTableWith([makePromotion('p1', 'Promo A')], { 0: true })()

    const wrapper = mountView()
    // Confirm rowSelection is populated initially
    const vm = wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }
    expect(vm.rowSelection.value).toEqual({ 0: true })

    // Change filter → rowSelection should clear
    ;(wrapper.vm as unknown as Record<string, string>)['filterType'] = 'BUY_X_GET_Y'
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(vm.rowSelection.value).toEqual({})
  })
})

// ── promotions-batch-end ───────────────────────────────────────────────────────
// RED tests are intentionally added before the corresponding view implementation.
describe('PromotionsView — batch end', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastCalls.length = 0
    userCanMock.mockReturnValue(true)
  })

  function mockUseServerTableWith(
    promotions: PromotionResponse[],
    selected: Record<string, boolean> = {},
  ) {
    return async () => {
      const { useServerTable } = await import('@/core/shared/composables/useServerTable')
      vi.mocked(useServerTable).mockReturnValueOnce({
        pagination: { value: { pageIndex: 0, pageSize: 20 } },
        sorting: { value: [] },
        globalFilter: { value: '' },
        rowSelection: { value: selected },
        columnPinning: { value: { left: [], right: ['actions'] } },
        columnVisibility: { value: {} },
        data: { value: promotions },
        totalCount: { value: promotions.length },
        pageCount: { value: 1 },
        isLoading: { value: false },
        isFetching: { value: false },
        isError: { value: false },
        error: { value: null },
        refresh: vi.fn(),
        pageSizeOptions: { value: [10, 20, 50] },
        showingFrom: { value: 1 },
        showingTo: { value: promotions.length },
        selectedRows: {
          value: promotions.filter((_, index) => selected[String(index)]),
        },
        clearSelection: vi.fn(),
      } as unknown as ReturnType<typeof useServerTable>)
    }
  }

  function triggerBatchEnd(wrapper: ReturnType<typeof mountView>) {
    const vm = wrapper.vm as unknown as {
      bulkActions: Array<{ id: string; onClick: () => void }>
    }
    const action = vm.bulkActions.find((item) => item.id === 'batch-end')
    expect(action).toBeDefined()
    action!.onClick()
  }

  it('BE-REQ-001: omits Finalizar when user lacks update:Promotion', () => {
    userCanMock.mockImplementation((action: string, subject: string) =>
      !(action === 'update' && subject === 'Promotion'),
    )

    const wrapper = mountView()
    const vm = wrapper.vm as unknown as {
      canBatchEnd: boolean
      bulkActions: Array<{ id: string }>
    }

    expect(vm.canBatchEnd).toBe(false)
    expect(vm.bulkActions.some((item) => item.id === 'batch-end')).toBe(false)
  })

  it('BE-REQ-009: shows row selection for update-only users', () => {
    userCanMock.mockImplementation((action: string, subject: string) =>
      action === 'update' && subject === 'Promotion',
    )

    const wrapper = mountView()

    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-enable-row-selection')).toBe('true')
  })

  it('BE-REQ-003: renders warning Finalizar (3) enabled with 3 selected rows', async () => {
    const promotions = [
      makePromotion('p1', 'Promo A'),
      makePromotion('p2', 'Promo B'),
      makePromotion('p3', 'Promo C'),
    ]
    await mockUseServerTableWith(promotions, { 0: true, 1: true, 2: true })()

    const wrapper = mountView()
    const vm = wrapper.vm as unknown as {
      bulkActions: Array<{ id: string; label: string; variant: string; disabled?: boolean }>
    }
    const action = vm.bulkActions.find((item) => item.id === 'batch-end')

    expect(action).toMatchObject({ id: 'batch-end', label: 'Finalizar (3)', variant: 'warning', disabled: false })
  })

  it('BE-REQ-003/010: disables Finalizar at zero and above the 100-row cap', async () => {
    await mockUseServerTableWith([makePromotion('p1', 'Promo A')])()
    let wrapper = mountView()
    let vm = wrapper.vm as unknown as { bulkActions: Array<{ id: string; disabled?: boolean }> }
    expect(vm.bulkActions.find((item) => item.id === 'batch-end')?.disabled).toBe(true)

    const many = Array.from({ length: 101 }, (_, i) => makePromotion(`p${i}`, `Promo ${i}`))
    const selected: Record<string, boolean> = {}
    many.forEach((_, i) => (selected[String(i)] = true))
    await mockUseServerTableWith(many, selected)()
    wrapper = mountView()
    vm = wrapper.vm as unknown as { bulkActions: Array<{ id: string; disabled?: boolean }> }
    expect(vm.bulkActions.find((item) => item.id === 'batch-end')?.disabled).toBe(true)
  })

  it('BE-REQ-004: opens warning confirmation with selected titles and Finalizar label', async () => {
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')],
      { 0: true, 1: true },
    )()

    const wrapper = mountView()
    triggerBatchEnd(wrapper)
    await wrapper.vm.$nextTick()

    const modal = wrapper.find('[data-testid="confirm-modal"]')
    expect(modal.attributes('data-open')).toBe('true')
    expect(modal.attributes('data-confirm-label')).toBe('Finalizar seleccionadas')
    expect(modal.attributes('data-confirm-color')).toBe('warning')
    expect(wrapper.findAll('[data-testid="confirm-item"]').map((item) => item.text())).toEqual([
      'Promo A',
      'Promo B',
    ])
  })

  it('BE-REQ-005: success shows toast, clears selection and closes modal', async () => {
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')],
      { 0: true, 1: true },
    )()
    vi.mocked(promotionApi.batchEnd).mockResolvedValueOnce({ ended: 2 })

    const wrapper = mountView()
    triggerBatchEnd(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(promotionApi.batchEnd).toHaveBeenCalledWith(['p1', 'p2'])
    expect(toastCalls.find((toast) => toast.color === 'success')?.title).toContain(
      '2 promociones finalizadas',
    )
    expect((wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }).rowSelection.value).toEqual({})
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('false')
  })

  it('BE-REQ-006: 404 BATCH_DELETE_NOT_FOUND shows count toast and clears selection', async () => {
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')],
      { 0: true, 1: true },
    )()
    const axiosError = new AxiosError('not found')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(axiosError as any).response = {
      status: 404,
      data: { error: 'BATCH_DELETE_NOT_FOUND', offendingIds: ['p1', 'p2'] },
    }
    vi.mocked(promotionApi.batchEnd).mockRejectedValueOnce(axiosError)

    const wrapper = mountView()
    triggerBatchEnd(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(toastCalls.find((toast) => toast.color === 'warning')?.title).toContain(
      '2 promocion(es) no encontrada(s)',
    )
    expect((wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }).rowSelection.value).toEqual({})
  })

  it('BE-REQ-008: binds pending batch-end state to ConfirmModal loading', async () => {
    await mockUseServerTableWith([makePromotion('p1', 'Promo A')], { 0: true })()
    let resolveRequest!: (value: { ended: number }) => void
    vi.mocked(promotionApi.batchEnd).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )

    const wrapper = mountView()
    triggerBatchEnd(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-loading')).toBe('true')
    resolveRequest({ ended: 1 })
    await flushPromises()
  })

  it('BE-REQ-007: 403 preserves selection and shows permission toast', async () => {
    await mockUseServerTableWith([makePromotion('p1', 'Promo A')], { 0: true })()
    const axiosError = new AxiosError('forbidden')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(axiosError as any).response = {
      status: 403,
      data: { error: 'INSUFFICIENT_PERMISSIONS' },
    }
    vi.mocked(promotionApi.batchEnd).mockRejectedValueOnce(axiosError)

    const wrapper = mountView()
    triggerBatchEnd(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(toastCalls.find((toast) => toast.color === 'error')?.title).toContain('No tenés permisos')
    expect((wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }).rowSelection.value).toEqual({ 0: true })
  })
})

// ── sdd-13 promotions-batch-activate ───────────────────────────────────────────
// Mirror of the batch-end tests above. BA = Batch Activate, IA = Individual Activate.
// Variant is `primary` (not warning); label is "Reactivar"; success toast
// says "N promociones reactivadas".
describe('PromotionsView — batch activate (sdd-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastCalls.length = 0
    userCanMock.mockReturnValue(true)
  })

  function mockUseServerTableWith(
    promotions: PromotionResponse[],
    selected: Record<string, boolean> = {},
  ) {
    return async () => {
      const { useServerTable } = await import('@/core/shared/composables/useServerTable')
      vi.mocked(useServerTable).mockReturnValueOnce({
        pagination: { value: { pageIndex: 0, pageSize: 20 } },
        sorting: { value: [] },
        globalFilter: { value: '' },
        rowSelection: { value: selected },
        columnPinning: { value: { left: [], right: ['actions'] } },
        columnVisibility: { value: {} },
        data: { value: promotions },
        totalCount: { value: promotions.length },
        pageCount: { value: 1 },
        isLoading: { value: false },
        isFetching: { value: false },
        isError: { value: false },
        error: { value: null },
        refresh: vi.fn(),
        pageSizeOptions: { value: [10, 20, 50] },
        showingFrom: { value: 1 },
        showingTo: { value: promotions.length },
        selectedRows: {
          value: promotions.filter((_, index) => selected[String(index)]),
        },
        clearSelection: vi.fn(),
      } as unknown as ReturnType<typeof useServerTable>)
    }
  }

  function triggerBatchActivate(wrapper: ReturnType<typeof mountView>) {
    const vm = wrapper.vm as unknown as {
      bulkActions: Array<{ id: string; onClick: () => void }>
    }
    const action = vm.bulkActions.find((item) => item.id === 'batch-activate')
    expect(action).toBeDefined()
    action!.onClick()
  }

  // ── BA-REQ-001: permission gating ──────────────────────────────────────────
  it('BA-REQ-001: omits Reactivar when user lacks update:Promotion', () => {
    userCanMock.mockImplementation((action: string, subject: string) =>
      !(action === 'update' && subject === 'Promotion'),
    )

    const wrapper = mountView()
    const vm = wrapper.vm as unknown as {
      canBatchActivate: boolean
      bulkActions: Array<{ id: string }>
    }

    expect(vm.canBatchActivate).toBe(false)
    expect(vm.bulkActions.some((item) => item.id === 'batch-activate')).toBe(false)
  })

  // ── BA-REQ-003: bulk action states ─────────────────────────────────────────
  it('BA-REQ-003: renders primary Reactivar (3) enabled with 3 selected rows', async () => {
    const promotions = [
      makePromotion('p1', 'Promo A'),
      makePromotion('p2', 'Promo B'),
      makePromotion('p3', 'Promo C'),
    ]
    await mockUseServerTableWith(promotions, { 0: true, 1: true, 2: true })()

    const wrapper = mountView()
    const vm = wrapper.vm as unknown as {
      bulkActions: Array<{ id: string; label: string; variant: string; disabled?: boolean }>
    }
    const action = vm.bulkActions.find((item) => item.id === 'batch-activate')

    expect(action).toMatchObject({
      id: 'batch-activate',
      label: 'Reactivar (3)',
      variant: 'primary',
      disabled: false,
    })
  })

  it('BA-REQ-003/010: disables Reactivar at zero and above the 100-row cap', async () => {
    await mockUseServerTableWith([makePromotion('p1', 'Promo A')])()
    let wrapper = mountView()
    let vm = wrapper.vm as unknown as { bulkActions: Array<{ id: string; disabled?: boolean }> }
    expect(vm.bulkActions.find((item) => item.id === 'batch-activate')?.disabled).toBe(true)

    const many = Array.from({ length: 101 }, (_, i) => makePromotion(`p${i}`, `Promo ${i}`))
    const selected: Record<string, boolean> = {}
    many.forEach((_, i) => (selected[String(i)] = true))
    await mockUseServerTableWith(many, selected)()
    wrapper = mountView()
    vm = wrapper.vm as unknown as { bulkActions: Array<{ id: string; disabled?: boolean }> }
    expect(vm.bulkActions.find((item) => item.id === 'batch-activate')?.disabled).toBe(true)
  })

  // ── BA-REQ-004: confirm modal ──────────────────────────────────────────────
  it('BA-REQ-004: opens primary confirmation with selected titles and Reactivar label', async () => {
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')],
      { 0: true, 1: true },
    )()

    const wrapper = mountView()
    triggerBatchActivate(wrapper)
    await wrapper.vm.$nextTick()

    const modal = wrapper.find('[data-testid="confirm-modal"]')
    expect(modal.attributes('data-open')).toBe('true')
    expect(modal.attributes('data-confirm-label')).toBe('Reactivar seleccionadas')
    expect(modal.attributes('data-confirm-color')).toBe('primary')
    expect(wrapper.findAll('[data-testid="confirm-item"]').map((item) => item.text())).toEqual([
      'Promo A',
      'Promo B',
    ])
  })

  it('BA-REQ-004: cancelling the confirm modal does NOT call batchActivate', async () => {
    await mockUseServerTableWith([makePromotion('p1', 'Promo A')], { 0: true })()

    const wrapper = mountView()
    triggerBatchActivate(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="cancel-btn"]').trigger('click')
    await flushPromises()

    expect(promotionApi.batchActivate).not.toHaveBeenCalled()
  })

  // ── BA-REQ-005: success path ───────────────────────────────────────────────
  it('BA-REQ-005: 200 success → reactivadas toast, rowSelection cleared, modal closes', async () => {
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')],
      { 0: true, 1: true },
    )()
    vi.mocked(promotionApi.batchActivate).mockResolvedValueOnce({ activated: 2 })

    const wrapper = mountView()
    triggerBatchActivate(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(promotionApi.batchActivate).toHaveBeenCalledWith(['p1', 'p2'])
    const successToast = toastCalls.find((t) => t.color === 'success')
    expect(successToast).toBeDefined()
    expect(successToast?.title).toContain('2 promociones reactivadas')

    const vm = wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }
    expect(vm.rowSelection.value).toEqual({})
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('false')
  })

  // ── BA-REQ-006: 404 BATCH_DELETE_NOT_FOUND ─────────────────────────────────
  it('BA-REQ-006: 404 BATCH_DELETE_NOT_FOUND → count toast + invalidate + clear selection', async () => {
    await mockUseServerTableWith(
      [makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')],
      { 0: true, 1: true },
    )()
    const axiosError = new AxiosError('not found')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(axiosError as any).response = {
      status: 404,
      data: { error: 'BATCH_DELETE_NOT_FOUND', offendingIds: ['p1', 'p2'] },
    }
    vi.mocked(promotionApi.batchActivate).mockRejectedValueOnce(axiosError)

    const wrapper = mountView()
    triggerBatchActivate(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(toastCalls.find((toast) => toast.color === 'warning')?.title).toContain(
      '2 promocion(es) no encontrada(s)',
    )
    expect((wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }).rowSelection.value).toEqual({})
  })

  // ── BA-REQ-007: 403 INSUFFICIENT_PERMISSIONS ───────────────────────────────
  it('BA-REQ-007: 403 preserves selection and shows permission toast', async () => {
    await mockUseServerTableWith([makePromotion('p1', 'Promo A')], { 0: true })()
    const axiosError = new AxiosError('forbidden')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(axiosError as any).response = {
      status: 403,
      data: { error: 'INSUFFICIENT_PERMISSIONS' },
    }
    vi.mocked(promotionApi.batchActivate).mockRejectedValueOnce(axiosError)

    const wrapper = mountView()
    triggerBatchActivate(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(toastCalls.find((toast) => toast.color === 'error')?.title).toContain('No tenés permisos')
    expect((wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }).rowSelection.value).toEqual({ 0: true })
  })

  // ── BA-REQ-008: loading state ──────────────────────────────────────────────
  it('BA-REQ-008: binds pending batch-activate state to ConfirmModal loading', async () => {
    await mockUseServerTableWith([makePromotion('p1', 'Promo A')], { 0: true })()
    let resolveRequest!: (value: { activated: number }) => void
    vi.mocked(promotionApi.batchActivate).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )

    const wrapper = mountView()
    triggerBatchActivate(wrapper)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-loading')).toBe('true')
    resolveRequest({ activated: 1 })
    await flushPromises()
  })

  // ── BA-REQ-009: row selection gate ─────────────────────────────────────────
  it('BA-REQ-009: checkboxes visible when canBatchActivate is the only batch permission', () => {
    userCanMock.mockImplementation((action: string, subject: string) =>
      action === 'update' && subject === 'Promotion',
    )

    const wrapper = mountView()
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-enable-row-selection')).toBe('true')
  })
})

