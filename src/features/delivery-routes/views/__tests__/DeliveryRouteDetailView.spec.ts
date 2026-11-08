// DeliveryRouteDetailView.spec.ts — STRICT-TDD tests for the detail view.
//
// Contract (sdd delivery-routes S6a, design.md §4.1, §4.2, §6.4, §7.2, §10.1, §11,
// REQ-DRM-013..015):
//   - Composition surface for `/pos/rutas-de-entrega/:id`; ONE route serves both
//     roles; the view discriminates manager vs driver via `useDeliveryRouteRole`.
//   - Manager branch (`isManager=true`): renders the route detail with the S4c
//     + S5a + S5b mutation affordances:
//       * Edit (uses `DeliveryRouteUpsertSlideover`)
//       * Start (409 conflict toast + refetch, NO auto-retry)
//       * Cancel
//       * Delete (hidden unless DRAFT + zero stops + delete permission)
//       * Reorder (renders `DeliveryRouteReorderPanel` only on DRAFT)
//       * Append stop
//   - Driver branch (`isDriver=true`): returns null placeholder (`// TODO(S6b)`)
//     until S6b lands.
//   - 404 ENTITY_NOT_FOUND on detail fetch → renders the full-page "Ruta no
//     encontrada" state (REQ-DRM-013).
//   - Driver 403 → SAME full-page not-found state; no banner, no toast
//     (no presence leak; design §7.2, §11).
//   - Loading skeleton during fetch.
//   - The view reads per-action permissions from `useDeliveryRouteRole`.
//
// We mock the inner composables + components to focus on the composition surface
// (i.e. which branches render given inputs). Mirrors the
// `DeliveryRoutesListView.spec.ts` precedent.

import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, shallowRef } from 'vue'
import { DELIVERY_ROUTE_COPY } from '../../copy'

// ─── Mock `useDeliveryRouteRole` — drives isManager / isDriver / per-action perms ─
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

// ─── Mock `useDeliveryRouteDetail` — controls detail loading / data / error ────
const detailMock = {
  data: shallowRef<unknown>(undefined),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn(),
}

vi.mock('../../composables/useDeliveryRouteDetail', () => ({
  useDeliveryRouteDetail: () => detailMock,
}))

// ─── Stub the manager mutation composables — record that they were invoked ─────
const updateMutateMock = vi.fn()
const deleteMutateMock = vi.fn()
const startMutateMock = vi.fn()
const cancelMutateMock = vi.fn()
const appendMutateMock = vi.fn()
const reorderMutateMock = vi.fn()

vi.mock('../../composables/useUpdateDeliveryRoute', () => ({
  useUpdateDeliveryRoute: () => ({
    mutate: updateMutateMock,
    mutateAsync: updateMutateMock,
    isPending: ref(false),
    error: ref(null),
  }),
}))
vi.mock('../../composables/useDeleteDeliveryRoute', () => ({
  useDeleteDeliveryRoute: () => ({
    mutate: deleteMutateMock,
    mutateAsync: deleteMutateMock,
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
vi.mock('../../composables/useCancelDeliveryRoute', () => ({
  useCancelDeliveryRoute: () => ({
    mutate: cancelMutateMock,
    mutateAsync: cancelMutateMock,
    isPending: ref(false),
    error: ref(null),
  }),
}))
vi.mock('../../composables/useAppendDeliveryRouteStop', () => ({
  useAppendDeliveryRouteStop: () => ({
    mutate: appendMutateMock,
    mutateAsync: appendMutateMock,
    isPending: ref(false),
    error: ref(null),
  }),
}))
vi.mock('../../composables/useReorderStops', () => ({
  useReorderStops: () => ({
    mutate: reorderMutateMock,
    mutateAsync: reorderMutateMock,
    isPending: ref(false),
    error: ref(null),
  }),
}))
// ─── Mock `useCheckInStop` — view-owned single instance (REQ-DRC-104) ──────────
const checkInMutateMock = vi.fn().mockResolvedValue({})
const checkInPendingRef = ref(false)
vi.mock('../../composables/useCheckInStop', () => ({
  useCheckInStop: () => ({ mutateAsync: checkInMutateMock, isPending: checkInPendingRef, error: ref(null) }),
}))

// ─── Toast recorder — SFC's auto-imported `useToast` mocked at its module path ──
const toastCalls: Array<{ title: string; color?: string; description?: string }> = []
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({
  useToast: () => ({ add: (t: { title: string; color?: string; description?: string }) => { toastCalls.push(t) } }),
}))

// ─── Stub the slideover to record emits + render a stable test surface ─────────
const slideoverEmits: { create: unknown[]; edit: unknown[] } = { create: [], edit: [] }
vi.mock('../../components/DeliveryRouteUpsertSlideover.vue', () => ({
  default: defineComponent({
    name: 'DeliveryRouteUpsertSlideover',
    props: {
      open: { type: Boolean, default: false },
      mode: { type: String, default: 'edit' },
      routeId: { type: String, default: '' },
      initialNotes: { type: String, default: '' },
      initialDriverUserId: { type: String, default: null },
    },
    emits: ['update:open', 'edit'],
    setup(props, { emit }) {
      function fireEdit() {
        const payload = { driverUserId: 'd1', notes: 'updated' }
        slideoverEmits.edit.push(payload)
        emit('edit', payload)
      }
      return () =>
        h(
          'div',
          { 'data-testid': 'detail-upsert-slideover-stub' },
          [
            h('span', { 'data-testid': 'detail-slideover-mode' }, String(props.mode)),
            h(
              'button',
              {
                type: 'button',
                'data-testid': 'detail-slideover-fire-edit',
                onClick: fireEdit,
              },
              'fire-edit',
            ),
          ],
        )
    },
  }),
}))

// ─── Stub EligibleSalesPicker — single-sale selector for the append-stop flow ─
const eligiblePickerEmits: { 'update:selected': string[][] } = { 'update:selected': [] }
vi.mock('../../components/EligibleSalesPicker.vue', () => ({
  default: defineComponent({
    name: 'EligibleSalesPicker',
    props: {
      modelValue: { type: Array, default: () => [] },
      required: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
      placeholder: { type: String, default: '' },
      error: { type: String, default: '' },
      source: { type: String, default: '' },
    },
    emits: ['update:selected'],
    setup(props, { emit }) {
      const sales = (props.modelValue as string[])
      return () =>
        h('div', {
          'data-testid': 'detail-eligible-sales-picker-stub',
          'data-source': props.source,
        }, [
          h('button', {
            type: 'button',
            'data-testid': 'detail-eligible-pick-sale-sale-1',
            onClick: () => {
              emit('update:selected', ['sale-1'])
            },
          }, 'pick-sale-1'),
          h('button', {
            type: 'button',
            'data-testid': 'detail-eligible-pick-sale-sale-2',
            onClick: () => {
              emit('update:selected', ['sale-2'])
            },
          }, 'pick-sale-2'),
          h('span', { 'data-testid': 'detail-eligible-current' }, JSON.stringify(sales)),
        ])
    },
  }),
}))

// ─── Stub TransferDeliveryRouteStopModal — per-stop draft-to-draft move dialog ─
const transferModalState: { open: boolean; originRouteId: string; stopId: string | null } = {
  open: false,
  originRouteId: '',
  stopId: null,
}
vi.mock('../../components/TransferDeliveryRouteStopModal.vue', () => ({
  default: defineComponent({
    name: 'TransferDeliveryRouteStopModal',
    props: {
      open: { type: Boolean, default: false },
      originRouteId: { type: String, default: '' },
      stop: { type: Object, default: null },
    },
    emits: ['update:open', 'moved'],
    setup(props) {
      return () => {
        transferModalState.open = props.open
        transferModalState.originRouteId = props.originRouteId
        transferModalState.stopId = (props.stop as { id?: string } | null)?.id ?? null
        return h('div', { 'data-testid': 'transfer-stop-modal-stub' })
      }
    },
  }),
}))

// ─── Stub the reorder panel — renders a stable testid + a reorder save button ─
let lastReorderProps: Record<string, unknown> = {}
vi.mock('../../components/DeliveryRouteReorderPanel.vue', () => ({
  default: defineComponent({
    name: 'DeliveryRouteReorderPanel',
    props: { route: { type: Object, required: true } },
    setup(props) {
      lastReorderProps = { ...props }
      return () =>
        h(
          'div',
          { 'data-testid': 'detail-reorder-panel-stub' },
          'reorder-panel',
        )
    },
  }),
}))

// ─── Stub DriverRouteCockpit — typed props + event buttons (S11a) ──────────
const cockpitPropsHistory: Array<{ route: unknown; isFetching: boolean; canCheckIn: boolean; checkInPending: boolean }> = []
const resetCockpit = () => { cockpitPropsHistory.length = 0 }
vi.mock('../../components/cockpit/DriverRouteCockpit.vue', () => ({
  default: defineComponent({
    name: 'DriverRouteCockpit',
    props: { route: { type: Object, required: true }, isFetching: { type: Boolean, required: true }, canCheckIn: { type: Boolean, required: true }, checkInPending: { type: Boolean, required: true } },
    setup(props, { emit }) {
      cockpitPropsHistory.push({ route: props.route, isFetching: props.isFetching, canCheckIn: props.canCheckIn, checkInPending: props.checkInPending })
      return () => h('div', { 'data-testid': 'driver-route-cockpit-stub', 'data-can-check-in': String(props.canCheckIn), 'data-check-in-pending': String(props.checkInPending) }, [
        h('button', { type: 'button', 'data-testid': 'cockpit-stub-emit-check-in', onClick: () => emit('request-check-in', 's1') }, 'check-in'),
        h('button', { type: 'button', 'data-testid': 'cockpit-stub-emit-back', onClick: () => emit('back') }, 'back'),
        h('button', { type: 'button', 'data-testid': 'cockpit-stub-emit-refresh', onClick: () => emit('refresh') }, 'refresh'),
      ])
    },
  }),
}))

// ─── Stub DeliveryRouteTimeline — renders a stable testid per row ─────────
vi.mock('../../components/DeliveryRouteTimeline.vue', () => ({
  default: defineComponent({
    name: 'DeliveryRouteTimeline',
    props: { route: { type: Object, required: true } },
    setup(props) {
      const route = props.route as { timeline?: Array<{ type: string }> }
      return () =>
        h(
          'div',
          { 'data-testid': 'delivery-route-timeline-stub' },
          (route.timeline ?? []).map((e, i) =>
            h('div', { 'data-testid': `timeline-stub-row-${i}`, key: i }, e.type),
          ),
        )
    },
  }),
}))

// ─── Stub the shared ConfirmModal primitive — record open state + emits ─
const confirmModalState: { open: boolean; title: string; confirmColor?: string; description: string; confirmLabel: string; cancelLabel: string; uiContent?: string } = { open: false, title: '', description: '', confirmColor: 'primary', confirmLabel: '', cancelLabel: '' }
const confirmEmits: { confirm: number; cancel: number; updateOpen: number[] } = { confirm: 0, cancel: 0, updateOpen: [] }
function resetConfirmModalState() {
  confirmModalState.open = false
  confirmModalState.title = ''
  confirmModalState.description = ''
  confirmModalState.confirmColor = 'primary'
  confirmModalState.confirmLabel = ''
  confirmModalState.cancelLabel = ''
  confirmEmits.confirm = 0
  confirmEmits.cancel = 0
  confirmEmits.updateOpen = []
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
      ui: { type: Object, default: undefined },
    },
    emits: ['update:open', 'confirm', 'cancel'],
    setup(props, { emit }) {
      return () => {
        confirmModalState.open = props.open
        confirmModalState.uiContent = (props.ui as { content?: string } | undefined)?.content
        confirmModalState.title = props.title ?? ''
        confirmModalState.description = props.description ?? ''
        confirmModalState.confirmColor = (props.confirmColor as typeof confirmModalState.confirmColor) ?? 'primary'
        confirmModalState.confirmLabel = props.confirmLabel ?? ''
        confirmModalState.cancelLabel = props.cancelLabel ?? ''
        return h('div', { 'data-testid': 'detail-confirm-modal-stub' }, [
          h('span', { 'data-testid': 'detail-confirm-modal-title' }, props.title ?? ''),
          h('span', { 'data-testid': 'detail-confirm-modal-description' }, props.description ?? ''),
          h('span', { 'data-testid': 'detail-confirm-modal-confirm-color' }, (props.confirmColor as string) ?? 'primary'),
          h('button', {
            type: 'button',
            'data-testid': 'detail-confirm-modal-confirm',
            onClick: () => { confirmEmits.confirm += 1; emit('confirm') },
          }, 'confirm'),
          h('button', {
            type: 'button',
            'data-testid': 'detail-confirm-modal-cancel',
            onClick: () => { confirmEmits.cancel += 1; emit('update:open', false); emit('cancel') },
          }, 'cancel'),
        ])
      }
    },
  }),
}))

