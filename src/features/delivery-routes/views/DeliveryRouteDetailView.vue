<script setup lang="ts">
/**
 * DeliveryRouteDetailView — S6a + S7 verify remediation + S11a view wiring (sdd
 * delivery-routes, design.md §4.1, §4.2, §6.4, §7.2, §10.1, §11, REQ-DRM-008/
 * 010/011/012/013/015, REQ-DRC-103/104/107/108/109/110/112, REQ-DCS-007/009/010).
 *
 * Route-level composition surface for `/pos/rutas-de-entrega/:id`. ONE route
 * serves both roles; the view discriminates manager vs driver via a SINGLE
 * `useDeliveryRouteRole` call, which also provides the per-action permissions.
 *
 *   - Manager branch (`isManager=true`): renders the route detail with the S4c
 *     + S5a + S5b + S7 mutation affordances:
 *       * Edit (DeliveryRouteUpsertSlideover in edit mode; DRAFT-only per REQ-DRM-013)
 *       * Start / Cancel (DRAFT + ACTIVE per REQ-DRM-011/013) — each gated by ConfirmModal
 *       * Delete (DRAFT + zero stops + canDelete) — gated by ConfirmModal per REQ-DRM-012
 *       * Reorder (panel only on DRAFT)
 *       * Append stop (DRAFT + update) — wired through `EligibleSalesPicker` +
 *         `useAppendDeliveryRouteStop` per REQ-DRM-008/013
 *     404 ENTITY_NOT_FOUND on detail fetch → full-page "Ruta no encontrada".
 *     Driver 403 → SAME full-page not-found state (no banner, no toast — no
 *     presence leak; design §7.2, §11).
 *   - Driver branch (`isDriver=true`, S11a): mounts `DriverRouteCockpit` with
 *     typed props `{ route, isFetching, canCheckIn=canUpdate, checkInPending }`
 *     and events back (list push) / refresh (single observer refetch; failure →
 *     toast) / request-check-in(stopId) (single view-owned useCheckInStop,
 *     REQ-DRC-104). The superseded old-card stack and inline timeline are gone;
 *     the timeline mounts only inside the cockpit's history-mode drawer.
 *
 * Loading / error / not-found states follow design §11. The view is a composition
 * surface only — no card markup, no field markup. Mutation wiring is role-gated;
 * the discriminator is the one branching decision.
 */
import { computed, ref } from 'vue'
import { useNow } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import { useDeliveryRouteRole } from '../composables/useDeliveryRouteRole'
import { useDeliveryRouteDetail } from '../composables/useDeliveryRouteDetail'
import { useUpdateDeliveryRoute } from '../composables/useUpdateDeliveryRoute'
import { useDeleteDeliveryRoute } from '../composables/useDeleteDeliveryRoute'
import { useStartDeliveryRoute } from '../composables/useStartDeliveryRoute'
import { useCancelDeliveryRoute } from '../composables/useCancelDeliveryRoute'
import { useAppendDeliveryRouteStop } from '../composables/useAppendDeliveryRouteStop'
import { useCheckInStop } from '../composables/useCheckInStop'
import DeliveryRouteUpsertSlideover from '../components/DeliveryRouteUpsertSlideover.vue'
import DeliveryRouteReorderPanel from '../components/DeliveryRouteReorderPanel.vue'
import DriverRouteCockpit from '../components/cockpit/DriverRouteCockpit.vue'
import '../styles/delivery-routes-visual.css'
import EligibleSalesPicker from '../components/EligibleSalesPicker.vue'
import TransferDeliveryRouteStopModal from '../components/TransferDeliveryRouteStopModal.vue'
import { extractDeliveryRouteErrorCode } from '../interfaces/errors'
import { buildManagerRouteDetail } from '../utils/delivery-route-detail.utils'
import { deliveryRouteRowActions } from '../utils/delivery-route-actions.utils'
import { getRouteIssues, routeAvisoLabel } from '../utils/delivery-route-list.utils'
import DeliveryRouteTimeline from '../components/DeliveryRouteTimeline.vue'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type DeliveryRouteStatus,
  type DeliveryRouteStop,
  type UpdateDeliveryRouteRequest,
} from '../interfaces/delivery-route.types'
import { DELIVERY_ROUTE_COPY } from '../copy'

// ─── Route / role / detail ────────────────────────────────────────────────────
const route = useRoute()
const router = useRouter()
const routeId = computed(() => String(route.params.id ?? ''))

// Single discriminator call (REFACTOR target — S6a spec pin).
const { isManager, isDriver, canUpdate, canDelete } = useDeliveryRouteRole()

