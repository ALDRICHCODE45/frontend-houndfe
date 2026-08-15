<script setup lang="ts">
/**
 * EmployeeFilters — WU-02 (WU-B: search stripped, status tabs only)
 *
 * Presentational component: status tabs only. Rendered inside
 * `AppDataTable`'s `#filters` slot.
 *
 * The search input was removed in WU-B (REQ-4): `AppDataTable`'s toolbar
 * owns the search box and maps it to `useServerTable`'s `globalFilter`
 * (300ms debounce). Keeping a second input here duplicated that contract.
 *
 * Status tabs use lowercase values matching the backend API contract:
 * 'all' | 'active' | 'terminated'
 *
 * NOTE: 'on_leave' is NOT included — the backend GET /admin/employees list
 * endpoint only supports status: 'active' | 'terminated' | 'all'.
 * The ON_LEAVE status exists as an Employee.status enum value (row badges),
 * but it is NOT a valid list filter param. It must not be emitted from here.
 * Ref: backend doc §4.1 GET /admin/employees query params.
 */
import { EMPLOYEE_STATUS_FILTER } from '../constants/employee.constants'
import type { EmployeeStatusFilter } from '../api/employees.api'

const props = defineProps<{
  statusTab: EmployeeStatusFilter
}>()

const emit = defineEmits<{
  'update:status-tab': [value: EmployeeStatusFilter]
}>()

const STATUS_TABS: { label: string; value: EmployeeStatusFilter }[] = [
  { label: 'Todos', value: EMPLOYEE_STATUS_FILTER.ALL },
  { label: 'Activos', value: EMPLOYEE_STATUS_FILTER.ACTIVE },
  { label: 'Bajas', value: EMPLOYEE_STATUS_FILTER.TERMINATED },
]

function onTabSelect(value: EmployeeStatusFilter) {
  emit('update:status-tab', value)
}
</script>

<template>
  <div class="flex items-center gap-1 rounded-lg bg-transparent">
    <button
      v-for="tab in STATUS_TABS"
      :key="tab.value"
      type="button"
      class="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
      :class="
        props.statusTab === tab.value
          ? 'border border-default bg-elevated text-highlighted shadow-sm'
          : 'text-muted hover:bg-elevated/60 hover:text-default'
      "
      @click="onTabSelect(tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