// ─── Stub `useRouter` — record `push` calls so we can assert detail→list navigation
const routerPushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
  useRoute: () => ({ params: { id: 'route-42' } }),
}))

// ─── Mock `useAuthStore` — only `currentTenantId` is needed for nothing in the
// view body itself (mutations own the tenant id), but view-level tests
// sometimes reach it via the composables it consumes. Keep it simple.
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: () => false,
  }),
}))

import DeliveryRouteDetailView from '../DeliveryRouteDetailView.vue'
import DetailPageFrame from '@/core/shared/components/DetailPageFrame.vue'

// The ⋮ menu (RowActionsMenu → UDropdownMenu): render every item as a plain
// button that fires the item's `onSelect`, skipping separators.
const UDropdownMenuStub = defineComponent({
  name: 'UDropdownMenu',
  props: ['items', 'content', 'ui'],
  setup(props) {
    return () => {
      const items = ((props.items as unknown[]) ?? [])
        .flat()
        .filter((item) => (item as { label?: string }).label) as Array<{ label: string; onSelect: () => void }>
      return h(
        'div',
        { 'data-testid': 'row-actions-menu' },
        items.map((item) =>
          h(
            'button',
            { type: 'button', 'data-testid': 'row-action-item', key: item.label, onClick: () => item.onSelect() },
            item.label,
          ),
        ),
      )
    }
  },
})

function mountView() {
  return mount(DeliveryRouteDetailView, {
    global: {
      stubs: {
        // Avoid pulling in the Nuxt UI runtime; the inner components are mocked.
        UDropdownMenu: UDropdownMenuStub,
        DropdownMenu: UDropdownMenuStub,
      },
    },
  })
}

type Wrapper = ReturnType<typeof mountView>
/** Labels of the header ⋮ menu (the header menu is the first one in the page). */
const headerMenu = (wrapper: Wrapper) => {
  const toolbar = wrapper.find('[data-testid="detail-actions-toolbar"]')
  return toolbar.exists() ? toolbar.findAll('[data-testid="row-action-item"]') : []
}
const headerLabels = (wrapper: Wrapper) => headerMenu(wrapper).map((item) => item.text())
async function selectHeader(wrapper: Wrapper, label: string) {
  const item = headerMenu(wrapper).find((candidate) => candidate.text() === label)
  expect(item, `header menu item ${label}`).toBeDefined()
  await item!.trigger('click')
  await flushPromises()
}
const EDIT = DELIVERY_ROUTE_COPY.actions.edit
const CANCEL = `${DELIVERY_ROUTE_COPY.actions.cancel}…`
const DELETE = `${DELIVERY_ROUTE_COPY.actions.delete}…`

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

function resetDetailState(overrides: Partial<{
  data: unknown
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  error: unknown
}> = {}) {
  detailMock.data.value = overrides.data ?? undefined
  detailMock.isLoading.value = overrides.isLoading ?? false
  detailMock.isFetching.value = overrides.isFetching ?? false
  detailMock.isError.value = overrides.isError ?? false
  detailMock.error.value = overrides.error ?? null
}

function makeDraftRoute(overrides: Partial<{ id: string; stopsLength: number }> = {}): Record<string, unknown> {
  const id = overrides.id ?? 'route-42'
  const stopsLength = overrides.stopsLength ?? 2
  return {
    id,
    status: 'DRAFT',
    driver: { id: 'd1', name: 'Ana', email: 'a@x' },
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: 'notas',
    stops: Array.from({ length: stopsLength }).map((_, i) => ({
      id: `s${i + 1}`,
      saleId: `sale-${i + 1}`,
      saleFolio: `F-${i + 1}`,
      sortOrder: i,
      status: 'PENDING',
      checkedInAt: null,
      completedAt: null,
      customer: { id: `c${i + 1}`, name: `Cliente ${i + 1}`, email: null },
      shippingAddress: null,
    })),
    timeline: [],
  }
}