const {
  data: routeData,
  isLoading,
  isFetching,
  isError,
  error,
  refetch,
} = useDeliveryRouteDetail(routeId)

// ─── View-owned check-in mutation (REQ-DRC-104) ────────────────────────────────
// Single view-owned `useCheckInStop`; the cockpit never instantiates it and the
// composable owns toasts + invalidation (the view does not re-toast/re-invalidate).
const { mutateAsync: checkInStop, isPending: checkInPending } = useCheckInStop()

// Refresh-failure toast only (REQ-DRC-110); other toasts are composable-owned.
declare const useToast: () => { add: (o: { title: string; color?: 'error' }) => void }
const toast = useToast()

// ─── Driver cockpit wiring (S11a, REQ-DRC-104/107/109/110, REQ-DCS-007) ───────
// Refresh: one observer refetch; failure toasts refresh-failed once (cached DTO
// + scroll stay put). Check-in: single view-owned mutation forward.
async function handleRefresh(): Promise<void> {
  try {
    if ((await refetch()).isError) toast.add({ title: DELIVERY_ROUTE_COPY.toasts.refreshFailed, color: 'error' })
  } catch {
    toast.add({ title: DELIVERY_ROUTE_COPY.toasts.refreshFailed, color: 'error' })
  }
}

async function handleCheckIn(stopId: string): Promise<void> {
  try { await checkInStop({ id: routeId.value, stopId }) } catch { /* composable owns the error toast */ }
}
function handleBack(): void { void router.push('/pos/rutas-de-entrega') }

// ─── Not-found / forbidden detection ──────────────────────────────────────────
// Type-only observer-error shape — keeps the HTTP client import out of the view.
type DetailFetchError = { response?: { status?: number } }
// Driver 403 → same full-page "Ruta no encontrada" state as 404 ENTITY_NOT_FOUND.
// The view NEVER surfaces a 403 banner / toast (no presence leak; design §7.2,
// §11). The composable just propagates the rejection — we map both 404 and 403
// to the same not-found state.
const notFoundCode = computed<string | null>(() => {
  if (!isError.value) return null
  const code = extractDeliveryRouteErrorCode(error.value)
  if (code === 'ENTITY_NOT_FOUND') return 'ENTITY_NOT_FOUND'
  // A bare HTTP 404 (no domain code in the body) is a missing record too, never an error.
  const status = (error.value as DetailFetchError | null | undefined)?.response?.status
  if (status === 404) return 'ENTITY_NOT_FOUND'
  // Driver 403 → same full-page not-found state (no presence leak; design §7.2,
  // §11). Any OTHER error (5xx, network, unknown) falls through to the generic
  // error block below — it is NOT a not-found state.
  if (status === 403 && isDriver.value) return 'ENTITY_NOT_FOUND'
  return null
})

// ─── Mutations (S4c + S5a + S5b + S7 verify remediation) ──────────────────────
const { mutateAsync: updateRoute, isPending: updateIsPending } = useUpdateDeliveryRoute()
const { mutateAsync: deleteRoute, isPending: deleteIsPending } = useDeleteDeliveryRoute()
const { mutateAsync: startRoute, isPending: startIsPending } = useStartDeliveryRoute()
const { mutateAsync: cancelRoute, isPending: cancelIsPending } = useCancelDeliveryRoute()
const { mutateAsync: appendStop, isPending: appendIsPending } = useAppendDeliveryRouteStop()

// ─── Edit slideover ───────────────────────────────────────────────────────────
const isEditOpen = ref(false)

async function onEdit(payload: UpdateDeliveryRouteRequest): Promise<void> {
  try {
    await updateRoute({ id: routeId.value, payload })
    // Close only on success — the mutation's onSuccess already fired the toast.
    isEditOpen.value = false
  } catch {
    // Error already surfaced via the composable's onError toast; keep the
    // slideover open so the user can correct the input.
  }
}

// ─── ConfirmModal wiring (S7 verify remediation, REQ-DRM-010/011/012) ──────────
// One ConfirmModal is reused for start / cancel / delete; the `kind` ref +
// confirm handler pick which action fires. We could split into three modals
// but the shared primitive is the simpler surface and matches the rest of
// the app's pattern (admin payment-methods view).
const confirmKind = ref<'start' | 'cancel' | 'delete' | null>(null)
const isConfirmOpen = computed<boolean>(() => confirmKind.value !== null)

function openConfirm(kind: 'start' | 'cancel' | 'delete'): void {
  confirmKind.value = kind
}

