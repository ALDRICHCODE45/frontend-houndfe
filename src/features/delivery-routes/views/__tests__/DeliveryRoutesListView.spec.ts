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

// ─── Mock `useDriverActiveRoutes` so the spec controls the driver list ────────
const driverRoutesMock = {
  data: ref<unknown[]>([]),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn(),
}

vi.mock('../../composables/useDriverActiveRoutes', () => ({
  useDriverActiveRoutes: () => driverRoutesMock,
}))

// ─── Stub the create/update mutation composables so emitting from the
// slideover doesn't reach TanStack Query. We just record the emit.
const createMutateMock = vi.fn()
const updateMutateMock = vi.fn()
const startMutateMock = vi.fn()
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
vi.mock('../../composables/useStartDeliveryRoute', () => ({
  useStartDeliveryRoute: () => ({
    mutate: startMutateMock,
    mutateAsync: startMutateMock,
    isPending: ref(false),
    error: ref(null),
  }),
}))

// ─── Stub the DriverRouteCard so the spec can assert the tap wiring ──────────
const driverCardEmits: { select: string[] } = { select: [] }
vi.mock('../../components/DriverRouteCard.vue', () => ({
  default: defineComponent({
    name: 'DriverRouteCard',
    props: ['route'],
    emits: ['select'],
    setup(props, { emit }) {
      function fireSelect() {
        const route = props.route as { id: string }
        driverCardEmits.select.push(route.id)
        emit('select', route.id)
      }
      return () =>
        h(
          'div',
          { 'data-testid': 'driver-route-card-stub' },
          [
            h(
              'button',
              {
                type: 'button',
                'data-testid': 'driver-route-card-stub-select',
                'data-route-id': (props.route as { id: string }).id,
                onClick: fireSelect,
              },
              'select',
            ),
          ],
        )
    },
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
    setup(props, { emit, slots }) {
      dataTableProps.push({ ...props })
      function fireAdd() {
        emit('add')
      }
      function fireRefresh() {
        emit('refresh')
      }
      return () => {
        // Render the `actions-cell` slot once per row so the view's kebab wiring
        // is exercised (the slot receives the TanStack-style `{ row }` shape).
        const rows = Array.isArray(props.data) ? (props.data as Array<Record<string, unknown>>) : []
        const rowNodes = rows.map((item, index) =>
          h(
            'div',
            { 'data-testid': 'app-data-table-row', key: String((item as { id?: unknown }).id ?? index) },
            [slots['actions-cell']?.({ row: { original: item }, index })],
          ),
        )
        return h(
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
            ...rowNodes,
          ],
        )
      }
    },
  }),
  SortableHeader: defineComponent({ name: 'SortableHeader', render: () => null }),
  createSimpleHeader: (label: string) => () => label,
}))

// ─── Stub the shared ConfirmModal primitive — record open state + emits ─
const confirmModalState: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  confirmColor: string
  loading: boolean
} = { open: false, title: '', description: '', confirmLabel: '', cancelLabel: '', confirmColor: 'primary', loading: false }
const confirmEmits = { confirm: 0, cancel: 0 }
function resetConfirmModalState() {
  confirmModalState.open = false
  confirmModalState.title = ''
  confirmModalState.description = ''
  confirmModalState.confirmLabel = ''
  confirmModalState.cancelLabel = ''
  confirmModalState.confirmColor = 'primary'
  confirmModalState.loading = false
  confirmEmits.confirm = 0
  confirmEmits.cancel = 0
}
vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: defineComponent({
    name: 'ConfirmModal',
    props: {
      open: { type: Boolean, default: false },
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      confirmLabel: { type: String, default: 'Confirmar' },
      cancelLabel: { type: String, default: 'Cancelar' },
      confirmColor: { type: String, default: 'primary' },
      loading: { type: Boolean, default: false },
    },
    emits: ['update:open', 'confirm', 'cancel'],
    setup(props, { emit }) {
      return () => {
        confirmModalState.open = props.open
        confirmModalState.title = props.title ?? ''
        confirmModalState.description = props.description ?? ''
        confirmModalState.confirmLabel = props.confirmLabel ?? ''
        confirmModalState.cancelLabel = props.cancelLabel ?? ''
        confirmModalState.confirmColor = (props.confirmColor as string) ?? 'primary'
        confirmModalState.loading = props.loading
        return h('div', { 'data-testid': 'list-confirm-modal-stub' }, [
          h('span', { 'data-testid': 'list-confirm-modal-title' }, props.title ?? ''),
          h('span', { 'data-testid': 'list-confirm-modal-description' }, props.description ?? ''),
          h('span', { 'data-testid': 'list-confirm-modal-confirm-color' }, (props.confirmColor as string) ?? 'primary'),
          h('span', { 'data-testid': 'list-confirm-modal-loading' }, String(props.loading)),
          h(
            'button',
            { type: 'button', 'data-testid': 'list-confirm-modal-confirm', onClick: () => emit('confirm') },
            'confirm',
          ),
          h(
            'button',
            { type: 'button', 'data-testid': 'list-confirm-modal-cancel', onClick: () => emit('update:open', false) },
            'cancel',
          ),
        ])
      }
    },
  }),
}))