// Driver-branch fixture: driver+read role, detail state, mounted + settled.
async function mountDriver(detail: Parameters<typeof resetDetailState>[0] = { data: makeDraftRoute() }, flags: RoleFlagOverrides = {}) {
  resetRoleFlags({ isManager: { value: false }, isDriver: { value: true }, canRead: { value: true }, ...flags })
  resetDetailState(detail)
  const wrapper = mountView()
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  slideoverEmits.edit.length = 0
  slideoverEmits.create.length = 0
  toastCalls.length = 0
  lastReorderProps = {}
  resetCockpit()
  checkInPendingRef.value = false
  // Default: manager with all perms — individual specs override.
  resetRoleFlags({
    isManager: { value: true },
    canCreate: { value: true },
    canDelete: { value: true },
    canUpdate: { value: true },
  })
  resetDetailState()
})

describe('DeliveryRouteDetailView — manager branch wiring (design §4.1, §6.4, §11, REQ-DRM-013..015)', () => {
  it('renders the manager actions area when isManager=true (REQ-DRM-014)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true }, canDelete: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    // Manager branch must render the actions toolbar (Edit / Start / Cancel /
    // Delete / Reorder / Append) — we assert via stable testids the view
    // exposes for each affordance.
    // One primary (Iniciar ruta) and a ⋮ with the rest.
    expect(wrapper.find('[data-testid="detail-actions-toolbar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="detail-start-button"]').exists()).toBe(true)
    // Delete has the additional DRAFT + zero-stops + canDelete gate; the default
    // makeDraftRoute has 2 stops so delete is hidden here. A dedicated test
    // below covers the visible-path.
    expect(headerLabels(wrapper)).toEqual([EDIT, CANCEL])
    expect(wrapper.find('[data-testid="detail-edit-button"]').exists()).toBe(false)
  })

  it('opens the edit slideover when Editar is chosen in the ⋮ menu (REQ-DRM-007)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    await selectHeader(wrapper, EDIT)
    await nextTick()
    const slideover = wrapper.find('[data-testid="detail-upsert-slideover-stub"]')
    expect(slideover.exists()).toBe(true)
    // Edit mode, routeId forwarded.
    expect(wrapper.find('[data-testid="detail-slideover-mode"]').text()).toBe('edit')
  })

  it('forwards the edit payload to useUpdateDeliveryRoute.mutate', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    await selectHeader(wrapper, EDIT)
    await nextTick()
    await wrapper.find('[data-testid="detail-slideover-fire-edit"]').trigger('click')
    await flushPromises()
    expect(updateMutateMock).toHaveBeenCalledTimes(1)
    expect(updateMutateMock.mock.calls[0]?.[0]).toEqual({
      id: 'route-42',
      payload: { driverUserId: 'd1', notes: 'updated' },
    })
  })

  it('renders the reorder panel ONLY when the route is DRAFT (DRM-009/010 gating)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    // DRAFT — panel renders.
    resetDetailState({ data: makeDraftRoute() })
    let wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-reorder-panel-stub"]').exists()).toBe(true)

    // ACTIVE — panel hidden entirely (rendered as the placeholder marker).
    resetDetailState({
      data: { ...makeDraftRoute(), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' },
    })
    wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-reorder-panel-stub"]').exists()).toBe(false)
  })

  it('offers delete only for DRAFT + zero stops + canDelete=true (REQ-DRM-008, REQ-DRM-015)', async () => {
    resetRoleFlags({
      isManager: { value: true },
      canUpdate: { value: true },
      canDelete: { value: true },
    })
    // DRAFT + zero stops + canDelete → delete VISIBLE, last, after the others.
    resetDetailState({ data: makeDraftRoute({ stopsLength: 0 }) })
    let wrapper = mountView()
    await flushPromises()
    expect(headerLabels(wrapper)).toEqual([EDIT, CANCEL, DELETE])

    // DRAFT + has stops → delete HIDDEN (zero-stop rule).
    resetDetailState({ data: makeDraftRoute({ stopsLength: 2 }) })
    wrapper = mountView()
    await flushPromises()
    expect(headerLabels(wrapper)).not.toContain(DELETE)

    // ACTIVE + zero stops → delete HIDDEN (status rule).
    resetDetailState({
      data: { ...makeDraftRoute({ stopsLength: 0 }), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' },
    })
    wrapper = mountView()
    await flushPromises()
    expect(headerLabels(wrapper)).not.toContain(DELETE)

    // DRAFT + zero stops + canDelete=false → delete HIDDEN (permission rule).
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true }, canDelete: { value: false } })
    resetDetailState({ data: makeDraftRoute({ stopsLength: 0 }) })
    wrapper = mountView()
    await flushPromises()
    expect(headerLabels(wrapper)).not.toContain(DELETE)
  })

  it('hides delete when routeData is stale (keepPreviousData from a different route id)', async () => {
    // TRIANGULATE — useDeliveryRouteDetail uses placeholderData: keepPreviousData,
    // so navigating between routes keeps the previous route's data visible until
    // the new fetch completes. The delete gate must NOT trust stale data: when
    // routeData.id !== current routeId, the delete button stays hidden.
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true }, canDelete: { value: true } })
    // Stale DRAFT zero-stop data belonging to a DIFFERENT route id.
    resetDetailState({ data: makeDraftRoute({ id: 'route-OTHER', stopsLength: 0 }) })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="row-action-item"]').exists()).toBe(false)
  })

  it('clicking the start button opens ConfirmModal; mutation fires only after confirm (REQ-DRM-010/013)', async () => {
    // S7 verify remediation — the start button no longer fires the mutation
    // directly; it opens the shared ConfirmModal first (REQ-DRM-010).
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="detail-start-button"]').trigger('click')
    await flushPromises()
    expect(startMutateMock).not.toHaveBeenCalled()
    await wrapper.find('[data-testid="detail-confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(startMutateMock).toHaveBeenCalledTimes(1)
    expect(startMutateMock).toHaveBeenCalledWith('route-42')
  })

  it('clicking the cancel button on ACTIVE opens ConfirmModal; mutation fires only after confirm (REQ-DRM-011)', async () => {
    // S7 verify remediation — cancel is gated through the shared ConfirmModal
    // (REQ-DRM-011).
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({
      data: { ...makeDraftRoute(), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' },
    })
    const wrapper = mountView()
    await flushPromises()
    await selectHeader(wrapper, CANCEL)
    await flushPromises()
    expect(cancelMutateMock).not.toHaveBeenCalled()
    await wrapper.find('[data-testid="detail-confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(cancelMutateMock).toHaveBeenCalledTimes(1)
    expect(cancelMutateMock).toHaveBeenCalledWith('route-42')
  })

  it('clicking the delete button opens ConfirmModal; mutation fires only after confirm (REQ-DRM-012)', async () => {
    // S7 verify remediation — delete is gated through the shared ConfirmModal
    // (REQ-DRM-012); on confirm, the route list navigation fires too.
    resetRoleFlags({
          isManager: { value: true },
          canUpdate: { value: true },
          canDelete: { value: true },
        })
    resetDetailState({ data: makeDraftRoute({ stopsLength: 0 }) })
    const wrapper = mountView()
    await flushPromises()
    await selectHeader(wrapper, DELETE)
    await flushPromises()
    expect(deleteMutateMock).not.toHaveBeenCalled()
    await wrapper.find('[data-testid="detail-confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(deleteMutateMock).toHaveBeenCalledTimes(1)
    expect(deleteMutateMock).toHaveBeenCalledWith('route-42')
    expect(routerPushMock).toHaveBeenCalledWith('/pos/rutas-de-entrega')
  })

  it('renders the append-stop affordance on DRAFT (REQ-DRM-008, REQ-DRM-013)', async () => {
    // sdd delivery-routes S7 verify remediation — REQ-DRM-008: the append
    // composable was implemented but the UI selector was deferred. The
    // detail view now exposes the selector + "Agregar parada" button on
    // DRAFT (gated by update AND status === 'DRAFT').
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-append-button"]').exists()).toBe(true)
    // The picker is stubbed; the section testid is exposed by the view.
    expect(wrapper.find('[data-testid="detail-append-section"]').exists()).toBe(true)
    // Finding 1: the append consumer MUST keep the legacy confirmed-sales path
    // (update-gated), not the create-gated authoritative eligible-sales source.
    expect(
      wrapper.find('[data-testid="detail-append-sales-picker"]').attributes('data-source'),
    ).toBe('append')
  })

  it('hides the append-stop affordance on non-DRAFT (REQ-DRM-008, REQ-DRM-013)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({
      data: { ...makeDraftRoute(), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' },
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-append-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="detail-append-sales-picker"]').exists()).toBe(false)
  })

  it('hides the append-stop affordance when canUpdate is false (REQ-DRM-013)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: false } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-append-button"]').exists()).toBe(false)
  })

  it('clicking the append button with a selected sale calls useAppendDeliveryRouteStop (REQ-DRM-008)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    // The picker is stubbed; the section testid is exposed by the view.
    expect(wrapper.find('[data-testid="detail-append-section"]').exists()).toBe(true)
    // Pick sale-1 via the stub's button (stub is a single root <div>).
    await wrapper.find('[data-testid="detail-eligible-pick-sale-sale-1"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-testid="detail-append-button"]').trigger('click')
    await flushPromises()
    expect(appendMutateMock).toHaveBeenCalledTimes(1)
    expect(appendMutateMock).toHaveBeenCalledWith({
      id: 'route-42',
      payload: { saleId: 'sale-1' },
    })
  })

  it('clicking the append button with no sale selected is a no-op (UI invariant)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    const btn = wrapper.find('[data-testid="detail-append-button"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    await btn.trigger('click')
    await flushPromises()
    expect(appendMutateMock).not.toHaveBeenCalled()
  })

  it('renders the loading skeleton on initial fetch', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ isLoading: true, data: undefined })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-loading-skeleton"]').exists()).toBe(true)
  })

  it('a driver waits on a cockpit-shaped skeleton (header, summary, stop cards), not the manager workspace', async () => {
    resetRoleFlags({ isManager: { value: false }, isDriver: { value: true } })
    resetDetailState({ isLoading: true, data: undefined })
    const wrapper = mountView()
    await flushPromises()
    const sk = wrapper.find('[data-testid="detail-driver-loading-skeleton"]')
    expect(sk.exists()).toBe(true)
    expect(sk.attributes('aria-busy')).toBe('true')
    expect(sk.findAll('[data-skeleton="stop-card"]').length).toBe(3)
    expect(sk.find('[data-skeleton="kpi"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="detail-loading-skeleton"]').exists()).toBe(false)
  })

  it('renders the route summary (status badge + driver + x/y progress) when data is loaded', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ data: makeDraftRoute({ stopsLength: 3 }) })
    const wrapper = mountView()
    await flushPromises()
    // Header testid is a stable surface the view exposes for the summary.
    expect(wrapper.find('[data-testid="detail-route-summary"]').exists()).toBe(true)
    // Progress reads as a sentence in the redesigned workspace header.
    expect(wrapper.text()).toContain('0 de 3 entregadas')
  })

  it('does NOT render the manager summary when routeData is stale (different route id)', async () => {
    // TRIANGULATE — keepPreviousData leaves the previous route's data mounted
    // during the fetch window. The manager branch must NOT render stale data
    // (or seed the edit slideover from it): when routeData.id !== routeId,
    // the summary is hidden.
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute({ id: 'route-OTHER' }) })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-route-summary"]').exists()).toBe(false)
  })
})

