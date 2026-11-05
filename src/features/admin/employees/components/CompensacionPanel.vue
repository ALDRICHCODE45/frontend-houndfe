<script setup lang="ts">
/**
 * CompensacionPanel — WU-07
 *
 * Compensación tab panel for the Employee Detail View.
 *
 * Layout:
 *   1. Sueldo actual section (gated by hasSalary + can('read', 'EmployeeSalary'))
 *      - Shows current salary with "Nuevo ajuste" button (gated by can('create', 'EmployeeSalary'))
 *   2. Salary history timeline (most recent first, append-only)
 *   3. Position history timeline with "Nuevo" button (gated by can('update', 'Employee'))
 *
 * Each timeline entry: date, amount/position, department as muted text, reason.
 * Neutral surfaces (color is for status). Each history has its four states
 * (S10): skeleton, the shared error EmptyState with Reintentar, the shared
 * empty state, and the data.
 *
 * CASL gates:
 *   - Salary section: can('read', 'EmployeeSalary')
 *   - Add salary: can('create', 'EmployeeSalary')
 *   - Position history: visible to anyone with read:Employee (standard tier)
 *   - Add position: can('update', 'Employee')
 */

import { computed, reactive, ref } from 'vue'
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import DateFieldPopover from '@/features/POS/sales/components/DateFieldPopover.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import HfMoneyInput from '@/core/shared/components/form/HfMoneyInput.vue'
import { hasSalary } from '../interfaces/employee.types'
import {
  AddPositionChangeDtoSchema,
} from '../interfaces/employee.types'

/**
 * Form-level schema for the salary modal.
 * The user types pesos in HfMoneyInput, which already yields exact centavos.
 */
const SalaryFormSchema = z.object({
  amountCents: z.number({ message: 'Escribe el monto.' }).int().min(100, 'El monto debe ser al menos 1'),
  currency: z.string().min(1).max(3),
  effectiveFrom: z.string().min(1),
  reason: z.string().min(1),
})
import type { Employee } from '../interfaces/employee.types'
import {
  useEmployeeSalaryHistory,
  useAddSalaryChange,
  useEmployeePositionHistory,
  useAddPositionChange,
  buildSalaryTimelineEntry,
  buildPositionTimelineEntry,
  formatSalaryCents,
} from '../composables/useCompensacion'

// ─── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  employee: Employee
  canReadSalary: boolean
  canCreateSalary: boolean
  canUpdate: boolean
}>()

// ─── Queries ───────────────────────────────────────────────────────────────────

const employeeId = computed(() => props.employee.id)

const {
  data: salaryHistory,
  isLoading: isSalaryLoading,
  isError: isSalaryError,
  refetch: refetchSalary,
} = useEmployeeSalaryHistory(employeeId)

const {
  data: positionHistory,
  isLoading: isPositionLoading,
  isError: isPositionError,
  refetch: refetchPositions,
} = useEmployeePositionHistory(employeeId)

// ─── Derived display data ─────────────────────────────────────────────────────

const salaryEntries = computed(() =>
  (salaryHistory.value ?? []).map(buildSalaryTimelineEntry),
)

const positionEntries = computed(() =>
  (positionHistory.value ?? []).map(buildPositionTimelineEntry),
)

const currentSalaryDisplay = computed<string>(() => {
  if (!hasSalary(props.employee)) return '—'
  return formatSalaryCents(
    props.employee.currentSalaryCents,
    props.employee.currentSalaryCurrency,
  )
})

// ─── Add Salary Change form ────────────────────────────────────────────────────

const isSalaryModalOpen = ref(false)
const salaryFormId = 'add-salary-change-form'

/** The amount in centavos, as HfMoneyInput reads it (45000 typed = 4500000). */
const salaryState = reactive({
  amountCents: null as number | null,
  currency: 'MXN',
  effectiveFrom: '',
  reason: '',
})

// The parser error of the typed amount; while present nothing is sent.
const salaryAmountError = ref<string | null>(null)

