<script setup lang="ts">
/**
 * ActionRow — one notification action as a whole-row switch (HfSwitchRow):
 * label, description, state word and track are one `role="switch"` target.
 *
 * While the master is off the row stays focusable (`aria-disabled`), says
 * «En pausa» for a kept selection and reads why it cannot change. Without
 * update permission (`readonly`) it is locked without a pause reason; the
 * page notice explains the lock.
 *
 * Props ↓ / Events ↑:
 *   - action:        registry descriptor (label, optional description)
 *   - modelValue:    the current enabledActions set
 *   - masterEnabled: master switch state
 *   - readonly?:     no update permission
 *   - Emits @toggle  with the next enabledActions array (parent owns state)
 */
import { computed } from 'vue'
import { HfSwitchRow } from '@/core/shared/components/selection'
import type { ActionDescriptor } from '../interfaces/notification-config.types'
import {
  computeActionStateWord,
  computePausedReason,
  toggleActionMembership,
} from './notificationRowState'

const props = withDefaults(
  defineProps<{
    action: ActionDescriptor
    modelValue: readonly string[]
    masterEnabled: boolean
    readonly?: boolean
  }>(),
  { readonly: false },
)

const emit = defineEmits<{ toggle: [next: string[]] }>()

const slug = computed(() => props.action.key.toLowerCase().replace(/_/g, '-'))
const checked = computed(() => props.modelValue.includes(props.action.key))
const stateWord = computed(() => computeActionStateWord(checked.value, props.masterEnabled))
const disabled = computed(() => !props.masterEnabled || props.readonly)
const reason = computed(() => (props.masterEnabled ? undefined : computePausedReason(checked.value)))

function onUpdate(next: boolean) {
  if (next === checked.value) return
  emit('toggle', toggleActionMembership(props.action.key, props.modelValue))
}
</script>

<template>
  <HfSwitchRow
    class="nc-action-row"
    :data-testid="`action-row-${slug}`"
    :data-checked="checked"
    :data-disabled="disabled"
    :model-value="checked"
    :label="action.label"
    :description="action.description"
    :on-label="stateWord"
    :off-label="stateWord"
    :disabled="disabled"
    :disabled-reason="reason"
    @update:model-value="onUpdate"
  />
</template>
