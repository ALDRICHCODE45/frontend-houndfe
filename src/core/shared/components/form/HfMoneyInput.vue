<script setup lang="ts">
/**
 * HfMoneyInput — An MXN amount typed as text: `$ [ 70.55 ]`, read with the one
 * app-wide money rule (`parseMoneyInput`: `70,55` and `1,234.50` are accepted,
 * an ambiguous comma or a third decimal is rejected, never guessed or rounded).
 *
 * v-model is in CENTS: a number, or `null` for an empty field. Text that does
 * not parse never reaches the model; the parser error is emitted at once as
 * `validation` (so the owner can block its submit) and shown under the field,
 * in the HfFormField message style, once the field was left. On blur a valid
 * amount is rewritten as plain text (`1,234.5` → `1234.50`).
 *
 * Props:
 *   modelValue           — cents or null
 *   id                   — id of the input; the message id is `${id}-message`
 *   minCents, maxCents   — inclusive bounds, checked by the parser
 *   error                — an owner error (for example «supera la deuda»), shown
 *                          when the text itself parses
 *   placeholder, disabled, size
 *
 * Attributes (`data-testid`, `aria-*`, …) go to the native input; `class` and
 * `style` to the root.
 */
import { computed, ref, useAttrs, useId, watch } from 'vue'
import { centsToMoneyInput, parseMoneyInput } from '../../utils/money-input.utils'
import './hf-form.css'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue: number | null
  id?: string
  minCents?: number
  maxCents?: number
  error?: string | null
  placeholder?: string
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>(), {
  id: undefined,
  minCents: undefined,
  maxCents: undefined,
  error: null,
  placeholder: '0.00',
  size: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [cents: number | null]
  validation: [error: string | null]
}>()

const attrs = useAttrs()
const rootAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))
const inputAttrs = computed(() =>
  Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== 'class' && key !== 'style')),
)

const fallbackId = useId()
const inputId = computed(() => props.id ?? fallbackId)
const messageId = computed(() => `${inputId.value}-message`)

const draft = ref('')
const parseError = ref<string | null>(null)
const touched = ref(false)
const focused = ref(false)

const bounds = computed(() => ({ minCents: props.minCents, maxCents: props.maxCents }))

/** The cents of a text: a number, `null` for blank, `undefined` when it does not parse. */
function centsOf(text: string): number | null | undefined {
  if (text.trim() === '') return null
  const result = parseMoneyInput(text, bounds.value)
  return 'cents' in result ? result.cents : undefined
}

function setError(error: string | null) {
  if (parseError.value === error) return
  parseError.value = error
  emit('validation', error)
}

watch(() => props.modelValue, (cents) => {
  if (focused.value || centsOf(draft.value) === cents) return
  draft.value = cents == null ? '' : centsToMoneyInput(cents)
  setError(null)
}, { immediate: true })

function onText(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  draft.value = text
  if (text.trim() === '') {
    setError(null)
    emit('update:modelValue', null)
    return
  }
  const result = parseMoneyInput(text, bounds.value)
  if ('cents' in result) {
    setError(null)
    emit('update:modelValue', result.cents)
  } else {
    setError(result.error)
  }
}

function onBlur() {
  focused.value = false
  touched.value = true
  const cents = centsOf(draft.value)
  if (typeof cents === 'number' && cents === props.modelValue) draft.value = centsToMoneyInput(cents)
}

const shownError = computed(() => (touched.value && parseError.value) || (!parseError.value && props.error) || null)
</script>

<template>
  <div class="hf-money-input" v-bind="rootAttrs">
    <UInput
      v-bind="inputAttrs"
      :id="inputId"
      :model-value="draft"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      :placeholder="placeholder"
      :disabled="disabled"
      :size="size"
      :aria-invalid="shownError ? 'true' : undefined"
      :aria-describedby="shownError ? messageId : undefined"
      class="w-full"
      @update:model-value="onText"
      @focus="focused = true"
      @blur="onBlur"
    >
      <template #leading>
        <span class="text-sm text-dimmed" aria-hidden="true">$</span>
      </template>
    </UInput>
    <p v-if="shownError" :id="messageId" class="hf-form-field__message" data-tone="error">
      {{ shownError }}
    </p>
  </div>
</template>
