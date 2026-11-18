<script setup lang="ts">
/**
 * HfToggleChips — filters or a few short multiple options (docs/design-system.md
 * §Selección sin checkboxes, «Toggle chips»). A named group of native buttons
 * with `aria-pressed`: 36px pills (44px below md), a check icon and
 * `--hf-active-soft` / `--hf-active` when pressed, never color alone.
 * `clearable` adds «Limpiar (n)» while any chip is on (emits `clear` too).
 */
import { computed } from 'vue'
import './hf-selection.css'

export interface HfToggleChipItem {
  value: string
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    items: readonly HfToggleChipItem[]
    modelValue: readonly string[]
    label?: string
    labelledby?: string
    disabled?: boolean
    clearable?: boolean
    clearLabel?: string
  }>(),
  { label: undefined, labelledby: undefined, disabled: false, clearable: false, clearLabel: 'Limpiar' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string[]]; clear: [] }>()

const selected = computed(() => new Set(props.modelValue))

function toggle(item: HfToggleChipItem) {
  if (props.disabled || item.disabled) return
  const next = new Set(props.modelValue)
  if (next.has(item.value)) next.delete(item.value)
  else next.add(item.value)
  const known = new Set(props.items.map((entry) => entry.value))
  emit('update:modelValue', [
    ...props.items.filter((entry) => next.has(entry.value)).map((entry) => entry.value),
    ...props.modelValue.filter((value) => !known.has(value) && next.has(value)),
  ])
}

function clear() {
  if (props.disabled) return
  emit('update:modelValue', [])
  emit('clear')
}
</script>

<template>
  <div class="hf-toggle-chips" role="group" :aria-label="label" :aria-labelledby="labelledby">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="hf-toggle-chip"
      :aria-pressed="selected.has(item.value)"
      :disabled="disabled || item.disabled"
      :data-value="item.value"
      @click="toggle(item)"
    >
      <UIcon v-if="selected.has(item.value)" name="i-lucide-check" class="hf-toggle-chip__check" aria-hidden="true" />
      {{ item.label }}
    </button>
    <button
      v-if="clearable && modelValue.length > 0"
      type="button"
      class="hf-toggle-chips__clear"
      :disabled="disabled"
      @click="clear"
    >
      {{ clearLabel }} ({{ modelValue.length }})
    </button>
  </div>
</template>