function closeConfirm(): void {
  confirmKind.value = null
}

async function onConfirm(): Promise<void> {
  const kind = confirmKind.value
  closeConfirm()
  try {
    if (kind === 'start') {
      await startRoute(routeId.value)
    } else if (kind === 'cancel') {
      await cancelRoute(routeId.value)
    } else if (kind === 'delete') {
      await deleteRoute(routeId.value)
      void router.push('/pos/rutas-de-entrega')
    }
  } catch {
    // Errors already surfaced via the composable's onError toast (the 409
    // conflict path owns its own refetch + toast per design §10.1).
  }
}

// Wire each action button to openConfirm — the mutation only fires after the
// user confirms inside the modal.
function onStart(): void { openConfirm('start') }
function onCancel(): void { openConfirm('cancel') }
function onDelete(): void { openConfirm('delete') }

// ─── Append-stop wiring (S7 verify remediation, REQ-DRM-008/013) ──────────────
// Single-sale selector (EligibleSalesPicker) + "Agregar parada" button.
// The picker is multi-select-capable, but we only ever submit ONE saleId per
// call (the append mutation accepts a single saleId). We track the first
// selected id and reset the picker after a successful submit. The picker is
// hidden when the route is not DRAFT (mutation would 422 anyway).
const appendSelectedSaleIds = ref<string[]>([])
const appendSelectedSaleId = computed<string | null>(() =>
  appendSelectedSaleIds.value.length > 0 ? appendSelectedSaleIds.value[0]! : null,
)

function onAppendSalePicked(next: string[]): void {
  // Keep only the first selection — the append mutation accepts a single
  // saleId and would 422 on a multi-id payload.
  appendSelectedSaleIds.value = next.slice(0, 1)
}

async function onAppend(): Promise<void> {
  const saleId = appendSelectedSaleId.value
  if (!saleId) return
  try {
    await appendStop({ id: routeId.value, payload: { saleId } })
    // Reset the selector on success so the user can immediately pick another
    // sale. The composable's onSuccess already fired the "Parada agregada"
    // toast + invalidated the eligible-sales cache.
    appendSelectedSaleIds.value = []
  } catch {
    // Error already surfaced via the composable's onError toast.
  }
}

// ─── Transfer-stop wiring (T3 S2/S4) ──────────────────────────────────────────
// Per-stop "Mover" opens the destination-selection + explicit-confirmation
// dialog. The dialog owns the mutation, destination list fetch and inline error
// surfacing; the view only tracks which stop was chosen and whether the dialog
// is open. No immediate mutation fires from this action.
const transferStop = ref<DeliveryRouteStop | null>(null)
const isTransferOpen = ref(false)

function onMoveStop(stop: DeliveryRouteStop): void {
  transferStop.value = stop
  isTransferOpen.value = true
}

// ─── Per-action gating ───────────────────────────────────────────────────────
// The header holds ONE primary (Iniciar ruta) and a ⋮ menu for the rest. The
// gates live in `deliveryRouteRowActions` (the same ones as the list row menu):
//   - Edit:   DRAFT + canUpdate
//   - Start:  DRAFT + at least one stop (the backend rejects empty-route starts
//             with 422 DELIVERY_ROUTE_INVALID_TRANSITION) + canUpdate
//   - Cancel: DRAFT or ACTIVE + canUpdate (REQ-DRM-011)
//   - Delete: DRAFT + zero stops + canDelete (REQ-DRM-008/015)
// Every gate ignores a cached detail that belongs to ANOTHER route id
// (keepPreviousData stale guard).
const currentRoute = computed(() => {
  const r = routeData.value
  return r && r.id === routeId.value ? r : null
})

const routeActions = computed(() =>
  currentRoute.value
    ? deliveryRouteRowActions(currentRoute.value, {
        canUpdate: canUpdate.value,
        canDelete: canDelete.value,
      })
    : [],
)
const canShowStart = computed<boolean>(() => routeActions.value.some((action) => action.key === 'start'))
const menuActions = computed(() =>
  routeActions.value.filter((action) => action.key !== 'view' && action.key !== 'start'),
)

function runHeaderAction(key: string): void {
  if (key === 'edit') isEditOpen.value = true
  else if (key === 'cancel') onCancel()
  else if (key === 'delete') onDelete()
}

// Append-stop is manager-only on DRAFT (any non-DRAFT rejects at the backend).
// Surfaced as an explicit affordance (REQ-DRM-008/013): a single-sale selector
// plus the "Agregar parada" button.
const canShowAppend = computed<boolean>(() => {
  const r = currentRoute.value
  if (!r) return false
  if (r.status !== 'DRAFT') return false
  return canUpdate.value
})