// useToast stub.
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

// ─── Stub vue-router so the driver tap target can navigate without a router ──
const routerPushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
  useRoute: () => ({ params: {} }),
}))

import DeliveryRoutesListView from '../DeliveryRoutesListView.vue'

// ─── Stub the Nuxt UI dropdown + button so the actions-cell kebab is testable
// without the Nuxt UI runtime. The UDropdownMenu stub renders every section
// item as a plain button that fires the item's `onSelect` directly.
const UDropdownMenuStub = defineComponent({
  name: 'UDropdownMenu',
  props: ['items', 'content'],
  setup(props) {
    return () => {
      const items = ((props.items as unknown[][]) ?? []).flat() as Array<{ label: string; onSelect: () => void }>
      return h('div', { 'data-testid': 'row-actions-menu' }, [
        h('button', { type: 'button', 'data-testid': 'row-actions-trigger' }, '⋯'),
        ...items.map((item) =>
          h(
            'button',
            { type: 'button', 'data-testid': 'row-action-item', key: item.label, onClick: () => item.onSelect() },
            item.label,
          ),
        ),
      ])
    }
  },
})

const UButtonStub = defineComponent({
  name: 'UButton',
  props: ['icon', 'color', 'variant', 'label', 'loading'],
  setup(props) {
    return () => h('span', { 'data-testid': 'row-actions-button-stub' }, props.label ?? '⋯')
  },
})

