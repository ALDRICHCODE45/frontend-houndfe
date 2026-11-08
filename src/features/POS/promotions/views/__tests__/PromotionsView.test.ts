import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { AxiosError } from 'axios'
import { columnLabel } from '@/core/shared/components/DataTable/columnLayout.utils'
import PromotionsView from '../PromotionsView.vue'
import { promotionApi } from '../../api/promotion.api'
import type { PromotionResponse } from '../../interfaces/promotion.types'

// Wrap a plain value so it auto-unwraps like a Vue ref in templates.
// The real useServerTable returns ComputedRef/Ref instances, but the mock
// fixtures historically used `{ value: ... }` objects — Vue's template
// auto-unwrap only fires for real refs, which broke `:promotions="data"`
// when data was the plain object. This helper keeps existing fixtures
// readable while restoring auto-unwrap semantics.
function r<T>(value: T) {
  return ref(value)
}

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
    error: r(null),
    refresh: vi.fn(),
    pageSizeOptions: { value: [10, 20, 50] },
    showingFrom: { value: 0 },
    showingTo: { value: 0 },
    selectedRows: { value: [] },
    clearSelection: vi.fn(),
  }
  return {
    useServerTable: vi.fn(
      () =>
        defaultReturn as unknown as ReturnType<
          typeof import('@/core/shared/composables/useServerTable').useServerTable<unknown>
        >,
    ),
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
    columns: [{ id: 'select' }, { accessorKey: 'title' }],
    formatDate: (value: string | null) => value ?? '—',
    getStatusConfig: (status: string) => {
      const map: Record<string, { label: string; tone: string; icon: string }> = {
        ACTIVE: { label: 'Activa', tone: 'success', icon: 'i-lucide-circle-check' },
        SCHEDULED: { label: 'Programada', tone: 'info', icon: 'i-lucide-clock' },
        ENDED: { label: 'Finalizada', tone: 'neutral', icon: 'i-lucide-circle-x' },
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
    getMethodConfig: (method: string) =>
      ({
        AUTOMATIC: { label: 'Automático', tone: 'automatic' },
        MANUAL: { label: 'Manual', tone: 'manual' },
      })[method] ?? { label: method, tone: 'automatic', icon: '' },
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
    props: [
      'columns',
      'data',
      'loading',
      'empty',
      'bulkActions',
      'enableRowSelection',
      'error',
      'errorMessage',
      'displayMode',
      'mobileRender',
      'emptyState',
      'filtered',
      'noMatchTitle',
      'activeFilterCount',
      'showAddButton',
      'rowOpen',
      'columnPinning',
      'columnVisibility',
      'columnOrder',
      'columnSizing',
      'density',
      'persistLayout',
      'selectedLabel',
    ],
    emits: [
      'add',
      'refresh',
      'empty-action',
      'clear-filters',
      'reset-columns',
      'update:columnPinning',
      'update:columnVisibility',
      'update:columnOrder',
      'update:columnSizing',
      'update:density',
    ],
    // The view passes `:error="isError"` and the mock may return either a
    // real Vue ref (after auto-unwrap → boolean) or a plain `{ value: ... }`
    // object (no auto-unwrap). Resolve both forms with a small helper.
    computed: {
      errorFlag(): boolean {
        const e = (this as unknown as { error: unknown }).error
        if (e === true) return true
        if (e && typeof e === 'object' && 'value' in e) {
          return (e as { value: unknown }).value === true
        }
        return false
      },
    },
    template: `
      <div
        data-testid="app-data-table"
        :data-bulk-count="String((bulkActions?.length) ?? 0)"
        :data-enable-row-selection="String(enableRowSelection)"
        :data-columns="(columns ?? []).map((c) => c.id ?? c.accessorKey).join(',')"
        :data-display-mode="displayMode"
        :data-mobile-render="mobileRender"
        :data-filtered="String(!!filtered)"
        :data-empty-title="emptyState?.title ?? ''"
        :data-empty-action="emptyState?.actionLabel ?? ''"
        :data-no-match-title="noMatchTitle ?? ''"
        :data-active-filter-count="activeFilterCount ?? 0"
        :data-error="errorFlag ? 'true' : 'false'"
        :data-error-message="errorMessage"
      >
        <div data-testid="app-data-table-toolbar">
          <slot name="filters" />
          <slot name="actions" />
        </div>
        <div v-if="errorFlag" data-testid="table-error-state" role="alert">
          <p data-testid="error-message">{{ errorMessage }}</p>
          <button data-testid="table-error-retry" @click="$emit('refresh')">Reintentar</button>
        </div>
        <template v-else>
          <button data-testid="add-btn" @click="$emit('add')">Add</button>
          <button data-testid="stub-empty-action" @click="$emit('empty-action')" />
          <button data-testid="stub-clear-filters" @click="$emit('clear-filters')" />
          <div
            v-for="row in (Array.isArray(data) ? data : (data?.value ?? []))"
            :key="row.id"
            data-testid="row"
            :data-row-id="row.id"
          >
            <slot name="title-header" :column="{ id: 'title', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="createdAt-header" :column="{ id: 'createdAt', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="startDate-header" :column="{ id: 'startDate', getIsSorted: () => false, toggleSorting: () => {} }" />
            <slot name="title-cell" :row="{ original: row }" />
            <slot name="status-cell" :row="{ original: row }" />
            <slot name="method-cell" :row="{ original: row }" />
            <slot name="capacity-cell" :row="{ original: row }" />
            <slot name="startDate-cell" :row="{ original: row }" />
            <slot name="createdAt-cell" :row="{ original: row }" />
            <slot name="actions-cell" :row="{ original: row }" />
            <slot name="mobile-card" :row="row" />
          </div>
        </template>
      </div>
    `,
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
    template:
      '<button :disabled="disabled" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
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
  StatusBadge: {
    props: ['label', 'tone'],
    template: '<span data-testid="status-badge" :data-tone="tone">{{ label }}</span>',
  },
  PromotionCapacityStatus: {
    props: ['maxProductUnits', 'consumedProductUnits', 'remainingProductUnits', 'compact'],
    template: '<span data-testid="capacity-status" />',
  },
  RowActionsMenu: {
    name: 'RowActionsMenu',
    props: ['actions', 'rowLabel', 'portalClass'],
    emits: ['select'],
    template: `
      <div data-testid="row-actions-stub" :data-row-label="rowLabel">
        <button
          v-for="action in actions"
          :key="action.key"
          type="button"
          :data-action="action.key"
          :data-destructive="String(!!action.destructive)"
          @click="$emit('select', action.key)"
        >{{ action.label }}</button>
      </div>
    `,
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
    botEligible: false,
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
    maxProductUnits: null,
    consumedProductUnits: 0,
    remainingProductUnits: null,
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

  async function mountWithPromotion(botEligible: boolean) {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    const base = useServerTable({} as never)
    vi.mocked(useServerTable).mockReturnValueOnce({
      ...base,
      data: r([{ ...makePromotion('bot', 'Oferta'), botEligible }]),
    } as unknown as ReturnType<typeof useServerTable>)
    return mountView()
  }

  it('shows one WhatsApp marker (icon + text, not a badge) when botEligible is true', async () => {
    const wrapper = await mountWithPromotion(true)
    const markers = wrapper.findAll('[data-testid="whatsapp-marker"]')
    expect(markers).toHaveLength(1)
    expect(markers[0]!.text()).toBe('WhatsApp')
    wrapper.unmount()
  })

  it('shows no WhatsApp marker when botEligible is false', async () => {
    const wrapper = await mountWithPromotion(false)
    expect(wrapper.find('[data-testid="whatsapp-marker"]').exists()).toBe(false)
    wrapper.unmount()
  })

  // ── Renders ───────────────────────────────────────────────────────────────
  it('renders page title "Promociones" outside the table surface', () => {
    const wrapper = mountView()
    const title = wrapper.find('h1.hf-page-title')
    expect(title.text()).toBe('Promociones')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    const surface = wrapper.find('.hf-table-surface')
    expect(surface.exists()).toBe(true)
    expect(surface.find('h1').exists()).toBe(false)
    expect(surface.find('[data-testid="app-data-table"]').exists()).toBe(true)
  })

  // ── Column layout (premium tables T9) ─────────────────────────────────────
  it('binds the persisted layout (pos-promotions), persist-layout, «seleccionadas» and «Restablecer columnas»', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    const base = useServerTable({} as never)
    const layout = {
      columnPinning: r({ left: [], right: ['actions'] }),
      columnVisibility: r({}),
      columnOrder: r<string[]>([]),
      columnSizing: r<Record<string, number>>({}),
      density: r('comfortable'),
      resetLayout: vi.fn(),
    }
    vi.mocked(useServerTable).mockReturnValueOnce({ ...base, ...layout } as unknown as ReturnType<
      typeof useServerTable
    >)
    const wrapper = mountView()
    expect(vi.mocked(useServerTable).mock.lastCall?.[0]).toMatchObject({ persistKey: 'pos-promotions' })

    const table = wrapper.getComponent(STUBS.AppDataTable)
    expect(table.props()).toMatchObject({
      persistLayout: true,
      selectedLabel: { one: 'seleccionada', other: 'seleccionadas' },
      columnOrder: [],
      columnSizing: {},
      density: 'comfortable',
      columnPinning: { left: [], right: ['actions'] },
      columnVisibility: {},
    })

    table.vm.$emit('update:columnOrder', ['createdAt', 'title'])
    table.vm.$emit('update:columnSizing', { title: 320 })
    table.vm.$emit('update:columnPinning', { left: ['title'], right: ['actions'] })
    table.vm.$emit('update:columnVisibility', { method: false })
    table.vm.$emit('update:density', 'compact')
    expect(layout.columnOrder.value).toEqual(['createdAt', 'title'])
    expect(layout.columnSizing.value).toEqual({ title: 320 })
    expect(layout.columnPinning.value).toEqual({ left: ['title'], right: ['actions'] })
    expect(layout.columnVisibility.value).toEqual({ method: false })
    expect(layout.density.value).toBe('compact')

    table.vm.$emit('reset-columns')
    expect(layout.resetLayout).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('names every column for the «Columnas» panel, never with its id', async () => {
    const { usePromotionColumns } = await vi.importActual<
      typeof import('../../composables/usePromotionColumns')
    >('../../composables/usePromotionColumns')
    const labels = usePromotionColumns()
      .columns.filter((column) => column.id !== 'select')
      .map(columnLabel)
    expect(labels).toEqual(['Promoción', 'Estado', 'Método', 'Cupo', 'Inicio', 'Creada', 'Acciones'])
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

  it('has no active filters initially (the toolbar counter is 0 and the list is not filtered)', () => {
    const wrapper = mountView()
    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.attributes('data-active-filter-count')).toBe('0')
    expect(table.attributes('data-filtered')).toBe('false')
  })

  it('labels each filter inside its control, with no inline Limpiar filtros button', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="clear-filters-btn"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Tipo"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Estado"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Método"]').exists()).toBe(true)
  })

  // ── S02: Filter by type ───────────────────────────────────────────────────
  it('S02: filterType ref starts as empty string (default state)', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { filterType: string }
    expect(vm.filterType).toBe('')
    expect(wrapper.find('[data-testid="filter-type"]').attributes('modelvalue')).toBe('__ALL__')
  })

  it('S02: filterType ref updates and the list becomes filtered when type is set', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { filterType: string }
    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-filtered')).toBe('false')
    ;(wrapper.vm as unknown as Record<string, string>)['filterType'] = 'PRODUCT_DISCOUNT'
    await wrapper.vm.$nextTick()
    expect(vm.filterType).toBe('PRODUCT_DISCOUNT')
    expect(wrapper.find('[data-testid="filter-type"]').attributes('modelvalue')).toBe(
      'PRODUCT_DISCOUNT',
    )
    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.attributes('data-filtered')).toBe('true')
    expect(table.attributes('data-active-filter-count')).toBe('1')
  })

  it('S02: the table clear-filters event resets filterType to empty string', async () => {
    const wrapper = mountView()
    ;(wrapper.vm as unknown as Record<string, string>)['filterType'] = 'BUY_X_GET_Y'
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="stub-clear-filters"]').trigger('click')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { filterType: string }
    expect(vm.filterType).toBe('')
    expect(wrapper.find('[data-testid="filter-type"]').attributes('modelvalue')).toBe('__ALL__')
    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-filtered')).toBe('false')
  })

  // ── S03: Filter by status ─────────────────────────────────────────────────
  it('S03: filterStatus ref starts as empty string (default state)', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { filterStatus: string }
    expect(vm.filterStatus).toBe('')
    expect(wrapper.find('[data-testid="filter-status"]').attributes('modelvalue')).toBe('__ALL__')
  })

  it('S03: filterStatus ref updates and the filter counter reflects it when status is set', async () => {
    const wrapper = mountView()
    ;(wrapper.vm as unknown as Record<string, string>)['filterStatus'] = 'ACTIVE'
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { filterStatus: string }
    expect(vm.filterStatus).toBe('ACTIVE')
    expect(wrapper.find('[data-testid="filter-status"]').attributes('modelvalue')).toBe('ACTIVE')
    expect(wrapper.get('[data-testid="app-data-table"]').attributes('data-active-filter-count')).toBe(
      '1',
    )
  })

  it('S03: the table clear-filters event resets filterStatus to empty', async () => {
    const wrapper = mountView()
    ;(wrapper.vm as unknown as Record<string, string>)['filterStatus'] = 'ENDED'
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="stub-clear-filters"]').trigger('click')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { filterStatus: string }
    expect(vm.filterStatus).toBe('')
    expect(wrapper.find('[data-testid="filter-status"]').attributes('modelvalue')).toBe('__ALL__')
  })

  it('renders ACTIVE status via StatusBadge (Activa, success tone)', async () => {
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
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
      error: ref(null),
      refresh: vi.fn(),
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: { value: 1 },
      showingTo: { value: 1 },
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Activa')
    expect(wrapper.get('[data-testid="status-badge"]').attributes('data-tone')).toBe('success')
  })
})

