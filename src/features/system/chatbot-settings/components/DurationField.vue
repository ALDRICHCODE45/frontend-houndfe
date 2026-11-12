<script setup lang="ts">
/**
 * DurationField — business minutes in the units people read. A number plus a unit select (min / h);
 * when the value may be «Sin plazo» the select has that third option, which stores `null`. The model
 * is always minutes (`null` = no deadline, `NaN` = text that is not a number yet, so validation can
 * say so). The unit and the typed text are local; they resync only when the model changes from outside
 * (discard, 409, reload).
 */
import { computed, ref, watch } from 'vue'
import {
  initialUnit,
  parseDuration,
  textForUnit,
  type DurationUnit,
} from '../utils/settingsUnits'

type Unit = DurationUnit | 'none'

const props = withDefaults(
  defineProps<{
    modelValue: number | null
    label: string
    id: string
    /** Offers «Sin plazo» (stores `null`). Off: a blank number is invalid. */
    nullable?: boolean
    invalid?: boolean
    describedby?: string
  }>(),
  { nullable: true, invalid: false, describedby: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const startUnit = (value: number | null): Unit =>
  value === null && props.nullable ? 'none' : initialUnit(Number.isNaN(value) ? null : value)

const unit = ref<Unit>(startUnit(props.modelValue))
const text = ref(unit.value === 'none' ? '' : textForUnit(props.modelValue, unit.value))

function parse(): number | null {
  if (unit.value === 'none') return null
  const parsed = parseDuration(text.value, unit.value)
  return parsed === null && !props.nullable ? Number.NaN : parsed
}

watch(
  () => props.modelValue,
  (value) => {
    if (Object.is(value, parse())) return
    unit.value = startUnit(value)
    text.value = unit.value === 'none' ? '' : textForUnit(value, unit.value)
  },
)

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  emit('update:modelValue', parse())
}

const unitItems = computed(() => [
  { label: 'min', value: 'min' },
  { label: 'h', value: 'h' },
  ...(props.nullable ? [{ label: 'Sin plazo', value: 'none' }] : []),
])

function onUnit(value: unknown) {
  const next = value as Unit
  if (next === unit.value) return
  const current = props.modelValue
  unit.value = next
  if (next === 'none') {
    text.value = ''
    emit('update:modelValue', null)
    return
  }
  // The same amount of time in the new unit (90 min → 1.5 h), never a silent change of value.
  if (typeof current === 'number' && !Number.isNaN(current)) text.value = textForUnit(current, next)
  else emit('update:modelValue', parse())
}
</script>

<template>
  <div class="cbs-duration" :data-unit="unit">
    <input
      :id="id"
      class="cbs-input cbs-figure"
      inputmode="decimal"
      autocomplete="off"
      :value="text"
      :disabled="unit === 'none'"
      :placeholder="unit === 'none' ? 'Sin plazo' : '0'"
      :aria-label="label"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-describedby="describedby"
      data-testid="duration-input"
      @input="onInput"
    />
    <USelect
      :model-value="unit"
      :items="unitItems"
      value-key="value"
      label-key="label"
      size="lg"
      class="cbs-unit"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay chatbot-settings-dialog' }"
      :aria-label="`Unidad de ${label}`"
      data-testid="duration-unit"
      @update:model-value="onUnit"
    />
  </div>
</template>
