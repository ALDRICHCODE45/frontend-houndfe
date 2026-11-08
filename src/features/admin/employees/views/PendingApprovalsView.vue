<script setup lang="ts">
/**
 * PendingApprovalsView — WU-12B + S5 + WU-A (standardize-pending-approvals)
 *
 * Tenant-wide "Validaciones pendientes" tray showing PENDING time-off approval
 * requests across the whole tenant. The manager→subordinates model was removed
 * backend-side; any user with read:EmployeeTimeOff sees the same queue.
 *
 * One layout: an AppDataTable (client-side) on desktop and cards on mobile
 * (`mobile-render="cards"` + `#mobile-card`). The person first, then the
 * status badge (every request here is a pending item that needs action, so it
 * is warning), then dates, type, days, reason and when it was requested. The
 * ⋮ menu (Aprobar…, Rechazar…) shows only with update:EmployeeTimeOff and
 * opens the review dialog; a read-only role sees no menu.
 *
 * Four states (S10): "Sin solicitudes pendientes" (nothing to review, no
 * action), no-match for a name search, skeletons, and the shared error.
 *
 * Permission gate: read:EmployeeTimeOff (enforced at route level).
 * Review action gated by update:EmployeeTimeOff.
 *
 * Backend constraint (§4.5):
 *   GET /admin/employees-time-off/pending-approvals
 *   - Route uses HYPHEN (employees-time-off) — NOT under /:employeeId.
 *   - Returns the full tenant PENDING queue (no managerId, no tenantId).
 *   - Ordered by startDate asc, then id asc (backend-sorted — we do NOT
 *     re-sort; the filter preserves the backend order).
 *   - SICK reason is null if caller lacks read:EmployeeTimeOffMedical
 *     (Tier 3 stripping). `resolveSickReason` renders the SICK+null
 *     case as "Motivo médico reservado" (S5).
 *
 * Name resolution (S5):
 *   One cached `listForPicker('')` (active employees, pageSize 100) feeds
 *   a `buildManagerMap` lookup. ZERO per-row `getById` calls.
 *   KNOWN LIMITATION (v1, accepted): picker caps at 100 active employees;
 *   a tenant with >100 active employees may show "—" for some names.
 *   A future `/admin/employees?ids=` batch endpoint would lift this.
 *
 * REQ-8 invariants (preserved):
 *   - `usePendingApprovals` keeps `refetchOnWindowFocus: true` +
 *     `staleTime: 30_000` (approvals are time-sensitive).
 *   - `usePendingApprovals` stays inside `useReviewTimeOff.ts` (NOT split).
 *   - Client-side full-array pagination via paginateRows / clampPage /
 *     pageAfterQueryChange.
 *   - `pagination.utils.ts` header unchanged.
 */

import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { AppDataTable } from '@/core/shared/components/DataTable'
import { useTablePreferences } from '@/core/shared/composables/useTablePreferences'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import '../styles/employees-visual.css'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import {
  paginateRows,
  pageAfterQueryChange,
  clampPage,
  FIRST_PAGE,
  DEFAULT_TABLE_PAGE_SIZE,
} from '@/core/shared/utils/pagination.utils'
import { REVIEW_DECISION, TIME_OFF_STATUS } from '../constants/employee.constants'
import type { ReviewDecisionValue } from '../constants/employee.constants'
import { usePendingApprovals } from '../composables/useReviewTimeOff'
import { useReviewTimeOff } from '../composables/useReviewTimeOff'
import { usePendingApprovalsColumns } from '../composables/usePendingApprovalsColumns'
import {
  formatTimeOffType,
  formatTimeOffStatus,
  computeTimeOffDays,
  resolveSickReason,
  filterPendingBySearch,
} from '../composables/useAusencias'
import { buildManagerMap } from '../composables/useManagerResolution'
import { formatTimeOffDateRange } from '../composables/useEmployeeColumns'
import AdminMobileCard from '../../shared/components/AdminMobileCard.vue'
import { noMatchTitleFor } from '../../shared/utils/list-state.utils'
import { employeesApi } from '../api/employees.api'
import type { TimeOffRequest, ReviewTimeOffDto, Employee } from '../interfaces/employee.types'

// ─── Auth ──────────────────────────────────────────────────────────────────────

const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)

const canReview = computed(() => authStore.userCan('update', 'EmployeeTimeOff'))

// ─── Pending queue (tenant-wide) ─────────────────────────────────────────────

const {
  data: pendingRequests,
  isLoading,
  isError,
  refetch,
} = usePendingApprovals()

