<script setup lang="ts">
/**
 * ActionRow — one row inside an accordion module.
 *
 * Thin component: takes a single action descriptor and renders it as a
 * USwitch + label. All gating logic (master-enabled, dirty detection,
 * count formatting) is in pure helpers (`notificationRowState.ts`) — the
 * SFC just forwards props and emits.
 *
 * Props ↓ / Events ↑:
 *   - action:        descriptor to render
 *   - modelValue:    the current membership set (so the switch can be
 *                    marked checked when this action is in it)
 *   - disabled:      from parent (master-off greys)
 *   - Emits @toggle  with the new enabledActions array (parent owns
 *                    reactivity — the row never mutates modelValue).
 */
import { computed } from 'vue'
import type { ActionDescriptor } from '../interfaces/notification-config.types'
import {
  computeActionRowState,
  toggleActionMembership,
} from './notificationRowState'

const props = defineProps<{
  action: ActionDescriptor
  modelValue: readonly string[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  toggle: [next: string[]]
}>()

const state = computed(() =>
  computeActionRowState(props.action, !props.disabled, props.modelValue),
)

function handleToggle(nextChecked: boolean) {
  // USwitch emits a boolean; we translate that to the action's membership.
  if (nextChecked === state.value.checked) return
  emit('toggle', toggleActionMembership(props.action.key, props.modelValue))
}
</script>

<template>
  <div
    :data-testid="`action-row-${action.key.toLowerCase().replace(/_/g, '-')}`"
    :data-checked="state.checked"
    :data-disabled="state.disabled"
    class="flex items-center"
  >
    <USwitch
      :model-value="state.checked"
      :disabled="state.disabled"
      :label="action.label"
      @update:model-value="handleToggle"
    />
  </div>
</template>