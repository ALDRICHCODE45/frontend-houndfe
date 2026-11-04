<script setup lang="ts">
/**
 * AusenciasPanel — WU-11 + S6 (hr-validation-notifications)
 *
 * Ausencias tab panel for the Employee Detail View.
 *
 * Layout:
 *   1. Vacation balance card (year at a glance)
 *   2. Time-off list with a StatusBadge per request
 *      - Filter by year (current year default)
 *      - Per-row: dates and day count, then type and reason, then status
 *      - ⋮ menu: Revisar… (PENDING, gated by canReview = can('update', 'EmployeeTimeOff'))
 *        and Cancelar solicitud (destructive, last; canCancelTimeOff logic)
 *      - Four states (S10): skeleton, error with Reintentar, empty, data
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
 *   - Pending approvals: GET /admin/employees-time-off/pending-approvals (tenant-wide, no managerId)
 *   - NEVER send tenantId.
 *
 * S6 hardening:
 *   - submitRequest surfaces the SPECIFIC voseo Zod issue message via
 *     `firstZodIssueMessage` (e.g. "La fecha de fin debe ser igual o
 *     posterior a la fecha de inicio") instead of the prior generic.
 *   - submitRequest mutation error → `resolveCreateErrorMessage` (real
 *     400 TIME_OFF_INVALID_DATE_RANGE voseo or joined Nest array).
 *   - Cancel mutation error is surfaced by `useCancelTimeOff.onError`
 *     via `resolveCancelErrorMessage` (real 409
 *     TIME_OFF_INVALID_TRANSITION voseo).
 */

import { computed, reactive, ref } from 'vue'
import DateFieldPopover from '@/features/POS/sales/components/DateFieldPopover.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { TIME_OFF_STATUS, TIME_OFF_TYPE, REVIEW_DECISION } from '../constants/employee.constants'
import type { ReviewDecisionValue } from '../constants/employee.constants'
import type { Employee, TimeOffStatus } from '../interfaces/employee.types'
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
  firstZodIssueMessage,
  resolveCreateErrorMessage,
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

const {
  data: timeOffResponse,
  isLoading: isLoadingList,
  isError: isListError,
  refetch: refetchList,
} = useEmployeeTimeOff(employeeId, selectedYear)
const { data: balance, isLoading: isLoadingBalance } = useVacationBalance(employeeId, selectedYear)

const { mutateAsync: requestTimeOff, isPending: isRequesting } = useCreateTimeOff(employeeId)
const { mutateAsync: cancelTimeOff, isPending: isCancelling } = useCancelTimeOff(employeeId)
const { mutateAsync: reviewTimeOff, isPending: isReviewing } = useReviewTimeOff(employeeId)

// ─── Derived data ─────────────────────────────────────────────────────────────

const timeOffList = computed(() => timeOffResponse.value?.data ?? [])

// ─── Request form state ───────────────────────────────────────────────────────

const isRequestOpen = ref(false)
const requestForm = reactive({
  type: TIME_OFF_TYPE.VACATION,
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
    // S6: surface the SPECIFIC voseo message from the schema (e.g.
    // "La fecha de fin debe ser igual o posterior a la fecha de
    // inicio") instead of the prior generic "Verifica los datos del
    // formulario." Falls back to a generic only if the error carries
    // no issue (defensive — should never happen with safeParse).
    requestError.value =
      firstZodIssueMessage(parseResult.error) ??
      'Verifica los datos del formulario.'
    return
  }
  try {
    await requestTimeOff(parseResult.data)
    isRequestOpen.value = false
    requestForm.type = TIME_OFF_TYPE.VACATION
    requestForm.startDate = ''
    requestForm.endDate = ''
    requestForm.reason = ''
  } catch (err) {
    // S6: route the mutation error through `resolveCreateErrorMessage`
    // so the user sees the REAL 400 TIME_OFF_INVALID_DATE_RANGE voseo
    // message OR a joined Nest class-validator array — never the prior
    // generic "Error al enviar la solicitud. Intenta de nuevo."
    requestError.value = resolveCreateErrorMessage(err)
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
  decision: REVIEW_DECISION.APPROVED as ReviewDecisionValue,
  reviewerNotes: '',
})
const reviewError = ref<string | null>(null)

