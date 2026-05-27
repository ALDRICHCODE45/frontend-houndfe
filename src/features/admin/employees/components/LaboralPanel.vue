<script setup lang="ts">
/**
 * LaboralPanel — WU-06A
 *
 * Read-only labor/employment data panel for the Employee Detail View — Laboral tab.
 *
 * Displays:
 *   - Current position, department
 *   - Employee number
 *   - Manager (linked — router-link to manager's detail)
 *   - Contract type, work modality
 *   - Hire date
 *   - Schedule
 *   - Responsibilities
 *
 * Design: card-based sections with edit pencil icon per Claude Design.
 */

import { computed } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import {
  workModalityToBadgeTone,
  formatHireDate,
} from '../composables/useEmployeeColumns'
import {
  WORK_MODALITY_LABELS,
  CONTRACT_TYPE_LABELS,
  type Employee,
} from '../interfaces/employee.types'

const props = defineProps<{
  employee: Employee
  /** Resolved manager display name (or "—") */
  managerDisplay: string
  /** Manager employee ID for navigation (optional) */
  managerId?: string | null
  canUpdate?: boolean
}>()

const emit = defineEmits<{
  edit: [employee: Employee]
}>()

const hireDateFormatted = computed(() => formatHireDate(props.employee.hireDate))
const modalityTone = computed(() => workModalityToBadgeTone(props.employee.workModality))
const modalityLabel = computed(() => WORK_MODALITY_LABELS[props.employee.workModality])
const contractLabel = computed(() => CONTRACT_TYPE_LABELS[props.employee.contractType])
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Position + contract section -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="flex items-center justify-between border-b border-default px-5 py-4">
        <h3 class="text-sm font-semibold text-highlighted">Datos de empleo</h3>
        <UButton
          v-if="canUpdate"
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Editar datos de empleo"
          @click="emit('edit', employee)"
        />
      </div>

      <div class="grid grid-cols-1 gap-0 sm:grid-cols-2">
        <!-- Puesto actual -->
        <div class="border-b border-default px-5 py-4 sm:border-r">
          <p class="text-xs text-muted">Puesto actual</p>
          <p class="mt-1 font-medium text-highlighted">{{ employee.currentPosition ?? '—' }}</p>
        </div>

        <!-- Departamento -->
        <div class="border-b border-default px-5 py-4">
          <p class="text-xs text-muted">Departamento</p>
          <p class="mt-1 font-medium text-default">{{ employee.currentDepartment ?? '—' }}</p>
        </div>

        <!-- Número de empleado -->
        <div class="border-b border-default px-5 py-4 sm:border-r">
          <p class="text-xs text-muted">Número de empleado</p>
          <p class="mt-1 font-mono font-medium text-default">{{ employee.employeeNumber }}</p>
        </div>

        <!-- Tipo de contrato -->
        <div class="border-b border-default px-5 py-4">
          <p class="text-xs text-muted">Tipo de contrato</p>
          <p class="mt-1 font-medium text-default">{{ contractLabel }}</p>
        </div>

        <!-- Modalidad de trabajo -->
        <div class="border-b border-default px-5 py-4 sm:border-r">
          <p class="text-xs text-muted">Modalidad</p>
          <div class="mt-1">
            <AppBadge
              :label="modalityLabel"
              :tone="modalityTone"
              :aria-label="`Modalidad: ${modalityLabel}`"
            />
          </div>
        </div>

        <!-- Fecha de ingreso -->
        <div class="border-b border-default px-5 py-4">
          <p class="text-xs text-muted">Fecha de ingreso</p>
          <p class="mt-1 font-medium text-default">{{ hireDateFormatted }}</p>
        </div>

        <!-- Jefe directo — linked if managerId exists -->
        <div class="border-b border-default px-5 py-4 sm:border-r sm:border-b-0">
          <p class="text-xs text-muted">Jefe directo</p>
          <RouterLink
            v-if="managerId"
            :to="{ name: 'admin-employee-detail', params: { id: managerId } }"
            class="mt-1 block font-medium text-primary hover:underline"
          >
            {{ managerDisplay }}
          </RouterLink>
          <p v-else class="mt-1 text-muted">—</p>
        </div>

        <!-- Horario -->
        <div class="px-5 py-4">
          <p class="text-xs text-muted">Horario</p>
          <p class="mt-1 font-medium text-default">{{ employee.currentSchedule ?? '—' }}</p>
        </div>
      </div>
    </UCard>

    <!-- Responsibilities section -->
    <UCard
      v-if="employee.currentResponsibilities"
      :ui="{ body: 'p-5 sm:p-5' }"
    >
      <h3 class="mb-3 text-sm font-semibold text-highlighted">Responsabilidades</h3>
      <p class="whitespace-pre-wrap text-sm text-default leading-relaxed">
        {{ employee.currentResponsibilities }}
      </p>
    </UCard>
  </div>
</template>
