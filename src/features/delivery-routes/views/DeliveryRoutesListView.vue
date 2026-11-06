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
 * §4, "List screens"): heading outside the surface, the Estado filter with
 * counts, client-side search/sort over the cached full list, a derived route
 * name that opens the detail (the whole row does too), a table on desktop and
 * cards on mobile, and the ⋮ row menu (Ver detalle/Editar/Iniciar/Cancelar/
 * Eliminar) gated exactly like the detail view, each mutation behind the shared
 * ConfirmModal. A route that only offers "Ver detalle" shows no ⋮.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import '../styles/delivery-routes-visual.css'
import type { TableColumn } from '@nuxt/ui'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ToolbarSelectFilter from '@/core/shared/components/DataTable/ToolbarSelectFilter.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { useDeliveryRouteRole } from '../composables/useDeliveryRouteRole'
import { useDeliveryRoutesTable } from '../composables/useDeliveryRoutesTable'
import { useDriverActiveRoutes } from '../composables/useDriverActiveRoutes'
import { useCreateDeliveryRoute } from '../composables/useCreateDeliveryRoute'
import { useStartDeliveryRoute } from '../composables/useStartDeliveryRoute'
import { useCancelDeliveryRoute } from '../composables/useCancelDeliveryRoute'
import { useDeleteDeliveryRoute } from '../composables/useDeleteDeliveryRoute'
import { useUpdateDeliveryRoute } from '../composables/useUpdateDeliveryRoute'
import DeliveryRouteUpsertSlideover from '../components/DeliveryRouteUpsertSlideover.vue'
import DriverRouteCard from '../components/DriverRouteCard.vue'
import { DELIVERY_ROUTE_COPY } from '../copy'
import { summarizeDriverRoutes } from '../utils/delivery-route-driver.utils'
import { extractSaleConflictIds } from '../interfaces/errors'
import {
  buildStopProgress,
  deliveryRouteRowActions,
  deliveryRouteRowLabel,
} from '../utils/delivery-route-actions.utils'
import {
  DELIVERY_ROUTE_STATUS_ORDER,
  buildRouteTitle,
  getRouteCreatedAt,
  getRouteCustomers,
  getRouteIssues,
  getRouteProgress,
  routeAvisoLabel,
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
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
  statusFilter,
  statusCounts,
} = useDeliveryRoutesTable()

// ─── Estado filter (client-side over the cached full list) ──────────────────
const statusItems = computed(() =>
  (['ALL', ...DELIVERY_ROUTE_STATUS_ORDER] as DeliveryRouteStatusFilter[]).map((value) => ({
    value,
    // Counts describe loaded data: while loading or failed they would all read "(0)".
    label: `${
      value === 'ALL' ? DELIVERY_ROUTE_COPY.list.managerTabs.all : DELIVERY_ROUTE_STATUS_LABELS[value]
    }${isLoading.value || isError.value ? '' : ` (${statusCounts.value[value]})`}`,
  })),
)

const statusModel = computed<string>({
  get: () => statusFilter.value,
  set: (value) => {
    statusFilter.value = value as DeliveryRouteStatusFilter
    pagination.value = { ...pagination.value, pageIndex: 0 }
  },
})

const LIST_PORTAL = 'hf-theme hf-ui delivery-routes-list-portal'
const FORM_PORTAL = 'hf-theme hf-ui hf-form-overlay delivery-routes-form-portal'

// Error title of the list block: a human sentence, never the server message.
const routesErrorMessage = 'No se pudieron cargar las rutas de entrega'

// ─── Shared list states (S10) ─────────────────────────────────────────────────
const search = computed(() => globalFilter.value.trim())
const activeFilterCount = computed(() => (statusFilter.value === 'ALL' ? 0 : 1))

/** The list is empty because a search or the Estado filter matched nothing. */
const filtered = computed(() => search.value.length > 0 || activeFilterCount.value > 0)

const noMatchTitle = computed(() =>
  search.value ? `Ningún resultado para «${search.value}»` : 'Ningún resultado',
)

const emptyState = computed(() => ({
  title: DELIVERY_ROUTE_COPY.empty.managerTitle,
  description: DELIVERY_ROUTE_COPY.empty.managerDescription,
  ...(canCreate.value
    ? { actionLabel: DELIVERY_ROUTE_COPY.actions.create, actionIcon: 'i-lucide-route' }
    : {}),
}))

