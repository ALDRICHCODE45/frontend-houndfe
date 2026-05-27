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
  click: [employee: Employee]
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
const modalityLabel = computed(() => WORK_MODALITY_LABELS[props.employee.workModality])
const hireDateFormatted = computed(() => formatHireDate(props.employee.hireDate))
const seniority = computed(() => computeSeniority(props.employee.hireDate))
const avatarClass = computed(() => {
  const palettes = [
    'bg-amber-500 text-white',
    'bg-pink-500 text-white',
    'bg-violet-500 text-white',
    'bg-red-500 text-white',
    'bg-cyan-500 text-white',
    'bg-emerald-500 text-white',
    'bg-blue-500 text-white',
  ]
  const seed = props.employee.id
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palettes[seed % palettes.length]
})

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
  <article
    class="group relative flex min-h-[220px] cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    @click="emit('click', employee)"
  >
    <!-- Row action menu (top-right corner) -->
    <div v-if="rowActions.length > 0" class="absolute right-3 top-3 z-10" @click.stop>
      <UDropdownMenu
        :items="rowActions"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          class="size-7 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Acciones del colaborador"
        />
      </UDropdownMenu>
    </div>

    <!-- Card header: avatar + name + position + chips -->
    <div class="flex flex-col items-start gap-3">
      <div class="relative">
        <div
          class="flex size-12 items-center justify-center rounded-full text-base font-semibold shadow-sm"
          :class="avatarClass"
          :aria-label="employee.fullName"
        >
          {{ initials }}
        </div>
        <span
          v-if="employee.status === 'ACTIVE'"
          class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-default bg-emerald-500"
          aria-label="Activo"
        />
      </div>

      <!-- Name + employee number -->
      <div class="min-w-0 space-y-1 pr-7">
        <p class="truncate text-sm font-semibold leading-tight text-highlighted">
          {{ employee.fullName }}
        </p>
        <p class="line-clamp-1 text-xs text-muted">{{ employee.currentPosition ?? employee.employeeNumber }}</p>
      </div>

      <div class="flex min-h-6 flex-wrap items-center gap-1.5">
        <AppBadge
          v-if="employee.currentDepartment"
          :label="employee.currentDepartment"
          tone="neutral"
          class="max-w-[120px] truncate"
        />
        <AppBadge
          :label="statusLabel"
          :tone="statusTone"
          :aria-label="`Estado: ${statusLabel}`"
        />
      </div>
    </div>

    <div class="my-3 border-t border-dashed border-default" />

    <!-- Card body: department, manager, hire date, modality, seniority -->
    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div class="min-w-0">
        <p class="text-muted">Jefe directo</p>
        <p class="mt-1 truncate font-medium text-default">{{ managerDisplay }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Fecha de ingreso</p>
        <p class="mt-1 truncate font-semibold text-default">{{ hireDateFormatted }}</p>
      </div>
      <div class="min-w-0">
        <p class="text-muted">Modalidad</p>
        <p class="mt-1 font-medium text-default">{{ modalityLabel }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Antigüedad</p>
        <p class="mt-1 font-semibold text-default">{{ seniority }}</p>
      </div>
    </div>
  </article>
</template>
