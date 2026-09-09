<script setup lang="ts">
/**
 * EmployeeCardGrid — WU-03 (updated WU-05B: action events forwarded)
 *
 * Presentational grid that wraps a list of EmployeeCard components.
 *
 * Responsibilities:
 *   - Responsive grid layout (1→2→3 columns)
 *   - Skeleton loading state
 *   - Empty state when no employees
 *   - Forward edit/terminate/reactivate events from cards to the parent view
 *
 * No data fetching — receives employees + managerMap as props (props down pattern).
 */

import EmployeeCard from './EmployeeCard.vue'
import { resolveManagerName, type ManagerInfo } from '../composables/useManagerResolution'
import type { Employee } from '../interfaces/employee.types'

// S4 pilot available-width grid convention (design §4): the nested list
// width, not the viewport, decides the column count. Duplicated by design
// across the three pilot grids — no shared wrapper.
const gridClasses =
  'grid w-full min-w-0 max-w-full grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3'

const props = defineProps<{
  employees: Employee[]
  managerMap: Map<string, ManagerInfo>
  loading?: boolean
  empty?: string
  canUpdate?: boolean
}>()

const emit = defineEmits<{
  edit: [employee: Employee]
  terminate: [employee: Employee]
  reactivate: [employee: Employee]
  'card-click': [employee: Employee]
}>()

function getManagerDisplay(employee: Employee): string {
  return resolveManagerName(employee.managerId, props.managerMap)
}
</script>

<template>
  <!-- Loading skeleton -->
  <div
    v-if="props.loading"
    data-testid="card-grid-skeleton"
    :class="gridClasses"
  >
    <div
      v-for="i in 8"
      :key="i"
      data-testid="card-skeleton"
      class="h-56 animate-pulse rounded-xl border border-default bg-elevated"
    />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="!props.employees.length"
    data-testid="card-grid-empty"
    class="flex w-full min-w-0 max-w-full flex-col items-center justify-center gap-3 py-16 text-center"
  >
    <UIcon name="i-lucide-users" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ props.empty ?? 'No se encontraron colaboradores' }}</p>
  </div>

  <!-- Card grid -->
  <div
    v-else
    data-testid="card-grid"
    :class="gridClasses"
  >
    <EmployeeCard
      v-for="employee in props.employees"
      :key="employee.id"
      :employee="employee"
      :manager-display="getManagerDisplay(employee)"
      :can-update="props.canUpdate"
      @edit="emit('edit', $event)"
      @terminate="emit('terminate', $event)"
      @reactivate="emit('reactivate', $event)"
      @click="emit('card-click', $event)"
    />
  </div>
</template>