describe('DeliveryRouteDetailView — 404 ENTITY_NOT_FOUND / driver 403 → full-page not-found (design §7.2, §11, REQ-DRM-013)', () => {
  it('renders the full-page "Ruta no encontrada" state when the fetch returns 404 ENTITY_NOT_FOUND', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({
      isError: true,
      data: undefined,
      error: {
        response: { status: 404, data: { error: 'ENTITY_NOT_FOUND', message: 'x' } },
      },
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-not-found"]').exists()).toBe(true)
    expect(wrapper.text()).toContain(DELIVERY_ROUTE_COPY.detail.notFoundTitle)
    // The not-found state must NOT render any manager controls (no toolbar).
    expect(wrapper.find('[data-testid="detail-actions-toolbar"]').exists()).toBe(false)
  })

  it('renders the SAME full-page not-found state on a driver 403 (no banner, no toast, no presence leak)', async () => {
    // TRIANGULATE — driver 403 must map to the same not-found state as 404;
    // NEVER surface a banner / toast (presence leak; design §7.2, §11).
    resetRoleFlags({ isManager: { value: false }, isDriver: { value: true } })
    resetDetailState({
      isError: true,
      data: undefined,
      error: {
        response: { status: 403, data: { error: 'FORBIDDEN', message: 'no es tuya' } },
      },
    })
    const toastCountBefore = toastCalls.length
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-not-found"]').exists()).toBe(true)
    // No leak: no toast fired on a 403.
    expect(toastCalls.length).toBe(toastCountBefore)
    // No leak: no "permiso denegado" banner — the full-page state IS the response.
    expect(wrapper.find('[data-testid="detail-forbidden-banner"]').exists()).toBe(false)
  })

  it('does not leak driver 403 via a toast (regression pin against future convenience that would surface the rejection)', async () => {
    // Stronger invariant — the spec records ALL toasts across the lifecycle
    // and asserts none of them fire on a 403 fetch.
    resetRoleFlags({ isManager: { value: false }, isDriver: { value: true } })
    resetDetailState({
      isError: true,
      data: undefined,
      error: {
        response: { status: 403, data: { error: 'FORBIDDEN', message: 'no es tuya' } },
      },
    })
    mountView()
    await flushPromises()
    expect(toastCalls.length).toBe(0)
  })

  it('renders the generic error block for a non-404/403 error (5xx), NOT the not-found state', async () => {
    // TRIANGULATE — a 5xx / network / unknown error is NOT a not-found state. It
    // must fall through to the generic error block (design §11), never the
    // full-page "Ruta no encontrada".
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({
      isError: true,
      data: undefined,
      error: { response: { status: 500, data: { message: 'boom' } } },
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-error-block"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="detail-not-found"]').exists()).toBe(false)
  })

  it('driver 403 with isDriver=true lands in not-found, NOT the driver placeholder (branch order)', async () => {
    // TRIANGULATE — the not-found branch is evaluated BEFORE the driver branch,
    // so a real driver whose fetch returns 403 gets the full-page "Ruta no
    // encontrada" state, never the driver placeholder (no presence leak).
    resetRoleFlags({ isManager: { value: false }, isDriver: { value: true } })
    resetDetailState({
      isError: true,
      data: undefined,
      error: { response: { status: 403, data: { error: 'FORBIDDEN', message: 'no es tuya' } } },
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-not-found"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="detail-driver-placeholder"]').exists()).toBe(false)
  })

  it('driver 5xx with isDriver=true lands in the generic error block, NOT the driver placeholder', async () => {
    // TRIANGULATE — a non-404/403 fetch failure (5xx/network) must render the
    // generic error block, never the driver placeholder (evaluated AFTER error).
    resetRoleFlags({ isManager: { value: false }, isDriver: { value: true } })
    resetDetailState({
      isError: true,
      data: undefined,
      error: { response: { status: 500, data: { message: 'boom' } } },
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-error-block"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="detail-driver-placeholder"]').exists()).toBe(false)
  })

  it('manager 403 (authorization denial) renders the generic error block, NOT not-found', async () => {
    // TRIANGULATE — 403 → not-found is a DRIVER-only presence-leak mapping. A
    // manager receiving a 403 (authorization denial on an existing route) must
    // see the generic error block, not the full-page "Ruta no encontrada".
    resetRoleFlags({ isManager: { value: true }, isDriver: { value: false } })
    resetDetailState({
      isError: true,
      data: undefined,
      error: { response: { status: 403, data: { error: 'FORBIDDEN', message: 'no perms' } } },
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-error-block"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="detail-not-found"]').exists()).toBe(false)
  })
})

    describe('DeliveryRouteDetailView — driver branch + cockpit wiring (S11a, design §4.2, §11, REQ-DRC-103/104/107/108/109/110/112, REQ-DCS-007/009/010)', () => {
      it('renders the driver branch with DriverRouteCockpit + four typed props (REQ-DCS-001, REQ-DRC-104, REQ-DRC-112)', async () => {
        const route = makeDraftRoute({ stopsLength: 3 })
        const wrapper = await mountDriver({ data: route, isFetching: false }, { canUpdate: { value: true } })
        expect(wrapper.find('[data-testid="detail-driver-branch"]').exists()).toBe(true)
        const cockpit = wrapper.find('[data-testid="driver-route-cockpit-stub"]')
        expect(cockpit.exists()).toBe(true)
        expect(cockpitPropsHistory.length).toBeGreaterThan(0)
        const last = cockpitPropsHistory[cockpitPropsHistory.length - 1]!
        expect(last.route).toBe(route)
        expect(last.isFetching).toBe(false)
        expect(last.canCheckIn).toBe(true)
        expect(last.checkInPending).toBe(false)
        // Old card stack is gone (S11b — superseded by the cockpit).
        expect(wrapper.find('[data-testid="driver-stop-detail-stub"]').exists()).toBe(false)
      })

      it('does NOT render the manager toolbar / slideover / reorder panel / route summary on the driver branch', async () => {
        const wrapper = await mountDriver()
        expect(wrapper.find('[data-testid="detail-actions-toolbar"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="detail-upsert-slideover-stub"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="detail-reorder-panel-stub"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="detail-route-summary"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="detail-driver-placeholder"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="detail-driver-stops-empty"]').exists()).toBe(false)
      })

      it('mounts the cockpit even when the route has zero stops (REQ-DRC-112)', async () => {
        const wrapper = await mountDriver({ data: makeDraftRoute({ stopsLength: 0 }) })
        expect(wrapper.find('[data-testid="detail-driver-branch"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="driver-route-cockpit-stub"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="detail-driver-stops-empty"]').exists()).toBe(false)
      })

      it('does NOT render the driver branch when routeData is stale (different route id, keepPreviousData guard, REQ-DRC-107)', async () => {
        const wrapper = await mountDriver({ data: makeDraftRoute({ id: 'route-OTHER', stopsLength: 2 }) })
        expect(wrapper.find('[data-testid="detail-driver-branch"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="driver-route-cockpit-stub"]').exists()).toBe(false)
      })

      it('does NOT mount the cockpit on a generic 5xx / network error (REQ-DRC-112)', async () => {
        const wrapper = await mountDriver({ isError: true, data: undefined, error: { response: { status: 500, data: { message: 'boom' } } } })
        expect(wrapper.find('[data-testid="detail-error-block"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="driver-route-cockpit-stub"]').exists()).toBe(false)
      })

      it('does NOT mount the cockpit while isLoading=true (REQ-DRC-112)', async () => {
        const wrapper = await mountDriver({ isLoading: true, data: undefined })
        expect(wrapper.find('[data-testid="detail-driver-loading-skeleton"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="driver-route-cockpit-stub"]').exists()).toBe(false)
      })

      it('canCheckIn prop equals canUpdate at the call site — read-only driver sees no delivery actions (REQ-DRC-104, REQ-DCS-007/009)', async () => {
        const wrapper = await mountDriver(undefined, { canUpdate: { value: false } })
        const cockpit = wrapper.find('[data-testid="driver-route-cockpit-stub"]')
        expect(cockpit.exists()).toBe(true)
        expect(cockpit.attributes('data-can-check-in')).toBe('false')
      })

      it('checkInPending prop propagates to the cockpit (REQ-DRC-104, REQ-DCS-009/010)', async () => {
        checkInPendingRef.value = true
        const wrapper = await mountDriver()
        const cockpit = wrapper.find('[data-testid="driver-route-cockpit-stub"]')
        expect(cockpit.attributes('data-check-in-pending')).toBe('true')
      })

      it('request-check-in event fires the view-owned useCheckInStop instance exactly once with { id, stopId } (REQ-DRC-104)', async () => {
        const wrapper = await mountDriver()
        await wrapper.find('[data-testid="cockpit-stub-emit-check-in"]').trigger('click')
        await flushPromises()
        expect(checkInMutateMock).toHaveBeenCalledTimes(1)
        expect(checkInMutateMock).toHaveBeenCalledWith({ id: 'route-42', stopId: 's1' })
        // No view-level toast on success — the composable owns it.
        expect(toastCalls.length).toBe(0)
      })
      it('request-check-in rejection is swallowed at the view; mutation still called exactly once with { id, stopId } (REQ-DRC-104)', async () => {
        checkInMutateMock.mockRejectedValueOnce(new Error('boom'))
        const wrapper = await mountDriver()
        await wrapper.find('[data-testid="cockpit-stub-emit-check-in"]').trigger('click')
        await flushPromises()
        expect(checkInMutateMock).toHaveBeenCalledTimes(1)
        expect(checkInMutateMock).toHaveBeenCalledWith({ id: 'route-42', stopId: 's1' })
        // No view-level toast on rejection — the composable owns error surfacing.
        expect(toastCalls.length).toBe(0)
      })

      it('refresh event invokes the observer refetch exactly once; success → no toast (REQ-DRC-110, REQ-DCS-007)', async () => {
        detailMock.refetch.mockResolvedValue({ isError: false } as never)
        const wrapper = await mountDriver()
        await wrapper.find('[data-testid="cockpit-stub-emit-refresh"]').trigger('click')
        await flushPromises()
        expect(detailMock.refetch).toHaveBeenCalledTimes(1)
        expect(toastCalls.length).toBe(0)
      })

      it('refresh failure (result.isError=true) toasts the canonical refresh-failed copy once + keeps cached DTO (REQ-DRC-110)', async () => {
        const cached = makeDraftRoute()
        detailMock.refetch.mockResolvedValue({ isError: true, error: { response: { status: 500 } } } as never)
        const wrapper = await mountDriver({ data: cached })
        const mountsBeforeRefresh = cockpitPropsHistory.length
        await wrapper.find('[data-testid="cockpit-stub-emit-refresh"]').trigger('click')
        await flushPromises()
        expect(detailMock.refetch).toHaveBeenCalledTimes(1)
        const refreshToasts = toastCalls.filter((t) => t.title === DELIVERY_ROUTE_COPY.toasts.refreshFailed)
        expect(refreshToasts.length).toBe(1)
        expect(refreshToasts[0]?.color).toBe('error')
        // Cached DTO identity + no cockpit remount (scroll-preservation proxy) + no navigation.
        expect(cockpitPropsHistory[cockpitPropsHistory.length - 1]?.route).toBe(cached)
        expect(routerPushMock).not.toHaveBeenCalled()
        expect(wrapper.find('[data-testid="detail-driver-branch"]').exists()).toBe(true)
        expect(cockpitPropsHistory.length).toBe(mountsBeforeRefresh)
      })

      it('refresh rejection (thrown promise) also toasts refresh-failed once (REQ-DRC-110)', async () => {
        detailMock.refetch.mockRejectedValue(new Error('network'))
        const wrapper = await mountDriver()
        const mountsBeforeRefresh = cockpitPropsHistory.length
        await wrapper.find('[data-testid="cockpit-stub-emit-refresh"]').trigger('click')
        await flushPromises()
        expect(detailMock.refetch).toHaveBeenCalledTimes(1)
        const refreshToasts = toastCalls.filter((t) => t.title === DELIVERY_ROUTE_COPY.toasts.refreshFailed)
        expect(refreshToasts.length).toBe(1)
        // Thrown rejection keeps the driver branch mounted and the cockpit unremounted.
        expect(wrapper.find('[data-testid="detail-driver-branch"]').exists()).toBe(true)
        expect(cockpitPropsHistory.length).toBe(mountsBeforeRefresh)
      })

      it('isFetching=true forwards to the cockpit as the disabled-while-fetching prop (REQ-DCS-007)', async () => {
        await mountDriver({ data: makeDraftRoute(), isFetching: true })
        const last = cockpitPropsHistory[cockpitPropsHistory.length - 1]!
        expect(last.isFetching).toBe(true)
      })

      it('manager branch byte-equivalence — cockpit NEVER mounts when isManager=true (REQ-DRC-108)', async () => {
        resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
        resetDetailState({ data: makeDraftRoute() })
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="driver-route-cockpit-stub"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="detail-actions-toolbar"]').exists()).toBe(true)
      })

      it('does NOT mount the not-found full-page for the driver branch on 404 (driver 403 + true 404 map to not-found, REQ-DRC-103)', async () => {
        resetRoleFlags({ isManager: { value: true } })
        resetDetailState({ isError: true, data: undefined, error: { response: { status: 404, data: { error: 'ENTITY_NOT_FOUND', message: 'x' } } } })
        const wrapper = mountView()
        await flushPromises()
        expect(wrapper.find('[data-testid="detail-not-found"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="driver-route-cockpit-stub"]').exists()).toBe(false)
      })
    })

    describe('DeliveryRouteDetailView — TRIANGULATE: view SFC source invariants (S11a, REQ-DRC-103/104/107/108/109/110/112, REQ-DCS-007/009/010)', () => {
      it('view source invariants: no query-client/axios/fetch, single observer + single check-in instance + exactly one refetch (REQ-DRC-103/104/107/108/109/110/112)', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
        const fs = require('node:fs') as typeof import('node:fs')
        const src = fs.readFileSync((DeliveryRouteDetailView as unknown as { __file: string }).__file, 'utf8').replace(/\/\*\*[\s\S]*?\*\//g, '')
        for (const re of [/\buseQueryClient\b/, /\brefetchQueries\b/, /\baxios\b/, /\bfetch\(['"`]/, /\binvalidateQueries\b/, /\bnew\s+QueryClient\b/]) expect(src).not.toMatch(re)
        expect(src).toMatch(/useDeliveryRouteDetail/)
        expect(src).toMatch(/useCheckInStop\b/)
        expect(src).not.toMatch(/queryKey:\s*\[/)
        expect(src).not.toMatch(/invalidateQueries\(\s*\{\s*queryKey[\s\S]*?refetch/)
        expect((src.match(/useCheckInStop\(/g) ?? []).length).toBe(1)
        expect((src.match(/useDeliveryRouteDetail\(/g) ?? []).length).toBe(1)
        expect((src.match(/\brefetch\(\)/g) ?? []).length).toBe(1)
      })
    })

describe('DeliveryRouteDetailView — ConfirmModal for start/cancel/delete (REQ-DRM-010/011/012)', () => {
    beforeEach(() => {
      resetConfirmModalState()
    })

    it('opens a ConfirmModal when the start button is clicked (REQ-DRM-010)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: makeDraftRoute() })
      const wrapper = mountView()
      await flushPromises()
      await wrapper.find('[data-testid="detail-start-button"]').trigger('click')
      await nextTick()
      expect(confirmModalState.open).toBe(true)
      expect(confirmModalState.title).toMatch(/iniciar.*ruta/i)
      expect(confirmModalState.description).toMatch(/pasar.*activa|composici/i)
    })

    it('does NOT fire useStartDeliveryRoute until the confirm modal is confirmed (REQ-DRM-010)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: makeDraftRoute() })
      const wrapper = mountView()
      await flushPromises()
      await wrapper.find('[data-testid="detail-start-button"]').trigger('click')
      await nextTick()
      expect(startMutateMock).not.toHaveBeenCalled()
      await wrapper.find('[data-testid="detail-confirm-modal-confirm"]').trigger('click')
      await flushPromises()
      expect(startMutateMock).toHaveBeenCalledTimes(1)
      expect(startMutateMock).toHaveBeenCalledWith('route-42')
    })

    it('opens a ConfirmModal when the cancel button is clicked (REQ-DRM-011)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: { ...makeDraftRoute(), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' } })
      const wrapper = mountView()
      await flushPromises()
      await selectHeader(wrapper, CANCEL)
      await nextTick()
      expect(confirmModalState.open).toBe(true)
      expect(confirmModalState.title).toMatch(/cancelar.*ruta/i)
    })

    it('does NOT fire useCancelDeliveryRoute until the confirm modal is confirmed (REQ-DRM-011)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: { ...makeDraftRoute(), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' } })
      const wrapper = mountView()
      await flushPromises()
      await selectHeader(wrapper, CANCEL)
      await nextTick()
      expect(cancelMutateMock).not.toHaveBeenCalled()
      await wrapper.find('[data-testid="detail-confirm-modal-confirm"]').trigger('click')
      await flushPromises()
      expect(cancelMutateMock).toHaveBeenCalledTimes(1)
      expect(cancelMutateMock).toHaveBeenCalledWith('route-42')
    })

    it('opens a ConfirmModal when the delete button is clicked (REQ-DRM-012)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true }, canDelete: { value: true } })
      resetDetailState({ data: makeDraftRoute({ stopsLength: 0 }) })
      const wrapper = mountView()
      await flushPromises()
      await selectHeader(wrapper, DELETE)
      await nextTick()
      expect(confirmModalState.open).toBe(true)
      expect(confirmModalState.title).toMatch(/eliminar.*ruta/i)
      expect(confirmModalState.description).toMatch(/vac[i/plantilla]|permanentemente/i)
    })

    it('does NOT fire useDeleteDeliveryRoute until the confirm modal is confirmed (REQ-DRM-012)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true }, canDelete: { value: true } })
      resetDetailState({ data: makeDraftRoute({ stopsLength: 0 }) })
      const wrapper = mountView()
      await flushPromises()
      await selectHeader(wrapper, DELETE)
      await nextTick()
      expect(deleteMutateMock).not.toHaveBeenCalled()
      await wrapper.find('[data-testid="detail-confirm-modal-confirm"]').trigger('click')
      await flushPromises()
      expect(deleteMutateMock).toHaveBeenCalledTimes(1)
      expect(deleteMutateMock).toHaveBeenCalledWith('route-42')
    })

    it('cancelling the start confirm modal closes it without firing the mutation (REQ-DRM-010)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: makeDraftRoute() })
      const wrapper = mountView()
      await flushPromises()
      await wrapper.find('[data-testid="detail-start-button"]').trigger('click')
      await nextTick()
      expect(confirmModalState.open).toBe(true)
      await wrapper.find('[data-testid="detail-confirm-modal-cancel"]').trigger('click')
      await nextTick()
      expect(startMutateMock).not.toHaveBeenCalled()
    })
  })

  describe('DeliveryRouteDetailView — cancel gating expanded to DRAFT + ACTIVE (REQ-DRM-011, REQ-DRM-013)', () => {
    it('Cancelar ruta… is offered on a DRAFT route (was ACTIVE-only before S7 remediation)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: makeDraftRoute() })
      const wrapper = mountView()
      await flushPromises()
      expect(headerLabels(wrapper)).toContain(CANCEL)
    })

    it('Cancelar ruta… is offered on an ACTIVE route (REQ-DRM-011 baseline), and it is the only item', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: { ...makeDraftRoute(), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' } })
      const wrapper = mountView()
      await flushPromises()
      expect(headerLabels(wrapper)).toEqual([CANCEL])
      expect(wrapper.find('[data-testid="detail-start-button"]').exists()).toBe(false)
    })

    it.each([
      ['COMPLETED', { completedAt: '2025-01-01T00:00:00Z' }],
      ['CANCELLED', { cancelledAt: '2025-01-01T00:00:00Z' }],
    ])('%s routes have no action menu at all (REQ-DRM-011)', async (status, extra) => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true }, canDelete: { value: true } })
      resetDetailState({ data: { ...makeDraftRoute(), status, ...extra } })
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('[data-testid="detail-actions-toolbar"]').exists()).toBe(false)
    })

    it('clicking the cancel button on a DRAFT route fires the mutation after confirm (REQ-DRM-011)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: makeDraftRoute() })
      const wrapper = mountView()
      await flushPromises()
      await selectHeader(wrapper, CANCEL)
      await nextTick()
      await wrapper.find('[data-testid="detail-confirm-modal-confirm"]').trigger('click')
      await flushPromises()
      expect(cancelMutateMock).toHaveBeenCalledWith('route-42')
    })
  })

  describe('DeliveryRouteDetailView — edit gated to DRAFT only (REQ-DRM-013)', () => {
    it('Editar is offered on a DRAFT route', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: makeDraftRoute() })
      const wrapper = mountView()
      await flushPromises()
      expect(headerLabels(wrapper)).toContain(EDIT)
    })

    it.each([
      ['ACTIVE', { startedAt: '2025-01-01T00:00:00Z' }],
      ['COMPLETED', { completedAt: '2025-01-01T00:00:00Z' }],
      ['CANCELLED', { cancelledAt: '2025-01-01T00:00:00Z' }],
    ])('Editar is NOT offered on a %s route', async (status, extra) => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: { ...makeDraftRoute(), status, ...extra } })
      const wrapper = mountView()
      await flushPromises()
      expect(headerLabels(wrapper)).not.toContain(EDIT)
    })
  })

  describe('DeliveryRouteDetailView — start 409 conflict flow (design §10.1, REQ-DRM-013)', () => {
  it('mutations are wired through their composables — the 409 handling lives in useStartDeliveryRoute', async () => {
    // The view itself does NOT special-case the 409 (the composable owns the
    // extract→refetch→toast chain per design §10.1). This spec pins that
    // contract: the start button → ConfirmModal → useStartDeliveryRoute.mutate
    // (id). The composable handles the rejection. We assert by driving the
    // button + modal and verifying the mutation was invoked with the correct id.
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="detail-start-button"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="detail-confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(startMutateMock).toHaveBeenCalledWith('route-42')
  })
})

