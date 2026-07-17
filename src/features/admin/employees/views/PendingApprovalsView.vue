<script setup lang="ts">
/**
 * PendingApprovalsView — WU-12B + S5 (hr-validation-notifications)
 *
 * Tenant-wide "Validaciones pendientes" tray showing PENDING time-off approval
 * requests across the whole tenant. The manager→subordinates model was removed
 * backend-side; any user with read:EmployeeTimeOff sees the same queue.
 *
 * Layout (S5):
 *   - Page header: title "Validaciones pendientes", tenant-wide description
 *   - Search box (client-side) filtering by resolved employee name
 *   - Approval cards/rows: employee, type, dates, days, reason (SICK guard), actions
 *   - Empty state: voseo, no "tu equipo" copy
 *   - Loading skeleton
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
 * Design: warm orange primary, Nuxt UI 4. Card-based list for easy scanning.
 */

import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { usePendingApprovals } from '../composables/useReviewTimeOff'
import { useReviewTimeOff } from '../composables/useReviewTimeOff'
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

// ─── Auth ──────────────────────────────────────────────────────────────────────

const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)

const canReview = computed(() => authStore.userCan('update', 'EmployeeTimeOff'))

// ─── Pending queue (tenant-wide) ─────────────────────────────────────────────

const { data: pendingRequests, isLoading, isError, refetch } = usePendingApprovals()

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

const AVATAR_PALETTE = [
  'bg-amber-500 text-white',
  'bg-pink-500 text-white',
  'bg-violet-500 text-white',
  'bg-red-500 text-white',
  'bg-cyan-500 text-white',
  'bg-emerald-500 text-white',
  'bg-blue-500 text-white',
]

function getAvatarClass(seedValue: string): string {
  const seed = seedValue.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[seed % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]!
}

// ─── Client-side search by resolved name (S5) ────────────────────────────────

const searchQuery = ref('')

/** View-side computed that mirrors `computeTrayRows` (S5 runtime test). */
const filteredRequests = computed(() =>
  filterPendingBySearch(pendingRequests.value ?? [], employeeMap.value, searchQuery.value),
)

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)

// ─── Review mutation ───────────────────────────────────────────────────────────

// We use a singleton employee ID from the first pending request for the mutation context.
// The review route is per-employee: POST /:employeeId/time-off/:timeOffId/review
const reviewingRequest = ref<TimeOffRequest | null>(null)
const reviewEmployeeId = computed(() => reviewingRequest.value?.employeeId ?? '')

const { mutateAsync: submitReview, isPending: isReviewing } =
  useReviewTimeOff(reviewEmployeeId)

const isReviewDialogOpen = ref(false)
const reviewDecision = ref<'APPROVED' | 'REJECTED' | null>(null)
const reviewerNotes = ref('')

function openReviewDialog(request: TimeOffRequest, decision: 'APPROVED' | 'REJECTED'): void {
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
    case 'VACATION':
      return 'primary'
    case 'SICK':
      return 'error'
    case 'PERSONAL':
      return 'warning'
    case 'UNPAID':
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
          <UButton
            icon="i-lucide-refresh-cw"
            variant="ghost"
            color="neutral"
            size="sm"
            :loading="isLoading"
            @click="() => refetch()"
          >
            Actualizar
          </UButton>
        </div>
      </template>

      <div class="px-6 py-5">
        <!-- Loading state -->
        <div v-if="isLoading" class="flex flex-col gap-3">
          <USkeleton v-for="i in 3" :key="i" class="h-20 w-full rounded-lg" />
        </div>

        <!-- Error state -->
        <div v-else-if="isError" class="flex flex-col items-center gap-3 py-12 text-center">
          <UIcon name="i-lucide-alert-triangle" class="size-10 text-error" />
          <p class="text-sm text-muted">
            No se pudo cargar las solicitudes pendientes. Intentá de nuevo.
          </p>
        </div>

        <!-- Empty state (no requests at all) -->
        <div
          v-else-if="!pendingRequests || pendingRequests.length === 0"
          class="flex flex-col items-center gap-3 py-16 text-center"
        >
          <div class="flex size-16 items-center justify-center rounded-full bg-success/10">
            <UIcon name="i-lucide-check-circle-2" class="size-8 text-success" />
          </div>
          <div class="max-w-md space-y-1">
            <p class="font-medium text-highlighted">Sin solicitudes pendientes</p>
            <p class="text-sm text-muted">
              No hay solicitudes de ausencia esperando validación en la organización.
            </p>
          </div>
        </div>

        <!-- Loaded: show search + filtered list (or no-match sub-state) -->
        <div v-else class="flex flex-col gap-3">
          <!-- Search by employee name (S5) -->
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Buscar por nombre del colaborador..."
            size="sm"
            class="w-full sm:max-w-sm"
            data-testid="pending-search-input"
          />

          <!-- Summary count (after search) -->
          <p class="text-sm text-muted">
            {{ filteredRequests.length }}
            {{
              filteredRequests.length === 1
                ? 'solicitud pendiente'
                : 'solicitudes pendientes'
            }}
            <template v-if="isSearchActive && (pendingRequests?.length ?? 0) !== filteredRequests.length">
              <span class="text-muted-foreground">
                (de {{ pendingRequests?.length ?? 0 }} en total)
              </span>
            </template>
          </p>

          <!-- No-match sub-state when the search filters everything out -->
          <div
            v-if="filteredRequests.length === 0"
            class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-default py-10 text-center"
          >
            <UIcon name="i-lucide-search-x" class="size-7 text-muted" />
            <p class="text-sm text-muted">
              No hay coincidencias para «{{ searchQuery.trim() }}».
            </p>
          </div>

          <div
            v-for="request in filteredRequests"
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
                    {{ computeTimeOffDays(request.startDate, request.endDate) === 1 ? 'día' : 'días' }})
                  </span>
                </div>

                <!-- Reason (SICK guard: null = "Motivo médico reservado" per S5) -->
                <div
                  v-if="resolveSickReason(request.type, request.reason) !== '—'"
                  class="flex items-start gap-2 text-sm"
                >
                  <UIcon name="i-lucide-message-square" class="mt-0.5 size-4 shrink-0 text-muted" />
                  <span
                    :class="[
                      request.type === 'SICK' && request.reason === null
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
                    Solicitada el {{ new Date(request.createdAt).toLocaleDateString('es-MX', { timeZone: 'UTC' }) }}
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
                  @click="openReviewDialog(request, 'REJECTED')"
                >
                  Rechazar
                </UButton>
                <UButton
                  icon="i-lucide-check"
                  color="success"
                  variant="soft"
                  size="sm"
                  :disabled="isReviewing"
                  @click="openReviewDialog(request, 'APPROVED')"
                >
                  Aprobar
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Review confirmation dialog -->
    <UModal v-model:open="isReviewDialogOpen">
      <template #content>
        <UCard v-if="reviewingRequest">
          <template #header>
            <h3 class="text-base font-semibold">
              {{
                reviewDecision === 'APPROVED'
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
                  reviewDecision === 'REJECTED'
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
                :color="reviewDecision === 'APPROVED' ? 'success' : 'error'"
                :loading="isReviewing"
                @click="confirmReview"
              >
                {{
                  reviewDecision === 'APPROVED' ? 'Confirmar aprobación' : 'Confirmar rechazo'
                }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
