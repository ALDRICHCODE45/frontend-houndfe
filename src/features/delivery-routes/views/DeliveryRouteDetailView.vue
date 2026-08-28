<script setup lang="ts">
/**
 * DeliveryRouteDetailView — S6a + S6b (sdd delivery-routes, design.md §4.1,
 * §4.2, §6.4, §7.2, §10.1, §11, REQ-DRM-013..015, REQ-DRC-001..008).
 *
 * Route-level composition surface for `/pos/rutas-de-entrega/:id`. ONE route
 * serves both roles; the view discriminates manager vs driver via a SINGLE
 * `useDeliveryRouteRole` call (REFACTOR target of S6a). The view consumes
 * `useDeliveryRoutePermissions` as a thin re-export wrapper to keep the
 * permission reads co-located at the call site.
 *
 *   - Manager branch (`isManager=true`): renders the route detail with the S4c
 *     + S5a + S5b mutation affordances:
 *       * Edit (DeliveryRouteUpsertSlideover in edit mode)
 *       * Start / Cancel / Delete / Reorder (panel only on DRAFT) / Append stop
 *     404 ENTITY_NOT_FOUND on detail fetch → full-page "Ruta no encontrada".
 *     Driver 403 → SAME full-page not-found state (no banner, no toast — no
 *     presence leak; design §7.2, §11).
 *   - Driver branch (`isDriver=true`): renders the stop list (one
 *     `DriverStopDetail` per stop) + the `DeliveryRouteTimeline` at the
 *     bottom. The check-in mutation is wired INSIDE `DriverStopDetail` (the
 *     component owns its action surface; same pattern as the reorder panel).
 *
 * Loading / error / not-found states follow design §11. The view is a composition
 * surface only — no card markup, no field markup. Mutation wiring is role-gated;
 * the discriminator is the one branching decision.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AxiosError } from 'axios'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { useDeliveryRouteRole } from '../composables/useDeliveryRouteRole'
import { useDeliveryRouteDetail } from '../composables/useDeliveryRouteDetail'
import { useUpdateDeliveryRoute } from '../composables/useUpdateDeliveryRoute'
import { useDeleteDeliveryRoute } from '../composables/useDeleteDeliveryRoute'
import { useStartDeliveryRoute } from '../composables/useStartDeliveryRoute'
import { useCancelDeliveryRoute } from '../composables/useCancelDeliveryRoute'
import DeliveryRouteUpsertSlideover from '../components/DeliveryRouteUpsertSlideover.vue'
import DeliveryRouteReorderPanel from '../components/DeliveryRouteReorderPanel.vue'
import DriverStopDetail from '../components/DriverStopDetail.vue'
import DeliveryRouteTimeline from '../components/DeliveryRouteTimeline.vue'
import { extractDeliveryRouteErrorCode } from '../interfaces/errors'
import { buildStopProgress } from '../utils/delivery-route-actions.utils'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type DeliveryRouteResponseDto,
  type DeliveryRouteStatus,
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
  isError,
  error,
} = useDeliveryRouteDetail(routeId)

// ─── Not-found / forbidden detection ──────────────────────────────────────────
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
  const status = (error.value as AxiosError | null | undefined)?.response?.status
  if (status === 403 && isDriver.value) return 'ENTITY_NOT_FOUND'
  return null
})

// ─── Mutations (S4c + S5a + S5b) ──────────────────────────────────────────────
const { mutateAsync: updateRoute, isPending: updateIsPending } = useUpdateDeliveryRoute()
const { mutateAsync: deleteRoute, isPending: deleteIsPending } = useDeleteDeliveryRoute()
const { mutateAsync: startRoute, isPending: startIsPending } = useStartDeliveryRoute()
const { mutateAsync: cancelRoute, isPending: cancelIsPending } = useCancelDeliveryRoute()

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

// ─── Delete / start / cancel / append handlers ────────────────────────────────
async function onDelete(): Promise<void> {
  try {
    await deleteRoute(routeId.value)
    // After delete, navigate back to the manager list (the route no longer
    // exists server-side; staying on the detail page would render the
    // not-found state immediately).
    void router.push('/pos/rutas-de-entrega')
  } catch {
    // Error already surfaced via the composable's onError toast.
  }
}

async function onStart(): Promise<void> {
  try {
    await startRoute(routeId.value)
  } catch {
    // Error already surfaced via the composable's onError toast (the 409
    // conflict path owns its own refetch + toast per design §10.1).
  }
}

async function onCancel(): Promise<void> {
  try {
    await cancelRoute(routeId.value)
  } catch {
    // Error already surfaced via the composable's onError toast.
  }
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
// Deferred: the detail view has no single-sale selector yet (design §4.2 lists
// edit/reorder/start/cancel/delete, NOT append). Wire it when a selector lands.

// ─── Status / progress helpers ────────────────────────────────────────────────
function statusTone(status: DeliveryRouteStatus) {
  return DELIVERY_ROUTE_STATUS_TONES[status]
}
function statusLabel(status: DeliveryRouteStatus) {
  return DELIVERY_ROUTE_STATUS_LABELS[status]
}

const stopProgressLabel = computed<string>(() => {
  const r = routeData.value
  if (!r) return ''
  return buildStopProgress(r.stops)
})

// ─── Error fallback copy ──────────────────────────────────────────────────────
// Used for non-not-found errors that DO bubble (rare; the mutations own most
// of the error routing via the toast). The full-page error block mirrors the
// list-view pattern (design §11).
const errorMessage = computed<string>(() => {
  const e = error.value as AxiosError | null | undefined
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
    Driver branch (REQ-DRM-002 driver side, design §6.4): renders nothing in
    S6a. S6b replaces this placeholder with DriverStopDetail +
    DeliveryRouteTimeline.
    TODO(S6b): render the driver branch (DriverStopDetail + timeline) here.
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

      <!-- Driver branch (REQ-DRC-001..008, design §4.2, §11): renders one
           DriverStopDetail per stop + the DeliveryRouteTimeline. The check-in
           mutation is wired inside DriverStopDetail (component owns its action
           surface, design §4.2). The header still surfaces route metadata
           (short id + status badge + x/y progress) so the driver sees where they
           are in the route before scrolling into the stops list. -->
      <div
        v-else-if="isDriver && routeData && routeData.id === routeId"
        data-testid="detail-driver-branch"
        class="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10"
      >
        <header
          class="flex flex-col gap-2 border-b border-default pb-4"
          data-testid="detail-driver-summary"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-col gap-1">
              <span class="text-xs uppercase tracking-wide text-muted">Ruta</span>
              <span class="font-mono text-sm">{{ routeData.id.slice(0, 8) }}</span>
            </div>
            <StatusDotBadge
              :tone="statusTone(routeData.status)"
              :label="statusLabel(routeData.status)"
            />
          </div>
          <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
            <span>Repartidor: <strong class="text-default">{{ routeData.driver?.name ?? '—' }}</strong></span>
            <span>Progreso: <strong class="text-default">{{ stopProgressLabel }}</strong></span>
          </div>
        </header>

        <section
          v-if="routeData.stops.length > 0"
          data-testid="detail-driver-stops"
          class="flex flex-col gap-3"
        >
          <h2 class="text-sm font-medium">Paradas</h2>
          <DriverStopDetail
            v-for="stop in routeData.stops"
            :key="stop.id"
            :stop="stop"
            :route-id="routeData.id"
          />
        </section>
        <p
          v-else
          data-testid="detail-driver-stops-empty"
          class="text-sm text-muted"
        >
          Sin paradas
        </p>

        <DeliveryRouteTimeline :route="routeData" />
      </div>

  <!-- Manager branch — route detail with mutation affordances. Only when the
       cached detail belongs to the CURRENT route id (keepPreviousData stale guard). -->
  <div
    v-else-if="isManager && routeData && routeData.id === routeId"
    class="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10"
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

    <!-- Header / summary (REQ-DRM-014) -->
    <header
      data-testid="detail-route-summary"
      class="flex flex-col gap-2 border-b border-default pb-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-col gap-1">
          <span class="text-xs uppercase tracking-wide text-muted">Ruta</span>
          <span class="font-mono text-sm">{{ routeData.id.slice(0, 8) }}</span>
        </div>
        <StatusDotBadge
          :tone="statusTone(routeData.status)"
          :label="statusLabel(routeData.status)"
        />
      </div>
      <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>Repartidor: <strong class="text-default">{{ routeData.driver?.name ?? '—' }}</strong></span>
        <span>Progreso: <strong class="text-default">{{ stopProgressLabel }}</strong></span>
      </div>
    </header>

    <!-- Manager actions toolbar (S4c + S5a + S5b wiring) -->
    <div
      v-if="canUpdate"
      data-testid="detail-actions-toolbar"
      class="flex flex-wrap items-center gap-2"
    >
      <UButton
        color="primary"
        variant="outline"
        :label="DELIVERY_ROUTE_COPY.actions.edit"
        data-testid="detail-edit-button"
        @click="isEditOpen = true"
      />
      <UButton
        color="primary"
        variant="solid"
        :label="DELIVERY_ROUTE_COPY.actions.start"
        :loading="startIsPending"
        :disabled="routeData.status !== 'DRAFT' || routeData.stops.length === 0"
        data-testid="detail-start-button"
        @click="onStart"
      />
      <UButton
        color="warning"
        variant="outline"
        :label="DELIVERY_ROUTE_COPY.actions.cancel"
        :loading="cancelIsPending"
        :disabled="routeData.status !== 'ACTIVE'"
        data-testid="detail-cancel-button"
        @click="onCancel"
      />
      <UButton
        v-if="canShowDelete"
        color="error"
        variant="outline"
        :label="DELIVERY_ROUTE_COPY.actions.delete"
        :loading="deleteIsPending"
        data-testid="detail-delete-button"
        @click="onDelete"
      />
    </div>

    <!-- Reorder panel — only on DRAFT (DRM-009/010 gating). -->
    <DeliveryRouteReorderPanel
      v-if="routeData.status === 'DRAFT'"
      :route="routeData"
    />

    <!-- Stops list (manager-side surface; S6b adds the driver-side detail). -->
    <section data-testid="detail-stops-section" class="flex flex-col gap-2">
      <h2 class="text-sm font-medium">Paradas</h2>
      <ul
        v-if="routeData.stops.length > 0"
        class="flex flex-col gap-2"
      >
        <li
          v-for="stop in routeData.stops"
          :key="stop.id"
          :data-testid="`detail-stop-${stop.id}`"
          class="flex items-center justify-between rounded-md border border-default bg-default px-3 py-2"
        >
          <span class="text-sm">
            <span class="font-medium">{{ stop.saleFolio ?? stop.id.slice(0, 8) }}</span>
            <span class="ml-2 text-muted">{{ stop.customer?.name ?? 'Cliente sin nombre' }}</span>
          </span>
          <span class="text-xs text-muted">{{ stop.status }}</span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">Sin paradas</p>
    </section>
  </div>
</template>
