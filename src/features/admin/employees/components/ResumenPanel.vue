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
 * Figures are neutral (color is for status): muted label, semibold value,
 * grouped in one section card (no card per figure).
 * Salary display guarded by hasSalary() — never renders undefined as "0".
 */

import { computed } from 'vue'
import { formatCurrencyMXN } from '../composables/useEmployeeDetail'
import { hasSalary } from '../interfaces/employee.types'
import { computeSeniority, formatHireDate } from '../composables/useEmployeeColumns'
import type { Employee } from '../interfaces/employee.types'
import type { ManagerInfo } from '../composables/useManagerResolution'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'

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
  <div class="employees-panel">
    <!-- Key figures: one section, the figures side by side -->
    <HfSectionCard title="Vista rápida" :heading-level="2">
      <dl
        class="employees-figures grid-cols-1"
        :class="canReadSalary && hasSalary(employee) ? 'sm:grid-cols-3' : 'sm:grid-cols-2'"
        data-testid="employee-stat-grid"
      >
        <div>
          <dt>Antigüedad</dt>
          <dd class="employees-figure hf-figure">{{ seniority }}</dd>
          <dd class="employees-figure-note">Desde {{ hireDateFormatted }}</dd>
        </div>

        <!-- Current salary — only when canReadSalary and hasSalary -->
        <div v-if="canReadSalary && hasSalary(employee)">
          <dt>Sueldo actual</dt>
          <dd class="employees-figure hf-figure">{{ salaryDisplay }}</dd>
          <dd class="employees-figure-note">{{ employee.currentSalaryCurrency }}</dd>
        </div>

        <div>
          <dt>Vacaciones</dt>
          <dd class="employees-figure hf-figure">{{ employee.annualVacationDays ?? '—' }}</dd>
          <dd class="employees-figure-note">días al año</dd>
        </div>
      </dl>
    </HfSectionCard>

    <!-- Manager section -->
    <HfSectionCard title="Reporta a" :heading-level="2">
      <div v-if="managerDisplay !== '—' && managerDisplay" class="flex items-center gap-4">
        <EntityAvatar :name="managerDisplay" size="lg" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-highlighted">{{ managerDisplay }}</p>
          <p v-if="managerSubtitle" class="text-sm text-muted">{{ managerSubtitle }}</p>
          <p v-if="managerInfo?.email" class="break-all text-sm text-muted">{{ managerInfo.email }}</p>
        </div>
      </div>

      <p v-else class="text-sm text-muted">Sin jefe directo</p>
    </HfSectionCard>

    <!-- Responsibilities -->
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
