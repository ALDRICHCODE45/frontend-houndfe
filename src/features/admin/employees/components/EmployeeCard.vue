<script setup lang="ts">
/**
 * EmployeeCard — WU-03 (updated WU-05B: action menu)
 *
 * Card view for a single employee. Shows:
 *   - Avatar with initials (no photo in v1)
 *   - Full name + employee number
 *   - Current position
 *   - Department chip (AppBadge neutral)
 *   - Status chip (ACTIVE→success, ON_LEAVE→warning, TERMINATED→error)
 *   - Manager display (resolved name or "—")
 *   - Hire date (formatted)
 *   - Work modality chip
 *   - Seniority (computed from hireDate)
 *   - Row action menu (WU-05B): Editar, Dar de baja / Reactivar — gated by canUpdate prop
 *
 * NO salary fields — salary belongs in Compensación detail tab (WU-06+).
 *
 * Design direction: warm-orange Nuxt UI 4 tokens; dense-but-clean HR card layout.
 */

import { computed } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import {
  employeeStatusToBadgeTone,
  workModalityToBadgeTone,
  formatHireDate,
} from '../composables/useEmployeeColumns'
import { computeSeniority } from '../composables/useEmployeeViewMode'
import {
  EMPLOYEE_STATUS_LABELS,
  WORK_MODALITY_LABELS,
  type Employee,
} from '../interfaces/employee.types'
import { getEmployeeRowActions } from '../composables/useEmployeeActions'

const props = defineProps<{
  employee: Employee
  managerDisplay: string
  canUpdate?: boolean
}>()

const emit = defineEmits<{
  edit: [employee: Employee]
  terminate: [employee: Employee]
  reactivate: [employee: Employee]
}>()

// Initials helper — first two words, first letter each
function getInitials(fullName: string): string {
  const parts = fullName.trim().split(' ').filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'C'
  )
}

const initials = computed(() => getInitials(props.employee.fullName))
const statusTone = computed(() => employeeStatusToBadgeTone(props.employee.status))
const statusLabel = computed(() => EMPLOYEE_STATUS_LABELS[props.employee.status])
const modalityTone = computed(() => workModalityToBadgeTone(props.employee.workModality))
const modalityLabel = computed(() => WORK_MODALITY_LABELS[props.employee.workModality])
const hireDateFormatted = computed(() => formatHireDate(props.employee.hireDate))
const seniority = computed(() => computeSeniority(props.employee.hireDate))

// Row action menu items — pure function, no reactivity overhead
const rowActions = computed(() =>
  getEmployeeRowActions(props.employee, props.canUpdate ?? false, {
    onEdit: () => emit('edit', props.employee),
    onTerminate: () => emit('terminate', props.employee),
    onReactivate: () => emit('reactivate', props.employee),
  }),
)
</script>

<template>
  <UCard
    class="group flex flex-col gap-0 overflow-hidden transition-shadow hover:shadow-md"
    :ui="{ body: 'p-0 sm:p-0', root: 'cursor-pointer' }"
  >
    <!-- Card header: avatar + name + position + status (+ action menu) -->
    <div class="flex flex-col items-center gap-3 px-5 pb-4 pt-5 text-center relative">
      <!-- Row action menu (top-right corner) -->
      <div v-if="rowActions.length > 0" class="absolute right-2 top-2">
        <UDropdownMenu
          :items="rowActions"
          :content="{ align: 'end' }"
        >
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            class="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Acciones del colaborador"
          />
        </UDropdownMenu>
      </div>

      <!-- Avatar with initials -->
      <UAvatar
        :alt="employee.fullName"
        :text="initials"
        size="xl"
        :ui="{
          root: 'ring-2 ring-primary/20',
        }"
      />

      <!-- Name + employee number -->
      <div class="min-w-0 space-y-0.5">
        <p class="truncate text-base font-semibold text-highlighted">
          {{ employee.fullName }}
        </p>
        <p class="text-xs text-muted">{{ employee.employeeNumber }}</p>
      </div>

      <!-- Position -->
      <p class="line-clamp-2 text-center text-sm text-default">
        {{ employee.currentPosition ?? '—' }}
      </p>

      <!-- Status chip -->
      <AppBadge
        :label="statusLabel"
        :tone="statusTone"
        :aria-label="`Estado: ${statusLabel}`"
      />
    </div>

    <UDivider />

    <!-- Card body: department, manager, hire date, modality, seniority -->
    <div class="flex flex-col gap-2.5 px-5 py-4">
      <!-- Department -->
      <div v-if="employee.currentDepartment" class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-xs text-muted">Área</span>
        <AppBadge
          :label="employee.currentDepartment"
          tone="neutral"
          class="max-w-[140px] truncate"
        />
      </div>

      <!-- Work modality -->
      <div class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-xs text-muted">Modalidad</span>
        <AppBadge
          :label="modalityLabel"
          :tone="modalityTone"
          :aria-label="`Modalidad: ${modalityLabel}`"
        />
      </div>

      <!-- Manager -->
      <div class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-xs text-muted">Jefe directo</span>
        <span class="truncate text-xs font-medium text-default">{{ managerDisplay }}</span>
      </div>

      <!-- Hire date + seniority -->
      <div class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-xs text-muted">Ingreso</span>
        <span class="text-xs text-default">
          {{ hireDateFormatted }}
          <span class="text-muted"> · {{ seniority }}</span>
        </span>
      </div>
    </div>
  </UCard>
</template>
