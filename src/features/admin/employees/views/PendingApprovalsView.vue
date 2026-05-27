<script setup lang="ts">
/**
 * PendingApprovalsView — WU-12B
 *
 * Tenant-wide dashboard showing PENDING time-off approval requests
 * for the current user as manager.
 *
 * Layout:
 *   - Page header
 *   - Approval cards/rows: employee, type, dates, days, reason (SICK guard), actions
 *   - Empty state: "Sin solicitudes pendientes"
 *   - Loading skeleton
 *
 * Permission gate: read:EmployeeTimeOff (enforced at route level).
 * Review action gated by update:EmployeeTimeOff.
 *
 * Backend constraint (§4.5):
 *   GET /admin/employees-time-off/pending-approvals?managerId=...
 *   Route uses HYPHEN (employees-time-off) — NOT under /:employeeId.
 *   Returns array of PENDING requests for direct subordinates of managerId.
 *   SICK reason is null if caller lacks read:EmployeeTimeOffMedical (Tier 3 stripping).
 *   NEVER send tenantId.
 *
 * Design: warm orange primary, Nuxt UI 4. Card-based list for easy scanning.
 */

import { computed, ref } from 'vue'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { usePendingApprovals } from '../composables/useReviewTimeOff'
import { useReviewTimeOff } from '../composables/useReviewTimeOff'
import {
  formatTimeOffType,
  formatTimeOffStatus,
  computeTimeOffDays,
  resolveSickReason,
} from '../composables/useAusencias'
import type { TimeOffRequest, ReviewTimeOffDto } from '../interfaces/employee.types'

// ─── Auth + manager id ─────────────────────────────────────────────────────────

const authStore = useAuthStore()

// Manager ID: the current user's employee ID — the backend resolves this.
// The user managing approvals is identified by their profile's employee record.
// We use authStore.user?.id as the managerId passed to the query.
const managerId = computed(() => authStore.user?.id ?? '')

const canReview = computed(() => authStore.userCan('update', 'EmployeeTimeOff'))

// ─── Query ─────────────────────────────────────────────────────────────────────

const { data: pendingRequests, isLoading, isError, refetch } = usePendingApprovals(managerId)

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
    // Error toast handled by mutation onError
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

function formatDateRange(startDate: string, endDate: string): string {
  const fmt = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${fmt.format(new Date(startDate))} – ${fmt.format(new Date(endDate))}`
}
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <AdminPageHeader
            title="Aprobaciones pendientes"
            description="Solicitudes de ausencia que requieren tu revisión"
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

        <!-- Empty state -->
        <div
          v-else-if="!pendingRequests || pendingRequests.length === 0"
          class="flex flex-col items-center gap-3 py-16 text-center"
        >
          <div class="flex size-16 items-center justify-center rounded-full bg-success/10">
            <UIcon name="i-lucide-check-circle-2" class="size-8 text-success" />
          </div>
          <div>
            <p class="font-medium text-highlighted">Sin solicitudes pendientes</p>
            <p class="mt-1 text-sm text-muted">
              Todas las solicitudes de tu equipo están al día.
            </p>
          </div>
        </div>

        <!-- Pending approvals list -->
        <div v-else class="flex flex-col gap-3">
          <!-- Summary count -->
          <p class="text-sm text-muted">
            {{ pendingRequests.length }}
            {{ pendingRequests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes' }}
          </p>

          <div
            v-for="request in pendingRequests"
            :key="request.id"
            class="rounded-lg border border-default bg-elevated/30 p-4 transition-colors hover:bg-elevated/50"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <!-- Request info -->
              <div class="flex flex-col gap-2">
                <!-- Employee ID + type badge -->
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-user" class="size-4 shrink-0 text-muted" />
                  <span class="font-mono text-xs text-muted">{{ request.employeeId }}</span>
                  <UBadge :color="getTypeColor(request.type)" variant="subtle" size="sm">
                    {{ formatTimeOffType(request.type) }}
                  </UBadge>
                </div>

                <!-- Date range + days -->
                <div class="flex items-center gap-2 text-sm">
                  <UIcon name="i-lucide-calendar" class="size-4 shrink-0 text-muted" />
                  <span class="text-highlighted">
                    {{ formatDateRange(request.startDate, request.endDate) }}
                  </span>
                  <span class="text-muted">
                    ({{ computeTimeOffDays(request.startDate, request.endDate) }}
                    {{ computeTimeOffDays(request.startDate, request.endDate) === 1 ? 'día' : 'días' }})
                  </span>
                </div>

                <!-- Reason (SICK guard: null = Confidencial) -->
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
                {{ formatDateRange(reviewingRequest.startDate, reviewingRequest.endDate) }}
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
