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
import {
  formatHireDate,
} from '../composables/useEmployeeColumns'
import { computeSeniority } from '../composables/useEmployeeViewMode'
import {
  EMPLOYEE_STATUS_LABELS,
  WORK_MODALITY_LABELS,
  type Employee,
} from '../interfaces/employee.types'
import { getEmployeeRowActions } from '../composables/useEmployeeActions'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import DotBadge from '@/core/shared/components/DotBadge.vue'

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

const statusLabel = computed(() => EMPLOYEE_STATUS_LABELS[props.employee.status])
const modalityLabel = computed(() => WORK_MODALITY_LABELS[props.employee.workModality])
const hireDateFormatted = computed(() => formatHireDate(props.employee.hireDate))
const seniority = computed(() => computeSeniority(props.employee.hireDate))

// ── Department dot color map — domain data passed into DotBadge ───────────────
function getDepartmentDotClass(department: string | null): string {
  const value = department?.toLowerCase() ?? ''
  if (value.includes('producto')) return 'bg-violet-500'
  if (value.includes('diseño')) return 'bg-pink-500'
  if (value.includes('finanzas')) return 'bg-blue-500'
  if (value.includes('recursos')) return 'bg-cyan-500'
  if (value.includes('operaciones')) return 'bg-amber-500'
  if (value.includes('legal')) return 'bg-slate-500'
  if (value.includes('almac')) return 'bg-orange-500'
  if (value.includes('ingen') || value.includes('tecnolog')) return 'bg-indigo-500'
  if (value.includes('tienda')) return 'bg-emerald-500'
  return 'bg-emerald-500'
}

function getStatusBadgeClass(status: Employee['status']): string {
  switch (status) {
    case 'ACTIVE':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
    case 'ON_LEAVE':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300'
    case 'TERMINATED':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300'
  }
}

function getStatusDotClass(status: Employee['status']): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-500'
    case 'ON_LEAVE':
      return 'bg-amber-500'
    case 'TERMINATED':
      return 'bg-red-500'
  }
}
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
      <!-- EntityAvatar handles initials, color hash, and active status dot -->
      <EntityAvatar
        :name="employee.fullName"
        :seed="employee.id"
        :show-dot="employee.status === 'ACTIVE'"
        size="lg"
      />

      <!-- Name + employee number -->
      <div class="min-w-0 space-y-1 pr-7">
        <p class="truncate text-sm font-semibold leading-tight text-highlighted">
          {{ employee.fullName }}
        </p>
        <p class="line-clamp-1 text-xs text-muted">{{ employee.currentPosition ?? employee.employeeNumber }}</p>
      </div>

      <div class="flex min-h-6 flex-wrap items-center gap-1.5">
        <!-- DotBadge handles the neutral-outlined + colored-dot department pattern -->
        <DotBadge
          v-if="employee.currentDepartment"
          :label="employee.currentDepartment"
          :dot-class="getDepartmentDotClass(employee.currentDepartment)"
          :truncate="true"
          :compact="true"
        />

        <!-- Status badge keeps its semantic coloring (not the neutral DotBadge pattern) -->
        <UBadge
          variant="outline"
          size="md"
          :class="getStatusBadgeClass(employee.status)"
          :ui="{
            base: 'gap-2 rounded-full px-3 py-1 shadow-none ring-0',
            label: 'text-xs font-semibold',
          }"
          :aria-label="`Estado: ${statusLabel}`"
        >
          <template #leading>
            <span class="size-2 rounded-full" :class="getStatusDotClass(employee.status)" />
          </template>
          {{ statusLabel }}
        </UBadge>
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
