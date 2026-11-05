<script setup lang="ts">
/**
 * HfSegmented — A short single choice shown whole: equal-width segments on a
 * `--hf-surface-muted` track, the chosen one raised on `--hf-surface`.
 * A radiogroup with roving focus: the chosen segment (or the first) is the one
 * tab stop; arrows move and select, wrapping; Home and End jump to the ends;
 * disabled segments are skipped. Use it for up to ~6 short options; longer
 * lists use HfCombobox.
 *
 * Props:
 *   items       — { label, value, disabled? }[]
 *   modelValue  — the chosen value
 *   label       — accessible name of the group (or `labelledby` for a visible label)
 *   disabled
 *   columns     — segments per row (default: one row with every item)
 */
import { computed, ref } from 'vue'
import type { HfComboboxItem } from './HfCombobox.vue'
import './hf-form.css'

const props = defineProps<{
  items: readonly HfComboboxItem[]
  modelValue?: string | null
  label?: string
  labelledby?: string
  disabled?: boolean
  columns?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const segments = ref<HTMLButtonElement[]>([])
const checkedIndex = computed(() => props.items.findIndex(item => item.value === props.modelValue))
const tabStop = computed(() => {
  if (checkedIndex.value >= 0) return checkedIndex.value
  return Math.max(0, props.items.findIndex(item => !item.disabled))
})

const KEY_STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

function select(index: number, focus: boolean) {
  const item = props.items[index]
  if (props.disabled || !item || item.disabled) return
  if (item.value !== props.modelValue) emit('update:modelValue', item.value)
  if (focus) segments.value[index]?.focus()
}

function enabledFrom(start: number, step: number) {
  const count = props.items.length
  for (let offset = 0; offset < count; offset++) {
    const index = (((start + step * offset) % count) + count) % count
    if (!props.items[index]?.disabled) return index
  }
  return -1
}

function onKeydown(event: KeyboardEvent, index: number) {
  let next = -1
  if (event.key === 'Home') next = enabledFrom(0, 1)
  else if (event.key === 'End') next = enabledFrom(props.items.length - 1, -1)
  else if (event.key in KEY_STEP) next = enabledFrom(index + KEY_STEP[event.key]!, KEY_STEP[event.key]!)
  else return
  event.preventDefault()
  if (next >= 0) select(next, true)
}
</script>

<template>
  <div
    class="hf-segmented"
    role="radiogroup"
    :aria-label="label"
    :aria-labelledby="labelledby"
    :aria-disabled="disabled || undefined"
    :style="{ '--hf-segments': columns ?? items.length }"
  >
    <button
      v-for="(item, index) in items"
      :key="item.value"
      ref="segments"
      type="button"
      role="radio"
      class="hf-segmented__segment"
      :aria-checked="index === checkedIndex"
      :tabindex="index === tabStop ? 0 : -1"
      :disabled="disabled || item.disabled"
      :title="item.label"
      @click="select(index, false)"
      @keydown="onKeydown($event, index)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