// ─── T3 S2/S4 — per-stop "Mover" action (draft-to-draft transfer) ────────────
describe('DeliveryRouteDetailView — per-stop Mover action (T3 S2/S4)', () => {
  beforeEach(() => {
    transferModalState.open = false
    transferModalState.originRouteId = ''
    transferModalState.stopId = null
  })

  it('renders a Mover… menu item per stop on a DRAFT route with update permission', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute({ stopsLength: 2 }) })
    const wrapper = mountView()
    await flushPromises()
    for (const id of ['s1', 's2']) {
      const move = wrapper.get(`[data-testid="detail-stop-move-${id}"]`)
      expect(move.findAll('[data-testid="row-action-item"]').map((item) => item.text())).toEqual(['Mover…'])
    }
  })

  it('hides the Mover control on a non-DRAFT route (both routes must be draft)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({
      data: { ...makeDraftRoute({ stopsLength: 2 }), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' },
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-stop-move-s1"]').exists()).toBe(false)
  })

  it('hides the Mover control when canUpdate is false', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: false } })
    resetDetailState({ data: makeDraftRoute({ stopsLength: 2 }) })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-stop-move-s1"]').exists()).toBe(false)
  })

  it('clicking Mover opens the destination dialog with that stop (no immediate mutation)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute({ stopsLength: 2 }) })
    const wrapper = mountView()
    await flushPromises()
    expect(transferModalState.open).toBe(false)
    await wrapper.get('[data-testid="detail-stop-move-s2"] [data-testid="row-action-item"]').trigger('click')
    await nextTick()
    expect(transferModalState.open).toBe(true)
    expect(transferModalState.originRouteId).toBe('route-42')
    expect(transferModalState.stopId).toBe('s2')
  })

  it('does not render Mover controls when routeData is stale (keepPreviousData guard)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute({ id: 'route-OTHER', stopsLength: 2 }) })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-stop-move-s1"]').exists()).toBe(false)
  })
})

