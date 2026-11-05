<script setup lang="ts">
/**
 * HfUnitField — A number joined to its unit in one field: `[ 10 | kg ▾ ]`,
 * or a range `[ 10 – 40 | kg ▾ ]`. One border, one focus ring (on the whole
 * control), an inner divider, and the unit list is an embedded HfCombobox.
 *
 * Props:
 *   modelValue      — { value?, min?, max?, unit? } (value for single, min/max for range)
 *   units           — { label, value }[] for the unit list
 *   range           — two numbers (mínimo, máximo)
 *   label           — the field name; names the inputs and the unit trigger
 *   id              — id of the (first) number input, for the visible label
 *   invalid, disabled, describedby, placeholder
 *   specialAnswers  — footer answers of the unit list; while `special` is set
 *   special           its label replaces the number in muted italic
 *
 * Events:
 *   update:modelValue — the whole object; a number cleared or not a number yet is `undefined`
 *   update:special    — a special answer was picked, or `null` when a unit is picked again
 *   update:text       — (part, text) the raw text of an input as typed, for owners that
 *                       validate it themselves (`5x` is `undefined` in the model)
 */
import { computed, ref, watch } from 'vue'
import HfCombobox, { type HfComboboxItem, type HfSpecialAnswer } from './HfCombobox.vue'
import './hf-form.css'

export interface HfUnitValue {
  value?: number
  min?: number
  max?: number
  unit?: string
}

type NumberPart = 'value' | 'min' | 'max'

const props = withDefaults(defineProps<{
  modelValue?: HfUnitValue
  units: readonly HfComboboxItem[]
  range?: boolean
  label: string
  id?: string
  invalid?: boolean
  disabled?: boolean
  describedby?: string
  placeholder?: string
  specialAnswers?: readonly HfSpecialAnswer[]
  special?: string | null
}>(), {
  modelValue: () => ({}),
  placeholder: '0',
  specialAnswers: () => [],
  special: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: HfUnitValue]
  'update:special': [value: string | null]
  'update:text': [part: NumberPart, text: string]
}>()

const parts = computed<NumberPart[]>(() => props.range ? ['min', 'max'] : ['value'])
const activeSpecial = computed(() => props.specialAnswers.find(answer => answer.value === props.special) ?? null)

// Each input keeps its own text so a half-typed number ("3.", "2,") survives
// the round trip through the parent; it resyncs when the model really changes.
const drafts = ref<Record<NumberPart, string>>({ value: '', min: '', max: '' })

function parse(text: string): number | undefined {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return undefined
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : undefined
}

watch(() => props.modelValue, (model) => {
  for (const part of ['value', 'min', 'max'] as const) {
    const next = model?.[part]
    if (parse(drafts.value[part]) !== next) drafts.value[part] = next == null ? '' : String(next)
  }
}, { immediate: true, deep: true })

function onInput(part: NumberPart, event: Event) {
  const text = (event.target as HTMLInputElement).value
  drafts.value[part] = text
  emit('update:text', part, text)
  emit('update:modelValue', { ...props.modelValue, [part]: parse(text) })
}

function onUnit(unit: string | string[] | null) {
  emit('update:modelValue', { ...props.modelValue, unit: typeof unit === 'string' ? unit : undefined })
}

function inputLabel(part: NumberPart) {
  if (part === 'min') return `${props.label}, mínimo`
  if (part === 'max') return `${props.label}, máximo`
  return undefined
}
</script>

<template>
  <div
    class="hf-unit-field"
    :class="{ 'hf-unit-field--invalid': invalid, 'hf-unit-field--disabled': disabled }"
    role="group"
    :aria-label="label"
  >
    <span v-if="activeSpecial" :id="id ? `${id}-special` : undefined" class="hf-unit-field__special">{{ activeSpecial.label }}</span>
    <template v-for="(part, index) in parts" v-else :key="part">
      <span v-if="index > 0" class="hf-unit-field__dash" aria-hidden="true">–</span>
      <input
        :id="index === 0 ? id : undefined"
        class="hf-unit-field__input"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        :value="drafts[part]"
        :placeholder="range ? (part === 'min' ? 'Mín.' : 'Máx.') : placeholder"
        :aria-label="inputLabel(part)"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedby"
        :disabled="disabled"
        @input="onInput(part, $event)"
      >
    </template>
    <span class="hf-unit-field__divider" aria-hidden="true" />
    <span class="hf-unit-field__unit">
      <HfCombobox
        embedded
        :items="units"
        :model-value="modelValue?.unit ?? null"
        :label="`${label}, unidad`"
        placeholder="Unidad"
        :disabled="disabled"
        :special-answers="specialAnswers"
        :special="special"
        :search-threshold="Number.POSITIVE_INFINITY"
        @update:model-value="onUnit"
        @update:special="emit('update:special', $event)"
      />
    </span>
  </div>
</template>
