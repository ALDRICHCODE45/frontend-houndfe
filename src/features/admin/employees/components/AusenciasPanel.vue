<script setup lang="ts">
/**
 * AusenciasPanel — WU-11 (review wiring)
 *
 * Ausencias tab panel for the Employee Detail View.
 *
 * Layout:
 *   1. Vacation balance card (year at a glance)
 *   2. Time-off list with status badges
 *      - Filter by year (current year default)
 *      - Per-row: type badge, dates, day count, reason, status
 *      - Cancel button (gated by canUpdate + canCancelTimeOff logic)
 *      - Review button — APPROVED / REJECTED (gated by canReview = can('update', 'EmployeeTimeOff'))
 *   3. "Solicitar ausencia" button (gated by canCreate = can('create', 'EmployeeTimeOff'))
 *
 * CASL gates:
 *   - Read: can('read', 'EmployeeTimeOff') — enforced at route level
 *   - Create (request): can('create', 'EmployeeTimeOff')
 *   - Cancel / Review: can('update', 'EmployeeTimeOff')
 *   - SICK reason visibility: can('read', 'EmployeeTimeOffMedical') — server-side stripped
 *
 * Backend constraints (§4.5):
 *   - Review: POST /:employeeId/time-off/:timeOffId/review — PENDING only
 *   - Cancel: POST /:employeeId/time-off/:timeOffId/cancel — PENDING or future APPROVED
 *   - Pending approvals: GET /admin/employees-time-off/pending-approvals?managerId=...
 *   - NEVER send tenantId.
 */

import { computed, reactive, ref } from 'vue'
import DateFieldPopover from '@/features/POS/sales/components/DateFieldPopover.vue'
import type { Employee } from '../interfaces/employee.types'
import { ReviewTimeOffDtoSchema, CreateTimeOffDtoSchema } from '../interfaces/employee.types'
import {
  useEmployeeTimeOff,
  useVacationBalance,
  useCreateTimeOff,
  useCancelTimeOff,
  formatTimeOffType,
  formatTimeOffStatus,
  computeTimeOffDays,
  resolveSickReason,
  canCancelTimeOff,
} from '../composables/useAusencias'
import { useReviewTimeOff } from '../composables/useReviewTimeOff'
import { formatTimeOffDateRange } from '../composables/useEmployeeColumns'

// ─── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  employee: Employee
  canCreate: boolean
  canUpdate: boolean
}>()

// ─── Queries & mutations ──────────────────────────────────────────────────────

const employeeId = computed(() => props.employee.id)

const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)

const { data: timeOffResponse, isLoading: isLoadingList } = useEmployeeTimeOff(
  employeeId,
  selectedYear,
)
const { data: balance, isLoading: isLoadingBalance } = useVacationBalance(employeeId, selectedYear)

const { mutateAsync: requestTimeOff, isPending: isRequesting } = useCreateTimeOff(employeeId)
const { mutateAsync: cancelTimeOff, isPending: isCancelling } = useCancelTimeOff(employeeId)
const { mutateAsync: reviewTimeOff, isPending: isReviewing } = useReviewTimeOff(employeeId)

// ─── Derived data ─────────────────────────────────────────────────────────────

const timeOffList = computed(() => timeOffResponse.value?.data ?? [])

// ─── Request form state ───────────────────────────────────────────────────────

const isRequestOpen = ref(false)
const requestForm = reactive({
  type: 'VACATION' as const,
  startDate: '',
  endDate: '',
  reason: '',
})
const requestError = ref<string | null>(null)

async function submitRequest(): Promise<void> {
  requestError.value = null
  const parseResult = CreateTimeOffDtoSchema.safeParse({
    type: requestForm.type,
    startDate: requestForm.startDate,
    endDate: requestForm.endDate,
    reason: requestForm.reason || undefined,
  })
  if (!parseResult.success) {
    requestError.value = 'Verificá los datos del formulario.'
    return
  }
  try {
    await requestTimeOff(parseResult.data)
    isRequestOpen.value = false
    requestForm.type = 'VACATION'
    requestForm.startDate = ''
    requestForm.endDate = ''
    requestForm.reason = ''
  } catch {
    requestError.value = 'Error al enviar la solicitud. Intentá de nuevo.'
  }
}

