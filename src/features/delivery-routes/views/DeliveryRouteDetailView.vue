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
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
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
  // Driver 403 → same full-page not-found state (no presence leak; design §7.2,
  // §11). Any OTHER error (5xx, network, unknown) falls through to the generic
  // error block below — it is NOT a not-found state.
  const status = (error.value as DetailFetchError | null | undefined)?.response?.status
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
// Delete button is HIDDEN unless ALL three rules pass:
//   - DRAFT status (per design §6.3 DELETE-only-for-DRAFT contract)
//   - zero stops (the backend deletes DRAFT routes only when no stops exist)
//   - canDelete permission (CASL `delete:DeliveryRoute`)
// The spec asserts the inverse for each broken rule.
const canShowDelete = computed<boolean>(() => {
  const r = routeData.value
  if (!r) return false
  if (r.id !== routeId.value) return false // keepPreviousData stale guard
  if (r.status !== 'DRAFT') return false
  if (r.stops.length !== 0) return false
  return canDelete.value
})

// Append-stop is manager-only on DRAFT (any non-DRAFT rejects at the backend).
// Surfaced as an explicit affordance now (S7 verify remediation): the spec
// mandates a single-sale selector + button (REQ-DRM-008/013).
const canShowAppend = computed<boolean>(() => {
  const r = routeData.value
  if (!r) return false
  if (r.id !== routeId.value) return false // keepPreviousData stale guard
  if (r.status !== 'DRAFT') return false
  return canUpdate.value
})

// Per-stop "Mover" is available only while BOTH routes can be DRAFT: the source
// must be DRAFT (destination list is DRAFT-only) and the manager needs update.
// The keepPreviousData stale guard keeps the control off stale rows.
const canShowMove = computed<boolean>(() => {
  const r = routeData.value
  if (!r) return false
  if (r.id !== routeId.value) return false
  if (r.status !== 'DRAFT') return false
  return canUpdate.value
})

// Edit button is HIDDEN unless both rules pass (REQ-DRM-013, S7 verify
// remediation — was previously rendered for any status when update was held).
const canShowEdit = computed<boolean>(() => {
  const r = routeData.value
  if (!r) return false
  if (r.id !== routeId.value) return false
  if (r.status !== 'DRAFT') return false
  return canUpdate.value
})

// Start button is HIDDEN unless ALL three rules pass (REQ-DRM-013).
//   - DRAFT status
//   - at least one stop (the backend rejects empty-route starts with
//     422 DELIVERY_ROUTE_INVALID_TRANSITION)
//   - update permission
const canShowStart = computed<boolean>(() => {
  const r = routeData.value
  if (!r) return false
  if (r.id !== routeId.value) return false
  if (r.status !== 'DRAFT') return false
  if (r.stops.length === 0) return false
  return canUpdate.value
})

// Cancel button is ENABLED for routes in DRAFT or ACTIVE (REQ-DRM-011, S7
// verify remediation — was previously ACTIVE-only). HIDDEN otherwise.
const canShowCancel = computed<boolean>(() => {
  const r = routeData.value
  if (!r) return false
  if (r.id !== routeId.value) return false
  if (r.status !== 'DRAFT' && r.status !== 'ACTIVE') return false
  return canUpdate.value
})

// ─── Status / progress helpers ────────────────────────────────────────────────
function statusTone(status: DeliveryRouteStatus) {
  return DELIVERY_ROUTE_STATUS_TONES[status]
}
function statusLabel(status: DeliveryRouteStatus) {
  return DELIVERY_ROUTE_STATUS_LABELS[status]
}

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

