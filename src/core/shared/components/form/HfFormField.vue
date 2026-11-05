<script setup lang="ts">
/**
 * HfFormField — The frame of one field: the label above (13px/500), its
 * markers, an optional hint on the right (`40 de 80`), the control (slot) and
 * one message line below (the error replaces the help).
 *
 * Markers: `required` is an amber dot with `Requerido para publicar` for
 * assistive tech (never red); `internal` is a lock plus `Interno`.
 * `specialAnswers` adds ghost actions (`No lo sé`, `No aplica`) on the right
 * that appear on hover or focus within the field (always on touch) and emit
 * `special`; meant for text-like fields. Choice fields offer the same answers
 * inside HfCombobox instead. The hint wins the right side over the ghosts.
 *
 * Props:
 *   label         — visible label
 *   for           — id of a native control: renders a `<label for>`
 *   labelId       — id of the label element, for a control named with aria-labelledby
 *   hint, help, error
 *   required, internal
 *   specialAnswers — { value, label }[]
 *
 * The message id is `${for ?? labelId}-message`, to pass as the control's describedby.
 */
import { computed } from 'vue'
import type { HfSpecialAnswer } from './HfCombobox.vue'
import './hf-form.css'

const props = withDefaults(defineProps<{
  label: string
  for?: string
  labelId?: string
  hint?: string
  help?: string
  error?: string
  required?: boolean
  internal?: boolean
  specialAnswers?: readonly Pick<HfSpecialAnswer, 'value' | 'label'>[]
}>(), {
  for: undefined,
  labelId: undefined,
  hint: undefined,
  help: undefined,
  error: undefined,
  specialAnswers: () => [],
})

const emit = defineEmits<{ special: [value: string] }>()

const message = computed(() => props.error || props.help || '')
const messageId = computed(() => {
  const base = props.for ?? props.labelId
  return base ? `${base}-message` : undefined
})
</script>

<template>
  <div class="hf-form-field" :data-invalid="error ? 'true' : undefined">
    <div class="hf-form-field__row">
      <label v-if="props.for" :id="labelId" class="hf-form-field__label" :for="props.for">{{ label }}</label>
      <span v-else :id="labelId" class="hf-form-field__label">{{ label }}</span>
      <span v-if="required" class="hf-form-field__required">
        <span class="hf-form-field__dot" aria-hidden="true" />
        <span class="sr-only">Requerido para publicar</span>
      </span>
      <span v-if="internal" class="hf-form-field__internal">
        <UIcon name="i-lucide-lock" class="hf-form-field__internal-icon" aria-hidden="true" />Interno
      </span>
      <span v-if="hint" class="hf-form-field__hint">{{ hint }}</span>
      <span v-else-if="specialAnswers.length > 0" class="hf-form-field__ghosts">
        <button
          v-for="answer in specialAnswers"
          :key="answer.value"
          type="button"
          class="hf-form-field__ghost"
          :aria-label="`${label}: marcar como ${answer.label}`"
          @click="emit('special', answer.value)"
        >
          {{ answer.label }}
        </button>
      </span>
    </div>
    <slot />
    <p
      v-if="message"
      :id="messageId"
      class="hf-form-field__message"
      :data-tone="error ? 'error' : 'help'"
    >
      {{ message }}
    </p>
  </div>
</template>
