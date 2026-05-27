<script setup lang="ts">
/**
 * CompensacionPanel — WU-07
 *
 * Compensación tab panel for the Employee Detail View.
 *
 * Layout (per Claude Design):
 *   1. Sueldo actual section (gated by hasSalary + can('read', 'EmployeeSalary'))
 *      - Shows current salary with "Nuevo ajuste" button (gated by can('create', 'EmployeeSalary'))
 *   2. Salary history timeline (most recent first, append-only)
 *   3. Position history timeline with "Nuevo" button (gated by can('update', 'Employee'))
 *
 * Each timeline entry: date, amount/position, department badge if applicable, reason.
 *
 * CASL gates:
 *   - Salary section: can('read', 'EmployeeSalary')
 *   - Add salary: can('create', 'EmployeeSalary')
 *   - Position history: visible to anyone with read:Employee (standard tier)
 *   - Add position: can('update', 'Employee')
 */

import { computed, reactive, ref } from 'vue'
import type { FormSubmitEvent } from '@nuxt/ui'
import DateFieldPopover from '@/features/POS/sales/components/DateFieldPopover.vue'
import { hasSalary } from '../interfaces/employee.types'
import {
  AddSalaryChangeDtoSchema,
  AddPositionChangeDtoSchema,
} from '../interfaces/employee.types'
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
} = useEmployeeSalaryHistory(employeeId)