function resetSalaryForm(): void {
  salaryState.amountCents = null
  salaryAmountError.value = null
  salaryState.currency = 'MXN'
  salaryState.effectiveFrom = ''
  salaryState.reason = ''
}

const { mutateAsync: addSalaryChange, isPending: isAddingSalary } =
  useAddSalaryChange(employeeId)

async function onSalarySubmit(
  event: FormSubmitEvent<{ amountCents: number; currency: string; effectiveFrom: string; reason: string }>,
): Promise<void> {
  if (salaryAmountError.value) return
  try {
    await addSalaryChange({
      amountCents: event.data.amountCents,
      currency: event.data.currency,
      effectiveFrom: event.data.effectiveFrom,
      reason: event.data.reason,
    })
    resetSalaryForm()
    isSalaryModalOpen.value = false
  } catch {
    // useAddSalaryChange.onError handles toast
  }
}

function closeSalaryModal(): void {
  resetSalaryForm()
  isSalaryModalOpen.value = false
}

// ─── Add Position Change form ─────────────────────────────────────────────────

const isPositionModalOpen = ref(false)
const positionFormId = 'add-position-change-form'

const positionState = reactive({
  position: '',
  department: '',
  effectiveFrom: '',
  reason: '',
})

function resetPositionForm(): void {
  positionState.position = ''
  positionState.department = ''
  positionState.effectiveFrom = ''
  positionState.reason = ''
}

const { mutateAsync: addPositionChange, isPending: isAddingPosition } =
  useAddPositionChange(employeeId)

async function onPositionSubmit(
  event: FormSubmitEvent<{ position: string; department?: string; effectiveFrom: string; reason: string }>,
): Promise<void> {
  try {
    await addPositionChange({
      position: event.data.position,
      department: event.data.department || undefined,
      effectiveFrom: event.data.effectiveFrom,
      reason: event.data.reason,
    })
    resetPositionForm()
    isPositionModalOpen.value = false
  } catch {
    // useAddPositionChange.onError handles toast
  }
}

function closePositionModal(): void {
  resetPositionForm()
  isPositionModalOpen.value = false
}
</script>