// Per-stop "Mover" is available only while BOTH routes can be DRAFT: the source
// must be DRAFT (destination list is DRAFT-only) and the manager needs update.
const canShowMove = computed<boolean>(() => {
  const r = currentRoute.value
  if (!r) return false
  if (r.status !== 'DRAFT') return false
  return canUpdate.value
})

/** Draft blockers ("Sin paradas", "Sin repartidor") shown as an inline aviso. */
const routeIssues = computed(() => (currentRoute.value ? getRouteIssues(currentRoute.value) : []))

// ─── Status / progress helpers ────────────────────────────────────────────────
function statusTone(status: DeliveryRouteStatus) {
  return DELIVERY_ROUTE_STATUS_TONES[status]
}
function statusLabel(status: DeliveryRouteStatus) {
  return DELIVERY_ROUTE_STATUS_LABELS[status]
}
const MOVE_ACTIONS = [
  { key: 'move', label: `${DELIVERY_ROUTE_COPY.actions.moveStop}…`, icon: 'i-lucide-arrow-right-left' },
]

// Manager workspace view model (header, KPIs, progress, rich stop rows).
// The clock ticks once a minute so "En ruta" stays current.
const now = useNow({ interval: 60_000 })
const managerDetail = computed(() =>
  routeData.value ? buildManagerRouteDetail(routeData.value, now.value) : null,
)

// Teleported dialogs carry the module's form portal marker (design §3).
const FORM_PORTAL = 'hf-theme hf-ui hf-form-overlay delivery-routes-form-portal'

// ─── ConfirmModal payload helpers ─────────────────────────────────────────────
const confirmTitle = computed<string>(() => {
  if (confirmKind.value === 'start') return DELIVERY_ROUTE_COPY.confirm.start.title
  if (confirmKind.value === 'cancel') return DELIVERY_ROUTE_COPY.confirm.cancel.title
  if (confirmKind.value === 'delete') return DELIVERY_ROUTE_COPY.confirm.delete.title
  return ''
})
const confirmDescription = computed<string>(() => {
  if (confirmKind.value === 'start') return DELIVERY_ROUTE_COPY.confirm.start.body
  if (confirmKind.value === 'cancel') return DELIVERY_ROUTE_COPY.confirm.cancel.body
  if (confirmKind.value === 'delete') return DELIVERY_ROUTE_COPY.confirm.delete.body
  return ''
})
const confirmLabel = computed<string>(() => {
  if (confirmKind.value === 'start') return DELIVERY_ROUTE_COPY.confirm.start.confirmLabel
  if (confirmKind.value === 'cancel') return DELIVERY_ROUTE_COPY.confirm.cancel.confirmLabel
  if (confirmKind.value === 'delete') return DELIVERY_ROUTE_COPY.confirm.delete.confirmLabel
  return 'Confirmar'
})
const confirmCancelLabel = computed<string>(() => {
  if (confirmKind.value === 'start') return DELIVERY_ROUTE_COPY.confirm.start.cancelLabel
  if (confirmKind.value === 'cancel') return DELIVERY_ROUTE_COPY.confirm.cancel.cancelLabel
  if (confirmKind.value === 'delete') return DELIVERY_ROUTE_COPY.confirm.delete.cancelLabel
  return 'Cancelar'
})
const confirmColor = computed<'primary' | 'error' | 'warning'>(() => {
  if (confirmKind.value === 'delete') return 'error'
  if (confirmKind.value === 'cancel') return 'warning'
  return 'primary'
})
const confirmLoading = computed<boolean>(() => {
  if (confirmKind.value === 'start') return startIsPending.value
  if (confirmKind.value === 'cancel') return cancelIsPending.value
  if (confirmKind.value === 'delete') return deleteIsPending.value
  return false
})

// ─── Test-only handles ────────────────────────────────────────────────────────
// Specs drive the actions without going through the Nuxt UI runtime. We expose
// them behind a `__test` prefix so accidental production consumption is
// visible in code review.
defineExpose({
  __testRouteId: computed(() => routeId.value),
})
</script>