// ─── Name resolution: ONE cached list → buildManagerMap ──────────────────────
//
// Single `listForPicker('')` query (active employees, pageSize 100) feeds the
// lookup map. Replaces the prior per-row `useQueries(getById)` which scaled
// with the number of unique employees in the queue.
const { data: employeesList } = useQuery<Employee[]>({
  queryKey: computed(() => employeeQueryKeys.activeForPicker(tenantId.value, '')),
  queryFn: () => employeesApi.listForPicker(''),
  staleTime: 60_000,
  refetchOnWindowFocus: false,
  retry: 1,
})

const employeeMap = computed(() => buildManagerMap(employeesList.value ?? []))

// ─── Table columns ────────────────────────────────────────────────────────────

const { columns: allColumns } = usePendingApprovalsColumns()

// ─── Client-side search by resolved name (S5) ────────────────────────────────

const searchQuery = ref('')

/** Client-side filtered tray rows: search by resolved employee name. */
// An all-pending queue would repeat "Pendiente" on every row, so the status shows
// (column and card badge) only when some request is not pending.
const showStatus = computed(() =>
  (pendingRequests.value ?? []).some((request) => request.status !== TIME_OFF_STATUS.PENDING),
)
const columns = computed(() =>
  showStatus.value ? allColumns.value : allColumns.value.filter((column) => column.id !== 'estado'),
)

const filteredRequests = computed(() =>
  filterPendingBySearch(pendingRequests.value ?? [], employeeMap.value, searchQuery.value),
)

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)
const noMatchTitle = computed(() => noMatchTitleFor(searchQuery.value))

function clearSearch(): void {
  searchQuery.value = ''
}

// ─── Client-side pagination ───────────────────────────────────────────────────
//
// The pending-approvals endpoint returns the FULL tenant queue as a flat array
// (server-sorted, NO server pagination), so we slice it client-side AFTER the
// name search. Page size is shared with the "Documentos por vencer" table for a
// consistent feel across the two tenant-wide list views.
const page = ref(FIRST_PAGE)
const pageSize = ref(DEFAULT_TABLE_PAGE_SIZE)

/** Current page slice of the searched queue — page clamped so it is always valid. */
const paged = computed(() => {
  const pageCount = Math.ceil(filteredRequests.value.length / pageSize.value)
  return paginateRows(filteredRequests.value, clampPage(page.value, pageCount), pageSize.value)
})

const showingFrom = computed(() =>
  paged.value.total === 0 ? 0 : (page.value - 1) * pageSize.value + 1,
)
const showingTo = computed(() => Math.min(page.value * pageSize.value, paged.value.total))

// Reset to the first page whenever the search query changes (the result set,
// and therefore the page range, changes).
watch(searchQuery, (next, previous) => {
  page.value = pageAfterQueryChange(previous, next, page.value)
})

// Recover the page ref when the queue shrinks from a NON-search source (a
// review-mutation refetch drops pending below the current page); clampPage is
// idempotent, so this watch cannot loop.
watch(
  () => paged.value.pageCount,
  (count) => {
    page.value = clampPage(page.value, count)
  },
)

// ─── AppDataTable pagination bridge (copy-pasted verbatim from
//     ExpiringDocumentsView.vue — REQ-1, REQ-8 invariant).
//
// Bridge AppDataTable's 0-based PaginationState with our 1-based page ref.
const pagination = computed({
  get: () => ({ pageIndex: page.value - 1, pageSize: pageSize.value }),
  set: (val: { pageIndex: number; pageSize: number }) => {
    if (val.pageSize !== pageSize.value) {
      pageSize.value = val.pageSize
      page.value = FIRST_PAGE
    } else {
      page.value = val.pageIndex + 1
    }
  },
})

// ─── Column layout (REQ-3 + premium tables), persisted in the browser ──────────
//
// Reconciled against every column, the conditional Estado included, so hiding it
// for an all-pending queue never drops the user's choices for it.
const {
  columnPinning,
  columnVisibility,
  columnOrder,
  columnSizing,
  density,
  reset: resetLayout,
} = useTablePreferences({
  persistKey: 'admin-pending-approvals',
  defaultPinning: { left: [], right: ['acciones'] },
  columnIds: () => allColumns.value.map((column) => column.id!),
})

// ─── Error title (a fixed human sentence, never the server message) ───────────

const pendingErrorMessage = 'No se pudieron cargar las solicitudes pendientes'

// ─── Review mutation ───────────────────────────────────────────────────────────

// We use a singleton employee ID from the first pending request for the mutation context.
// The review route is per-employee: POST /:employeeId/time-off/:timeOffId/review
const reviewingRequest = ref<TimeOffRequest | null>(null)
const reviewEmployeeId = computed(() => reviewingRequest.value?.employeeId ?? '')

const { mutateAsync: submitReview, isPending: isReviewingMutation } =
  useReviewTimeOff(reviewEmployeeId)