<template>
  <div class="flex flex-col gap-6">

    <!-- ── Sueldo actual (gated by canReadSalary) ────────────────────────── -->
    <template v-if="canReadSalary">
      <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
        <div class="flex items-center justify-between gap-3 border-b border-default px-5 py-4">
          <h2 class="text-base font-semibold text-highlighted">Sueldo actual</h2>
          <UButton
            v-if="canCreateSalary"
            icon="i-lucide-plus"
            size="sm"
            variant="outline"
            color="neutral"
            label="Nuevo ajuste"
            @click="isSalaryModalOpen = true"
          />
        </div>

        <!-- Current salary display -->
        <div class="px-5 py-4">
          <template v-if="hasSalary(employee)">
            <p class="hf-figure text-3xl font-semibold text-highlighted">{{ currentSalaryDisplay }}</p>
            <p class="mt-1 text-[13px] text-muted">{{ employee.currentSalaryCurrency }}</p>
          </template>
          <p v-else class="text-sm text-muted">Sin sueldo registrado</p>
        </div>
      </UCard>

      <!-- Salary history timeline -->
      <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
        <div class="border-b border-default px-5 py-4">
          <h2 class="text-base font-semibold text-highlighted">Historial de sueldos</h2>
        </div>

        <!-- Loading -->
        <div
          v-if="isSalaryLoading"
          class="flex flex-col gap-3 px-5 py-6"
          aria-busy="true"
          data-testid="salary-history-skeleton"
        >
          <span class="sr-only">Cargando</span>
          <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-(--hf-surface-muted)" aria-hidden="true" />
        </div>

        <!-- Error -->
        <div v-else-if="isSalaryError" class="p-5" data-testid="salary-history-error">
          <EmptyState
            kind="error"
            title="No se pudo cargar el historial de sueldos"
            action-label="Reintentar"
            action-test-id="salary-history-retry"
            @action="() => refetchSalary()"
          />
        </div>

        <!-- Empty -->
        <div v-else-if="salaryEntries.length === 0" class="p-5" data-testid="salary-history-empty">
          <EmptyState title="Sin historial de sueldos" icon="i-lucide-receipt" />
        </div>

        <!-- Timeline -->
        <div v-else class="divide-y divide-default">
          <div
            v-for="(entry, index) in salaryEntries"
            :key="entry.id"
            class="flex items-start gap-4 px-5 py-4"
          >
            <!-- Timeline dot: the latest entry is filled -->
            <div class="mt-1.5 flex flex-col items-center">
              <div
                :class="[
                  'size-2.5 rounded-full',
                  index === 0 ? 'bg-(--hf-heading)' : 'bg-(--hf-border)',
                ]"
              />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span
                  :class="[
                    'hf-figure text-base font-semibold',
                    index === 0 ? 'text-highlighted' : 'text-default',
                  ]"
                >
                  {{ entry.amountFormatted }}
                  <span class="text-[13px] font-normal text-muted">{{ entry.currency }}</span>
                </span>
                <span class="text-[13px] text-muted">{{ entry.dateFormatted }}</span>
              </div>
              <p v-if="entry.reason" class="mt-0.5 line-clamp-2 text-sm text-muted">
                {{ entry.reason }}
              </p>
            </div>
          </div>
        </div>
      </UCard>
    </template>

    <!-- Salary access denied notice (when user lacks read:EmployeeSalary) -->
    <UCard v-else class="employees-detail-section" :ui="{ body: 'p-5 sm:p-5' }">
      <EmptyState
        kind="forbidden"
        title="Sin acceso a los sueldos"
        description="Tu rol no puede ver los sueldos de este colaborador."
      />
    </UCard>

    <!-- ── Historial de posiciones ────────────────────────────────────────── -->
    <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="flex items-center justify-between gap-3 border-b border-default px-5 py-4">
        <h2 class="text-base font-semibold text-highlighted">Historial de posiciones</h2>
        <UButton
          v-if="canUpdate"
          icon="i-lucide-plus"
          size="sm"
          variant="outline"
          color="neutral"
          label="Nuevo"
          @click="isPositionModalOpen = true"
        />
      </div>

      <!-- Loading -->
      <div
        v-if="isPositionLoading"
        class="flex flex-col gap-3 px-5 py-6"
        aria-busy="true"
        data-testid="position-history-skeleton"
      >
        <span class="sr-only">Cargando</span>
        <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-(--hf-surface-muted)" aria-hidden="true" />
      </div>

      <!-- Error -->
      <div v-else-if="isPositionError" class="p-5" data-testid="position-history-error">
        <EmptyState
          kind="error"
          title="No se pudo cargar el historial de posiciones"
          action-label="Reintentar"
          action-test-id="position-history-retry"
          @action="() => refetchPositions()"
        />
      </div>

      <!-- Empty -->
      <div v-else-if="positionEntries.length === 0" class="p-5" data-testid="position-history-empty">
        <EmptyState title="Sin historial de posiciones" icon="i-lucide-briefcase" />
      </div>

      <!-- Timeline -->
      <div v-else class="divide-y divide-default">
        <div
          v-for="(entry, index) in positionEntries"
          :key="entry.id"
          class="flex items-start gap-4 px-5 py-4"
        >
          <div class="mt-1.5 flex flex-col items-center">
            <div
              :class="[
                'size-2.5 rounded-full',
                index === 0 ? 'bg-(--hf-heading)' : 'bg-(--hf-border)',
              ]"
            />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span
                :class="[
                  'text-base font-semibold',
                  index === 0 ? 'text-highlighted' : 'text-default',
                ]"
              >
                {{ entry.position }}
              </span>
              <span class="text-[13px] text-muted">{{ entry.dateFormatted }}</span>
            </div>

            <p v-if="entry.department" class="mt-0.5 text-[13px] text-muted">
              {{ entry.department }}
            </p>

            <p v-if="entry.reason" class="mt-1 line-clamp-2 text-sm text-muted">
              {{ entry.reason }}
            </p>
          </div>
        </div>
      </div>
    </UCard>

  </div>

  <!-- ── Add Salary Change modal ───────────────────────────────────────────── -->
  <UModal :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }"
    v-model:open="isSalaryModalOpen"
    title="Registrar ajuste de sueldo"
    :dismissible="!isAddingSalary"
    :close="!isAddingSalary"
    @after-leave="resetSalaryForm"
  >
    <template #body>
      <UForm
        :id="salaryFormId"
        :schema="SalaryFormSchema"
        :state="salaryState"
        class="flex flex-col gap-4"
        @submit="onSalarySubmit"
      >
        <UFormField label="Monto" name="amountCents" required
          hint="Ingresa el monto en pesos (ej: 45000)">
          <HfMoneyInput
            id="salary-amount"
            v-model="salaryState.amountCents"
            placeholder="45000"
            class="w-full"
            :disabled="isAddingSalary"
            @validation="salaryAmountError = $event"
          />
        </UFormField>

        <UFormField label="Moneda" name="currency" required>
          <UInput
            v-model="salaryState.currency"
            class="w-full"
            size="lg"
            placeholder="MXN"
            maxlength="3"
            :disabled="isAddingSalary"
          />
        </UFormField>

        <UFormField label="Fecha de vigencia" name="effectiveFrom" required>
          <DateFieldPopover portal-class="hf-theme hf-ui hf-form-overlay employees-form-portal"
            v-model="salaryState.effectiveFrom"
            placeholder="Elegir fecha"
            :min-iso="null"
            :disabled="isAddingSalary"
          />
        </UFormField>

        <UFormField label="Motivo del ajuste" name="reason" required>
          <UTextarea
            v-model="salaryState.reason"
            class="w-full"
            size="lg"
            placeholder="Ej: Aumento anual por desempeño"
            :rows="3"
            :disabled="isAddingSalary"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="isAddingSalary"
          @click="closeSalaryModal"
        />
        <UButton
          label="Registrar ajuste"
          color="primary"
          type="submit"
          :form="salaryFormId"
          :loading="isAddingSalary"
        />
      </div>
    </template>
  </UModal>

  <!-- ── Add Position Change modal ─────────────────────────────────────────── -->
  <UModal :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }"
    v-model:open="isPositionModalOpen"
    title="Registrar cambio de posición"
    :dismissible="!isAddingPosition"
    :close="!isAddingPosition"
    @after-leave="resetPositionForm"
  >
    <template #body>
      <UForm
        :id="positionFormId"
        :schema="AddPositionChangeDtoSchema"
        :state="positionState"
        class="flex flex-col gap-4"
        @submit="onPositionSubmit"
      >
        <UFormField label="Puesto" name="position" required>
          <UInput
            v-model="positionState.position"
            class="w-full"
            size="lg"
            placeholder="Ej: Gerente de finanzas"
            :disabled="isAddingPosition"
          />
        </UFormField>

        <UFormField label="Departamento" name="department">
          <UInput
            v-model="positionState.department"
            class="w-full"
            size="lg"
            placeholder="Ej: Finanzas (opcional)"
            :disabled="isAddingPosition"
          />
        </UFormField>

        <UFormField label="Fecha de vigencia" name="effectiveFrom" required>
          <DateFieldPopover portal-class="hf-theme hf-ui hf-form-overlay employees-form-portal"
            v-model="positionState.effectiveFrom"
            placeholder="Elegir fecha"
            :min-iso="null"
            :disabled="isAddingPosition"
          />
        </UFormField>

        <UFormField label="Motivo del cambio" name="reason" required>
          <UTextarea
            v-model="positionState.reason"
            class="w-full"
            size="lg"
            placeholder="Ej: Promoción interna"
            :rows="3"
            :disabled="isAddingPosition"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="isAddingPosition"
          @click="closePositionModal"
        />
        <UButton
          label="Registrar cambio"
          color="primary"
          type="submit"
          :form="positionFormId"
          :loading="isAddingPosition"
        />
      </div>
    </template>
  </UModal>
</template>
