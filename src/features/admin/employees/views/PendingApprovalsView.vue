<script setup lang="ts">
/**
 * PendingApprovalsView — WU-12B + S5 + WU-A (standardize-pending-approvals)
 *
 * Tenant-wide "Validaciones pendientes" tray showing PENDING time-off approval
 * requests across the whole tenant. The manager→subordinates model was removed
 * backend-side; any user with read:EmployeeTimeOff sees the same queue.
 *
 * Layout (WU-A — hybrid):
 *   - Page header: title "Validaciones pendientes", tenant-wide description
 *   - AppDataTable (client-side) with ViewToggle and #cards slot
 *   - Per-card Aprobar / Rechazar (CASL canReview + UModal confirmation)
 *   - Empty state: voseo, no "tu equipo" copy
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
 *   a `buildManagerMap` lookup. ZERO per-row `getById` calls — the prior
 *   per-row `useQueries(getById)` design was replaced because it scaled
 *   with the number of unique employees in the queue.
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
 *
 * Design: warm orange primary, Nuxt UI 4. Hybrid (table + cards) via
 * AppDataTable + ViewToggle; the card tray remains the DEFAULT view.
 */

import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { ColumnPinningState } from '@tanstack/vue-table'
import { AppDataTable } from '@/core/shared/components/DataTable'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import {
  paginateRows,
  pageAfterQueryChange,
  clampPage,
  FIRST_PAGE,
  DEFAULT_TABLE_PAGE_SIZE,
} from '@/core/shared/utils/pagination.utils'
import { TIME_OFF_TYPE, REVIEW_DECISION } from '../constants/employee.constants'
import type { ReviewDecisionValue } from '../constants/employee.constants'
import { usePendingApprovals } from '../composables/useReviewTimeOff'
import { useReviewTimeOff } from '../composables/useReviewTimeOff'
import { usePendingApprovalsViewMode } from '../composables/usePendingApprovalsViewMode'
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
import { employeesApi } from '../api/employees.api'
import type { TimeOffRequest, ReviewTimeOffDto, Employee } from '../interfaces/employee.types'
import { AVATAR_PALETTE } from '@/app/constants/avatarPalette'

// ─── Auth ──────────────────────────────────────────────────────────────────────

const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)

const canReview = computed(() => authStore.userCan('update', 'EmployeeTimeOff'))

// ─── Pending queue (tenant-wide) ─────────────────────────────────────────────

const {
  data: pendingRequests,
  isLoading,
  isError,
  error,
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

function getEmployeeName(employeeId: string): string {
  // S5: missing name → "—" (per spec scenario "Employee absent from cache").
  // The prior 'Colaborador' placeholder was generic and read as a real
  // employee name; '—' is the canonical "not resolved" sentinel.
  return employeeMap.value.get(employeeId)?.fullName ?? '—'
}

function getEmployeeInitials(employeeId: string): string {
  const name = employeeMap.value.get(employeeId)?.fullName ?? '—'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '—'
  )
}

function getAvatarClass(seedValue: string): string {
  const seed = seedValue.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[seed % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]!
}

// ─── View mode + table columns ────────────────────────────────────────────────

const { displayMode } = usePendingApprovalsViewMode()
const { columns } = usePendingApprovalsColumns()

// ─── Client-side search by resolved name (S5) ────────────────────────────────

const searchQuery = ref('')

/** Client-side filtered tray rows: search by resolved employee name. */
const filteredRequests = computed(() =>
  filterPendingBySearch(pendingRequests.value ?? [], employeeMap.value, searchQuery.value),
)

const queueNonEmpty = computed(() => (pendingRequests.value ?? []).length > 0)
const isSearchActive = computed(() => searchQuery.value.trim().length > 0)

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

// ─── Column visibility + right-pinning (REQ-3) ────────────────────────────────

const columnPinning = ref<ColumnPinningState>({ left: [], right: ['acciones'] })
const columnVisibility = ref<Record<string, boolean>>({})

// ─── Error message (REQ-5: backendMessage > error.message > fallback) ─────────

const FALLBACK_PENDING_ERROR =
  'No se pudieron cargar las solicitudes pendientes. Intenta de nuevo.'

