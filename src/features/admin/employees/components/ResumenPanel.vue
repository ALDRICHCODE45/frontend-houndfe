<script setup lang="ts">
/**
 * ResumenPanel — WU-06A (redesigned)
 *
 * "Vista rápida" panel for the Employee Detail View — Resumen tab.
 *
 * Displays:
 *   - Key figures: seniority, current salary (if hasSalary) and vacation days.
 *     The department is already in the detail header, so it is not repeated.
 *   - "Reporta a" section — manager with neutral avatar, name, position + department subtitle
 *
 * Figures are neutral (color is for status): muted label, semibold value.
 * Salary display guarded by hasSalary() — never renders undefined as "0".
 */

import { computed } from 'vue'
import { formatCurrencyMXN } from '../composables/useEmployeeDetail'
import { hasSalary } from '../interfaces/employee.types'
import { computeSeniority, formatHireDate } from '../composables/useEmployeeColumns'
import type { Employee } from '../interfaces/employee.types'
import type { ManagerInfo } from '../composables/useManagerResolution'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'

const props = defineProps<{
  employee: Employee
  /** Resolved manager display name (or "---") */
  managerDisplay: string
  /** Full manager info from the expanded ManagerInfo map */
  managerInfo?: ManagerInfo | null
  canReadSalary?: boolean
}>()

// ── Derived stats ──────────────────────────────────────────────────────────────
const seniority = computed(() => computeSeniority(props.employee.hireDate))
const hireDateFormatted = computed(() => formatHireDate(props.employee.hireDate))
const salaryDisplay = computed<string>(() => {
  if (!hasSalary(props.employee)) return '—'
  return formatCurrencyMXN(props.employee.currentSalaryCents, props.employee.currentSalaryCurrency)
})

const managerSubtitle = computed(() => {
  const parts: string[] = []
  if (props.managerInfo?.currentPosition) parts.push(props.managerInfo.currentPosition)
  if (props.managerInfo?.currentDepartment) parts.push(props.managerInfo.currentDepartment)
  return parts.length > 0 ? parts.join(' \u00B7 ') : null
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Key figures -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="employee-stat-grid">
      <UCard class="employees-detail-section" :ui="{ body: 'p-4 sm:p-4' }">
        <p class="text-sm text-muted">Antigüedad</p>
        <p class="hf-figure mt-1 text-left text-2xl font-semibold text-highlighted">{{ seniority }}</p>
        <p class="text-sm text-muted">Desde {{ hireDateFormatted }}</p>
      </UCard>

      <!-- Current salary — only when canReadSalary and hasSalary -->
      <UCard
        v-if="canReadSalary && hasSalary(employee)"
        class="employees-detail-section"
        :ui="{ body: 'p-4 sm:p-4' }"
      >
        <p class="text-sm text-muted">Sueldo actual</p>
        <p class="hf-figure mt-1 text-left text-2xl font-semibold text-highlighted">{{ salaryDisplay }}</p>
        <p class="text-sm text-muted">{{ employee.currentSalaryCurrency }}</p>
      </UCard>

      <UCard class="employees-detail-section" :ui="{ body: 'p-4 sm:p-4' }">
        <p class="text-sm text-muted">Vacaciones</p>
        <p class="hf-figure mt-1 text-left text-2xl font-semibold text-highlighted">
          {{ employee.annualVacationDays ?? '—' }}
        </p>
        <p class="text-sm text-muted">días al año</p>
      </UCard>
    </div>

    <!-- Manager section -->
    <UCard class="employees-detail-section" :ui="{ body: 'p-5 sm:p-5' }">
      <h2 class="mb-4 text-base font-semibold text-highlighted">Reporta a</h2>

      <div v-if="managerDisplay !== '—' && managerDisplay" class="flex items-center gap-4">
        <EntityAvatar :name="managerDisplay" size="lg" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-highlighted">{{ managerDisplay }}</p>
          <p v-if="managerSubtitle" class="text-sm text-muted">{{ managerSubtitle }}</p>
          <p v-if="managerInfo?.email" class="text-sm text-muted">{{ managerInfo.email }}</p>
        </div>
      </div>

      <p v-else class="text-sm text-muted">Sin jefe directo</p>
    </UCard>

    <!-- Responsibilities -->
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
