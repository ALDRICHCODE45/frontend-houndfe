<script setup lang="ts">
/**
 * DeliveryRoutesListView — S4c (sdd delivery-routes, design.md §4.1, §6.4, §9.2, §11).
 *
 * Route-level composition surface for `/pos/rutas-de-entrega`. ONE route serves
 * both roles; the view discriminates internally via `useDeliveryRouteRole`:
 *
 *   - Manager branch (`isManager`): `AppDataTable` over `useDeliveryRoutesTable`
 *     + the create `DeliveryRouteUpsertSlideover` (gated by `canCreate`).
 *   - Driver branch (`isDriver`): placeholder — `// TODO(S6b)` below. S6b
 *     replaces it with the `DriverRouteCard` list. Until then it renders
 *     nothing (REQ-DRM-002 driver side).
 *
 * The view is a composition surface only (design §4.1): no card markup, no
 * field markup. Column definitions are INLINE (no columns composable exists for
 * this module — payment-details uses `usePaymentDetailColumns`, delivery-routes
 * does not); cell markup lives in this view's `#*-cell` slots, which AppDataTable
 * forwards to UTable underneath.
 *
 * Create flow (REQ-DRM-006): `@add` opens the slideover in create mode; the
 * slideover emits the zod-whitelisted payload → `useCreateDeliveryRoute().mutate`
 * (its onSuccess toast + list invalidation fire from the composable). The
 * slideover closes on emit. Row actions (edit/start/cancel/delete) land in
 * S5a/S5b — the `actions` column is intentionally empty here.
 */
import { computed, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { AppDataTable, createSimpleHeader } from '@/core/shared/components/DataTable'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { useDeliveryRouteRole } from '../composables/useDeliveryRouteRole'
import { useDeliveryRoutesTable } from '../composables/useDeliveryRoutesTable'
import { useCreateDeliveryRoute } from '../composables/useCreateDeliveryRoute'
import DeliveryRouteUpsertSlideover from '../components/DeliveryRouteUpsertSlideover.vue'
import { DELIVERY_ROUTE_COPY } from '../copy'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type CreateDeliveryRouteRequest,
  type DeliveryRouteResponseDto,
  type DeliveryRouteStatus,
} from '../interfaces/delivery-route.types'

// ─── Role discriminator (manager vs driver, design §6.4 / §9.3) ──────────────
// Destructured at top level so the template auto-unwraps the refs.
const { isManager, canCreate } = useDeliveryRouteRole()

// ─── Manager list — single-source wrapper (design §6.2, REQ-DRM-001) ──────────
const {
  pagination,
  sorting,
  globalFilter,
  columnPinning,
  columnVisibility,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  isError,
  error,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
} = useDeliveryRoutesTable()

// Human-readable list error (block, not toast — design §11, REQ-DRM-014).
const routesErrorMessage = computed(() =>
  normalizeApiError(error.value, 'No se pudieron cargar las rutas de entrega. Reintenta.').message,
)

// ─── Create slideover + mutation (REQ-DRM-006) ────────────────────────────────
const isCreateOpen = ref(false)
const { mutateAsync: createRoute, isPending: createIsPending } = useCreateDeliveryRoute()

async function onCreate(payload: CreateDeliveryRouteRequest): Promise<void> {
  try {
    await createRoute(payload)
    // Close only on success — the mutation's onSuccess already fired the toast.
    isCreateOpen.value = false
  } catch {
    // Error already surfaced via the composable's onError toast; keep the
    // slideover open so the user can correct the input.
  }
}

// ─── INLINE columns (no columns composable exists for this module) ────────────
// Structural definitions only — cell markup lives in the `#*-cell` slots below.
// REQ-DRM-001: status badge + driver name (or '—') + x/y progress; the `actions`
// column is right-pinned by `useDeliveryRoutesTable`'s defaultPinning and stays
// empty in S4c (row actions land in S5a/S5b).
const columns: TableColumn<DeliveryRouteResponseDto>[] = [
  {
    accessorKey: 'id',
    header: 'Ruta',
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: 'driver',
    header: 'Repartidor',
    enableSorting: false,
    enableHiding: true,
  },
  {
    id: 'progress',
    header: 'Progreso',
    enableSorting: false,
    enableHiding: true,
  },
  {
    id: 'status',
    header: createSimpleHeader('Estado'),
    enableSorting: false,
    enableHiding: true,
  },
  {
    id: 'actions',
    header: createSimpleHeader(''),
    enableSorting: false,
    enableHiding: false,
    meta: { class: { td: 'text-right' } },
  },
]

/** Compact route identifier (quotations convention: first 8 chars + ellipsis). */
function shortRouteId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

/**
 * x/y delivered-stops counter (REQ-DRM-001): `"{completed}/{total}"` when
 * `total > 0`, `"Sin paradas"` when the route has no stops.
 */
function stopProgress(route: DeliveryRouteResponseDto): string {
  const total = route.stops.length
  if (total === 0) return 'Sin paradas'
  const completed = route.stops.filter((stop) => stop.status === 'COMPLETED').length
  return `${completed}/${total}`
}

// Typed status accessors keep the template free of `any`-indexed Record
// lookups (vue-tsc rejects indexing the status label/tone maps with the
// slot's `any`-typed row).
function statusTone(status: DeliveryRouteStatus) {
  return DELIVERY_ROUTE_STATUS_TONES[status]
}
function statusLabel(status: DeliveryRouteStatus) {
  return DELIVERY_ROUTE_STATUS_LABELS[status]
}
</script>

<template>
  <!--
    Driver branch (REQ-DRM-002 driver side, design §6.4): renders nothing in
    S4c. S6b replaces this placeholder with the DriverRouteCard list.
    TODO(S6b): render the driver branch (DriverRouteCard list) here.
  -->
  <div v-if="isManager" class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <DeliveryRouteUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :loading="createIsPending"
      @create="onCreate"
    />

    <AppDataTable
      v-model:sorting="sorting"
      v-model:pagination="pagination"
      v-model:global-filter="globalFilter"
      v-model:column-pinning="columnPinning"
      v-model:column-visibility="columnVisibility"
      :columns="columns"
      :data="data"
      :loading="isLoading"
      :fetching="isFetching"
      :error="isError"
      :error-message="routesErrorMessage"
      :empty="DELIVERY_ROUTE_COPY.empty.manager"
      :page-count="pageCount"
      :total-count="totalCount"
      :showing-from="showingFrom"
      :showing-to="showingTo"
      :page-size-options="pageSizeOptions"
      :show-add-button="canCreate"
      :add-button-text="DELIVERY_ROUTE_COPY.actions.create"
      @add="isCreateOpen = true"
      @refresh="refresh"
    >
      <template #id-cell="{ row }">
        <span class="font-medium" :title="row.original.id">{{ shortRouteId(row.original.id) }}</span>
      </template>

      <template #driver-cell="{ row }">
        <span class="text-sm text-muted">{{ row.original.driver?.name ?? '—' }}</span>
      </template>

      <template #progress-cell="{ row }">
        <span class="text-sm text-muted">{{ stopProgress(row.original) }}</span>
      </template>

      <template #status-cell="{ row }">
        <StatusDotBadge
          :tone="statusTone(row.original.status)"
          :label="statusLabel(row.original.status)"
        />
      </template>

      <template #actions-cell>
        <!-- Row actions land in S5a/S5b — intentionally empty in S4c. -->
        <span class="sr-only">acciones</span>
      </template>
    </AppDataTable>
  </div>
</template>
