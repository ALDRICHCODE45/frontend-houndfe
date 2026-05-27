<script setup lang="ts">
/**
 * EmployeeViewToggle — WU-03
 *
 * Segmented Tabla / Tarjetas toggle.
 *
 * Design: UTabs (variant=pill) bound to `useEmployeeViewMode`.
 * Emits 'update:modelValue' for v-model integration.
 *
 * Accessible: tab role, aria-selected for current mode.
 */

import type { EmployeeViewMode } from '../composables/useEmployeeViewMode'

const props = defineProps<{
  modelValue: EmployeeViewMode
}>()

const emit = defineEmits<{
  'update:modelValue': [value: EmployeeViewMode]
}>()

const TABS: { label: string; value: EmployeeViewMode; icon: string }[] = [
  { label: 'Tabla', value: 'table', icon: 'i-lucide-table' },
  { label: 'Tarjetas', value: 'card', icon: 'i-lucide-layout-grid' },
]

function onSelect(value: EmployeeViewMode) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="flex items-center gap-1 rounded-lg border border-default bg-elevated/70 p-1 shadow-sm"
    role="tablist"
    aria-label="Vista de colaboradores"
  >
    <button
      v-for="tab in TABS"
      :key="tab.value"
      role="tab"
      :aria-selected="props.modelValue === tab.value"
        class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
        :class="
          props.modelValue === tab.value
            ? 'bg-default text-highlighted shadow-sm'
            : 'text-muted hover:text-default'
        "
      @click="onSelect(tab.value)"
    >
      <UIcon :name="tab.icon" class="size-4" />
      {{ tab.label }}
    </button>
  </div>
</template>
