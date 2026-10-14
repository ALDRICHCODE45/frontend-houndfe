<script setup lang="ts">
/**
 * DeliveryRoutesListView — S4c + S6b (sdd delivery-routes, design.md §4.1, §4.2,
 * §6.4, §9.2, §11).
 *
 * Route-level composition surface for `/pos/rutas-de-entrega`. ONE route serves
 * both roles; the view discriminates internally via `useDeliveryRouteRole`:
 *
 *   - Manager branch (`isManager`): `AppDataTable` over `useDeliveryRoutesTable`
 *     + the create `DeliveryRouteUpsertSlideover` (gated by `canCreate`).
 *   - Driver branch (`isDriver`): `DriverRouteCard` list over
 *     `useDriverActiveRoutes`. Tapping a card navigates to the detail view.
 *
 * The view is a composition surface only (design §4.1, §4.2): no card markup,
 * no field markup. The driver's list lives behind `DriverRouteCard`; the
 * manager's table renders inline `#*-cell` slots.
 *
 * Create flow (REQ-DRM-006): `@add` opens the slideover in create mode; the
 * slideover emits the zod-whitelisted payload → `useCreateDeliveryRoute().mutate`
 * (its onSuccess toast + list invalidation fire from the composable). The
 * slideover closes on emit.
 *
 * Manager listing follows the canonical table workspace (docs/design-system.md
 * §4): heading outside the surface, status tabs with counts, client-side
 * search/sort over the cached full list, a derived route name that opens the
 * detail, table/card views and the full row menu (View/Edit/Start/Cancel/
 * Delete) gated exactly like the detail view, each mutation behind the shared
 * ConfirmModal.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import '../styles/delivery-routes-visual.css'
import type { TableColumn } from '@nuxt/ui'
import { AppDataTable, SortableHeader, createSimpleHeader } from '@/core/shared/components/DataTable'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import ViewToggle from '@/core/shared/components/ViewToggle.vue'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { useDeliveryRouteRole } from '../composables/useDeliveryRouteRole'
import { useDeliveryRoutesTable } from '../composables/useDeliveryRoutesTable'
import { useDriverActiveRoutes } from '../composables/useDriverActiveRoutes'
import { useCreateDeliveryRoute } from '../composables/useCreateDeliveryRoute'
import { useStartDeliveryRoute } from '../composables/useStartDeliveryRoute'
import { useCancelDeliveryRoute } from '../composables/useCancelDeliveryRoute'
import { useDeleteDeliveryRoute } from '../composables/useDeleteDeliveryRoute'
import { useUpdateDeliveryRoute } from '../composables/useUpdateDeliveryRoute'
import { useDeliveryRouteViewMode } from '../composables/useDeliveryRouteViewMode'
import DeliveryRouteUpsertSlideover from '../components/DeliveryRouteUpsertSlideover.vue'
import DeliveryRouteCardGrid from '../components/DeliveryRouteCardGrid.vue'
import DriverRouteCard from '../components/DriverRouteCard.vue'
import { DELIVERY_ROUTE_COPY } from '../copy'
import { extractSaleConflictIds } from '../interfaces/errors'
import {
  buildDeliveryRouteListActions,
  type DeliveryRouteRowActionItem,
} from '../utils/delivery-route-actions.utils'
import {
  DELIVERY_ROUTE_STATUS_ORDER,
  buildRouteDisplayName,
  formatRouteDateTime,
  getRouteCreatedAt,
  getRouteCustomers,
  getRouteProgress,
  shortRouteId,
  type DeliveryRouteStatusFilter,
} from '../utils/delivery-route-list.utils'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type CreateDeliveryRouteRequest,
  type DeliveryRouteResponseDto,
  type DeliveryRouteStatus,
  type UpdateDeliveryRouteRequest,
} from '../interfaces/delivery-route.types'

// ─── Role discriminator (manager vs driver, design §6.4 / §9.3) ──────────────
// Destructured at top level so the template auto-unwraps the refs.
const { isManager, isDriver, canCreate, canUpdate, canDelete } = useDeliveryRouteRole()

// ─── Router (driver branch navigates to the detail view, manager stays in-place) ─
const router = useRouter()

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
  statusFilter,
  statusCounts,
} = useDeliveryRoutesTable()

// ─── Status tabs (client-side filter over the cached full list) ───────────────
const statusTabs = computed(() =>
  (['ALL', ...DELIVERY_ROUTE_STATUS_ORDER] as DeliveryRouteStatusFilter[]).map((value) => ({
    value,
    label: value === 'ALL' ? DELIVERY_ROUTE_COPY.list.managerTabs.all : DELIVERY_ROUTE_STATUS_LABELS[value],
    count: statusCounts.value[value],
  })),
)

function selectStatus(value: DeliveryRouteStatusFilter): void {
  statusFilter.value = value
  pagination.value = { ...pagination.value, pageIndex: 0 }
}

// ─── Table / card view (persisted like the other modules) ─────────────────────
const { viewMode, displayMode, setViewMode } = useDeliveryRouteViewMode()

const LIST_PORTAL = 'hf-theme hf-ui delivery-routes-list-portal'
const FORM_PORTAL = 'hf-theme hf-ui hf-form-overlay delivery-routes-form-portal'


  // Human-readable list error (block, not toast — design §11, REQ-DRM-014).
  const routesErrorMessage = computed(() =>
    normalizeApiError(error.value, 'No se pudieron cargar las rutas de entrega. Reintenta.').message,
  )

// ─── Driver list — active routes scoped server-side via CASL (design §6.2) ─────
const {
  data: driverRoutes,
  isLoading: driverIsLoading,
  isError: driverIsError,
  error: driverError,
  refetch: driverRefetch,
} = useDriverActiveRoutes()

// Human-readable driver list error (block, not toast — design §11, REQ-DRM-014).
const driverErrorMessage = computed(() =>
  normalizeApiError(
    driverError.value,
    'No se pudieron cargar tus rutas activas. Reintenta.',
  ).message,
)

/**
 * onSelectRoute — driver taps a card → navigate to the detail view.
 * The card owns the tap target; this view owns the route navigation (the card
 * is decoupled from vue-router, design §4.2).
 */