function openReview(timeOffId: string): void {
  reviewingId.value = timeOffId
  reviewForm.decision = REVIEW_DECISION.APPROVED
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
    reviewError.value = 'Error al procesar la revisión. Intenta de nuevo.'
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
  { label: 'Vacaciones', value: TIME_OFF_TYPE.VACATION },
  { label: 'Enfermedad', value: TIME_OFF_TYPE.SICK },
  { label: 'Personal', value: TIME_OFF_TYPE.PERSONAL },
  { label: 'Sin goce de sueldo', value: TIME_OFF_TYPE.UNPAID },
] as const

// ─── Review decision options ─────────────────────────────────────────────────

const REVIEW_DECISION_OPTIONS = [
  { label: 'Aprobar', value: REVIEW_DECISION.APPROVED },
  { label: 'Rechazar', value: REVIEW_DECISION.REJECTED },
] as const

// ─── Status badge tone ────────────────────────────────────────────────────────
// Pending is the only state that needs action (warning). A decision or a
// cancellation closes the request, so rejected and cancelled stay neutral.

type TimeOffTone = 'warning' | 'success' | 'neutral'

function statusTone(status: string): TimeOffTone {
  const map: Record<string, TimeOffTone> = {
    [TIME_OFF_STATUS.PENDING]: 'warning',
    [TIME_OFF_STATUS.APPROVED]: 'success',
    [TIME_OFF_STATUS.REJECTED]: 'neutral',
    [TIME_OFF_STATUS.CANCELLED]: 'neutral',
  }
  return map[status] ?? 'neutral'
}

// ─── Row menu ─────────────────────────────────────────────────────────────────

function rowActionsFor(item: { status: TimeOffStatus; startDate: string }): RowAction[] {
  const actions: RowAction[] = []
  if (props.canUpdate && item.status === TIME_OFF_STATUS.PENDING) {
    actions.push({ key: 'review', label: 'Revisar…', icon: 'i-lucide-clipboard-check' })
  }
  if (props.canUpdate && canCancelTimeOff(item.status, item.startDate)) {
    actions.push({
      key: 'cancel',
      label: 'Cancelar solicitud',
      icon: 'i-lucide-x-circle',
      destructive: true,
      disabled: isCancelling.value,
    })
  }
  return actions
}

function onRowAction(key: string, timeOffId: string): void {
  if (key === 'review') openReview(timeOffId)
  else if (key === 'cancel') void handleCancel(timeOffId)
}
</script>

