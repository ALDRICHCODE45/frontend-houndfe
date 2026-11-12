<script setup lang="ts">
/**
 * NumberField — a whole number with its own typed text. The model is the number, or `NaN` while the
 * text is not a whole number (validation says so). Resyncs from the model only when it changes from
 * outside (discard, 409), never while the user is typing.
 */
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: number
  label: string
  id: string
  invalid?: boolean
  describedby?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const text = ref(Number.isNaN(props.modelValue) ? '' : String(props.modelValue))
const parse = (raw: string) => (/^\d+$/.test(raw.trim()) ? parseInt(raw.trim(), 10) : Number.NaN)

watch(
  () => props.modelValue,
  (value) => {
    if (!Object.is(value, parse(text.value))) text.value = Number.isNaN(value) ? '' : String(value)
  },
)

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  emit('update:modelValue', parse(text.value))
}
</script>

<template>
  <input
    :id="id"
    class="cbs-input cbs-figure"
    inputmode="numeric"
    autocomplete="off"
    :value="text"
    :aria-label="label"
    :aria-invalid="invalid ? 'true' : undefined"
    :aria-describedby="describedby"
    data-testid="number-input"
    @input="onInput"
  />
</template>