<template>
  <!--
    Four states (S10). Not found / forbidden, loading, error and the manager or
    driver content are mutually exclusive and evaluated in this order.
  -->
  <!-- Full-page "Ruta no encontrada" state — 404 ENTITY_NOT_FOUND AND driver 403.
       Evaluated FIRST: a real driver whose detail fetch returns 403 must land
       here, NOT in the driver placeholder (no presence leak; design §7.2, §11). -->
  <div
    v-if="notFoundCode"
    data-testid="detail-not-found"
    class="hf-theme hf-ui delivery-routes-visual px-4 py-16"
  >
    <EmptyState
      kind="empty"
      :title="DELIVERY_ROUTE_COPY.detail.notFoundTitle"
      :action-label="DELIVERY_ROUTE_COPY.detail.notFoundBack"
      action-test-id="detail-not-found-back"
      @action="router.push('/pos/rutas-de-entrega')"
    />
  </div>

  <!-- Driver loading skeleton shaped like the cockpit: header card, summary, stop cards. -->
  <div
    v-else-if="isLoading && !routeData && isDriver"
    data-testid="detail-driver-loading-skeleton"
    aria-busy="true"
    class="hf-theme hf-ui delivery-routes-visual flex flex-col gap-4 px-4 py-6 sm:px-6 lg:px-10"
  >
    <div data-skeleton="header" class="route-skeleton route-skeleton-panel animate-pulse flex items-center gap-3 p-4">
      <div class="route-skeleton-bar h-11 w-11" />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="route-skeleton-bar h-5 w-40" />
        <div class="route-skeleton-bar h-3 w-28" />
      </div>
    </div>
    <div data-skeleton="summary" class="route-skeleton route-skeleton-panel animate-pulse flex flex-col gap-3 p-3">
      <div class="route-skeleton-bar h-2 w-full" />
      <div class="route-skeleton-bar h-3 w-48" />
    </div>
    <div class="route-skeleton-bar h-4 w-24" />
    <div v-for="i in 3" :key="i" data-skeleton="stop-card" class="route-skeleton route-skeleton-panel animate-pulse flex items-center gap-3 p-3">
      <div class="route-skeleton-bar h-8 w-8 flex-none rounded-full" />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="route-skeleton-bar h-3 w-32" />
        <div class="route-skeleton-bar h-4 w-48" />
        <div class="route-skeleton-bar h-3 w-full" />
      </div>
    </div>
  </div>

  <!-- Loading skeleton shaped like the workspace: header, KPI tiles, panels. -->
  <div
    v-else-if="isLoading && !routeData"
    data-testid="detail-loading-skeleton"
    aria-busy="true"
    class="hf-theme hf-ui delivery-routes-visual mx-auto flex w-full min-w-0 max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-6 md:px-10"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 flex-1 flex-col gap-3">
        <div class="flex items-center gap-2">
          <div data-skeleton="badge" class="route-skeleton animate-pulse h-6 w-20" />
          <div class="route-skeleton animate-pulse h-4 w-40" />
        </div>
        <div data-skeleton="title" class="route-skeleton animate-pulse h-7 w-2/3 max-w-sm" />
      </div>
      <div data-skeleton="action" class="route-skeleton animate-pulse h-11 w-32 max-md:hidden" />
    </div>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div v-for="i in 4" :key="i" data-skeleton="kpi" class="route-skeleton route-skeleton-panel animate-pulse flex flex-col gap-3 p-4">
        <div class="route-skeleton-bar h-3 w-16" />
        <div data-skeleton="kpi-value" class="route-skeleton-bar h-6 w-20" />
      </div>
    </div>
    <div data-skeleton="progress" class="route-skeleton route-skeleton-panel animate-pulse flex flex-col gap-3 p-4">
      <div class="route-skeleton-bar h-3 w-32" />
      <div class="route-skeleton-bar h-2 w-full" />
    </div>
    <div class="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="route-skeleton route-skeleton-panel animate-pulse flex flex-col gap-3 p-5">
        <div class="route-skeleton-bar h-4 w-24" />
        <div v-for="i in 3" :key="i" data-skeleton="stop-row" class="route-skeleton-bar h-14 w-full" />
      </div>
      <div class="flex flex-col gap-6">
        <div v-for="i in 2" :key="i" data-skeleton="side-panel" class="route-skeleton route-skeleton-panel animate-pulse flex flex-col gap-3 p-5">
          <div class="route-skeleton-bar h-4 w-20" />
          <div class="route-skeleton-bar h-3 w-full" />
          <div class="route-skeleton-bar h-3 w-2/3" />
        </div>
      </div>
    </div>
  </div>

  <!-- Generic error (non-404, non-403 — surfaced as a block, not a toast). -->
  <div
    v-else-if="isError"
    data-testid="detail-error-block"
    class="hf-theme hf-ui delivery-routes-visual px-4 py-16"
  >
    <EmptyState
      kind="error"
      :title="DELIVERY_ROUTE_COPY.detail.loadError"
      action-label="Reintentar"
      action-test-id="detail-error-retry"
      @action="refetch"
    />
  </div>

  <!-- Driver branch (S11a): DriverRouteCockpit with typed props; the old
       card stack + inline timeline are gone (drawer-owned now). -->
  <div
    v-else-if="isDriver && routeData && routeData.id === routeId"
    data-testid="detail-driver-branch"
    class="hf-theme hf-ui delivery-routes-driver flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10"
  >
    <DriverRouteCockpit
      :route="routeData"
      :is-fetching="isFetching"
      :can-check-in="canUpdate"
      :check-in-pending="checkInPending"
      @back="handleBack"
      @refresh="handleRefresh"
      @request-check-in="handleCheckIn"
    />
  </div>

  <!-- Manager branch — route detail workspace with mutation affordances. Only
       when the cached detail belongs to the CURRENT route id (keepPreviousData
       stale guard). Header + KPIs + progress, then stops (main column) and
       details / activity (side column). -->
  <div
    v-else-if="isManager && routeData && routeData.id === routeId && managerDetail"
    data-testid="detail-manager-workspace"
    class="hf-theme hf-ui delivery-routes-visual delivery-routes-detail mx-auto flex w-full min-w-0 max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-6 md:px-10"
  >
    <DeliveryRouteUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :route-id="routeId"
      :initial-notes="routeData.notes ?? ''"
      :initial-driver-user-id="routeData.driver?.id ?? null"
      :loading="updateIsPending"
      @edit="onEdit"
    />

    <!-- Shared ConfirmModal for start/cancel/delete (REQ-DRM-010/011/012).
         One modal is reused; the confirmKind ref picks the title/body/handler. -->
    <ConfirmModal
      :open="isConfirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="confirmLabel"
      :cancel-label="confirmCancelLabel"
      :confirm-color="confirmColor"
      :loading="confirmLoading"
      :ui="{ content: FORM_PORTAL }"
      data-testid="detail-confirm-modal"
      @update:open="(value: boolean) => { if (!value) closeConfirm() }"
      @confirm="onConfirm"
    />

    <!-- Per-stop draft-to-draft move dialog (T3 S2/S4). The dialog owns the
         destination list + mutation; it never mutates on selection alone. -->
    <TransferDeliveryRouteStopModal
      v-model:open="isTransferOpen"
      :origin-route-id="routeId"
      :stop="transferStop"
    />

    <!-- Detail header (REQ-DRM-014): meta line, title, one primary + the ⋮. -->
    <header
      data-testid="detail-route-summary"
      class="flex flex-col gap-4"
    >
      <button
        type="button"
        data-testid="detail-back-link"
        class="route-back-link md:hidden"
        @click="handleBack"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />
        {{ DELIVERY_ROUTE_COPY.list.title }}
      </button>

      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div
            data-testid="detail-route-meta"
            class="route-detail-meta"
          >
            <StatusBadge
              data-testid="detail-route-status"
              :tone="statusTone(routeData.status)"
              :label="statusLabel(routeData.status)"
            />
            <span
              v-if="routeIssues.length > 0"
              data-testid="detail-route-aviso"
              class="route-aviso"
              :title="routeIssues.join(' · ')"
            >
              <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />{{ routeAvisoLabel(routeIssues.length) }}
              <span class="sr-only">: {{ routeIssues.join(', ') }}</span>
            </span>
            <template v-for="moment in managerDetail.moments" :key="moment">
              <span aria-hidden="true" class="hidden sm:inline">·</span>
              <span class="route-detail-moment">{{ moment }}</span>
            </template>
          </div>
          <h1
            class="route-detail-title"
            data-testid="detail-route-title"
          >{{ managerDetail.title }}</h1>
        </div>

        <!-- One primary action; Editar, Cancelar and Eliminar live in the ⋮.
             Each one opens the shared ConfirmModal (or the edit slideover); the
             mutation only fires after the user confirms. -->
        <div
          v-if="canShowStart || menuActions.length > 0"
          data-testid="detail-actions-toolbar"
          class="flex shrink-0 items-center gap-2"
        >
          <UButton
            v-if="canShowStart"
            color="primary"
            variant="solid"
            icon="i-lucide-play"
            class="hf-primary-control max-md:hidden"
            :label="DELIVERY_ROUTE_COPY.actions.start"
            :loading="startIsPending"
            data-testid="detail-start-button"
            @click="onStart"
          />
          <RowActionsMenu
            :actions="menuActions"
            row-label="la ruta"
            aria-label="Más acciones de la ruta"
            portal-class="delivery-routes-list-portal"
            @select="runHeaderAction"
          />
        </div>
      </div>
    </header>

    <!-- KPI tiles: neutral surfaces, figures in tabular numerals. -->
    <section
      class="grid grid-cols-2 gap-3 lg:grid-cols-4"
      aria-label="Resumen de la ruta"
    >
      <div
        v-for="kpi in managerDetail.kpis"
        :key="kpi.key"
        :data-testid="`detail-kpi-${kpi.key}`"
        class="delivery-routes-detail-panel flex flex-col gap-1 rounded-xl p-4"
      >
        <span class="text-xs font-medium text-muted">{{ kpi.label }}</span>
        <span class="hf-figure route-kpi-value">{{ kpi.value }}</span>
      </div>
    </section>

    <!-- Progress -->
    <section class="delivery-routes-detail-panel flex flex-col gap-2 rounded-xl p-4">
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span class="font-medium text-default">{{ managerDetail.progressLabel }}</span>
        <span
          v-if="managerDetail.progress.total > 0"
          class="hf-figure text-muted"
        >{{ managerDetail.progress.percent }}%</span>
      </div>
      <div
        role="progressbar"
        data-testid="detail-progress"
        :aria-valuenow="managerDetail.progress.completed"
        aria-valuemin="0"
        :aria-valuemax="managerDetail.progress.total"
        :aria-label="managerDetail.progressLabel"
        class="route-progress-track h-2 w-full overflow-hidden rounded-full"
      >
        <div
          class="delivery-routes-progress-fill h-full rounded-full transition-[width] motion-reduce:transition-none"
          :style="{ width: `${managerDetail.progress.percent}%` }"
        />
      </div>
    </section>

    <div class="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="flex min-w-0 flex-col gap-6">
        <!-- Stops list (manager-side surface). -->
        <section
          data-testid="detail-stops-section"
          class="delivery-routes-detail-panel flex flex-col gap-3 rounded-xl p-4 sm:p-5"
        >
          <header class="flex items-center justify-between gap-3">
            <h2 class="route-section-title">Paradas</h2>
            <span class="hf-figure text-xs text-muted">{{ routeData.stops.length }} en total</span>
          </header>
          <ol
            v-if="managerDetail.stops.length > 0"
            class="flex flex-col gap-2"
          >
            <li
              v-for="row in managerDetail.stops"
              :key="row.stop.id"
              :data-testid="`detail-stop-${row.stop.id}`"
              :class="['delivery-routes-detail-stop flex flex-col gap-2 rounded-lg p-3 sm:flex-row sm:items-center sm:gap-4', { 'delivery-routes-detail-stop--current': row.isCurrent }]"
            >
              <div class="flex min-w-0 flex-1 items-start gap-3">
                <span class="delivery-routes-detail-position hf-figure flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {{ row.position }}
                </span>
                <div class="flex min-w-0 flex-col gap-0.5">
                  <span class="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span class="truncate font-semibold text-highlighted">{{ row.customer }}</span>
                    <span class="hf-figure text-xs text-muted">{{ row.folio }}</span>
                  </span>
                  <span
                    v-if="row.address"
                    class="flex min-w-0 items-start gap-1 text-sm text-muted"
                  >
                    <UIcon name="i-lucide-map-pin" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span class="line-clamp-2">{{ row.address }}</span>
                  </span>
                </div>
              </div>
              <div class="flex shrink-0 flex-wrap items-center gap-3 pl-11 sm:pl-0">
                <span
                  v-if="row.timeLabel"
                  class="hf-figure text-xs text-muted"
                >{{ row.timeLabel }}</span>
                <StatusBadge :tone="row.statusTone" :label="row.statusLabel" />
                <RowActionsMenu
                  v-if="canShowMove"
                  :actions="MOVE_ACTIONS"
                  :row-label="`la parada de ${row.customer}`"
                  portal-class="delivery-routes-list-portal"
                  :data-testid="`detail-stop-move-${row.stop.id}`"
                  @select="onMoveStop(row.stop)"
                />
              </div>
            </li>
          </ol>
          <EmptyState
            v-else
            title="Sin paradas"
            :description="canShowAppend ? 'Agrega una venta para armar la ruta.' : undefined"
          />
        </section>

        <!-- Append-stop affordance — single-sale selector + "Agregar parada" button.
             DRAFT + canUpdate only (REQ-DRM-008/013). Outline: the one primary
             of the view is Iniciar ruta. -->
        <section
          v-if="canShowAppend"
          data-testid="detail-append-section"
          class="delivery-routes-detail-panel flex flex-col gap-3 rounded-xl p-4 sm:p-5"
        >
          <h2 class="route-section-title">{{ DELIVERY_ROUTE_COPY.actions.appendStop }}</h2>
          <EligibleSalesPicker
            :model-value="appendSelectedSaleIds"
            source="append"
            data-testid="detail-append-sales-picker"
            @update:selected="onAppendSalePicked"
          />
          <div class="flex justify-end">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              :label="DELIVERY_ROUTE_COPY.actions.appendStop"
              :loading="appendIsPending"
              :disabled="appendSelectedSaleId === null"
              data-testid="detail-append-button"
              @click="onAppend"
            />
          </div>
        </section>

        <!-- Reorder panel — only on DRAFT (DRM-009/010 gating). -->
        <section
          v-if="routeData.status === 'DRAFT'"
          class="delivery-routes-detail-panel rounded-xl p-4 sm:p-5"
        >
          <DeliveryRouteReorderPanel :route="routeData" />
        </section>
      </div>

      <aside class="flex min-w-0 flex-col gap-6">
        <section
          data-testid="detail-side-details"
          class="delivery-routes-detail-panel flex flex-col gap-4 rounded-xl p-4 sm:p-5"
        >
          <h2 class="route-section-title">Detalles</h2>
          <dl class="flex flex-col gap-4 text-sm">
            <div class="flex flex-col gap-1">
              <dt class="text-xs font-medium text-muted">Repartidor</dt>
              <dd class="flex flex-col">
                <span class="font-semibold text-highlighted">{{ routeData.driver?.name ?? 'Sin repartidor' }}</span>
                <span v-if="routeData.driver?.email" class="text-xs text-muted">{{ routeData.driver.email }}</span>
              </dd>
            </div>
            <div class="flex flex-col gap-1">
              <dt class="text-xs font-medium text-muted">Notas</dt>
              <dd class="whitespace-pre-line text-default">{{ routeData.notes?.trim() || 'Sin notas' }}</dd>
            </div>
          </dl>
        </section>

        <section
          data-testid="detail-side-activity"
          class="delivery-routes-detail-panel rounded-xl p-4 sm:p-5"
        >
          <DeliveryRouteTimeline :route="routeData" heading="Actividad" />
        </section>
      </aside>
    </div>

    <!-- Mobile: the single primary lives in the sticky bottom bar. -->
    <div
      v-if="canShowStart"
      class="route-action-bar md:hidden"
      data-testid="mobile-action-bar"
    >
      <UButton
        color="primary"
        variant="solid"
        icon="i-lucide-play"
        class="hf-primary-control w-full justify-center"
        :label="DELIVERY_ROUTE_COPY.actions.start"
        :loading="startIsPending"
        data-testid="detail-start-button-mobile"
        @click="onStart"
      />
    </div>
  </div>