const {
  data: positionHistory,
  isLoading: isPositionLoading,
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

const salaryState = reactive({
  amountCents: undefined as number | undefined,
  currency: 'MXN',
  effectiveFrom: '',
  reason: '',
})

function resetSalaryForm(): void {
  salaryState.amountCents = undefined
  salaryState.currency = 'MXN'
  salaryState.effectiveFrom = ''
  salaryState.reason = ''
}

const { mutateAsync: addSalaryChange, isPending: isAddingSalary } =
  useAddSalaryChange(employeeId)

async function onSalarySubmit(
  event: FormSubmitEvent<{ amountCents: number; currency: string; effectiveFrom: string; reason: string }>,
): Promise<void> {
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
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-default px-5 py-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-wallet" class="size-4 text-primary" />
            <h3 class="text-sm font-semibold text-highlighted">Sueldo actual</h3>
          </div>
          <UButton
            v-if="canCreateSalary"
            icon="i-lucide-plus"
            size="xs"
            variant="outline"
            color="primary"
            label="Nuevo ajuste"
            @click="isSalaryModalOpen = true"
          />
        </div>

        <!-- Current salary display -->
        <div class="px-5 py-4">
          <template v-if="hasSalary(employee)">
            <p class="text-3xl font-bold text-highlighted">{{ currentSalaryDisplay }}</p>
            <p class="mt-1 text-xs text-muted">{{ employee.currentSalaryCurrency }} · sueldo vigente</p>
          </template>
          <template v-else>
            <div class="flex items-center gap-2 text-sm text-muted">
              <UIcon name="i-lucide-minus-circle" class="size-4" />
              <span>Sin sueldo registrado</span>
            </div>
          </template>
        </div>
      </UCard>

      <!-- Salary history timeline -->
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <div class="flex items-center gap-2 border-b border-default px-5 py-4">
          <UIcon name="i-lucide-history" class="size-4 text-muted" />
          <h3 class="text-sm font-semibold text-highlighted">Historial de sueldos</h3>
        </div>

        <!-- Loading -->
        <div v-if="isSalaryLoading" class="px-5 py-6">
          <div class="flex flex-col gap-3">
            <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-elevated" />
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="salaryEntries.length === 0"
          class="flex flex-col items-center gap-2 px-5 py-10 text-center"
        >
          <UIcon name="i-lucide-receipt" class="size-8 text-muted opacity-40" />
          <p class="text-sm text-muted">Sin historial de sueldos registrado.</p>
        </div>

        <!-- Timeline -->
        <div v-else class="divide-y divide-default">
          <div
            v-for="(entry, index) in salaryEntries"
            :key="entry.id"
            class="flex items-start gap-4 px-5 py-4"
          >
            <!-- Timeline dot -->
            <div class="relative mt-1 flex flex-col items-center">
              <div
                :class="[
                  'size-2.5 rounded-full ring-2',
                  index === 0
                    ? 'bg-primary ring-primary/20'
                    : 'bg-elevated ring-default',
                ]"
              />
            </div>

            <!-- Entry content -->
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span
                  :class="[
                    'text-base font-semibold',
                    index === 0 ? 'text-primary' : 'text-highlighted',
                  ]"
                >
                  {{ entry.amountFormatted }}
                </span>
                <span class="text-xs text-muted">{{ entry.dateFormatted }}</span>
              </div>
              <p v-if="entry.reason" class="mt-0.5 text-sm text-muted line-clamp-2">
                {{ entry.reason }}
              </p>
              <span class="mt-1 inline-block rounded-sm bg-elevated px-1.5 py-0.5 text-xs text-muted">
                {{ entry.currency }}
              </span>
            </div>
          </div>
        </div>
      </UCard>
    </template>

    <!-- Salary access denied notice (when user lacks read:EmployeeSalary) -->
    <UCard v-else :ui="{ body: 'p-5 sm:p-5' }">
      <div class="flex items-center gap-3 text-sm text-muted">
        <UIcon name="i-lucide-lock" class="size-4 shrink-0" />
        <span>No tenés acceso para ver la información de sueldos de este colaborador.</span>
      </div>
    </UCard>

    <!-- ── Historial de posiciones ────────────────────────────────────────── -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-default px-5 py-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-briefcase" class="size-4 text-muted" />
          <h3 class="text-sm font-semibold text-highlighted">Historial de posiciones</h3>
        </div>
        <UButton
          v-if="canUpdate"
          icon="i-lucide-plus"
          size="xs"
          variant="outline"
          color="neutral"
          label="Nuevo"
          @click="isPositionModalOpen = true"
        />
      </div>

      <!-- Loading -->
      <div v-if="isPositionLoading" class="px-5 py-6">
        <div class="flex flex-col gap-3">
          <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-elevated" />
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="positionEntries.length === 0"
        class="flex flex-col items-center gap-2 px-5 py-10 text-center"
      >
        <UIcon name="i-lucide-briefcase" class="size-8 text-muted opacity-40" />
        <p class="text-sm text-muted">Sin historial de posiciones registrado.</p>
      </div>

      <!-- Timeline -->
      <div v-else class="divide-y divide-default">
        <div
          v-for="(entry, index) in positionEntries"
          :key="entry.id"
          class="flex items-start gap-4 px-5 py-4"
        >
          <!-- Timeline dot -->
          <div class="relative mt-1 flex flex-col items-center">
            <div
              :class="[
                'size-2.5 rounded-full ring-2',
                index === 0
                  ? 'bg-primary ring-primary/20'
                  : 'bg-elevated ring-default',
              ]"
            />
          </div>

          <!-- Entry content -->
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
              <span class="text-xs text-muted">{{ entry.dateFormatted }}</span>
            </div>

            <!-- Department badge (optional) -->
            <span
              v-if="entry.department"
              class="mt-1 inline-block rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
            >
              {{ entry.department }}
            </span>

            <p v-if="entry.reason" class="mt-1 text-sm text-muted line-clamp-2">
              {{ entry.reason }}
            </p>
          </div>
        </div>
      </div>
    </UCard>

  </div>

  <!-- ── Add Salary Change modal ───────────────────────────────────────────── -->
  <UModal
    v-model:open="isSalaryModalOpen"
    title="Registrar ajuste de sueldo"
    :dismissible="!isAddingSalary"
    :close="!isAddingSalary"
    @after-leave="resetSalaryForm"
  >
    <template #body>
      <UForm
        :id="salaryFormId"
        :schema="AddSalaryChangeDtoSchema"
        :state="salaryState"
        class="flex flex-col gap-4"
        @submit="onSalarySubmit"
      >
        <UFormField label="Monto (centavos)" name="amountCents" required
          hint="Ej: $45,000.00 = 4500000">
          <UInputNumber
            v-model="salaryState.amountCents"
            :min="1"
            placeholder="4500000"
            class="w-full"
            :disabled="isAddingSalary"
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
          <DateFieldPopover
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
  <UModal
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
            placeholder="Ej: Gerente de Finanzas"
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
          <DateFieldPopover
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