/**
 * Per-row "is reviewing" check. The mutation's `isPending` is shared
 * (one POST /review at a time), but the in-flight target is the
 * `reviewingRequest` set by `openReviewDialog`. Match the row id so
 * only the row whose confirmation is in flight shows the busy state —
 * other rows stay interactive (mirrors AusenciasPanel's
 * `isReviewing && reviewingId === item.id` pattern).
 */
function isReviewing(id: string): boolean {
  return isReviewingMutation.value && reviewingRequest.value?.id === id
}

const isReviewDialogOpen = ref(false)
const reviewDecision = ref<ReviewDecisionValue | null>(null)
const reviewerNotes = ref('')

function openReviewDialog(request: TimeOffRequest, decision: ReviewDecisionValue): void {
  reviewingRequest.value = request
  reviewDecision.value = decision
  reviewerNotes.value = ''
  isReviewDialogOpen.value = true
}

async function confirmReview(): Promise<void> {
  if (!reviewingRequest.value || !reviewDecision.value) return

  const dto: ReviewTimeOffDto = {
    decision: reviewDecision.value,
    reviewerNotes: reviewerNotes.value.trim() || undefined,
  }

  try {
    await submitReview({ timeOffId: reviewingRequest.value.id, dto })
    isReviewDialogOpen.value = false
    reviewingRequest.value = null
  } catch {
    // Error toast handled by mutation onError (S5: routes through
    // normalizeApiError + resolveDomainErrorMessage for 409 voseo).
  }
}

function cancelReview(): void {
  isReviewDialogOpen.value = false
  reviewingRequest.value = null
  reviewDecision.value = null
  reviewerNotes.value = ''
}

// ─── Display helpers ───────────────────────────────────────────────────────────

/** Resolve the employee display name for a row or card ("—" until the picker loads). */
function resolveEmployeeName(request: TimeOffRequest): string {
  return employeeMap.value.get(request.employeeId)?.fullName ?? '—'
}

/** Every request in this tray is PENDING: a pending item that needs action is warning. */
function statusBadgeOf(request: TimeOffRequest) {
  return {
    tone: request.status === TIME_OFF_STATUS.PENDING ? ('warning' as const) : ('neutral' as const),
    label: formatTimeOffStatus(request.status),
  }
}

function daysLabel(request: TimeOffRequest): string {
  const days = computeTimeOffDays(request.startDate, request.endDate)
  return `${days} ${days === 1 ? 'día' : 'días'}`
}

// ─── Row menu ─────────────────────────────────────────────────────────────────
// Both items open the review dialog (confirmation), so both end in "…". A
// read-only role gets no menu. While THIS request is being reviewed the items
// are held.

function actionsFor(request: TimeOffRequest): RowAction[] {
  if (!canReview.value) return []
  const busy = isReviewing(request.id)
  return [
    { key: 'approve', label: 'Aprobar…', icon: 'i-lucide-check', disabled: busy },
    { key: 'reject', label: 'Rechazar…', icon: 'i-lucide-x', disabled: busy },
  ]
}

function handleRowAction(key: string, request: TimeOffRequest): void {
  if (key === 'approve') openReviewDialog(request, REVIEW_DECISION.APPROVED)
  else if (key === 'reject') openReviewDialog(request, REVIEW_DECISION.REJECTED)
}

/** The row's accessible name: whose request it is and when. */
function rowLabelOf(request: TimeOffRequest): string {
  return `la solicitud de ${resolveEmployeeName(request)}, ${formatTimeOffDateRange(request.startDate, request.endDate)}`
}
</script>

