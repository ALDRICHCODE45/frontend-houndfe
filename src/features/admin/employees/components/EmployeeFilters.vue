<script setup lang="ts">
/**
 * EmployeeFilters — WU-02 (warning fixes applied)
 *
 * Presentational component: search input + status tabs.
 * Emits filter changes up to the parent view (props down, events up).
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
import type { EmployeeStatusFilter } from '../api/employees.api'

const props = withDefaults(
  defineProps<{
    search: string
    statusTab: EmployeeStatusFilter
    isLoading?: boolean
  }>(),
  {
    isLoading: false,
  },
)

const emit = defineEmits<{
  'update:search': [value: string]
  'update:statusTab': [value: EmployeeStatusFilter]
}>()

const STATUS_TABS: { label: string; value: EmployeeStatusFilter }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Activos', value: 'active' },
  { label: 'Bajas', value: 'terminated' },
]

function onSearchUpdate(value: string) {
  emit('update:search', value)
}

function onTabSelect(value: EmployeeStatusFilter) {
  emit('update:statusTab', value)
}
</script>

<template>
  <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
    <!-- Search -->
    <UInput
      :model-value="props.search"
      icon="i-lucide-search"
      placeholder="Buscar colaborador..."
      :loading="isLoading"
      class="w-full lg:w-72"
      size="lg"
      @update:model-value="onSearchUpdate"
    />

    <!-- Status tabs -->
    <div class="flex items-center gap-1 rounded-lg bg-transparent">
      <button
        v-for="tab in STATUS_TABS"
        :key="tab.value"
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
  </div>
</template>
