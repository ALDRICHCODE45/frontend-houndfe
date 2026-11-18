<script setup lang="ts">
/**
 * HfRowMark — selects a table row (or all rows from the header) without a
 * checkbox (docs/design-system.md §Selección sin checkboxes, «Row mark»). A
 * round 24px mark inside a 44px native button with `aria-pressed`
 * true / false / mixed and an accessible `label` («Seleccionar a Laura»).
 *
 * Emits `update:checked` with the next value (unchecked → true, mixed → true,
 * checked → false) and `toggle` with the same value and the originating event,
 * so a table can read `shiftKey` for range selection. The click does not bubble
 * to a clickable row.
 */
import { computed } from 'vue'
import HfSelectionMark from './HfSelectionMark.vue'
import './hf-selection.css'

const props = withDefaults(
  defineProps<{
    checked: boolean | 'mixed'
    label: string
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'update:checked': [value: boolean]
  toggle: [value: boolean, event: MouseEvent]
}>()

const state = computed(() =>
  props.checked === 'mixed' ? 'mixed' : props.checked ? 'checked' : 'unchecked',
)

function onClick(event: MouseEvent) {
  event.stopPropagation()
  if (props.disabled) return
  const next = props.checked !== true
  emit('update:checked', next)
  emit('toggle', next, event)
}
</script>

<template>
  <button
    type="button"
    class="hf-row-mark"
    :aria-label="label"
    :aria-pressed="checked === 'mixed' ? 'mixed' : checked ? 'true' : 'false'"
    :disabled="disabled"
    @click="onClick"
  >
    <HfSelectionMark :state="state" />
  </button>
</template>