<template>
  <div class="hf-theme hf-ui employees-visual flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <header class="hf-page-header">
      <h1 class="hf-page-title">Validaciones pendientes</h1>
    </header>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm">
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        <AppDataTable
          v-model:pagination="pagination"
          v-model:global-filter="searchQuery"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          v-model:column-order="columnOrder"
          v-model:column-sizing="columnSizing"
          v-model:density="density"
          :persist-layout="true"
          :columns="columns"
          :data="paged.pageRows"
          :loading="isLoading"
          :error="isError"
          :error-message="pendingErrorMessage"
          :empty-state="{
            title: 'Sin solicitudes pendientes',
            description: 'Aquí aparecerán las solicitudes de ausencia por validar.',
          }"
          :filtered="isSearchActive"
          :no-match-title="noMatchTitle"
          display-mode="auto"
          mobile-render="cards"
          enable-column-visibility
          search-placeholder="Buscar colaborador..."
          :page-count="paged.pageCount"
          :total-count="paged.total"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="[10, 20, 50]"
          empty="Sin solicitudes pendientes"
          class="hf-data-table"
          portal-class="hf-theme hf-ui employees-list-portal"
          pagination-portal-class="hf-theme hf-ui employees-list-portal"
          @refresh="() => refetch()"
          @clear-filters="clearSearch"
          @reset-columns="resetLayout"
        >
          <template #colaborador-cell="{ row }">
            <div class="flex min-w-0 items-center gap-3">
              <EntityAvatar
                :name="resolveEmployeeName(row.original)"
                aria-hidden="true"
              />
              <span class="hf-row-primary">{{ resolveEmployeeName(row.original) }}</span>
            </div>
          </template>

          <template #estado-cell="{ row }">
            <StatusBadge v-bind="statusBadgeOf(row.original)" />
          </template>

          <template #fechas-cell="{ row }">
            <span class="text-sm">
              {{ formatTimeOffDateRange(row.original.startDate, row.original.endDate) }}
            </span>
          </template>

          <template #tipo-cell="{ row }">
            <span class="text-sm">{{ formatTimeOffType(row.original.type) }}</span>
          </template>

          <template #dias-cell="{ row }">
            <span class="hf-figure text-sm">{{ daysLabel(row.original) }}</span>
          </template>

          <template #motivo-cell="{ row }">
            <span class="block max-w-56 truncate text-sm text-muted">
              {{ resolveSickReason(row.original.type, row.original.reason) }}
            </span>
          </template>

          <template #solicitada-cell="{ row }">
            <span class="text-sm text-muted">{{ formatShortDateTime(row.original.createdAt) }}</span>
          </template>

          <template #acciones-header><span class="sr-only">Acciones</span></template>

          <template #acciones-cell="{ row }">
            <RowActionsMenu
              :actions="actionsFor(row.original)"
              :row-label="rowLabelOf(row.original)"
              portal-class="employees-list-portal"
              @select="handleRowAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <AdminMobileCard
              :item="row"
              :label="resolveEmployeeName(row)"
              :actions="actionsFor(row)"
              portal-class="employees-list-portal"
              test-id="pending-approval-card"
              @action="handleRowAction"
            >
              <template #leading>
                <EntityAvatar :name="resolveEmployeeName(row)" aria-hidden="true" />
              </template>
              <template #secondary>
                {{ formatTimeOffType(row.type) }} · {{ resolveSickReason(row.type, row.reason) }}
              </template>
              <template v-if="showStatus" #badges>
                <StatusBadge v-bind="statusBadgeOf(row)" />
              </template>
              <template #footer>
                <span class="min-w-0 truncate font-medium">
                  {{ formatTimeOffDateRange(row.startDate, row.endDate) }} · {{ daysLabel(row) }}
                </span>
                <span class="shrink-0">Solicitada {{ formatShortDateTime(row.createdAt) }}</span>
              </template>
            </AdminMobileCard>
          </template>
        </AppDataTable>
      </div>
    </UCard>

    <!-- Review confirmation dialog -->
    <UModal
      v-model:open="isReviewDialogOpen"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }"
    >
      <template #content>
        <UCard v-if="reviewingRequest" class="employees-detail-section">
          <template #header>
            <h2 class="text-base font-semibold text-highlighted">
              {{
                reviewDecision === REVIEW_DECISION.APPROVED
                  ? 'Aprobar solicitud de ausencia'
                  : 'Rechazar solicitud de ausencia'
              }}
            </h2>
          </template>

          <div class="flex flex-col gap-4">
            <!-- Summary -->
            <div class="rounded-md bg-(--hf-surface-muted) p-3 text-sm">
              <p class="font-medium text-highlighted">
                {{ resolveEmployeeName(reviewingRequest) }}
              </p>
              <p class="text-muted">
                {{ formatTimeOffType(reviewingRequest.type) }} —
                {{ formatTimeOffDateRange(reviewingRequest.startDate, reviewingRequest.endDate) }}
                · {{ daysLabel(reviewingRequest) }}
              </p>
            </div>

            <!-- Reviewer notes -->
            <UFormField label="Notas del revisor (opcional)">
              <UTextarea
                v-model="reviewerNotes"
                :placeholder="
                  reviewDecision === REVIEW_DECISION.REJECTED
                    ? 'Motivo del rechazo...'
                    : 'Comentarios adicionales...'
                "
                :rows="3"
                class="w-full"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                variant="ghost"
                color="neutral"
                :disabled="isReviewingMutation"
                @click="cancelReview"
              >
                Cancelar
              </UButton>
              <UButton
                :color="reviewDecision === REVIEW_DECISION.APPROVED ? 'primary' : 'error'"
                :loading="isReviewingMutation"
                @click="confirmReview"
              >
                {{
                  reviewDecision === REVIEW_DECISION.APPROVED
                    ? 'Confirmar aprobación'
                    : 'Confirmar rechazo'
                }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