function onSelectRoute(routeId: string): void {
  void router.push(`/pos/rutas-de-entrega/${routeId}`)
}

// ─── Create slideover + mutation (REQ-DRM-006) ────────────────────────────────
const isCreateOpen = ref(false)
const { mutateAsync: createRoute, isPending: createIsPending } = useCreateDeliveryRoute()

// T3 S2 — inline create conflict. On a 409 the backend rejected the whole
// operation and reported the conflicting sales (flat `conflictSaleIds`, possibly
// empty on a race). We keep the slideover open + the selection untouched and
// forward the conflict so the picker marks/disables the affected rows and the
// mutation's `invalidateEligibleSales` refetches authoritative availability.
const createConflict = ref(false)
const createConflictSaleIds = ref<string[]>([])
// Monotonically incremented on EVERY 409 so a repeated EMPTY-id conflict
// reblocks the picker independent of the conflictSaleIds array identity.
const createConflictAttempt = ref(0)

function openCreate(): void {
  createConflict.value = false
  createConflictSaleIds.value = []
  createConflictAttempt.value = 0
  isCreateOpen.value = true
}

async function onCreate(payload: CreateDeliveryRouteRequest): Promise<void> {
  try {
    await createRoute(payload)
    // Close only on success — the mutation's onSuccess already fired the toast.
    isCreateOpen.value = false
    createConflict.value = false
    createConflictSaleIds.value = []
    createConflictAttempt.value = 0
  } catch (error) {
    // Error already surfaced via the composable's onError toast; keep the
    // slideover open so the user can correct the input.
    const conflictIds = extractSaleConflictIds(error)
    if (conflictIds !== null) {
      // Do NOT clear known conflict metadata before a successful reconciliation.
      createConflict.value = true
      createConflictSaleIds.value = conflictIds
      createConflictAttempt.value += 1
    }
  }
}

// ─── Row menu + shared ConfirmModal (same gates as the detail view) ─────────
// Every lifecycle action opens the shared ConfirmModal; the mutation fires only
// after the user confirms. The composables own pending state, toasts,
// invalidation and the 409 conflict handling (design §10.1).
const { mutateAsync: startRoute, isPending: startIsPending } = useStartDeliveryRoute()
const { mutateAsync: cancelRoute, isPending: cancelIsPending } = useCancelDeliveryRoute()
const { mutateAsync: deleteRoute, isPending: deleteIsPending } = useDeleteDeliveryRoute()
const { mutateAsync: updateRoute, isPending: updateIsPending } = useUpdateDeliveryRoute()

