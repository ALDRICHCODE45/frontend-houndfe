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
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'

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
  <div class="employees-panel">
    <HfSectionCard title="Datos de empleo" :heading-level="2">
      <dl class="employees-dl">
        <div class="employees-dl__item">
          <dt>Puesto actual</dt>
          <dd>{{ employee.currentPosition ?? '—' }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Departamento</dt>
          <dd>{{ employee.currentDepartment ?? '—' }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Tipo de contrato</dt>
          <dd>{{ contractLabel }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Modalidad</dt>
          <dd>{{ modalityLabel }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Fecha de ingreso</dt>
          <dd>{{ hireDateFormatted }}</dd>
        </div>

        <div class="employees-dl__item">
          <dt>Horario</dt>
          <dd>{{ employee.currentSchedule ?? '—' }}</dd>
        </div>

        <!-- Jefe directo — linked if managerId exists -->
        <div class="employees-dl__item">
          <dt>Jefe directo</dt>
          <dd>
            <RouterLink
              v-if="managerId"
              :to="{ name: 'admin-employee-detail', params: { id: managerId } }"
              class="employees-link"
            >
              {{ managerDisplay }}
            </RouterLink>
            <span v-else class="employees-dl__empty">—</span>
          </dd>
        </div>
      </dl>
    </HfSectionCard>

    <HfSectionCard
      v-if="employee.currentResponsibilities"
      title="Responsabilidades"
      :heading-level="2"
    >
      <p class="whitespace-pre-wrap text-sm leading-relaxed text-default">
        {{ employee.currentResponsibilities }}
      </p>
    </HfSectionCard>
  </div>
</template>
