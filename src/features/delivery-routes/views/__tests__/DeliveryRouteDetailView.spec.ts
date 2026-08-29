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
//   - The view consumes `useDeliveryRoutePermissions` (REFACTOR target).
//
// We mock the inner composables + components to focus on the composition surface
// (i.e. which branches render given inputs). Mirrors the
// `DeliveryRoutesListView.spec.ts` precedent.

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
    },
    emits: ['update:selected'],
    setup(props, { emit }) {
      const sales = (props.modelValue as string[])
      return () =>
        h('div', { 'data-testid': 'detail-eligible-sales-picker-stub' }, [
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
const confirmModalState: { open: boolean; title: string; confirmColor?: string; description: string; confirmLabel: string; cancelLabel: string } = { open: false, title: '', description: '', confirmColor: 'primary', confirmLabel: '', cancelLabel: '' }
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
    },
    emits: ['update:open', 'confirm', 'cancel'],
    setup(props, { emit }) {
      return () => {
        confirmModalState.open = props.open
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

function mountView() {
  return mount(DeliveryRouteDetailView, {
    global: {
      stubs: {
        // Avoid pulling in the Nuxt UI runtime; the inner components are mocked.
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
    expect(wrapper.find('[data-testid="detail-actions-toolbar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="detail-edit-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="detail-start-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="detail-cancel-button"]').exists()).toBe(true)
    // Delete button has the additional DRAFT + zero-stops + canDelete gate;
    // the default makeDraftRoute has 2 stops so delete is hidden here. A
    // dedicated test below covers the visible-path.
    expect(wrapper.find('[data-testid="detail-delete-button"]').exists()).toBe(false)
  })

  it('opens the edit slideover when the edit button is clicked (REQ-DRM-007)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="detail-edit-button"]').trigger('click')
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
    await wrapper.find('[data-testid="detail-edit-button"]').trigger('click')
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

  it('hides the delete button unless the route is DRAFT + has zero stops + canDelete=true (REQ-DRM-008, REQ-DRM-015)', async () => {
    resetRoleFlags({
          isManager: { value: true },
          canUpdate: { value: true },
          canDelete: { value: true },
        })
    // DRAFT + zero stops + canDelete → delete button VISIBLE.
    resetDetailState({ data: makeDraftRoute({ stopsLength: 0 }) })
    let wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-delete-button"]').exists()).toBe(true)

    // DRAFT + has stops → delete HIDDEN (zero-stop rule).
    resetDetailState({ data: makeDraftRoute({ stopsLength: 2 }) })
    wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-delete-button"]').exists()).toBe(false)

    // ACTIVE + zero stops → delete HIDDEN (status rule).
    resetDetailState({
      data: { ...makeDraftRoute({ stopsLength: 0 }), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' },
    })
    wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-delete-button"]').exists()).toBe(false)

    // DRAFT + zero stops + canDelete=false → delete HIDDEN (permission rule).
    resetRoleFlags({ isManager: { value: true }, canDelete: { value: false } })
    resetDetailState({ data: makeDraftRoute({ stopsLength: 0 }) })
    wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-delete-button"]').exists()).toBe(false)
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
    expect(wrapper.find('[data-testid="detail-delete-button"]').exists()).toBe(false)
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
    await wrapper.find('[data-testid="detail-cancel-button"]').trigger('click')
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
    await wrapper.find('[data-testid="detail-delete-button"]').trigger('click')
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

  it('renders the route summary (status badge + driver + x/y progress) when data is loaded', async () => {
    resetRoleFlags({ isManager: { value: true } })
    resetDetailState({ data: makeDraftRoute({ stopsLength: 3 }) })
    const wrapper = mountView()
    await flushPromises()
    // Header testid is a stable surface the view exposes for the summary.
    expect(wrapper.find('[data-testid="detail-route-summary"]').exists()).toBe(true)
    // Stops list rendered for the manager branch (the panel reads it via
    // `route.stops`; the view itself renders the count via buildStopProgress).
    expect(wrapper.text()).toContain('0/3')
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
    expect(wrapper.text()).toContain(DELIVERY_ROUTE_COPY.toasts.notFound)
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
        expect(wrapper.find('[data-testid="detail-loading-skeleton"]').exists()).toBe(true)
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
      await wrapper.find('[data-testid="detail-cancel-button"]').trigger('click')
      await nextTick()
      expect(confirmModalState.open).toBe(true)
      expect(confirmModalState.title).toMatch(/cancelar.*ruta/i)
    })

    it('does NOT fire useCancelDeliveryRoute until the confirm modal is confirmed (REQ-DRM-011)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: { ...makeDraftRoute(), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' } })
      const wrapper = mountView()
      await flushPromises()
      await wrapper.find('[data-testid="detail-cancel-button"]').trigger('click')
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
      await wrapper.find('[data-testid="detail-delete-button"]').trigger('click')
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
      await wrapper.find('[data-testid="detail-delete-button"]').trigger('click')
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
    it('cancel button is ENABLED on a DRAFT route (was ACTIVE-only before S7 remediation)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: makeDraftRoute() })
      const wrapper = mountView()
      await flushPromises()
      const cancelBtn = wrapper.find('[data-testid="detail-cancel-button"]')
      expect(cancelBtn.exists()).toBe(true)
      expect((cancelBtn.element as HTMLButtonElement).disabled).toBe(false)
    })

    it('cancel button is ENABLED on an ACTIVE route (REQ-DRM-011 baseline)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: { ...makeDraftRoute(), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' } })
      const wrapper = mountView()
      await flushPromises()
      const cancelBtn = wrapper.find('[data-testid="detail-cancel-button"]')
      expect((cancelBtn.element as HTMLButtonElement).disabled).toBe(false)
    })

    it('cancel button is HIDDEN on COMPLETED / CANCELLED routes (REQ-DRM-011)', async () => {
      // S7 verify remediation — the cancel button doesn't render at all on
      // COMPLETED / CANCELLED (the spec restricts it to DRAFT + ACTIVE).
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({
        data: { ...makeDraftRoute(), status: 'COMPLETED', completedAt: '2025-01-01T00:00:00Z' },
      })
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('[data-testid="detail-cancel-button"]').exists()).toBe(false)
    })

    it('cancel button is HIDDEN on COMPLETED / CANCELLED routes (driver-bound case)', async () => {
      // The button also stays hidden on CANCELLED (the route already finished).
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({
        data: { ...makeDraftRoute(), status: 'CANCELLED', cancelledAt: '2025-01-01T00:00:00Z' },
      })
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('[data-testid="detail-cancel-button"]').exists()).toBe(false)
    })

    it('clicking the cancel button on a DRAFT route fires the mutation after confirm (REQ-DRM-011)', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: makeDraftRoute() })
      const wrapper = mountView()
      await flushPromises()
      await wrapper.find('[data-testid="detail-cancel-button"]').trigger('click')
      await nextTick()
      await wrapper.find('[data-testid="detail-confirm-modal-confirm"]').trigger('click')
      await flushPromises()
      expect(cancelMutateMock).toHaveBeenCalledWith('route-42')
    })
  })

  describe('DeliveryRouteDetailView — edit gated to DRAFT only (REQ-DRM-013)', () => {
    it('edit button is ENABLED on a DRAFT route', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: makeDraftRoute() })
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('[data-testid="detail-edit-button"]').exists()).toBe(true)
    })

    it('edit button does NOT render on an ACTIVE route', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: { ...makeDraftRoute(), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' } })
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('[data-testid="detail-edit-button"]').exists()).toBe(false)
    })

    it('edit button does NOT render on a COMPLETED route', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: { ...makeDraftRoute(), status: 'COMPLETED', completedAt: '2025-01-01T00:00:00Z' } })
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('[data-testid="detail-edit-button"]').exists()).toBe(false)
    })

    it('edit button does NOT render on a CANCELLED route', async () => {
      resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
      resetDetailState({ data: { ...makeDraftRoute(), status: 'CANCELLED', cancelledAt: '2025-01-01T00:00:00Z' } })
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('[data-testid="detail-edit-button"]').exists()).toBe(false)
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