describe('DeliveryRouteDetailView — manager workspace redesign (odd delivery-routes-manager-detail-visual S2-S5)', () => {
  function activeRoute(): Record<string, unknown> {
    const base = makeDraftRoute({ stopsLength: 3 })
    const stops = base.stops as Array<Record<string, unknown>>
    stops[0] = { ...stops[0], status: 'COMPLETED', completedAt: '2026-10-14T10:05:00' }
    stops[1] = { ...stops[1], status: 'IN_PROGRESS', checkedInAt: '2026-10-14T10:40:00' }
    return {
      ...base,
      status: 'ACTIVE',
      startedAt: '2026-10-14T09:40:00',
      timeline: [{ type: 'ROUTE_CREATED', at: '2026-10-14T08:00:00', actor: null }],
    }
  }

  beforeEach(() => {
    routerPushMock.mockClear()
    resetConfirmModalState()
  })

  it('opts the manager workspace into the delivery-routes theme boundary', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    const root = wrapper.find('[data-testid="detail-manager-workspace"]')
    expect(root.exists()).toBe(true)
    for (const marker of ['hf-theme', 'hf-ui', 'delivery-routes-visual']) expect(root.classes()).toContain(marker)
  })

  it('renders the rich header: back link, route title with driver and lifecycle moments, never the id', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ data: activeRoute() })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-route-title"]').text()).toBe('Ruta del 14 oct · Ana')
    const meta = wrapper.find('[data-testid="detail-route-meta"]').text()
    expect(meta).not.toContain('route-42')
    expect(meta).toContain('Creada')
    expect(meta).toContain('Iniciada')
    await wrapper.find('[data-testid="detail-back-link"]').trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith('/pos/rutas-de-entrega')
  })

  it('renders the KPI tiles and the progress bar', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ data: activeRoute() })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-kpi-delivered"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="detail-kpi-delivered"]').text()).toContain('Entregadas')
    expect(wrapper.find('[data-testid="detail-kpi-pending"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="detail-kpi-skipped"]').text()).toContain('0')
    expect(wrapper.find('[data-testid="detail-kpi-time"]').text()).toContain('En ruta')
    const bar = wrapper.find('[data-testid="detail-progress"]')
    expect(bar.attributes('role')).toBe('progressbar')
    expect(bar.attributes('aria-valuenow')).toBe('1')
    expect(bar.attributes('aria-valuemax')).toBe('3')
    expect(wrapper.text()).toContain('1 de 3 entregadas')
  })

  it('renders each stop with position, translated status, time and current marker — never the raw enum', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ data: activeRoute() })
    const wrapper = mountView()
    await flushPromises()
    const first = wrapper.find('[data-testid="detail-stop-s1"]')
    expect(first.text()).toContain('Cliente 1')
    expect(first.text()).toContain('F-1')
    expect(first.text()).toContain('Entregada')
    expect(first.text()).toMatch(/Entregada (\d{1,2} \w+, )?\d{2}:\d{2}/)
    const second = wrapper.find('[data-testid="detail-stop-s2"]')
    expect(second.text()).toMatch(/Check-in (\d{1,2} \w+, )?\d{2}:\d{2}/)
    expect(second.classes()).toContain('delivery-routes-detail-stop--current')
    expect(wrapper.find('[data-testid="detail-stop-s3"]').text()).toContain('Pendiente')
    expect(wrapper.find('[data-testid="detail-stops-section"]').text()).not.toMatch(/PENDING|IN_PROGRESS|COMPLETED/)
  })

  it('renders the side column with driver, notes and the activity timeline', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ data: activeRoute() })
    const wrapper = mountView()
    await flushPromises()
    const details = wrapper.find('[data-testid="detail-side-details"]')
    expect(details.text()).toContain('Ana')
    expect(details.text()).toContain('a@x')
    expect(details.text()).toContain('notas')
    const activity = wrapper.find('[data-testid="detail-side-activity"]')
    expect(activity.find('[data-testid="delivery-route-timeline-stub"]').exists()).toBe(true)
  })

  it('teleports the shared ConfirmModal inside the delivery-routes form theme boundary', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    mountView()
    await flushPromises()
    const content = (confirmModalState.uiContent ?? '').split(' ')
    for (const marker of ['hf-theme', 'hf-ui', 'hf-form-overlay', 'delivery-routes-form-portal']) {
      expect(content).toContain(marker)
    }
  })
})