function mountView() {
  return mount(DeliveryRoutesListView, {
    global: {
      stubs: {
        // Nuxt UI auto-imports register under BOTH the U* name and the
        // unprefixed alias (see AdminPaymentDetailsView.spec.ts) — stub both
        // so the actions-cell kebab resolves to the test stub.
        UDropdownMenu: UDropdownMenuStub,
        DropdownMenu: UDropdownMenuStub,
        UButton: UButtonStub,
        Button: UButtonStub,
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

function resetDriverState(overrides: Partial<{
  data: unknown[]
  isLoading: boolean
  isError: boolean
  error: unknown
}> = {}) {
  driverRoutesMock.data.value = overrides.data ?? []
  driverRoutesMock.isLoading.value = overrides.isLoading ?? false
  driverRoutesMock.isError.value = overrides.isError ?? false
  driverRoutesMock.error.value = overrides.error ?? null
}

/** Minimal DeliveryRouteResponseDto-shaped fixture for the manager table. */
function makeRoute(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'route-42',
    status: 'DRAFT',
    driver: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  dataTableProps.length = 0
  slideoverState.emits.create.length = 0
  slideoverState.emits.edit.length = 0
  resetConfirmModalState()
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

    describe('DeliveryRoutesListView — manager actions column: START kebab (S5b, REQ-DRM-011/013)', () => {
      beforeEach(() => {
        resetConfirmModalState()
        resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
        resetTableState({ data: [makeRoute({ stops: [{ id: 's1' }] })] })
      })

      it('renders the three-dot kebab with the canonical "Iniciar ruta" item for a DRAFT route with stops + update permission', async () => {
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="row-actions-menu"]').exists()).toBe(true)
        const items = wrapper.findAll('[data-testid="row-action-item"]')
        expect(items.length).toBe(1)
        expect(items[0]!.text()).toBe(DELIVERY_ROUTE_COPY.actions.start)
        expect(items[0]!.text()).toBe('Iniciar ruta')
      })

      it('hides the kebab when the route is NOT DRAFT (status gate)', async () => {
        resetTableState({
          data: [makeRoute({ status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' })],
        })
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="row-actions-menu"]').exists()).toBe(false)
      })

      it('hides the kebab when the route has no stops (stop gate)', async () => {
        resetTableState({ data: [makeRoute()] }) // stops: []
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="row-actions-menu"]').exists()).toBe(false)
      })

      it('hides the kebab when the user cannot update DeliveryRoute (permission gate)', async () => {
        resetRoleFlags({ isManager: { value: true }, canUpdate: { value: false } })
        resetTableState({ data: [makeRoute({ stops: [{ id: 's1' }] })] })
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="row-actions-menu"]').exists()).toBe(false)
      })

      it('opens ConfirmModal with the confirm.start copy when "Iniciar ruta" is selected; the mutation fires only after confirm', async () => {
        const wrapper = mountView()
        await flushPromises()
        await wrapper.find('[data-testid="row-action-item"]').trigger('click')
        await flushPromises()
        expect(confirmModalState.open).toBe(true)
        expect(confirmModalState.title).toBe(DELIVERY_ROUTE_COPY.confirm.start.title)
        expect(confirmModalState.description).toBe(DELIVERY_ROUTE_COPY.confirm.start.body)
        expect(confirmModalState.confirmLabel).toBe(DELIVERY_ROUTE_COPY.confirm.start.confirmLabel)
        expect(confirmModalState.cancelLabel).toBe(DELIVERY_ROUTE_COPY.confirm.start.cancelLabel)
        expect(confirmModalState.confirmColor).toBe('primary')
        // Selecting the menu item must NOT fire the mutation by itself.
        expect(startMutateMock).not.toHaveBeenCalled()
        await wrapper.find('[data-testid="list-confirm-modal-confirm"]').trigger('click')
        await flushPromises()
        expect(startMutateMock).toHaveBeenCalledTimes(1)
        expect(startMutateMock).toHaveBeenCalledWith('route-42')
      })

      it('closing the modal without confirming does NOT fire the start mutation (TRIANGULATE)', async () => {
        const wrapper = mountView()
        await flushPromises()
        await wrapper.find('[data-testid="row-action-item"]').trigger('click')
        await flushPromises()
        expect(startMutateMock).not.toHaveBeenCalled()
        await wrapper.find('[data-testid="list-confirm-modal-cancel"]').trigger('click')
        await flushPromises()
        expect(startMutateMock).not.toHaveBeenCalled()
        expect(confirmModalState.open).toBe(false)
      })

      it('never renders the kebab on the driver branch (manager-only surface)', async () => {
        resetRoleFlags({
          isManager: { value: false },
          isDriver: { value: true },
          canRead: { value: true },
        })
        resetTableState({ data: [makeRoute({ stops: [{ id: 's1' }] })] })
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="row-actions-menu"]').exists()).toBe(false)
      })
    })

    describe('DeliveryRoutesListView — driver branch (S6b, design §4.2, §11, REQ-DRC-001)', () => {
      beforeEach(() => {
        routerPushMock.mockClear()
      })

      it('renders the DriverRouteCard list when isDriver=true and the list has rows', async () => {
        resetRoleFlags({
          isManager: { value: false },
          isDriver: { value: true },
          canRead: { value: true },
        })
        resetTableState({ data: [], totalCount: 0 })
        resetDriverState({
          data: [
            { id: 'route-1', status: 'ACTIVE', driver: { id: 'd1', name: 'Ana', email: 'a@x' }, stops: [] },
            { id: 'route-2', status: 'ACTIVE', driver: { id: 'd1', name: 'Ana', email: 'a@x' }, stops: [] },
          ],
        })
        const wrapper = mountView()
        await flushPromises()
        const cards = wrapper.findAll('[data-testid="driver-route-card-stub"]')
        expect(cards.length).toBe(2)
        expect(wrapper.find('[data-testid="app-data-table-stub"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="slideover-stub"]').exists()).toBe(false)
      })

      it('navigates to /pos/rutas-de-entrega/:id when a card is tapped (driver tap target wiring)', async () => {
        resetRoleFlags({
          isManager: { value: false },
          isDriver: { value: true },
          canRead: { value: true },
        })
        resetTableState({ data: [], totalCount: 0 })
        resetDriverState({
          data: [{ id: 'route-xyz', status: 'ACTIVE', driver: null, stops: [] }],
        })
        const wrapper = mountView()
        await flushPromises()
        await wrapper.find('[data-testid="driver-route-card-stub-select"]').trigger('click')
        await flushPromises()
        expect(routerPushMock).toHaveBeenCalledTimes(1)
        expect(routerPushMock.mock.calls[0]?.[0]).toBe('/pos/rutas-de-entrega/route-xyz')
      })

      it('renders the empty state when the driver has no active routes', async () => {
        resetRoleFlags({ isManager: { value: false }, isDriver: { value: true }, canRead: { value: true } })
        resetTableState({ data: [], totalCount: 0 })
        resetDriverState({ data: [] })
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="driver-list-empty"]').exists()).toBe(true)
        expect(wrapper.text()).toContain(DELIVERY_ROUTE_COPY.empty.driver)
      })

      it('renders the loading skeleton when isLoading=true', async () => {
        resetRoleFlags({ isManager: { value: false }, isDriver: { value: true }, canRead: { value: true } })
        resetTableState({ data: [], totalCount: 0 })
        resetDriverState({ isLoading: true })
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="driver-list-loading"]').exists()).toBe(true)
      })

      it('renders the error block + retry button when the driver list fails', async () => {
        resetRoleFlags({ isManager: { value: false }, isDriver: { value: true }, canRead: { value: true } })
        resetTableState({ data: [], totalCount: 0 })
        resetDriverState({ isError: true, error: { message: 'falló la red' } })
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="driver-list-error"]').exists()).toBe(true)
        expect(wrapper.text()).toMatch(/falló la red|operación|reintenta/i)
      })

      it('HIDES the manager surface (AppDataTable + slideover + add button) on the driver branch', async () => {
        resetRoleFlags({ isManager: { value: false }, isDriver: { value: true }, canRead: { value: true } })
        resetTableState({ data: [], totalCount: 0 })
        resetDriverState({ data: [] })
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="app-data-table-stub"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="slideover-stub"]').exists()).toBe(false)
      })
    })