<template>
  <div class="flex flex-col gap-6">

    <!-- Balance -->
    <div
      v-if="isLoadingBalance"
      class="h-24 animate-pulse rounded-xl bg-(--hf-surface-muted)"
      aria-busy="true"
      data-testid="balance-skeleton"
    />
    <UCard v-else-if="balance" class="employees-detail-section" :ui="{ body: 'p-5 sm:p-5' }">
      <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="vacation-balance">
        <div class="flex flex-col gap-0.5">
          <dt class="text-[13px] text-muted">Asignadas</dt>
          <dd class="hf-figure text-2xl font-semibold text-highlighted">{{ balance.entitlement }}</dd>
        </div>
        <div class="flex flex-col gap-0.5">
          <dt class="text-[13px] text-muted">Usadas</dt>
          <dd class="hf-figure text-2xl font-semibold text-highlighted">{{ balance.used }}</dd>
        </div>
        <div class="flex flex-col gap-0.5">
          <dt class="text-[13px] text-muted">Pendientes</dt>
          <dd class="hf-figure text-2xl font-semibold text-(--hf-warning)">{{ balance.pending }}</dd>
        </div>
        <div class="flex flex-col gap-0.5">
          <dt class="text-[13px] text-muted">Disponibles</dt>
          <dd class="hf-figure text-2xl font-semibold text-highlighted">{{ balance.remaining }}</dd>
        </div>
      </dl>
    </UCard>

    <!-- Controls row: year selector + request button -->
    <div class="flex items-center justify-between gap-3">
      <USelect
        v-model="selectedYear"
        :items="yearOptions"
        value-key="value"
        label-key="label"
        aria-label="Año"
        class="w-28"
        :ui="{ content: 'hf-theme hf-ui employees-list-portal' }"
      />
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        @click="isRequestOpen = true"
      >
        Solicitar ausencia
      </UButton>
    </div>

    <!-- Time-off list -->
    <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Loading -->
      <div
        v-if="isLoadingList"
        class="flex flex-col gap-3 p-5"
        aria-busy="true"
        data-testid="time-off-skeleton"
      >
        <span class="sr-only">Cargando</span>
        <div v-for="n in 3" :key="n" class="h-14 animate-pulse rounded-lg bg-(--hf-surface-muted)" aria-hidden="true" />
      </div>

      <!-- Error -->
      <div v-else-if="isListError" class="p-5" data-testid="time-off-error">
        <EmptyState
          kind="error"
          title="No se pudieron cargar las ausencias"
          action-label="Reintentar"
          action-test-id="time-off-retry"
          @action="() => refetchList()"
        />
      </div>

      <!-- Empty -->
      <div v-else-if="timeOffList.length === 0" class="p-5" data-testid="time-off-empty">
        <EmptyState
          :title="`Sin ausencias en ${selectedYear}`"
          description="Aquí aparecerán las solicitudes del colaborador."
          icon="i-lucide-calendar-off"
        />
      </div>

      <!-- List -->
      <ul v-else class="divide-y divide-default">
        <li
          v-for="item in timeOffList"
          :key="item.id"
          class="flex items-center gap-3 px-5 py-3"
          data-testid="time-off-row"
        >
          <div class="min-w-0 flex-1">
            <p class="hf-row-primary">
              {{ formatTimeOffDateRange(item.startDate, item.endDate) }}
              <span class="font-normal text-muted">
                · {{ computeTimeOffDays(item.startDate, item.endDate) }}
                {{ computeTimeOffDays(item.startDate, item.endDate) === 1 ? 'día' : 'días' }}
              </span>
            </p>
            <p class="hf-row-secondary">
              {{ formatTimeOffType(item.type) }}<template v-if="item.reason !== undefined"> · {{ resolveSickReason(item.type, item.reason) }}</template>
            </p>
          </div>

          <StatusBadge :tone="statusTone(item.status)" :label="formatTimeOffStatus(item.status)" />

          <RowActionsMenu
            :actions="rowActionsFor(item)"
            :row-label="`la ausencia del ${formatTimeOffDateRange(item.startDate, item.endDate)}`"
            portal-class="employees-list-portal"
            @select="onRowAction($event, item.id)"
          />
        </li>
      </ul>
    </UCard>

  </div>

  <!-- Request time-off modal -->
  <UModal :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }" v-model:open="isRequestOpen" title="Solicitar ausencia">
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField label="Tipo">
          <USelect :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }"
            v-model="requestForm.type"
            :items="TIME_OFF_TYPE_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Seleccionar tipo"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Fecha inicio">
          <DateFieldPopover portal-class="hf-theme hf-ui hf-form-overlay employees-form-portal"
            v-model="requestForm.startDate"
            placeholder="Elegir fecha inicio"
            :min-iso="null"
          />
        </UFormField>
        <UFormField label="Fecha fin">
          <DateFieldPopover portal-class="hf-theme hf-ui hf-form-overlay employees-form-portal"
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
        <p v-if="requestError" class="text-sm text-(--hf-danger)" role="alert">{{ requestError }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton :loading="isRequesting" @click="submitRequest">
          Solicitar
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Review modal -->
  <UModal :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }" v-model:open="isReviewOpen" title="Revisar solicitud">
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
        <p v-if="reviewError" class="text-sm text-(--hf-danger)" role="alert">{{ reviewError }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton :loading="isReviewing" @click="submitReview">
          Confirmar
        </UButton>
      </div>
    </template>
  </UModal>
</template>
