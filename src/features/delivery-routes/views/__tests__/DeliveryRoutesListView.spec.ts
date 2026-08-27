// DeliveryRoutesListView.spec.ts — STRICT-TDD tests for the manager list
// composition surface (sdd delivery-routes S4c, design.md §4.1, §6.4, §11).
//
// Contract (REQ-DRM-001..002, REQ-DRM-014..015):
//   - Manager branch (`isManager=true`): renders the AppDataTable with the
//     manager rows, exposes the "Nueva ruta" button when `canCreate=true`.
//     On click of "Nueva ruta", opens the create slideover.
//   - Manager branch (`canCreate=false`): "Nueva ruta" button is HIDDEN
//     (never renders a disabled placeholder).
//   - Driver branch (`isManager=false`, `isDriver=true`): the view returns
//     `null` (placeholder marker `// TODO(S6b)` — until S6b lands).
//   - Loading state: `AppDataTable` shows its loading skeleton.
//   - Empty state: `AppDataTable` renders "No hay rutas de entrega".
//   - Error state: `AppDataTable` renders the error block (with retry via
//     `normalizeApiError`); empty text is NOT rendered.
//
// We mock the inner composables + components to focus the spec on the view's
// composition surface (i.e. which slots/controls it renders given inputs).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { DELIVERY_ROUTE_COPY } from '../../copy'

// ─── Mock `useDeliveryRouteRole` so each spec controls the discriminator
const roleMock = {
  isManager: ref(false),
  isDriver: ref(false),
  canCreate: ref(false),
  canDelete: ref(false),
  canUpdate: ref(false),
  canRead: ref(true),
}

vi.mock('../../composables/useDeliveryRouteRole', () => ({
  useDeliveryRouteRole: () => roleMock,
}))

// ─── Mock `useDeliveryRoutesTable` so we control list loading/empty/error
const tableMock = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref<Array<{ id: string; desc: boolean }>>([]),
  globalFilter: ref(''),
  columnPinning: ref({ left: [], right: ['actions'] }),
  columnVisibility: ref<Record<string, boolean>>({}),
  data: ref<unknown[]>([]),
  totalCount: ref(0),
  pageCount: ref(0),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refresh: vi.fn(),
  pageSizeOptions: [10, 20, 50],
  showingFrom: ref(0),
  showingTo: ref(0),
  fullList: ref<unknown[]>([]),
}

vi.mock('../../composables/useDeliveryRoutesTable', () => ({
  useDeliveryRoutesTable: () => tableMock,
}))

// ─── Stub the create/update mutation composables so emitting from the
// slideover doesn't reach TanStack Query. We just record the emit.
const createMutateMock = vi.fn()
const updateMutateMock = vi.fn()
vi.mock('../../composables/useCreateDeliveryRoute', () => ({
  useCreateDeliveryRoute: () => ({
    mutate: createMutateMock,
    mutateAsync: createMutateMock,
    isPending: ref(false),
    error: ref(null),
  }),
}))
vi.mock('../../composables/useUpdateDeliveryRoute', () => ({
  useUpdateDeliveryRoute: () => ({
    mutate: updateMutateMock,
    mutateAsync: updateMutateMock,
    isPending: ref(false),
    error: ref(null),
  }),
}))

// ─── Stub the slideover so the spec can assert which emit fired
const slideoverState = { emits: { create: [] as unknown[], edit: [] as unknown[] } }
vi.mock('../../components/DeliveryRouteUpsertSlideover.vue', () => ({
  default: defineComponent({
    name: 'DeliveryRouteUpsertSlideover',
    props: {
      open: { type: Boolean, default: false },
      mode: { type: String, default: 'create' },
      routeId: { type: String, default: '' },
    },
    emits: ['update:open', 'create', 'edit'],
    setup(props, { emit }) {
      function fireCreate() {
        const payload = { saleIds: ['s1'], driverUserId: 'd1', notes: undefined }
        slideoverState.emits.create.push(payload)
        emit('create', payload)
      }
      function fireEdit() {
        const payload = { driverUserId: 'd1', notes: 'hello' }
        slideoverState.emits.edit.push(payload)
        emit('edit', payload)
      }
      return () =>
        h(
          'div',
          { 'data-testid': 'slideover-stub' },
          [
            h('span', { 'data-testid': 'slideover-stub-open' }, String(props.open)),
            h('span', { 'data-testid': 'slideover-stub-mode' }, String(props.mode)),
            h(
              'button',
              { type: 'button', 'data-testid': 'slideover-fire-create', onClick: fireCreate },
              'fire-create',
            ),
            h(
              'button',
              { type: 'button', 'data-testid': 'slideover-fire-edit', onClick: fireEdit },
              'fire-edit',
            ),
          ],
        )
    },
  }),
}))

