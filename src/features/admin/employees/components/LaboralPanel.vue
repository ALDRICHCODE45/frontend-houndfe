<script setup lang="ts">
/**
 * LaboralPanel — WU-06A
 *
 * Read-only labor/employment data panel for the Employee Detail View — Laboral tab.
 *
 * Displays:
 *   - Current position, department
 *   - Contract type, work modality (plain text: a category, not a status)
 *   - Hire date, schedule
 *   - Manager (linked — router-link to manager's detail)
 *   - Responsibilities
 *
 * The employee number lives in the Personal tab, and editing in the detail
 * header (one primary action per view).
 */

import { computed } from 'vue'
import { formatHireDate } from '../composables/useEmployeeColumns'
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
}>()

const hireDateFormatted = computed(() => formatHireDate(props.employee.hireDate))
const modalityLabel = computed(() => WORK_MODALITY_LABELS[props.employee.workModality])
const contractLabel = computed(() => CONTRACT_TYPE_LABELS[props.employee.contractType])
</script>

<template>
  <div class="flex flex-col gap-6">
    <UCard class="employees-detail-section" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="border-b border-default px-5 py-4">
        <h2 class="text-base font-semibold text-highlighted">Datos de empleo</h2>
      </div>

      <dl class="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
        <div>
          <dt class="text-[13px] text-muted">Puesto actual</dt>
          <dd class="mt-1 font-medium text-highlighted">{{ employee.currentPosition ?? '—' }}</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Departamento</dt>
          <dd class="mt-1 font-medium text-default">{{ employee.currentDepartment ?? '—' }}</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Tipo de contrato</dt>
          <dd class="mt-1 font-medium text-default">{{ contractLabel }}</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Modalidad</dt>
          <dd class="mt-1 font-medium text-default">{{ modalityLabel }}</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Fecha de ingreso</dt>
          <dd class="mt-1 font-medium text-default">{{ hireDateFormatted }}</dd>
        </div>

        <div>
          <dt class="text-[13px] text-muted">Horario</dt>
          <dd class="mt-1 font-medium text-default">{{ employee.currentSchedule ?? '—' }}</dd>
        </div>

        <!-- Jefe directo — linked if managerId exists -->
        <div>
          <dt class="text-[13px] text-muted">Jefe directo</dt>
          <dd class="mt-1">
            <RouterLink
              v-if="managerId"
              :to="{ name: 'admin-employee-detail', params: { id: managerId } }"
              class="font-medium text-default underline decoration-(--hf-border) underline-offset-2 hover:text-primary"
            >
              {{ managerDisplay }}
            </RouterLink>
            <span v-else class="text-muted">—</span>
          </dd>
        </div>
      </dl>
    </UCard>

    <UCard
      v-if="employee.currentResponsibilities"
      class="employees-detail-section"
      :ui="{ body: 'p-5 sm:p-5' }"
    >
      <h2 class="mb-3 text-base font-semibold text-highlighted">Responsabilidades</h2>
      <p class="whitespace-pre-wrap text-sm leading-relaxed text-default">
        {{ employee.currentResponsibilities }}
      </p>
    </UCard>
  </div>
</template>
