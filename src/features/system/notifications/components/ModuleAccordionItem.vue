<script setup lang="ts">
/**
 * ModuleAccordionItem — one accordion panel body for a single registry module.
 *
 * The UAccordion parent (ActionsAccordion) composes items from the registry
 * and renders the trigger (label + count badge + chevron). This component
 * is the *body* of a single item — it only owns the action-row list. The
 * per-module count was lifted to the trigger so the panel stays clean
 * (no redundant uppercase sub-header).
 *
 * Props ↓ / Events ↑:
 *   - module:      the registry entry (used to enumerate actions)
 *   - modelValue:  the current enabledActions set (forwarded to rows)
 *   - disabled:    master-off → all rows render greyed
 *   - Emits @toggle with the next enabledActions array (parent owns state)
 */
import type { ModuleDescriptor } from '../interfaces/notification-config.types'
import ActionRow from './ActionRow.vue'

defineProps<{
  module: ModuleDescriptor
  modelValue: readonly string[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  toggle: [next: string[]]
}>()

function onToggle(next: string[]) {
  emit('toggle', next)
}
</script>

<template>
  <div class="space-y-3">
    <ActionRow
      v-for="action in module.actions"
      :key="action.key"
      :action="action"
      :model-value="modelValue"
      :disabled="disabled"
      @toggle="onToggle"
    />
  </div>
</template>