// ─── Stub AppDataTable so we can assert its props directly without rendering
const dataTableProps: Array<Record<string, unknown>> = []
vi.mock('@/core/shared/components/DataTable', () => ({
  AppDataTable: defineComponent({
    name: 'AppDataTable',
    props: [
      'columns',
      'data',
      'loading',
      'fetching',
      'error',
      'errorMessage',
      'pageCount',
      'totalCount',
      'showingFrom',
      'showingTo',
      'pageSizeOptions',
      'displayMode',
      'searchPlaceholder',
      'showAddButton',
      'addButtonText',
      'addButtonIcon',
      'enableColumnVisibility',
      'empty',
    ],
    emits: ['add', 'refresh'],
    setup(props, { emit }) {
      dataTableProps.push({ ...props })
      function fireAdd() {
        emit('add')
      }
      function fireRefresh() {
        emit('refresh')
      }
      return () =>
        h(
          'div',
          { 'data-testid': 'app-data-table-stub' },
          [
            h('span', { 'data-testid': 'app-data-table-stub-loading' }, String(props.loading)),
            h('span', { 'data-testid': 'app-data-table-stub-error' }, String(props.error)),
            h('span', { 'data-testid': 'app-data-table-stub-empty' }, String(props.empty ?? '')),
            h('span', { 'data-testid': 'app-data-table-stub-show-add' }, String(props.showAddButton)),
            h(
              'button',
              { type: 'button', 'data-testid': 'app-data-table-stub-add', onClick: fireAdd },
              'add',
            ),
            h(
              'button',
              { type: 'button', 'data-testid': 'app-data-table-stub-refresh', onClick: fireRefresh },
              'refresh',
            ),
          ],
        )
    },
  }),
  SortableHeader: defineComponent({ name: 'SortableHeader', render: () => null }),
  createSimpleHeader: (label: string) => () => label,
}))

// useToast stub.
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

import DeliveryRoutesListView from '../DeliveryRoutesListView.vue'

function mountView() {
  return mount(DeliveryRoutesListView, {
    global: {
      stubs: {
        // Avoid pulling in the Nuxt UI runtime; the AppDataTable + slideover
        // are already mocked above.
      },
    },
  })
}

type RoleFlagOverrides = Partial<
  Record<'isManager' | 'isDriver' | 'canCreate' | 'canDelete' | 'canUpdate' | 'canRead', { value: boolean }>
>

function resetRoleFlags(overrides: RoleFlagOverrides = {}) {
  roleMock.isManager.value = overrides.isManager?.value ?? false
  roleMock.isDriver.value = overrides.isDriver?.value ?? false
  roleMock.canCreate.value = overrides.canCreate?.value ?? false
  roleMock.canDelete.value = overrides.canDelete?.value ?? false
  roleMock.canUpdate.value = overrides.canUpdate?.value ?? false
  roleMock.canRead.value = overrides.canRead?.value ?? true
}

function resetTableState(overrides: Partial<{
  data: unknown[]
  isLoading: boolean
  isError: boolean
  error: unknown
  totalCount: number
}> = {}) {
  tableMock.data.value = overrides.data ?? []
  tableMock.isLoading.value = overrides.isLoading ?? false
  tableMock.isError.value = overrides.isError ?? false
  tableMock.error.value = overrides.error ?? null
  tableMock.totalCount.value = overrides.totalCount ?? 0
}

beforeEach(() => {
  vi.clearAllMocks()
  dataTableProps.length = 0
  slideoverState.emits.create.length = 0
  slideoverState.emits.edit.length = 0
  resetRoleFlags({ isManager: { value: true }, canCreate: { value: true } })
  resetTableState()
})

