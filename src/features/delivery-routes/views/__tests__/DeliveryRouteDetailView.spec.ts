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
import { defineComponent, h, ref } from 'vue'
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
  data: ref<unknown>(undefined),
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

// ─── Toast recorder so we can assert the 409 conflict toast + absence of leak ──
const toastCalls: Array<{ title: string; color?: string; description?: string }> = []
vi.stubGlobal('useToast', () => ({
  add: (t: { title: string; color?: string; description?: string }) => {
    toastCalls.push(t)
  },
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

beforeEach(() => {
  vi.clearAllMocks()
  slideoverEmits.edit.length = 0
  slideoverEmits.create.length = 0
  toastCalls.length = 0
  lastReorderProps = {}
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

  it('clicking the start button calls useStartDeliveryRoute.mutate (REQ-DRM-013)', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="detail-start-button"]').trigger('click')
    await flushPromises()
    expect(startMutateMock).toHaveBeenCalledTimes(1)
    expect(startMutateMock).toHaveBeenCalledWith('route-42')
  })

  it('clicking the cancel button calls useCancelDeliveryRoute.mutate', async () => {
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({
      data: { ...makeDraftRoute(), status: 'ACTIVE', startedAt: '2025-01-01T00:00:00Z' },
    })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="detail-cancel-button"]').trigger('click')
    await flushPromises()
    expect(cancelMutateMock).toHaveBeenCalledTimes(1)
    expect(cancelMutateMock).toHaveBeenCalledWith('route-42')
  })

  it('clicking the delete button calls useDeleteDeliveryRoute.mutate on a DRAFT zero-stop route', async () => {
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
    expect(deleteMutateMock).toHaveBeenCalledTimes(1)
    expect(deleteMutateMock).toHaveBeenCalledWith('route-42')
  })

  it('does NOT render an append-stop affordance (deferred — no single-sale selector yet)', async () => {
    // design §4.2 lists edit/reorder/start/cancel/delete for the detail view, NOT
    // append. Append-stop needs a single-sale selector that lands later; until
    // then the button must NOT render (prevents sending a wrong saleId).
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="detail-append-button"]').exists()).toBe(false)
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

describe('DeliveryRouteDetailView — driver branch placeholder (REQ-DRM-002 driver side)', () => {
  it('returns null when isDriver=true (placeholder marker until S6b lands)', async () => {
    resetRoleFlags({
      isManager: { value: false },
      isDriver: { value: true },
      canRead: { value: true },
    })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    // Driver branch renders nothing — no toolbar, no slideover, no reorder
    // panel, no append button. S6b replaces this with DriverStopDetail +
    // DeliveryRouteTimeline.
    expect(wrapper.find('[data-testid="detail-actions-toolbar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="detail-upsert-slideover-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="detail-reorder-panel-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="detail-route-summary"]').exists()).toBe(false)
  })

  it('does NOT render the not-found full-page for the driver branch on 404 (driver 403 maps to not-found, but a true 404 with isDriver still maps to not-found)', async () => {
    // Driver 403 and 404 both render the full-page not-found state. The
    // DRIVER branch as a whole is a placeholder (returns null) until S6b
    // ships; this spec pins the manager-side not-found path which is the
    // one S6a owns.
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
  })
})

describe('DeliveryRouteDetailView — start 409 conflict flow (design §10.1, REQ-DRM-013)', () => {
  it('mutations are wired through their composables — the 409 handling lives in useStartDeliveryRoute', async () => {
    // The view itself does NOT special-case the 409 (the composable owns the
    // extract→refetch→toast chain per design §10.1). This spec pins that
    // contract: clicking start calls useStartDeliveryRoute.mutate(id) and the
    // composable handles the rejection. We assert by triggering the click and
    // verifying the mutation was invoked with the correct id.
    resetRoleFlags({ isManager: { value: true }, canUpdate: { value: true } })
    resetDetailState({ data: makeDraftRoute() })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="detail-start-button"]').trigger('click')
    await flushPromises()
    expect(startMutateMock).toHaveBeenCalledWith('route-42')
  })
})
