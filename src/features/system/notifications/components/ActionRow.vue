<script setup lang="ts">
/**
 * ActionRow — one row inside an accordion module.
 *
 * Thin component: takes a single action descriptor and renders it as a
 * self-contained card (label + optional description on the left, USwitch
 * pinned to the right). All gating logic (master-enabled, dirty detection,
 * count formatting) is in pure helpers (`notificationRowState.ts`) — the
 * SFC just forwards props and emits.
 *
 * Props ↓ / Events ↑:
 *   - action:        descriptor to render (label required, description
 *                    optional — when absent, no subtitle is rendered so
 *                    the card layout stays clean)
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

// Stable, unique ids for the label and (optional) description elements.
// The USwitch's `aria-labelledby` / `aria-describedby` point at these so the
// role="switch" control has a programmatic accessible name even though we no
// longer use USwitch's built-in `label` prop (the card layout owns the text).
// Mirrors the slug already used for the row's data-testid.
const actionSlug = computed(() =>
  props.action.key.toLowerCase().replace(/_/g, '-'),
)
const labelId = computed(() => `action-label-${actionSlug.value}`)
const descriptionId = computed(() => `action-description-${actionSlug.value}`)

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
    class="flex items-center justify-between gap-4 rounded-lg border border-default bg-default p-4"
  >
    <div class="min-w-0">
      <div :id="labelId" class="font-medium text-default">
        {{ action.label }}
      </div>
      <p
        v-if="action.description"
        :id="descriptionId"
        class="mt-1 text-sm text-muted"
        data-testid="action-description"
      >
        {{ action.description }}
      </p>
    </div>
    <USwitch
      :model-value="state.checked"
      :disabled="state.disabled"
      :aria-labelledby="labelId"
      :aria-describedby="action.description ? descriptionId : undefined"
      @update:model-value="handleToggle"
    />
  </div>
</template>