describe('DeliveryRoutesListView — manager branch (design.md §6.4, §11, REQ-DRM-014)', () => {
  it('renders the AppDataTable with the manager columns + empty copy', async () => {
    resetRoleFlags({ isManager: { value: true }, canCreate: { value: true } })
    resetTableState({ data: [], totalCount: 0 })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table-stub"]').exists()).toBe(true)
    const lastProps = dataTableProps[dataTableProps.length - 1]!
    expect(lastProps.empty).toBe(DELIVERY_ROUTE_COPY.empty.manager)
  })

  it('exposes the "Nueva ruta" button when canCreate=true (REQ-DRM-002)', async () => {
    resetRoleFlags({ isManager: { value: true }, canCreate: { value: true } })
    resetTableState({ data: [], totalCount: 0 })
    const wrapper = mountView()
    await flushPromises()
    const lastProps = dataTableProps[dataTableProps.length - 1]!
    expect(lastProps.showAddButton).toBe(true)
    expect(String(lastProps.addButtonText)).toBe(DELIVERY_ROUTE_COPY.actions.create)
  })

  it('hides the "Nueva ruta" button when canCreate=false (REQ-DRM-002)', async () => {
    resetRoleFlags({
      isManager: { value: true }, // create OR delete ⇒ manager
      canCreate: { value: false },
      canDelete: { value: true }, // manager via delete path
    })
    resetTableState({ data: [], totalCount: 0 })
    const wrapper = mountView()
    await flushPromises()
    const lastProps = dataTableProps[dataTableProps.length - 1]!
    expect(lastProps.showAddButton).toBe(false)
  })

  it('opens the create slideover when the AppDataTable emits "add"', async () => {
    resetRoleFlags({ isManager: { value: true }, canCreate: { value: true } })
    resetTableState({ data: [], totalCount: 0 })
    const wrapper = mountView()
    await flushPromises()
    const stub = wrapper.find('[data-testid="app-data-table-stub-add"]')
    expect(stub.exists()).toBe(true)
    await stub.trigger('click')
    await nextTick()
    // Slideover open=true should now be reflected on the stub.
    expect(wrapper.find('[data-testid="slideover-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slideover-stub-open"]').text()).toBe('true')
    expect(wrapper.find('[data-testid="slideover-stub-mode"]').text()).toBe('create')
  })

  it('forwards the create payload to useCreateDeliveryRoute.mutate', async () => {
    resetRoleFlags({ isManager: { value: true }, canCreate: { value: true } })
    resetTableState({ data: [], totalCount: 0 })
    const wrapper = mountView()
    await flushPromises()
    // Open slideover
    await wrapper.find('[data-testid="app-data-table-stub-add"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-testid="slideover-fire-create"]').trigger('click')
    await flushPromises()
    expect(createMutateMock).toHaveBeenCalledTimes(1)
    expect(createMutateMock.mock.calls[0]?.[0]).toEqual({
      saleIds: ['s1'],
      driverUserId: 'd1',
      notes: undefined,
    })
  })

  it('renders the loading skeleton on the AppDataTable when isLoading=true', async () => {
    resetRoleFlags({ isManager: { value: true }, canCreate: { value: true } })
    resetTableState({ data: [], isLoading: true, totalCount: 0 })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-data-table-stub-loading"]').text()).toBe('true')
  })

  it('renders the empty state when isLoading=false and totalCount=0 (REQ-DRM-014)', async () => {
    resetRoleFlags({ isManager: { value: true }, canCreate: { value: true } })
    resetTableState({ data: [], totalCount: 0 })
    const wrapper = mountView()
    await flushPromises()
    const lastProps = dataTableProps[dataTableProps.length - 1]!
    expect(lastProps.loading).toBe(false)
    expect(String(lastProps.empty)).toBe(DELIVERY_ROUTE_COPY.empty.manager)
  })

  it('renders the error block on AppDataTable when isError=true (REQ-DRM-014)', async () => {
    resetRoleFlags({ isManager: { value: true }, canCreate: { value: true } })
    resetTableState({ data: [], isError: true, error: { message: 'red rota' }, totalCount: 0 })
    const wrapper = mountView()
    await flushPromises()
    const lastProps = dataTableProps[dataTableProps.length - 1]!
    expect(lastProps.error).toBe(true)
    expect(String(lastProps.errorMessage)).toMatch(/red rota|operación|reintenta/i)
  })
})

describe('DeliveryRoutesListView — driver branch placeholder (REQ-DRM-002 driver side)', () => {
  it('returns null when isDriver=true (placeholder marker until S6b lands)', async () => {
    resetRoleFlags({
      isManager: { value: false },
      isDriver: { value: true },
      canRead: { value: true },
    })
    resetTableState({ data: [], totalCount: 0 })
    const wrapper = mountView()
    await flushPromises()
    // Driver branch returns null ⇒ no table mounted, no slideover, no add button.
    expect(wrapper.find('[data-testid="app-data-table-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slideover-stub"]').exists()).toBe(false)
  })
})