type ConfirmKind = 'start' | 'cancel' | 'delete'
const confirmState = ref<{ kind: ConfirmKind; route: DeliveryRouteResponseDto } | null>(null)
const isConfirmOpen = computed<boolean>(() => confirmState.value !== null)
const confirmCopy = computed(() =>
  confirmState.value ? DELIVERY_ROUTE_COPY.confirm[confirmState.value.kind] : null,
)
const confirmColor = computed<'primary' | 'warning' | 'error'>(() => {
  if (confirmState.value?.kind === 'delete') return 'error'
  if (confirmState.value?.kind === 'cancel') return 'warning'
  return 'primary'
})
const confirmLoading = computed<boolean>(
  () => startIsPending.value || cancelIsPending.value || deleteIsPending.value,
)

function openConfirm(kind: ConfirmKind, route: DeliveryRouteResponseDto): void {
  confirmState.value = { kind, route }
}

function closeConfirm(): void {
  confirmState.value = null
}

async function onConfirm(): Promise<void> {
  const state = confirmState.value
  closeConfirm()
  if (!state) return
  try {
    if (state.kind === 'start') await startRoute(state.route.id)
    else if (state.kind === 'cancel') await cancelRoute(state.route.id)
    else await deleteRoute(state.route.id)
  } catch {
    // Errors already surfaced via the composable's onError toast.
  }
}

// ─── Edit slideover (DRAFT-only, gated by the row menu) ───────────────────────
const editRoute = ref<DeliveryRouteResponseDto | null>(null)
const isEditOpen = computed<boolean>({
  get: () => editRoute.value !== null,
  set: (open) => {
    if (!open) editRoute.value = null
  },
})

async function onEdit(payload: UpdateDeliveryRouteRequest): Promise<void> {
  const route = editRoute.value
  if (!route) return
  try {
    await updateRoute({ id: route.id, payload })
    // Close only on success — the mutation's onSuccess already fired the toast.
    editRoute.value = null
  } catch {
    // Error already surfaced via the composable's onError toast; keep it open.
  }
}

function openRoute(routeId: string): void {
  void router.push(`/pos/rutas-de-entrega/${routeId}`)
}

/** Per-row menu sections — the pure gate lives in `buildDeliveryRouteListActions`. */
function rowActions(row: DeliveryRouteResponseDto): DeliveryRouteRowActionItem[][] {
  return buildDeliveryRouteListActions(row, {
    canUpdate: canUpdate.value,
    canDelete: canDelete.value,
    onView: (route) => openRoute(route.id),
    onEdit: (route) => {
      editRoute.value = route
    },
    onStart: (route) => openConfirm('start', route),
    onCancel: (route) => openConfirm('cancel', route),
    onDelete: (route) => openConfirm('delete', route),
  })
}

// ─── INLINE columns ───────────────────────────────────────────────────────────
// Structural definitions only — cell markup lives in the `#*-cell` slots below.
// Sorting runs client-side in `queryDeliveryRoutes` for the sortable ids.
const columns: TableColumn<DeliveryRouteResponseDto>[] = [
  { id: 'name', header: createSimpleHeader('Ruta'), enableSorting: false, enableHiding: false },
  { id: 'driver', header: 'Repartidor', enableSorting: true, enableHiding: true },
  { id: 'customers', header: createSimpleHeader('Clientes'), enableSorting: false, enableHiding: true },
  { id: 'progress', header: 'Progreso', enableSorting: true, enableHiding: true },
  { id: 'status', header: 'Estado', enableSorting: true, enableHiding: true },
  { id: 'createdAt', header: 'Creada', enableSorting: true, enableHiding: true },
  { id: 'startedAt', header: 'Inicio', enableSorting: true, enableHiding: true },
  { id: 'completedAt', header: 'Fin', enableSorting: true, enableHiding: true },
  { id: 'notes', header: createSimpleHeader('Notas'), enableSorting: false, enableHiding: true },
  {
    id: 'actions',
    header: createSimpleHeader(''),
    enableSorting: false,
    enableHiding: false,
    meta: { class: { td: 'text-right' } },
  },
]

// Typed status accessors keep the template free of `any`-indexed Record
// lookups (vue-tsc rejects indexing the status maps with the slot's row).
function statusTone(status: DeliveryRouteStatus) {
  return DELIVERY_ROUTE_STATUS_TONES[status]
}
function statusLabel(status: DeliveryRouteStatus) {
  return DELIVERY_ROUTE_STATUS_LABELS[status]
}

/** The end of a route is its completion or its cancellation. */
function routeEndedAt(route: DeliveryRouteResponseDto): string | null {
  return route.completedAt ?? route.cancelledAt
}
</script>

