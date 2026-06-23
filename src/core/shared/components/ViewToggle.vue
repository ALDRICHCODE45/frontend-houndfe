<script lang="ts">
/**
 * ViewToggle — Shared segmented view toggle.
 *
 * Generic Tabla / Tarjetas (or any 2+ option) toggle with role=tablist semantics.
 * Visual parity with the original EmployeeViewToggle.
 *
 * Props:
 *   modelValue — currently active option value
 *   options    — array of { value, label, icon? }; defaults to table + card
 *   ariaLabel  — accessible label for the tablist
 *
 * Emits:
 *   update:modelValue — when the user selects a different option
 */

export interface ViewToggleOption {
  value: string
  label: string
  icon?: string
}

// Defined in normal <script> so withDefaults() can reference it without hoisting issues.
export const VIEW_TOGGLE_DEFAULT_OPTIONS: ViewToggleOption[] = [
  { value: 'table', label: 'Tabla', icon: 'i-lucide-table' },
  { value: 'card', label: 'Tarjetas', icon: 'i-lucide-layout-grid' },
]
</script>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string
    options?: ViewToggleOption[]
    ariaLabel?: string
  }>(),
  {
    options: () => VIEW_TOGGLE_DEFAULT_OPTIONS,
    ariaLabel: 'Seleccionar vista',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onSelect(value: string): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="flex items-center gap-1 rounded-lg border border-default bg-elevated/70 p-1 shadow-sm"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="option in props.options"
      :key="option.value"
      role="tab"
      :aria-selected="props.modelValue === option.value"
      class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
      :class="
        props.modelValue === option.value
          ? 'bg-default text-highlighted shadow-sm'
          : 'text-muted hover:text-default'
      "
      @click="onSelect(option.value)"
    >
      <UIcon v-if="option.icon" :name="option.icon" class="size-4" />
      {{ option.label }}
    </button>
  </div>
</template>