// ─── Error fallback copy ──────────────────────────────────────────────────────
// Used for non-not-found errors that DO bubble (rare; the mutations own most
// of the error routing via the toast). The full-page error block mirrors the
// list-view pattern (design §11).
const errorMessage = computed<string>(() => {
  const e = error.value as DetailFetchError | null | undefined
  return normalizeApiError(e, 'No se pudo cargar la ruta de entrega.').message
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
    Driver branch (REQ-DRM-002 driver side, design §6.4): renders the stop list
    (S6b) + timeline. The S6b implementation supersedes the S6a placeholder
    marker that lived here.
  -->
  <!-- Full-page "Ruta no encontrada" state — 404 ENTITY_NOT_FOUND AND driver 403.
       Evaluated FIRST: a real driver whose detail fetch returns 403 must land
       here, NOT in the driver placeholder (no presence leak; design §7.2, §11). -->
  <div
    v-if="notFoundCode"
    data-testid="detail-not-found"
    class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
  >
    <h1 class="text-2xl font-semibold">
      {{ DELIVERY_ROUTE_COPY.toasts.notFound }}
    </h1>
    <p class="text-sm text-muted">
      La ruta solicitada no está disponible o fue eliminada.
    </p>
    <button
      type="button"
      class="text-sm text-primary underline"
      @click="router.push('/pos/rutas-de-entrega')"
    >
      Volver a la lista
    </button>
  </div>

  <!-- Loading skeleton (manager branch only — driver branch is null). -->
  <div
    v-else-if="isLoading && !routeData"
    data-testid="detail-loading-skeleton"
    class="flex flex-col gap-4 px-4 py-8 sm:px-6 lg:px-10"
  >
    <div class="h-8 w-1/3 animate-pulse rounded bg-default" />
    <div class="h-24 w-full animate-pulse rounded bg-default" />
    <div class="h-64 w-full animate-pulse rounded bg-default" />
  </div>

  <!-- Generic error (non-404, non-403 — surfaced as a block, not a toast). -->
  <div
    v-else-if="isError"
    data-testid="detail-error-block"
    class="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
  >
    <h1 class="text-2xl font-semibold">No se pudo cargar la ruta</h1>
    <p class="text-sm text-muted">{{ errorMessage }}</p>
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

    <!-- Shared ConfirmModal for start/cancel/delete (S7 verify remediation,
         REQ-DRM-010/011/012). One modal is reused; the confirmKind ref
         picks the title/body/handler. -->
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

    <!-- Header / summary (REQ-DRM-014) -->
    <header
      data-testid="detail-route-summary"
      class="flex flex-col gap-4"
    >
      <button
        type="button"
        data-testid="detail-back-link"
        class="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted transition hover:text-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        @click="handleBack"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />
        {{ DELIVERY_ROUTE_COPY.list.title }}
      </button>

      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-2">
          <div class="flex flex-wrap items-center gap-3">
            <h1
              class="hf-page-title"
              data-testid="detail-route-title"
            >{{ managerDetail.title }}</h1>
            <StatusDotBadge
              :tone="statusTone(routeData.status)"
              :label="statusLabel(routeData.status)"
            />
          </div>
          <p
            data-testid="detail-route-meta"
            class="hf-page-subtitle flex flex-wrap items-center gap-x-2 gap-y-1"
          >
            <span class="font-mono">#{{ managerDetail.reference }}</span>
            <template v-for="moment in managerDetail.moments" :key="moment">
              <span aria-hidden="true">·</span>
              <span>{{ moment }}</span>
            </template>
          </p>
        </div>

        <!-- Manager actions toolbar (S4c + S5a + S5b + S7 verify wiring).
             Each button click opens the shared ConfirmModal; the mutation only
             fires after the user confirms. -->
        <div
          v-if="canUpdate || canShowDelete"
          data-testid="detail-actions-toolbar"
          class="flex flex-wrap items-center gap-2"
        >
          <UButton
            v-if="canShowEdit"
            color="neutral"
            variant="outline"
            icon="i-lucide-pencil"
            :label="DELIVERY_ROUTE_COPY.actions.edit"
            data-testid="detail-edit-button"
            @click="isEditOpen = true"
          />
          <UButton
            v-if="canShowStart"
            color="primary"
            variant="solid"
            icon="i-lucide-play"
            class="hf-primary-control"
            :label="DELIVERY_ROUTE_COPY.actions.start"
            :loading="startIsPending"
            data-testid="detail-start-button"
            @click="onStart"
          />
          <UButton
            v-if="canShowCancel"
            color="warning"
            variant="outline"
            icon="i-lucide-ban"
            :label="DELIVERY_ROUTE_COPY.actions.cancel"
            :loading="cancelIsPending"
            data-testid="detail-cancel-button"
            @click="onCancel"
          />
          <UButton
            v-if="canShowDelete"
            color="error"
            variant="outline"
            icon="i-lucide-trash-2"
            :label="DELIVERY_ROUTE_COPY.actions.delete"
            :loading="deleteIsPending"
            data-testid="detail-delete-button"
            @click="onDelete"
          />
        </div>
      </div>
    </header>

    <!-- KPI tiles -->
    <section
      class="grid grid-cols-2 gap-3 lg:grid-cols-4"
      aria-label="Resumen de la ruta"
    >
      <div
        v-for="kpi in managerDetail.kpis"
        :key="kpi.key"
        :data-testid="`detail-kpi-${kpi.key}`"
        :class="['delivery-routes-detail-panel delivery-routes-detail-kpi flex flex-col gap-1 rounded-xl p-4', `delivery-routes-detail-kpi--${kpi.key}`]"
      >
        <span class="text-xs font-medium text-muted">{{ kpi.label }}</span>
        <span class="text-2xl font-semibold tabular-nums text-highlighted">{{ kpi.value }}</span>
      </div>
    </section>

    <!-- Progress -->
    <section class="delivery-routes-detail-panel flex flex-col gap-2 rounded-xl p-4">
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span class="font-medium text-default">{{ managerDetail.progressLabel }}</span>
        <span
          v-if="managerDetail.progress.total > 0"
          class="tabular-nums text-muted"
        >{{ managerDetail.progress.percent }}%</span>
      </div>
      <div
        role="progressbar"
        data-testid="detail-progress"
        :aria-valuenow="managerDetail.progress.completed"
        aria-valuemin="0"
        :aria-valuemax="managerDetail.progress.total"
        :aria-label="managerDetail.progressLabel"
        class="h-2 w-full overflow-hidden rounded-full bg-elevated"
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
            <h2 class="text-base font-semibold text-highlighted">Paradas</h2>
            <span class="text-xs text-muted">{{ routeData.stops.length }} en total</span>
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
                <span class="delivery-routes-detail-position flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold">
                  {{ row.position }}
                </span>
                <div class="flex min-w-0 flex-col gap-0.5">
                  <span class="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span class="truncate font-medium text-default">{{ row.customer }}</span>
                    <span class="font-mono text-xs text-muted">{{ row.folio }}</span>
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
                  class="text-xs tabular-nums text-muted"
                >{{ row.timeLabel }}</span>
                <StatusDotBadge :tone="row.statusTone" :label="row.statusLabel" />
                <UButton
                  v-if="canShowMove"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-arrow-right-left"
                  :label="DELIVERY_ROUTE_COPY.actions.moveStop"
                  :aria-label="DELIVERY_ROUTE_COPY.transfer.moveAriaLabel.replace('{folio}', row.stop.saleFolio ?? row.stop.id.slice(0, 8))"
                  :data-testid="`detail-stop-move-${row.stop.id}`"
                  @click="onMoveStop(row.stop)"
                />
              </div>
            </li>
          </ol>
          <p v-else class="text-sm text-muted">Sin paradas</p>
        </section>

        <!-- Append-stop affordance — single-sale selector + "Agregar parada" button.
             DRAFT + canUpdate only (REQ-DRM-008/013). -->
        <section
          v-if="canShowAppend"
          data-testid="detail-append-section"
          class="delivery-routes-detail-panel flex flex-col gap-3 rounded-xl p-4 sm:p-5"
        >
          <header class="flex flex-col gap-1">
            <h2 class="text-base font-semibold text-highlighted">{{ DELIVERY_ROUTE_COPY.actions.appendStop }}</h2>
            <p class="text-sm text-muted">
              Selecciona una venta pendiente o enviada para agregarla a la ruta.
            </p>
          </header>
          <EligibleSalesPicker
            :model-value="appendSelectedSaleIds"
            source="append"
            data-testid="detail-append-sales-picker"
            @update:selected="onAppendSalePicked"
          />
          <div class="flex justify-end">
            <UButton
              color="primary"
              variant="solid"
              icon="i-lucide-plus"
              class="hf-primary-control"
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
          <h2 class="text-base font-semibold text-highlighted">Detalles</h2>
          <dl class="flex flex-col gap-4 text-sm">
            <div class="flex flex-col gap-1">
              <dt class="text-xs font-medium text-muted">Repartidor</dt>
              <dd class="flex flex-col">
                <span class="font-medium text-default">{{ routeData.driver?.name ?? 'Sin repartidor' }}</span>
                <span v-if="routeData.driver?.email" class="text-xs text-muted">{{ routeData.driver.email }}</span>
              </dd>
            </div>
            <div class="flex flex-col gap-1">
              <dt class="text-xs font-medium text-muted">Notas</dt>
              <dd class="whitespace-pre-line text-default">{{ routeData.notes?.trim() || 'Sin notas' }}</dd>
            </div>
            <div class="flex flex-col gap-1">
              <dt class="text-xs font-medium text-muted">Fechas</dt>
              <dd>
                <ul class="flex flex-col gap-0.5 text-default">
                  <li v-for="moment in managerDetail.moments" :key="moment">{{ moment }}</li>
                </ul>
              </dd>
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
  </div>
</template>