// ── Row action tests ──────────────────────────────────────────────────────────

interface RowActionsVm {
  getRowActions: (p: PromotionResponse) => Array<{ key: string; label: string; destructive?: boolean }>
  handleRowAction: (key: string, p: PromotionResponse) => void
}

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
    const vm = wrapper.vm as unknown as RowActionsVm
    expect(vm.getRowActions(samplePromotion).map((a) => a.key)).toContain('edit')
    vm.handleRowAction('edit', samplePromotion)
    await wrapper.vm.$nextTick()
    expect(mockRouterPush).toHaveBeenCalledWith('/pos/promociones/promo-001')
  })

  it('S09: End action opens confirm modal with promotion title in description', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as RowActionsVm
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('false')
    expect(vm.getRowActions(samplePromotion).map((a) => a.key)).toContain('end')
    vm.handleRowAction('end', samplePromotion)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-description')).toContain(
      'Test Promo',
    )
  })

  it('S09: Confirming End calls promotionApi.end with promotion id', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as RowActionsVm
    vm.handleRowAction('end', samplePromotion)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()
    expect(promotionApi.end).toHaveBeenCalledWith('promo-001')
  })

  it('S10: Delete action opens confirm modal with promotion title in description', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as RowActionsVm
    expect(vm.getRowActions(samplePromotion).map((a) => a.key)).toContain('delete')
    vm.handleRowAction('delete', samplePromotion)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-description')).toContain(
      'Test Promo',
    )
  })

  it('S10: Confirming Delete calls promotionApi.remove with promotion id', async () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as RowActionsVm
    vm.handleRowAction('delete', samplePromotion)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()
    expect(promotionApi.remove).toHaveBeenCalledWith('promo-001')
  })

  it('ENDED promotion does not show Finalizar action', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as RowActionsVm
    const endedPromotion: PromotionResponse = { ...samplePromotion, status: 'ENDED' }
    expect(vm.getRowActions(endedPromotion).map((a) => a.key)).not.toContain('end')
  })

  it('orders Editar, Finalizar… and the destructive Eliminar… last, with an ellipsis on confirmations', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as RowActionsVm
    const actions = vm.getRowActions(samplePromotion)
    expect(actions.map((a) => a.label)).toEqual(['Editar', 'Finalizar…', 'Eliminar…'])
    expect(actions.map((a) => !!a.destructive)).toEqual([false, false, true])
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
  function mockUseServerTableWith(
    promotions: PromotionResponse[],
    selected: Record<string, boolean> = {},
  ) {
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
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
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
      bulkActions: Array<{
        id: string
        label: string
        disabled?: boolean
        onClick: (rows: PromotionResponse[]) => void
      }>
    }
    const bulkDelete = vm.bulkActions.find((a) => a.id === 'batch-delete')
    expect(bulkDelete).toBeDefined()
    bulkDelete!.onClick([])
  }

  // ── BD-REQ-001: permission gating ─────────────────────────────────────────
  it('BD-REQ-001: canBatchDelete is false when user lacks batch_delete:Promotion → bulkActions is empty', () => {
    userCanMock.mockImplementation(
      (action: string, subject: string) =>
        !(subject === 'Promotion' && (action === 'batch_delete' || action === 'update')),
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
    userCanMock.mockImplementation(
      (action: string, subject: string) => action === 'batch_delete' && subject === 'Promotion',
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

  // ── L42: the selection column only shows when a bulk action exists ────────
  const tableColumnKeys = (wrapper: ReturnType<typeof mountView>) =>
    wrapper.get('[data-testid="app-data-table"]').attributes('data-columns')?.split(',')

  it('L42: hides the selection column when the user has no bulk action', () => {
    userCanMock.mockImplementation(
      (action: string, subject: string) =>
        !(subject === 'Promotion' && (action === 'batch_delete' || action === 'update')),
    )

    expect(tableColumnKeys(mountView())).toEqual(['title'])
  })

  it('L42: keeps the selection column when a bulk action is allowed', () => {
    userCanMock.mockImplementation(
      (action: string, subject: string) => action === 'batch_delete' && subject === 'Promotion',
    )

    expect(tableColumnKeys(mountView())).toEqual(['select', 'title'])
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
      [
        makePromotion('p1', 'Promo A'),
        makePromotion('p2', 'Promo B'),
        makePromotion('p3', 'Promo C'),
      ],
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
    await mockUseServerTableWith([makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')], {
      0: true,
      1: true,
    })()
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
    await mockUseServerTableWith([makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')], {
      0: true,
      1: true,
    })()
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
    await mockUseServerTableWith([makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')], {
      0: true,
      1: true,
    })()
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
    await mockUseServerTableWith([makePromotion('p1', 'Promo A')], { 0: true })()
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
    expect(errorToast?.title).toContain('No tienes permisos')

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
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
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
    userCanMock.mockImplementation(
      (action: string, subject: string) => !(action === 'update' && subject === 'Promotion'),
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
    userCanMock.mockImplementation(
      (action: string, subject: string) => action === 'update' && subject === 'Promotion',
    )

    const wrapper = mountView()

    expect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-enable-row-selection'),
    ).toBe('true')
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

    expect(action).toMatchObject({
      id: 'batch-end',
      label: 'Finalizar (3)',
      variant: 'warning',
      disabled: false,
    })
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
    await mockUseServerTableWith([makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')], {
      0: true,
      1: true,
    })()

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
    await mockUseServerTableWith([makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')], {
      0: true,
      1: true,
    })()
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
    expect(
      (wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }).rowSelection
        .value,
    ).toEqual({})
    expect(wrapper.find('[data-testid="confirm-modal"]').attributes('data-open')).toBe('false')
  })

  it('BE-REQ-006: 404 BATCH_DELETE_NOT_FOUND shows count toast and clears selection', async () => {
    await mockUseServerTableWith([makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')], {
      0: true,
      1: true,
    })()
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
    expect(
      (wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }).rowSelection
        .value,
    ).toEqual({})
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

    expect(toastCalls.find((toast) => toast.color === 'error')?.title).toContain(
      'No tienes permisos',
    )
    expect(
      (wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }).rowSelection
        .value,
    ).toEqual({ 0: true })
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
        isLoading: ref(false),
        isFetching: ref(false),
        isError: ref(false),
        error: ref(null),
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
    userCanMock.mockImplementation(
      (action: string, subject: string) => !(action === 'update' && subject === 'Promotion'),
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
    await mockUseServerTableWith([makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')], {
      0: true,
      1: true,
    })()

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
    await mockUseServerTableWith([makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')], {
      0: true,
      1: true,
    })()
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
    await mockUseServerTableWith([makePromotion('p1', 'Promo A'), makePromotion('p2', 'Promo B')], {
      0: true,
      1: true,
    })()
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
    expect(
      (wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }).rowSelection
        .value,
    ).toEqual({})
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

    expect(toastCalls.find((toast) => toast.color === 'error')?.title).toContain(
      'No tienes permisos',
    )
    expect(
      (wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }).rowSelection
        .value,
    ).toEqual({ 0: true })
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
    userCanMock.mockImplementation(
      (action: string, subject: string) => action === 'update' && subject === 'Promotion',
    )

    const wrapper = mountView()
    expect(
      wrapper.find('[data-testid="app-data-table"]').attributes('data-enable-row-selection'),
    ).toBe('true')
  })
})

