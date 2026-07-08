<script setup lang="ts">
/**
 * MasterToggle — USwitch wrapper for the master "Notificaciones" toggle.
 *
 * Thin component: takes a boolean model + optional label/description,
 * renders USwitch + a UBadge with the "Activadas"/"Desactivadas" copy.
 *
 * Props ↓ / Events ↑:
 *   - modelValue:   boolean
 *   - disabled?:    boolean — when true the switch is greyed
 *   - label?:       string — switch label text (default "Notificaciones")
 *   - description?: string — sub-text under the label
 *   - Emits @update:modelValue with the next boolean
 *
 * Badge copy + tone live in `masterToggleState.ts` so the spec strings
 * are testable without mounting the component.
 */
import { computed } from 'vue'
import { computeMasterBadgeState } from './masterToggleState'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    disabled?: boolean
    label?: string
    description?: string
  }>(),
  {
    disabled: false,
    label: 'Notificaciones',
    description: 'Cuando estén activadas, los usuarios seleccionados recibirán notificaciones del sistema.',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const badge = computed(() => computeMasterBadgeState(props.modelValue))

function onUpdate(next: boolean) {
  emit('update:modelValue', next)
}
</script>

<template>
  <div
    class="flex items-center justify-between gap-4"
    data-testid="master-toggle"
    :data-enabled="modelValue"
  >
    <div class="flex flex-col gap-1">
      <USwitch
        :model-value="modelValue"
        :disabled="disabled"
        :label="label"
        :description="description"
        @update:model-value="onUpdate"
      />
    </div>
    <UBadge
      :color="badge.color"
      variant="subtle"
      size="md"
      data-testid="master-toggle-badge"
    >
      {{ badge.label }}
    </UBadge>
  </div>
</template>