function resetFilters(): void {
  globalFilter.value = ''
  statusFilter.value = 'ALL'
  pagination.value = { ...pagination.value, pageIndex: 0 }
}

// ─── Driver list — active routes scoped server-side via CASL (design §6.2) ─────
const {
  data: driverRoutes,
  isLoading: driverIsLoading,
  isError: driverIsError,
  error: driverError,
  refetch: driverRefetch,
} = useDriverActiveRoutes()

// Workload line under the driver header ("2 rutas · 7 paradas pendientes").
const driverSummary = computed(() =>
  driverRoutes.value && driverRoutes.value.length > 0 ? summarizeDriverRoutes(driverRoutes.value) : null,
)

// Human-readable driver list error (block, not toast — design §11, REQ-DRM-014).
const driverErrorMessage = computed(() =>
  normalizeApiError(
    driverError.value,
    'No se pudieron cargar tus rutas activas.',
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

/** The whole row (and the whole card) opens the detail. */
function openRow(route: DeliveryRouteResponseDto): void {
  openRoute(route.id)
}
const { rowProps } = useClickableRow<DeliveryRouteResponseDto>(openRow, { focusable: false })

/** Per-row menu — the pure gate lives in `deliveryRouteRowActions`. */
function actionsFor(row: DeliveryRouteResponseDto) {
  return deliveryRouteRowActions(row, { canUpdate: canUpdate.value, canDelete: canDelete.value })
}

function runAction(key: string, row: DeliveryRouteResponseDto): void {
  if (key === 'view') openRoute(row.id)
  else if (key === 'edit') editRoute.value = row
  else if (key === 'start' || key === 'cancel' || key === 'delete') openConfirm(key, row)
}

// ─── Columns ──────────────────────────────────────────────────────────────────
// Name first, status second, then what decides the next action. Structural
// definitions only — cell markup lives in the `#*-cell` slots below. Sorting runs
// client-side in `queryDeliveryRoutes` for the sortable ids.
const columns: TableColumn<DeliveryRouteResponseDto>[] = [
  { id: 'name', header: 'Ruta', enableSorting: false, enableHiding: false },
  { id: 'status', header: 'Estado', enableSorting: true, enableHiding: true },
  { id: 'driver', header: 'Repartidor', enableSorting: true, enableHiding: true },
  { id: 'progress', header: 'Progreso', enableSorting: true, enableHiding: true },
  { id: 'customers', header: 'Clientes', enableSorting: false, enableHiding: true },
  { id: 'createdAt', header: 'Creada', enableSorting: true, enableHiding: true },
  { id: 'startedAt', header: 'Inicio', enableSorting: true, enableHiding: true },
  // A 4rem menu column, as in the other lists, so the dates keep their width at 1440.
  {
    id: 'actions',
    header: 'Acciones',
    enableSorting: false,
    enableHiding: false,
    meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
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
function driverName(route: DeliveryRouteResponseDto): string {
  return route.driver?.name ?? 'Sin repartidor'
}

/** "2/5 paradas" or "Sin paradas" for the card footer. */
function stopsSummary(route: DeliveryRouteResponseDto): string {
  const progress = getRouteProgress(route)
  return progress.total === 0 ? buildStopProgress(route.stops) : `${buildStopProgress(route.stops)} paradas`
}
</script>

<template>
  <!--
    Driver branch (REQ-DRM-002 driver side, §4.2, §11): renders the
    `DriverRouteCard` list over `useDriverActiveRoutes`. Loading / empty /
    error states follow design §11: skeletons during fetch, the shared
    EmptyState when the list is empty, an error state + retry on failure.
  -->
  <div
    v-if="isDriver"
    class="hf-theme hf-ui delivery-routes-driver flex flex-col gap-4 px-4 py-6 sm:px-6 lg:px-10"
  >
    <header class="hf-page-header">
      <h1 class="hf-page-title">{{ DELIVERY_ROUTE_COPY.list.driverHeader }}</h1>
      <p
        v-if="driverSummary"
        class="hf-page-subtitle"
        data-testid="driver-list-summary"
      >
        {{ driverSummary }}
      </p>
    </header>

    <!-- Loading skeleton (design §11): card-shaped blocks. -->
    <div
      v-if="driverIsLoading"
      data-testid="driver-list-loading"
      aria-busy="true"
      class="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3"
    >
      <div v-for="i in 3" :key="i" class="route-skeleton animate-pulse" />
    </div>

    <!-- Error state (design §11, REQ-DRM-014). -->
    <div v-else-if="driverIsError" data-testid="driver-list-error">
      <EmptyState
        kind="error"
        title="No se pudieron cargar tus rutas"
        :description="driverErrorMessage"
        action-label="Reintentar"
        action-test-id="driver-list-retry"
        @action="() => driverRefetch()"
      />
    </div>

    <!-- Empty state (design §11). -->
    <div
      v-else-if="!driverRoutes || driverRoutes.length === 0"
      data-testid="driver-list-empty"
    >
      <EmptyState
        :title="DELIVERY_ROUTE_COPY.empty.driverTitle"
        :description="DELIVERY_ROUTE_COPY.empty.driverDescription"
      />
    </div>

    <!-- Active routes list — mobile-first, one card per row (cols widen on md+). -->
    <ul
      v-else
      class="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3"
      data-testid="driver-list-cards"
    >
      <li v-for="route in driverRoutes" :key="route.id" class="flex">
        <DriverRouteCard :route="route" @select="onSelectRoute" />
      </li>
    </ul>
  </div>

  <div
    v-else-if="isManager"
    class="hf-theme hf-ui delivery-routes-visual flex w-full min-w-0 flex-col gap-6 md:px-10"
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
    </header>

    <UCard
      :ui="{ body: 'p-0 sm:p-0' }"
      class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm"
    >
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
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
          :empty-state="emptyState"
          :filtered="filtered"
          :no-match-title="noMatchTitle"
          :active-filter-count="activeFilterCount"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :row-open="openRow"
          display-mode="auto"
          mobile-render="cards"
          :search-placeholder="DELIVERY_ROUTE_COPY.list.searchPlaceholder"
          :show-add-button="canCreate"
          :add-button-text="DELIVERY_ROUTE_COPY.actions.create"
          add-button-icon="i-lucide-route"
          enable-column-visibility
          class="hf-data-table"
          :portal-class="LIST_PORTAL"
          :pagination-portal-class="LIST_PORTAL"
          @add="openCreate"
          @empty-action="openCreate"
          @refresh="refresh"
          @clear-filters="resetFilters"
        >
          <template #filters>
            <ToolbarSelectFilter
              v-model="statusModel"
              :items="statusItems"
              label="Estado"
              :portal-class="LIST_PORTAL"
              test-id="route-status-filter"
            />
          </template>

          <template #status-header="{ column }">
            <SortableHeader :column="column" label="Estado" />
          </template>
          <template #driver-header="{ column }">
            <SortableHeader :column="column" label="Repartidor" />
          </template>
          <template #progress-header="{ column }">
            <SortableHeader :column="column" label="Progreso" />
          </template>
          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Creada" />
          </template>
          <template #startedAt-header="{ column }">
            <SortableHeader :column="column" label="Inicio" />
          </template>
          <template #actions-header><span class="sr-only">Acciones</span></template>

          <template #name-cell="{ row }">
            <div class="route-primary">
              <button
                type="button"
                class="hf-row-primary route-row-link"
                data-testid="route-name-link"
                @click="openRoute(row.original.id)"
              >{{ buildRouteTitle(row.original) }}</button>
              <span v-if="row.original.notes" class="hf-row-secondary">{{ row.original.notes }}</span>
            </div>
          </template>

          <template #status-cell="{ row }">
            <div class="route-status-cell">
              <StatusBadge
                data-testid="route-status"
                :tone="statusTone(row.original.status)"
                :label="statusLabel(row.original.status)"
              />
              <span
                v-if="getRouteIssues(row.original).length > 0"
                data-testid="route-aviso"
                class="route-aviso"
                :title="getRouteIssues(row.original).join(' · ')"
              >
                <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />{{ routeAvisoLabel(getRouteIssues(row.original).length) }}
                <span class="sr-only">: {{ getRouteIssues(row.original).join(', ') }}</span>
              </span>
            </div>
          </template>

          <template #driver-cell="{ row }">
            <span class="route-text">{{ driverName(row.original) }}</span>
          </template>

          <template #progress-cell="{ row }">
            <div class="route-progress-cell">
              <span class="hf-figure route-progress-count">{{ buildStopProgress(row.original.stops) }}</span>
              <div
                class="route-progress"
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

          <template #customers-cell="{ row }">
            <span class="route-text route-customers" :title="getRouteCustomers(row.original).join(', ')">
              {{ getRouteCustomers(row.original).join(', ') || '—' }}
            </span>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="route-when">{{ formatShortDateTime(getRouteCreatedAt(row.original)) }}</span>
          </template>

          <template #startedAt-cell="{ row }">
            <span class="route-when">{{ formatShortDateTime(row.original.startedAt) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <RowActionsMenu
              :actions="actionsFor(row.original)"
              :row-label="deliveryRouteRowLabel(row.original)"
              portal-class="delivery-routes-list-portal"
              @select="runAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <article v-bind="rowProps(row)" class="route-card" data-testid="delivery-route-card">
              <div class="route-card-head">
                <button
                  type="button"
                  class="hf-row-primary route-row-link"
                  data-testid="delivery-route-card-open"
                  @click="openRoute(row.id)"
                >{{ buildRouteTitle(row) }}</button>
                <RowActionsMenu
                  :actions="actionsFor(row)"
                  :row-label="deliveryRouteRowLabel(row)"
                  portal-class="delivery-routes-list-portal"
                  @select="runAction($event, row)"
                />
              </div>
              <span class="hf-row-secondary">{{ driverName(row) }}</span>
              <span v-if="getRouteCustomers(row).length > 0" class="hf-row-secondary">
                {{ getRouteCustomers(row).join(', ') }}
              </span>
              <div class="route-card-meta">
                <StatusBadge
                  data-testid="route-status"
                  :tone="statusTone(row.status)"
                  :label="statusLabel(row.status)"
                />
                <span
                  v-if="getRouteIssues(row).length > 0"
                  data-testid="route-aviso"
                  class="route-aviso"
                  :title="getRouteIssues(row).join(' · ')"
                >
                  <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />{{ routeAvisoLabel(getRouteIssues(row).length) }}
                  <span class="sr-only">: {{ getRouteIssues(row).join(', ') }}</span>
                </span>
              </div>
              <div class="route-card-footer">
                <span class="hf-figure route-card-stops">{{ stopsSummary(row) }}</span>
                <span>{{ formatShortDateTime(getRouteCreatedAt(row)) }}</span>
              </div>
            </article>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>

<style scoped>
.route-primary { min-width: 0; }
.route-row-link { padding: 0; border: 0; background: none; text-align: left; font-size: 14px; cursor: pointer; }
.route-row-link:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; border-radius: 4px; }
.route-status-cell { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; }
.route-aviso { display: inline-flex; align-items: center; gap: 4px; color: var(--hf-warning); font-size: 12px; font-weight: 600; white-space: nowrap; }
.route-text { font-size: 14px; }
.route-customers { display: block; max-width: 16rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.route-when { color: var(--hf-muted); font-size: 13px; white-space: nowrap; }
/* The cell keeps the table's 7rem floor; a floor here too would overflow it by the padding. */
.route-progress-cell { display: grid; min-width: 0; gap: 4px; }
.route-progress-count { text-align: left; font-size: 14px; }
.route-progress { height: 6px; overflow: hidden; border-radius: 999px; background: var(--hf-surface-muted); }
.route-progress > span { display: block; height: 100%; border-radius: inherit; background: var(--hf-success); }
.route-skeleton { height: 7.5rem; border-radius: 12px; background: var(--hf-surface-muted); }
.route-card { position: relative; min-width: 0; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 16px; }
.route-card-head { display: flex; align-items: flex-start; gap: 4px; min-width: 0; }
.route-card-head .route-row-link { flex: 1; min-width: 0; padding-top: 2px; font-size: 15px; line-height: 1.4; white-space: normal; }
.route-card-head > :last-child { margin: -8px -8px 0 0; flex: none; }
.route-card-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.route-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--hf-border); color: var(--hf-muted); font-size: 13px; }
.route-card-stops { color: var(--hf-ink); font-weight: 600; }
:deep(td[data-slot='td']) { height: 64px; padding-block: 10px; vertical-align: middle; }
:deep(td[data-slot='td']:last-child) { padding-inline: 8px; }
</style>