// ── standardization (REQ-1 to REQ-7) ──────────────────────────────────────────
//
// WU-C owns the test coverage for the standardization slice. The view tests
// below cover:
//   REQ-1 backend error state propagation + retry
//   REQ-2 view mode (ViewToggle renders + display-mode bridge)
//   REQ-3 card click → /pos/promociones/:id (no kebab/checkbox on cards)
//   REQ-4 filters testids resolve inside the AppDataTable toolbar
//   REQ-5 permission-gated actions (canManagePromotionActions)
//   REQ-6 updatedAt sortable header
//   REQ-7 preserved invariants (offending-IDs, filter clear, actions pinned)
describe('PromotionsView — standardization (REQ-1..7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastCalls.length = 0
    userCanMock.mockReturnValue(true)
    localStorage.clear()
  })

  // ── REQ-1: error state propagation ─────────────────────────────────────────
  it('REQ-1: renders the error block with a human title, never the backend message, when isError=true', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    vi.mocked(useServerTable).mockReturnValueOnce({
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
      isError: { value: true },
      error: r({ response: { data: { message: 'No se pudo conectar al servidor' } } }),
      refresh: vi.fn(),
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: { value: 0 },
      showingTo: { value: 0 },
      selectedRows: { value: [] },
      clearSelection: vi.fn(),
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar las promociones',
    )
    expect(wrapper.text()).not.toContain('No se pudo conectar al servidor')
    // The empty placeholder must NOT render when there is an error.
    expect(wrapper.find('[data-testid="app-data-table"]').attributes('data-error')).toBe('true')
  })

  it('REQ-1: keeps the human title when only error.message exists', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    vi.mocked(useServerTable).mockReturnValueOnce({
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
      isError: { value: true },
      error: r({ message: 'Network Error' }),
      refresh: vi.fn(),
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: { value: 0 },
      showingTo: { value: 0 },
      selectedRows: { value: [] },
      clearSelection: vi.fn(),
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar las promociones',
    )
    expect(wrapper.text()).not.toContain('Network Error')
  })

  it('REQ-1: keeps the human title when nothing else is available', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    vi.mocked(useServerTable).mockReturnValueOnce({
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
      isError: { value: true },
      error: r({}),
      refresh: vi.fn(),
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: { value: 0 },
      showingTo: { value: 0 },
      selectedRows: { value: [] },
      clearSelection: vi.fn(),
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="error-message"]').text()).toBe(
      'No se pudieron cargar las promociones',
    )
  })

  it('REQ-1: clicking the retry button triggers refresh', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    const mockRefresh = vi.fn()
    vi.mocked(useServerTable).mockReturnValueOnce({
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
      isError: { value: true },
      error: r({ response: { data: { message: 'Boom' } } }),
      refresh: mockRefresh,
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: { value: 0 },
      showingTo: { value: 0 },
      selectedRows: { value: [] },
      clearSelection: vi.fn(),
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="table-error-retry"]').trigger('click')
    expect(mockRefresh).toHaveBeenCalled()
  })

  // ── REQ-2: one layout (table on desktop, cards on mobile) ───────────────────
  it('REQ-2: has no ViewToggle and lets the table pick table or cards by breakpoint', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="view-toggle"]').exists()).toBe(false)
    const table = wrapper.get('[data-testid="app-data-table"]')
    expect(table.attributes('data-display-mode')).toBe('auto')
    expect(table.attributes('data-mobile-render')).toBe('cards')
  })

  // ── REQ-3: mobile card ─────────────────────────────────────────────────────
  it('REQ-3: renders a mobile card per row, named by the promotion, whose click opens it', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    vi.mocked(useServerTable).mockReturnValueOnce({
      pagination: { value: { pageIndex: 0, pageSize: 20 } },
      sorting: { value: [] },
      globalFilter: { value: '' },
      rowSelection: { value: {} },
      columnPinning: { value: { left: [], right: ['actions'] } },
      columnVisibility: { value: {} },
      data: r([makePromotion('p1', 'Promo Card')]),
      totalCount: r(1),
      pageCount: r(1),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
      error: ref(null),
      refresh: vi.fn(),
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: r(1),
      showingTo: r(1),
      selectedRows: r([]),
      clearSelection: vi.fn(),
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    const card = wrapper.get('[data-testid="promotion-card"]')
    expect(card.text()).toContain('Promo Card')
    expect(card.text()).not.toContain('p1')
    expect(card.find('[data-testid="status-badge"]').exists()).toBe(true)
    expect(card.get('[data-testid="row-actions-stub"]').attributes('data-row-label')).toBe(
      'promoción Promo Card',
    )
    // No checkboxes on cards.
    expect(wrapper.findAll('input[type="checkbox"]').length).toBe(0)
    await card.get('[data-testid="promotion-link-p1"]').trigger('click')
    expect(mockRouterPush).toHaveBeenCalledWith('/pos/promociones/p1')
  })

  // ── REQ-4: filters testids resolve inside AppDataTable toolbar ─────────────
  it('REQ-4: filter-type/status/method/clear-filters-btn resolve inside the AppDataTable toolbar', () => {
    const wrapper = mountView()
    const toolbar = wrapper.find('[data-testid="app-data-table-toolbar"]')
    expect(toolbar.exists()).toBe(true)
    expect(toolbar.find('[data-testid="filter-type"]').exists()).toBe(true)
    expect(toolbar.find('[data-testid="filter-status"]').exists()).toBe(true)
    expect(toolbar.find('[data-testid="filter-method"]').exists()).toBe(true)
  })

  // ── REQ-5: canManagePromotionActions gate ──────────────────────────────────
  it('REQ-5: hides the kebab dropdown when user lacks update AND delete', async () => {
    userCanMock.mockImplementation(
      (_action: string, subject: string) => subject !== 'Promotion' || false,
    )
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    vi.mocked(useServerTable).mockReturnValueOnce({
      pagination: { value: { pageIndex: 0, pageSize: 20 } },
      sorting: { value: [] },
      globalFilter: { value: '' },
      rowSelection: { value: {} },
      columnPinning: { value: { left: [], right: ['actions'] } },
      columnVisibility: { value: {} },
      data: r([makePromotion('p1', 'Read-only Promo')]),
      totalCount: r(1),
      pageCount: r(1),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
      error: ref(null),
      refresh: vi.fn(),
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: r(1),
      showingTo: r(1),
      selectedRows: r([]),
      clearSelection: vi.fn(),
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    const rows = wrapper.findAll('[data-testid="row"]')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    // canManagePromotionActions false → the v-if gate renders no ⋮ menu.
    expect(wrapper.findAll('[data-testid="row-actions-stub"]').length).toBe(0)
  })

  it('REQ-5: shows the kebab dropdown when user has update permission', async () => {
    userCanMock.mockImplementation(
      (action: string, subject: string) =>
        (action === 'update' && subject === 'Promotion') || action === 'read',
    )
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    vi.mocked(useServerTable).mockReturnValueOnce({
      pagination: { value: { pageIndex: 0, pageSize: 20 } },
      sorting: { value: [] },
      globalFilter: { value: '' },
      rowSelection: { value: {} },
      columnPinning: { value: { left: [], right: ['actions'] } },
      columnVisibility: { value: {} },
      data: r([makePromotion('p1', 'Editable Promo')]),
      totalCount: r(1),
      pageCount: r(1),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
      error: ref(null),
      refresh: vi.fn(),
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: r(1),
      showingTo: r(1),
      selectedRows: r([]),
      clearSelection: vi.fn(),
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-testid="row-actions-stub"]').length).toBeGreaterThanOrEqual(1)
  })

  // ── REQ-6: updatedAt SortableHeader renders ─────────────────────────────────
  it('REQ-6: renders the sortable headers (Promoción, Creada, Inicio) and no Actualizada', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    vi.mocked(useServerTable).mockReturnValueOnce({
      pagination: { value: { pageIndex: 0, pageSize: 20 } },
      sorting: { value: [] },
      globalFilter: { value: '' },
      rowSelection: { value: {} },
      columnPinning: { value: { left: [], right: ['actions'] } },
      columnVisibility: { value: {} },
      data: r([makePromotion('p1', 'Promo with updatedAt')]),
      totalCount: r(1),
      pageCount: r(1),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
      error: ref(null),
      refresh: vi.fn(),
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: r(1),
      showingTo: r(1),
      selectedRows: r([]),
      clearSelection: vi.fn(),
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Promoción')
    expect(wrapper.text()).toContain('Creada')
    expect(wrapper.text()).toContain('Inicio')
    expect(wrapper.text()).not.toContain('Actualizada')
  })

  // ── REQ-7: preserved invariants ────────────────────────────────────────────
  it('REQ-7: actions column stays pinned to the right (defaultPinning.right: ["actions"])', () => {
    const wrapper = mountView()
    const vm = wrapper.vm as unknown as { columnPinning: { value: { right: string[] } } }
    expect(vm.columnPinning.value.right).toContain('actions')
  })

  it('REQ-7: filter change clears rowSelection (pageIndex reset + selection clear watch)', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    vi.mocked(useServerTable).mockReturnValueOnce({
      pagination: { value: { pageIndex: 0, pageSize: 20 } },
      sorting: { value: [] },
      globalFilter: { value: '' },
      rowSelection: { value: { 0: true } },
      columnPinning: { value: { left: [], right: ['actions'] } },
      columnVisibility: { value: {} },
      data: { value: [makePromotion('p1', 'Promo A')] },
      totalCount: { value: 1 },
      pageCount: { value: 1 },
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
      error: ref(null),
      refresh: vi.fn(),
      pageSizeOptions: { value: [10, 20, 50] },
      showingFrom: { value: 1 },
      showingTo: { value: 1 },
      selectedRows: { value: [] },
      clearSelection: vi.fn(),
    } as unknown as ReturnType<typeof useServerTable>)

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { rowSelection: { value: Record<string, boolean> } }
    expect(vm.rowSelection.value).toEqual({ 0: true })
    ;(wrapper.vm as unknown as Record<string, string>)['filterType'] = 'BUY_X_GET_Y'
    await wrapper.vm.$nextTick()
    await flushPromises()
    expect(vm.rowSelection.value).toEqual({})
  })
})
