<script setup lang="ts">
/**
 * RequestCommandRadioGroup — a single choice shown as rows (design «radio rows», never checkboxes).
 * A radiogroup with roving focus: the chosen row (or the first) is the tab stop; arrows move and
 * select, wrapping; Home and End jump to the ends.
 */
import { computed, ref, useId } from 'vue'

export interface RadioItem {
  value: string
  label: string
  hint?: string
}

const props = defineProps<{
  modelValue: string
  items: readonly RadioItem[]
  label: string
  error?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const uid = useId()
const rows = ref<HTMLButtonElement[]>([])
const checkedIndex = computed(() => props.items.findIndex((item) => item.value === props.modelValue))
const tabStop = computed(() => (checkedIndex.value >= 0 ? checkedIndex.value : 0))
const errorId = computed(() => `${uid}-error`)

function select(index: number, focus: boolean): void {
  const item = props.items[index]
  if (props.disabled || !item) return
  if (item.value !== props.modelValue) emit('update:modelValue', item.value)
  if (focus) rows.value[index]?.focus()
}

function onKeydown(keyEvent: KeyboardEvent, index: number): void {
  const count = props.items.length
  const pressed = keyEvent.key
  let next = -1
  if (pressed === 'ArrowDown' || pressed === 'ArrowRight') next = (index + 1) % count
  else if (pressed === 'ArrowUp' || pressed === 'ArrowLeft') next = (index - 1 + count) % count
  else if (pressed === 'Home') next = 0
  else if (pressed === 'End') next = count - 1
  else return
  keyEvent.preventDefault()
  select(next, true)
}
</script>

<template>
  <div class="rc-field">
    <div
      class="rc-radios"
      role="radiogroup"
      :aria-label="label"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? errorId : undefined"
    >
      <button
        v-for="(item, index) in items"
        :key="item.value"
        ref="rows"
        type="button"
        role="radio"
        class="rc-radio"
        :data-testid="`radio-${item.value}`"
        :aria-checked="item.value === modelValue"
        :tabindex="index === tabStop ? 0 : -1"
        :disabled="disabled"
        @click="select(index, false)"
        @keydown="onKeydown($event, index)"
      >
        <span class="rc-radio__mark" aria-hidden="true" />
        <span class="rc-radio__text">
          <b>{{ item.label }}</b>
          <small v-if="item.hint">{{ item.hint }}</small>
        </span>
      </button>
    </div>
    <p v-if="error" :id="errorId" class="rc-error" role="alert">{{ error }}</p>
  </div>
</template>
