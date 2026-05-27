<script setup lang="ts">
/**
 * EmployeeCardGrid — WU-03
 *
 * Presentational grid that wraps a list of EmployeeCard components.
 *
 * Responsibilities:
 *   - Responsive grid layout (1→2→3 columns)
 *   - Skeleton loading state
 *   - Empty state when no employees
 *
 * No data fetching — receives employees + managerMap as props (props down pattern).
 */

import EmployeeCard from './EmployeeCard.vue'
import { resolveManagerName } from '../composables/useManagerResolution'
import type { Employee } from '../interfaces/employee.types'

const props = defineProps<{
  employees: Employee[]
  managerMap: Map<string, string>
  loading?: boolean
  empty?: string
}>()

function getManagerDisplay(employee: Employee): string {
  return resolveManagerName(employee.managerId, props.managerMap)
}
</script>

<template>
  <!-- Loading skeleton -->
  <div
    v-if="props.loading"
    class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    <div
      v-for="i in 8"
      :key="i"
      class="h-64 animate-pulse rounded-xl bg-elevated"
    />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="!props.employees.length"
    class="flex flex-col items-center justify-center gap-3 py-16 text-center"
  >
    <UIcon name="i-lucide-users" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ props.empty ?? 'No se encontraron colaboradores' }}</p>
  </div>

  <!-- Card grid -->
  <div
    v-else
    class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    <EmployeeCard
      v-for="employee in props.employees"
      :key="employee.id"
      :employee="employee"
      :manager-display="getManagerDisplay(employee)"
    />
  </div>
</template>