// ─── Cancel handler ───────────────────────────────────────────────────────────

const cancellingId = ref<string | null>(null)

async function handleCancel(timeOffId: string): Promise<void> {
  cancellingId.value = timeOffId
  try {
    await cancelTimeOff(timeOffId)
  } finally {
    cancellingId.value = null
  }
}

// ─── Review form state ────────────────────────────────────────────────────────

const isReviewOpen = ref(false)
const reviewingId = ref<string | null>(null)
const reviewForm = reactive({
  decision: 'APPROVED' as 'APPROVED' | 'REJECTED',
  reviewerNotes: '',
})
const reviewError = ref<string | null>(null)

function openReview(timeOffId: string): void {
  reviewingId.value = timeOffId
  reviewForm.decision = 'APPROVED'
  reviewForm.reviewerNotes = ''
  reviewError.value = null
  isReviewOpen.value = true
}

async function submitReview(): Promise<void> {
  if (!reviewingId.value) return
  reviewError.value = null

  const parseResult = ReviewTimeOffDtoSchema.safeParse({
    decision: reviewForm.decision,
    reviewerNotes: reviewForm.reviewerNotes || undefined,
  })

  if (!parseResult.success) {
    reviewError.value = 'Las notas no pueden superar los 500 caracteres.'
    return
  }

  try {
    await reviewTimeOff({ timeOffId: reviewingId.value, dto: parseResult.data })
    isReviewOpen.value = false
    reviewingId.value = null
  } catch {
    reviewError.value = 'Error al procesar la revisión. Intentá de nuevo.'
  }
}

// ─── Year options ─────────────────────────────────────────────────────────────

const yearOptions = computed(() => {
  const years: { label: string; value: number }[] = []
  for (let y = currentYear + 1; y >= currentYear - 2; y--) {
    years.push({ label: String(y), value: y })
  }
  return years
})

// ─── Time-off type options (Spanish labels) ──────────────────────────────────

const TIME_OFF_TYPE_OPTIONS = [
  { label: 'Vacaciones', value: 'VACATION' },
  { label: 'Enfermedad', value: 'SICK' },
  { label: 'Personal', value: 'PERSONAL' },
  { label: 'Sin goce de sueldo', value: 'UNPAID' },
] as const

// ─── Review decision options ─────────────────────────────────────────────────

const REVIEW_DECISION_OPTIONS = [
  { label: 'Aprobar', value: 'APPROVED' },
  { label: 'Rechazar', value: 'REJECTED' },
] as const

// ─── Status badge color helper ────────────────────────────────────────────────

function statusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'error',
    CANCELLED: 'neutral',
  }
  return map[status] ?? 'neutral'
}

// ─── Type badge color helper ──────────────────────────────────────────────────

function typeColor(type: string): string {
  const map: Record<string, string> = {
    VACATION: 'primary',
    SICK: 'error',
    PERSONAL: 'secondary',
    UNPAID: 'neutral',
  }
  return map[type] ?? 'neutral'
}
</script>