describe('DeliveryRouteDetailView — manager workspace width (odd delivery-routes-manager-detail-visual S6)', () => {
  it('centers the manager workspace with the Caja 1320px maximum width', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    const column = wrapper.get('[data-testid="detail-manager-workspace"] [data-slot="scroll"] .max-w-\\[1320px\\]')
    expect(column.classes()).toContain('mx-auto')
    expect(column.classes()).toContain('w-full')
  })

  // detail-page-frame S3: the header stays pinned above the full-width scroller.
  it('renders the shared detail frame with the header pinned and the workspace in the scroll area', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    const frame = wrapper.findComponent(DetailPageFrame)
    expect(frame.exists()).toBe(true)
    expect(frame.attributes('data-testid')).toBe('detail-manager-workspace')
    expect(wrapper.find('[data-slot="header"] [data-testid="detail-route-summary"]').exists()).toBe(true)
    expect(wrapper.find('[data-slot="scroll"] [data-testid="detail-route-summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-slot="scroll"] [data-testid="detail-progress"]').exists()).toBe(true)
  })
})

describe('DeliveryRouteDetailView — page states (S10: empty, loading, data, error)', () => {
  it('loading: a skeleton shaped like the workspace (header, tiles, progress, panels), marked busy', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ isLoading: true })
    const wrapper = mountView()
    await flushPromises()
    const skeleton = wrapper.get('[data-testid="detail-loading-skeleton"]')
    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(skeleton.findAll('[data-skeleton="badge"]')).toHaveLength(1)
    expect(skeleton.findAll('[data-skeleton="title"]')).toHaveLength(1)
    expect(skeleton.findAll('[data-skeleton="action"]')).toHaveLength(1)
    expect(skeleton.findAll('[data-skeleton="kpi"]')).toHaveLength(4)
    expect(skeleton.findAll('[data-skeleton="kpi"] [data-skeleton="kpi-value"]')).toHaveLength(4)
    expect(skeleton.findAll('[data-skeleton="progress"]')).toHaveLength(1)
    expect(skeleton.findAll('[data-skeleton="stop-row"]').length).toBeGreaterThanOrEqual(3)
    expect(skeleton.findAll('[data-skeleton="side-panel"]')).toHaveLength(2)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('error: the shared error state with Reintentar and a fixed title, never the server text', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({
      isError: true,
      error: { response: { status: 500, data: { message: 'Error interno del servidor' } } },
    })
    detailMock.refetch.mockResolvedValue({ isError: false })
    const wrapper = mountView()
    await flushPromises()
    const state = wrapper.get('[data-testid="detail-error-block"] .hf-empty-state')
    expect(state.attributes('data-kind')).toBe('error')
    expect(state.attributes('role')).toBe('alert')
    expect(state.get('.hf-empty-state__title').text()).toBe('No se pudo cargar la ruta')
    expect(state.find('.hf-empty-state__description').exists()).toBe(false)
    expect(state.text()).not.toContain('Error interno del servidor')
    await wrapper.get('[data-testid="detail-error-retry"]').trigger('click')
    expect(detailMock.refetch).toHaveBeenCalledTimes(1)
  })

  it('not found: an empty state (not an error) that says so and offers the way back to the list', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ isError: true, error: { response: { status: 404, data: { error: 'ENTITY_NOT_FOUND', message: 'x' } } } })
    const wrapper = mountView()
    await flushPromises()
    const state = wrapper.get('[data-testid="detail-not-found"] .hf-empty-state')
    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.attributes('role')).toBe('status')
    expect(state.get('.hf-empty-state__title').text()).toBe('No encontramos la ruta')
    expect(wrapper.find('[data-testid="detail-error-block"]').exists()).toBe(false)
    await wrapper.get('[data-testid="detail-not-found-back"]').trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith('/pos/rutas-de-entrega')
  })

  it('not found: a bare HTTP 404 (no domain code in the body) is also not-found, not an error', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ isError: true, error: { response: { status: 404, data: { message: 'No encontrado' } } } })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-not-found"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="detail-error-block"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No encontrado')
  })

  it('empty: a route without stops shows "Sin paradas" and points at the append picker on a draft', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute({ stopsLength: 0 }) })
    const wrapper = mountView()
    await flushPromises()
    const empty = wrapper.get('[data-testid="detail-stops-section"] .hf-empty-state')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Sin paradas')
    expect(empty.text()).toContain('Agrega una venta')
    expect(wrapper.find('[data-testid="detail-append-section"]').exists()).toBe(true)
  })

  it('data: neutral status badge for a draft, with the aviso when it cannot start', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: { ...makeDraftRoute({ stopsLength: 0 }), driver: null } })
    const wrapper = mountView()
    await flushPromises()
    const badge = wrapper.get('[data-testid="detail-route-status"]')
    expect(badge.attributes('data-tone')).toBe('neutral')
    expect(badge.text()).toBe('Borrador')
    const aviso = wrapper.get('[data-testid="detail-route-aviso"]')
    expect(aviso.text()).toContain('2 avisos')
    expect(aviso.text()).toContain('Sin paradas, Sin repartidor')
  })

  it('data: an active route shows an info badge, no aviso, and stop badges use the stop tones', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    const route = makeDraftRoute({ stopsLength: 2 }) as { stops: Array<Record<string, unknown>> }
    route.stops[0]!.status = 'COMPLETED'
    route.stops[1]!.status = 'SKIPPED'
    resetDetailState({ data: { ...route, status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' } })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.get('[data-testid="detail-route-status"]').attributes('data-tone')).toBe('info')
    expect(wrapper.find('[data-testid="detail-route-aviso"]').exists()).toBe(false)
    const stopBadges = wrapper.findAll('[data-testid^="detail-stop-"] .hf-status-badge')
    expect(stopBadges.map((badge) => badge.attributes('data-tone'))).toEqual(['success', 'warning'])
  })

  it('draws the detail header with one primary and a single ⋮, and never shows the id', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true }, canDelete: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    const toolbar = wrapper.get('[data-testid="detail-actions-toolbar"]')
    expect(toolbar.findAll('.hf-primary-control, [class*="hf-primary-control"]')).toHaveLength(1)
    expect(toolbar.findAll('[data-testid="row-actions-menu"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="detail-route-summary"]').text()).not.toContain('route-42')
  })
})