<template>
  <!--
    Driver branch (REQ-DRM-002 driver side, §4.2, §11): renders the
    `DriverRouteCard` list over `useDriverActiveRoutes`. Loading / empty /
    error states follow design §11: skeletons during fetch, "No tienes rutas
    activas" when the list is empty, error block + retry on failure.
  -->
  <div v-if="isDriver" class="flex flex-col gap-4 px-4 py-6 sm:px-6 lg:px-10">
    <header class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold">{{ DELIVERY_ROUTE_COPY.list.driverHeader }}</h1>
    </header>

    <!-- Loading skeleton (design §11). -->
    <div
      v-if="driverIsLoading"
      data-testid="driver-list-loading"
      class="flex flex-col gap-3"
    >
      <div class="h-24 animate-pulse rounded-lg bg-default" />
      <div class="h-24 animate-pulse rounded-lg bg-default" />
      <div class="h-24 animate-pulse rounded-lg bg-default" />
    </div>

    <!-- Error block (design §11, REQ-DRM-014). -->
    <div
      v-else-if="driverIsError"
      data-testid="driver-list-error"
      class="flex flex-col items-center gap-3 py-12 text-center"
    >
      <h2 class="text-base font-medium">No se pudieron cargar tus rutas</h2>
      <p class="text-sm text-muted">{{ driverErrorMessage }}</p>
      <button
        type="button"
        class="text-sm text-primary underline"
        @click="() => driverRefetch()"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty state (design §11). -->
    <p
      v-else-if="!driverRoutes || driverRoutes.length === 0"
      data-testid="driver-list-empty"
      class="py-12 text-center text-sm text-muted"
    >
      {{ DELIVERY_ROUTE_COPY.empty.driver }}
    </p>

    <!-- Active routes list — mobile-first, one card per row (cols widen on md+). -->
    <ul
      v-else
      class="grid grid-cols-1 gap-3 sm:grid-cols-2"
      data-testid="driver-list-cards"
    >
      <li v-for="route in driverRoutes" :key="route.id">
        <DriverRouteCard :route="route" @select="onSelectRoute" />
      </li>
    </ul>
  </div>

  <section
    v-else-if="isManager"
    class="hf-theme hf-ui delivery-routes-visual flex w-full min-w-0 flex-col gap-6 md:px-10"
    aria-labelledby="delivery-routes-title"
  >
    <DeliveryRouteUpsertSlideover
      v-model:open="isCreateOpen"
      v-model:create-conflict="createConflict"
      mode="create"
      :loading="createIsPending"
      :conflict-sale-ids="createConflictSaleIds"
      :conflict-attempt="createConflictAttempt"
      @create="onCreate"
    />

    <DeliveryRouteUpsertSlideover
      v-if="editRoute"
      v-model:open="isEditOpen"
      mode="edit"
      :route-id="editRoute.id"
      :initial-notes="editRoute.notes ?? ''"
      :initial-driver-user-id="editRoute.driver?.id ?? null"
      :loading="updateIsPending"
      @edit="onEdit"
    />

    <!-- Shared ConfirmModal for start / cancel / delete (REQ-DRM-010/011/012). -->
    <ConfirmModal
      :open="isConfirmOpen"
      :title="confirmCopy?.title ?? ''"
      :description="confirmCopy?.body ?? ''"
      :confirm-label="confirmCopy?.confirmLabel ?? 'Confirmar'"
      :cancel-label="confirmCopy?.cancelLabel ?? 'Cancelar'"
      :confirm-color="confirmColor"
      :loading="confirmLoading"
      :ui="{ content: FORM_PORTAL }"
      data-testid="list-start-confirm-modal"
      @update:open="(value: boolean) => { if (!value) closeConfirm() }"
      @confirm="onConfirm"
    />

    <header class="hf-page-header">
      <h1 id="delivery-routes-title" class="hf-page-title">{{ DELIVERY_ROUTE_COPY.list.title }}</h1>
      <p class="hf-page-subtitle">{{ DELIVERY_ROUTE_COPY.list.subtitle }}</p>
    </header>

    <UCard
      :ui="{ body: 'p-0 sm:p-0' }"
      class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm"
    >
      <div class="hf-table-content flex w-full min-w-0 flex-col gap-4">
        <div
          class="delivery-routes-tabs"
          role="tablist"
          :aria-label="DELIVERY_ROUTE_COPY.list.statusTabsLabel"
        >
          <button
            v-for="tab in statusTabs"
            :key="tab.value"
            type="button"
            role="tab"
            class="delivery-routes-tab"
            :aria-selected="statusFilter === tab.value"
            :data-testid="`status-tab-${tab.value}`"
            @click="selectStatus(tab.value)"
          >
            {{ tab.label }}
            <span class="delivery-routes-tab-count">{{ tab.count }}</span>
          </button>
        </div>

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
          :display-mode="displayMode"
          :search-placeholder="DELIVERY_ROUTE_COPY.list.searchPlaceholder"
          :show-add-button="canCreate"
          :add-button-text="DELIVERY_ROUTE_COPY.actions.create"
          add-button-icon="i-lucide-route"
          enable-column-visibility
          class="hf-data-table"
          :portal-class="LIST_PORTAL"
          :pagination-portal-class="LIST_PORTAL"
          @add="openCreate"
          @refresh="refresh"
        >
          <template #actions>
            <ViewToggle
              :model-value="viewMode"
              class="delivery-routes-view-toggle"
              aria-label="Seleccionar vista de rutas"
              @update:model-value="setViewMode"
            />
          </template>

          <template #cards>
            <DeliveryRouteCardGrid
              :routes="data"
              :loading="isLoading"
              :empty="DELIVERY_ROUTE_COPY.empty.manager"
              :get-actions="rowActions"
              :portal-class="LIST_PORTAL"
              @open="openRoute"
            />
          </template>

          <template #driver-header="{ column }">
            <SortableHeader :column="column" label="Repartidor" />
          </template>
          <template #progress-header="{ column }">
            <SortableHeader :column="column" label="Progreso" />
          </template>
          <template #status-header="{ column }">
            <SortableHeader :column="column" label="Estado" />
          </template>
          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Creada" />
          </template>
          <template #startedAt-header="{ column }">
            <SortableHeader :column="column" label="Inicio" />
          </template>
          <template #completedAt-header="{ column }">
            <SortableHeader :column="column" label="Fin" />
          </template>

          <template #name-cell="{ row }">
            <button
              type="button"
              class="delivery-routes-name-link flex min-w-0 flex-col text-left"
              data-testid="route-name-link"
              :title="row.original.id"
              @click="openRoute(row.original.id)"
            >
              <span class="text-sm font-medium">{{ buildRouteDisplayName(row.original) }}</span>
              <span class="delivery-routes-id font-mono text-xs">{{ shortRouteId(row.original.id) }}</span>
            </button>
          </template>

          <template #driver-cell="{ row }">
            <span class="text-sm">{{ row.original.driver?.name ?? 'Sin repartidor' }}</span>
          </template>

          <template #customers-cell="{ row }">
            <span class="block max-w-64 text-sm">
              {{ getRouteCustomers(row.original).join(', ') || '—' }}
            </span>
          </template>

          <template #progress-cell="{ row }">
            <div class="flex min-w-32 flex-col gap-1">
              <span class="text-sm tabular-nums">
                {{
                  getRouteProgress(row.original).total === 0
                    ? 'Sin paradas'
                    : `${getRouteProgress(row.original).completed}/${getRouteProgress(row.original).total}`
                }}
              </span>
              <div
                class="delivery-routes-progress"
                role="progressbar"
                :aria-valuenow="getRouteProgress(row.original).percent"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="`Progreso de entregas: ${getRouteProgress(row.original).percent}%`"
              >
                <span :style="{ width: `${getRouteProgress(row.original).percent}%` }" />
              </div>
            </div>
          </template>

          <template #status-cell="{ row }">
            <StatusDotBadge
              :tone="statusTone(row.original.status)"
              :label="statusLabel(row.original.status)"
            />
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm tabular-nums">
              {{ formatRouteDateTime(getRouteCreatedAt(row.original)) }}
            </span>
          </template>

          <template #startedAt-cell="{ row }">
            <span class="text-sm tabular-nums">{{ formatRouteDateTime(row.original.startedAt) }}</span>
          </template>

          <template #completedAt-cell="{ row }">
            <span class="text-sm tabular-nums">{{ formatRouteDateTime(routeEndedAt(row.original)) }}</span>
          </template>

          <template #notes-cell="{ row }">
            <span class="block max-w-72 whitespace-normal break-words text-sm">
              {{ row.original.notes || '—' }}
            </span>
          </template>

          <template #actions-cell="{ row }">
            <UDropdownMenu
              :items="rowActions(row.original)"
              :content="{ align: 'end' }"
              :ui="{ content: LIST_PORTAL }"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                class="size-9"
                aria-label="Acciones de la ruta"
              />
            </UDropdownMenu>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </section>
</template>