const pendingErrorMessage = computed<string>(() => {
  const err = error.value as
    | {
        response?: { data?: { message?: string | string[] } }
        message?: string
      }
    | null
  if (!err) return FALLBACK_PENDING_ERROR

  const backendMsg = err.response?.data?.message
  if (typeof backendMsg === 'string' && backendMsg.length > 0) {
    return backendMsg
  }
  if (Array.isArray(backendMsg) && typeof backendMsg[0] === 'string' && backendMsg[0].length > 0) {
    return backendMsg[0]
  }

  if (typeof err.message === 'string' && err.message.length > 0) {
    return err.message
  }

  return FALLBACK_PENDING_ERROR
})

// ─── Review mutation ───────────────────────────────────────────────────────────

// We use a singleton employee ID from the first pending request for the mutation context.
// The review route is per-employee: POST /:employeeId/time-off/:timeOffId/review
const reviewingRequest = ref<TimeOffRequest | null>(null)
const reviewEmployeeId = computed(() => reviewingRequest.value?.employeeId ?? '')

const { mutateAsync: submitReview, isPending: isReviewing } =
  useReviewTimeOff(reviewEmployeeId)

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

function getTypeColor(type: string): 'primary' | 'warning' | 'error' | 'neutral' | 'success' {
  switch (type) {
    case TIME_OFF_TYPE.VACATION:
      return 'primary'
    case TIME_OFF_TYPE.SICK:
      return 'error'
    case TIME_OFF_TYPE.PERSONAL:
      return 'warning'
    case TIME_OFF_TYPE.UNPAID:
      return 'neutral'
    default:
      return 'neutral'
  }
}