describe('DeliveryRouteDetailView — mobile detail header and progress (review round 1)', () => {
  function activeRoute(): Record<string, unknown> {
    return { ...makeDraftRoute({ stopsLength: 1 }), status: 'ACTIVE', startedAt: '2026-10-14T09:40:00' }
  }

  it('shows the back link only below md: from md the breadcrumb already says where you are', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.get('[data-testid="detail-back-link"]').classes()).toContain('md:hidden')
  })

  it('hides the back link from md with real CSS, because the scoped display rule beats the md:hidden utility', () => {
    const source = readFileSync('src/features/delivery-routes/views/DeliveryRouteDetailView.vue', 'utf8')
    expect(source).toMatch(/@media \(min-width: 768px\) \{[^}]*\.route-back-link \{ display: none; \}/)
  })

  it('uses the shared 40px page gutter on the manager skeleton and workspace', () => {
    const source = readFileSync('src/features/delivery-routes/views/DeliveryRouteDetailView.vue', 'utf8')
    // The skeleton, plus the framed workspace's header and body columns.
    expect(source.match(/max-w-\[1320px\][^"]*md:px-10/g)).toHaveLength(3)
  })

  it('shows the meta separators only from sm, so a wrapped phone line never dangles a dot', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: activeRoute() })
    const wrapper = mountView()
    await flushPromises()
    const separators = wrapper.get('[data-testid="detail-route-meta"]').findAll('[aria-hidden="true"]').filter((node) => node.text() === '·')
    expect(separators.length).toBeGreaterThan(0)
    for (const separator of separators) {
      expect(separator.classes()).toContain('hidden')
      expect(separator.classes()).toContain('sm:inline')
    }
  })

  it('moves the one primary to a sticky bottom bar on mobile and keeps the ⋮ in the header', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true }, canDelete: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    const header = wrapper.get('[data-testid="detail-actions-toolbar"]')
    // Desktop: the primary sits in the header, hidden below md.
    const desktop = header.get('[data-testid="detail-start-button"]')
    expect(desktop.classes()).toContain('max-md:hidden')
    expect(header.findAll('[data-testid="row-actions-menu"]')).toHaveLength(1)
    // Mobile: the same primary in the bar, hidden from md.
    const bar = wrapper.get('[data-slot="footer"] [data-testid="mobile-action-bar"]')
    expect(bar.classes()).toContain('md:hidden')
    const mobile = bar.get('[data-testid="detail-start-button-mobile"]')
    await mobile.trigger('click')
    await nextTick()
    expect(confirmModalState.open).toBe(true)
    expect(confirmModalState.title).toMatch(/iniciar.*ruta/i)
  })

  it('draws no bar when there is no primary action (an active route only has the ⋮)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: activeRoute() })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="mobile-action-bar"]').exists()).toBe(false)
  })

  it('lets the title wrap to two lines instead of cutting it to a few letters', () => {
    const source = readFileSync('src/features/delivery-routes/views/DeliveryRouteDetailView.vue', 'utf8')
    const rule = /\.route-detail-title\s*\{[^}]*\}/.exec(source)![0]
    expect(rule).not.toContain('white-space: nowrap')
    expect(rule).toContain('-webkit-line-clamp: 2')
  })

  it('draws a visible progress track, with the fill at the delivered percentage', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ data: activeRoute() })
    const wrapper = mountView()
    await flushPromises()
    const bar = wrapper.get('[data-testid="detail-progress"]')
    expect(bar.classes()).toContain('route-progress-track')
    expect(bar.get('.delivery-routes-progress-fill').attributes('style')).toContain('width: 0%')
    const source = readFileSync('src/features/delivery-routes/views/DeliveryRouteDetailView.vue', 'utf8')
    expect(/\.route-progress-track\s*\{[^}]*var\(--hf-border\)/.test(source)).toBe(true)
  })
})