</template>

<style scoped>
.route-skeleton { border-radius: 12px; background: var(--hf-surface-muted); }
.route-skeleton-panel { border: 1px solid var(--hf-border); background: var(--hf-surface); }
.route-skeleton-bar { border-radius: 6px; background: var(--hf-surface-muted); }
.route-progress-track { background: var(--hf-border); }
.route-back-link { display: inline-flex; width: fit-content; align-items: center; gap: 6px; border-radius: 6px; color: var(--hf-muted); font-size: 14px; }
@media (min-width: 768px) { .route-back-link { display: none; } }
.route-back-link:hover { color: var(--hf-heading); }
.route-back-link:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.route-detail-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; color: var(--hf-muted); font-size: 13px; }
.route-detail-moment { white-space: nowrap; }
.route-detail-title { display: -webkit-box; min-width: 0; overflow: hidden; color: var(--hf-heading); font-size: 22px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.25; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }
.route-aviso { display: inline-flex; align-items: center; gap: 4px; color: var(--hf-warning); font-size: 12px; font-weight: 600; white-space: nowrap; }
.route-kpi-value { color: var(--hf-heading); font-size: 24px; font-weight: 600; text-align: left; }
.route-section-title { color: var(--hf-heading); font-size: 16px; font-weight: 600; }
@media (max-width: 767px) { .route-detail-title { font-size: 17px; } }
/* Mobile: the one primary lives in a sticky bar, the body scrolls under it. */
.route-action-bar { position: sticky; bottom: 0; z-index: 10; margin-inline: -16px; border-top: 1px solid var(--hf-border); background: var(--hf-surface); padding: 12px 16px max(12px, env(safe-area-inset-bottom)); }
</style>