// formatTimeOffDateRange is imported from useEmployeeColumns and shared with AusenciasPanel.
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <AdminPageHeader
            title="Validaciones pendientes"
            description="Solicitudes de ausencia de toda la organización que requieren validación."
          />
        </div>
      </template>

      <div class="px-6 py-5">
        <AppDataTable
          v-model:pagination="pagination"
          v-model:global-filter="searchQuery"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          :columns="columns"
          :data="paged.pageRows"
          :loading="isLoading"
          :error="isError"
          :error-message="pendingErrorMessage"
          :display-mode="displayMode"
          enable-column-visibility
          :show-toolbar="queueNonEmpty"
          :page-count="paged.pageCount"
          :total-count="paged.total"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="[10, 20, 50]"
          empty="Sin solicitudes pendientes"
          @refresh="() => refetch()"
        >
          <!-- Card slot: keeps the existing card tray markup alive for WU-B to
               extract; the toolbar/refresh/error block are now owned by
               AppDataTable. -->
          <template #cards="{ data }">
            <div class="flex flex-col gap-3">
              <!-- Summary count (after search) -->
              <p v-if="queueNonEmpty" class="text-sm text-muted">
                {{ filteredRequests.length }}
                {{
                  filteredRequests.length === 1
                    ? 'solicitud pendiente'
                    : 'solicitudes pendientes'
                }}
                <template
                  v-if="
                    isSearchActive && (pendingRequests?.length ?? 0) !== filteredRequests.length
                  "
                >
                  <span class="text-muted-foreground">
                    (de {{ pendingRequests?.length ?? 0 }} en total)
                  </span>
                </template>
              </p>

              <!-- No-match sub-state when the search filters everything out -->
              <div
                v-if="filteredRequests.length === 0 && isSearchActive"
                class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-default py-10 text-center"
              >
                <UIcon name="i-lucide-search-x" class="size-7 text-muted" />
                <p class="text-sm text-muted">
                  No hay coincidencias para «{{ searchQuery.trim() }}».
                </p>
              </div>

              <div
                v-for="request in data"
                :key="request.id"
                class="rounded-lg border border-default bg-elevated/30 p-4 transition-colors hover:bg-elevated/50"
              >
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <!-- Request info -->
                  <div class="flex flex-col gap-2">
                    <!-- Employee identity + type badge -->
                    <div class="flex items-center gap-2">
                      <div
                        class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold shadow-sm"
                        :class="getAvatarClass(request.employeeId)"
                        :aria-label="getEmployeeName(request.employeeId)"
                      >
                        {{ getEmployeeInitials(request.employeeId) }}
                      </div>
                      <span class="text-sm font-medium text-highlighted">
                        {{ getEmployeeName(request.employeeId) }}
                      </span>
                      <UBadge :color="getTypeColor(request.type)" variant="subtle" size="sm">
                        {{ formatTimeOffType(request.type) }}
                      </UBadge>
                    </div>

                    <!-- Date range + days -->
                    <div class="flex items-center gap-2 text-sm">
                      <UIcon name="i-lucide-calendar" class="size-4 shrink-0 text-muted" />
                      <span class="text-highlighted">
                        {{ formatTimeOffDateRange(request.startDate, request.endDate) }}
                      </span>
                      <span class="text-muted">
                        ({{ computeTimeOffDays(request.startDate, request.endDate) }}
                        {{
                          computeTimeOffDays(request.startDate, request.endDate) === 1
                            ? 'día'
                            : 'días'
                        }})
                      </span>
                    </div>

                    <!-- Reason (SICK guard: null = "Motivo médico reservado" per S5) -->
                    <div
                      v-if="resolveSickReason(request.type, request.reason) !== '—'"
                      class="flex items-start gap-2 text-sm"
                    >
                      <UIcon
                        name="i-lucide-message-square"
                        class="mt-0.5 size-4 shrink-0 text-muted"
                      />
                      <span
                        :class="[
                          request.type === TIME_OFF_TYPE.SICK && request.reason === null
                            ? 'italic text-muted'
                            : 'text-highlighted',
                        ]"
                      >
                        {{ resolveSickReason(request.type, request.reason) }}
                      </span>
                    </div>

                    <!-- Status chip -->
                    <div class="flex items-center gap-2">
                      <UBadge color="warning" variant="soft" size="sm">
                        {{ formatTimeOffStatus(request.status) }}
                      </UBadge>
                      <span class="text-xs text-muted">
                        Solicitada el
                        {{
                          new Date(request.createdAt).toLocaleDateString('es-MX', {
                            timeZone: 'UTC',
                          })
                        }}
                      </span>
                    </div>
                  </div>

                  <!-- Action buttons (gated by canReview) -->
                  <div v-if="canReview" class="flex shrink-0 items-center gap-2">
                    <UButton
                      icon="i-lucide-x"
                      color="error"
                      variant="soft"
                      size="sm"
                      :disabled="isReviewing"
                      @click="openReviewDialog(request, REVIEW_DECISION.REJECTED)"
                    >
                      Rechazar
                    </UButton>
                    <UButton
                      icon="i-lucide-check"
                      color="success"
                      variant="soft"
                      size="sm"
                      :disabled="isReviewing"
                      @click="openReviewDialog(request, REVIEW_DECISION.APPROVED)"
                    >
                      Aprobar
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </AppDataTable>
      </div>
    </UCard>

    <!-- Review confirmation dialog -->
    <UModal v-model:open="isReviewDialogOpen">
      <template #content>
        <UCard v-if="reviewingRequest">
          <template #header>
            <h3 class="text-base font-semibold">
              {{
                reviewDecision === REVIEW_DECISION.APPROVED
                  ? 'Aprobar solicitud de ausencia'
                  : 'Rechazar solicitud de ausencia'
              }}
            </h3>
          </template>

          <div class="flex flex-col gap-4">
            <!-- Summary -->
            <div class="rounded-md bg-elevated p-3 text-sm">
              <p class="font-medium text-highlighted">
                {{ formatTimeOffType(reviewingRequest.type) }} —
                {{ formatTimeOffDateRange(reviewingRequest.startDate, reviewingRequest.endDate) }}
              </p>
              <p class="text-xs text-muted">
                {{ computeTimeOffDays(reviewingRequest.startDate, reviewingRequest.endDate) }} días
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
                :disabled="isReviewing"
                @click="cancelReview"
              >
                Cancelar
              </UButton>
              <UButton
                :color="reviewDecision === REVIEW_DECISION.APPROVED ? 'success' : 'error'"
                :loading="isReviewing"
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