<template>
  <div class="flex flex-col gap-6">

    <!-- Balance card -->
    <div
      v-if="isLoadingBalance"
      class="h-24 animate-pulse rounded-xl bg-elevated"
    />
    <div
      v-else-if="balance"
      class="grid grid-cols-2 gap-4 rounded-xl border border-default bg-elevated/40 p-5 sm:grid-cols-4"
    >
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-muted">Asignadas</span>
        <span class="text-2xl font-semibold text-highlighted">{{ balance.entitlement }}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-muted">Usadas</span>
        <span class="text-2xl font-semibold text-highlighted">{{ balance.used }}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-muted">Pendientes</span>
        <span class="text-2xl font-semibold text-warning">{{ balance.pending }}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-muted">Disponibles</span>
        <span class="text-2xl font-semibold text-success">{{ balance.remaining }}</span>
      </div>
    </div>

    <!-- Controls row: year selector + request button -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted">Año:</span>
        <USelect
          v-model="selectedYear"
          :items="yearOptions"
          value-key="value"
          label-key="label"
          size="sm"
        />
      </div>
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        size="sm"
        @click="isRequestOpen = true"
      >
        Solicitar ausencia
      </UButton>
    </div>

    <!-- Time-off list -->
    <div class="rounded-xl border border-default bg-elevated/30">
      <!-- Loading -->
      <div v-if="isLoadingList" class="flex flex-col gap-3 p-5">
        <div v-for="n in 3" :key="n" class="h-14 animate-pulse rounded-lg bg-elevated" />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="timeOffList.length === 0"
        class="flex flex-col items-center justify-center gap-3 py-14 text-center"
      >
        <UIcon name="i-lucide-calendar-off" class="size-9 text-muted opacity-60" />
        <div>
          <p class="font-medium text-highlighted">Sin ausencias registradas</p>
          <p class="text-sm text-muted">No hay solicitudes de ausencia para {{ selectedYear }}.</p>
        </div>
      </div>

      <!-- List -->
      <ul v-else class="divide-y divide-default">
        <li
          v-for="item in timeOffList"
          :key="item.id"
          class="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <UBadge :color="typeColor(item.type)" variant="subtle" size="xs">
                {{ formatTimeOffType(item.type) }}
              </UBadge>
              <UBadge :color="statusColor(item.status)" variant="subtle" size="xs">
                {{ formatTimeOffStatus(item.status) }}
              </UBadge>
            </div>
            <p class="text-sm font-medium text-highlighted">
              {{ formatTimeOffDateRange(item.startDate, item.endDate) }}
              <span class="font-normal text-muted">
                ({{ computeTimeOffDays(item.startDate, item.endDate) }}
                {{ computeTimeOffDays(item.startDate, item.endDate) === 1 ? 'día' : 'días' }})
              </span>
            </p>
            <p v-if="item.reason !== undefined" class="text-xs text-muted">
              {{ resolveSickReason(item.type, item.reason) }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2">
            <!-- Review button — only for PENDING items, requires canUpdate -->
            <UButton
              v-if="canUpdate && item.status === 'PENDING'"
              size="xs"
              color="primary"
              variant="outline"
              icon="i-lucide-check-circle"
              :loading="isReviewing && reviewingId === item.id"
              @click="openReview(item.id)"
            >
              Revisar
            </UButton>

            <!-- Cancel button -->
            <UButton
              v-if="canUpdate && canCancelTimeOff(item.status, item.startDate)"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x-circle"
              :loading="isCancelling && cancellingId === item.id"
              @click="handleCancel(item.id)"
            >
              Cancelar
            </UButton>
          </div>
        </li>
      </ul>
    </div>

  </div>

  <!-- Request time-off modal -->
  <UModal v-model:open="isRequestOpen" title="Solicitar ausencia">
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField label="Tipo">
          <USelect
            v-model="requestForm.type"
            :items="TIME_OFF_TYPE_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Seleccionar tipo"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Fecha inicio">
          <DateFieldPopover
            v-model="requestForm.startDate"
            placeholder="Elegir fecha inicio"
            :min-iso="null"
          />
        </UFormField>
        <UFormField label="Fecha fin">
          <DateFieldPopover
            v-model="requestForm.endDate"
            placeholder="Elegir fecha fin"
            :min-iso="requestForm.startDate"
          />
        </UFormField>
        <UFormField label="Motivo (opcional)">
          <UTextarea
            v-model="requestForm.reason"
            placeholder="Motivo de la ausencia..."
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <p v-if="requestError" class="text-sm text-error">{{ requestError }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isRequestOpen = false">
          Cancelar
        </UButton>
        <UButton :loading="isRequesting" @click="submitRequest">
          Solicitar
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Review modal -->
  <UModal v-model:open="isReviewOpen" title="Revisar solicitud">
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField label="Decisión">
          <URadioGroup
            v-model="reviewForm.decision"
            :items="REVIEW_DECISION_OPTIONS"
            value-key="value"
            label-key="label"
          />
        </UFormField>
        <UFormField label="Notas (opcional, máx. 500 caracteres)">
          <UTextarea
            v-model="reviewForm.reviewerNotes"
            placeholder="Notas para el colaborador..."
            :rows="3"
            :maxlength="500"
            class="w-full"
          />
        </UFormField>
        <p v-if="reviewError" class="text-sm text-error">{{ reviewError }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isReviewOpen = false">
          Cancelar
        </UButton>
        <UButton :loading="isReviewing" @click="submitReview">
          Confirmar
        </UButton>
      </div>
    </template>
  </UModal>
</template>
