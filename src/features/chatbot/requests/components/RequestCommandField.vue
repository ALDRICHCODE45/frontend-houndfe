<script setup lang="ts">
/**
 * RequestCommandField — one text control of a command form: label (with «(opcional)»), a single
 * line or a textarea, the character counter when there is a limit, help and the field error.
 * The text is the user's: it is bound as a value, never rendered as HTML.
 */
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    multiline?: boolean
    maxlength?: number
    optional?: boolean
    help?: string
    error?: string
    inputmode?: 'text' | 'numeric' | 'decimal'
    prefix?: string
    disabled?: boolean
    testId?: string
  }>(),
  { multiline: false, optional: false, inputmode: 'text', disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const uid = useId()
const messageId = computed(() => `${uid}-message`)
const describedBy = computed(() => (props.error || props.help ? messageId.value : undefined))

function onInput(inputEvent: Event): void {
  emit('update:modelValue', (inputEvent.target as HTMLInputElement | HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="rc-field">
    <label class="rc-label" :for="uid">{{ label }}<span v-if="optional"> (opcional)</span></label>
    <div class="rc-control">
      <span v-if="prefix" class="rc-prefix" aria-hidden="true">{{ prefix }}</span>
      <textarea
        v-if="multiline"
        :id="uid"
        class="rc-ctl"
        rows="3"
        :value="modelValue"
        :maxlength="maxlength"
        :disabled="disabled"
        :data-testid="testId"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="onInput"
      />
      <input
        v-else
        :id="uid"
        class="rc-ctl"
        type="text"
        autocomplete="off"
        :value="modelValue"
        :maxlength="maxlength"
        :inputmode="inputmode"
        :disabled="disabled"
        :data-testid="testId"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="onInput"
      />
    </div>
    <div class="rc-meta">
      <p v-if="error" :id="messageId" class="rc-error" role="alert">{{ error }}</p>
      <p v-else-if="help" :id="messageId" class="rc-help">{{ help }}</p>
      <span v-else />
      <span v-if="multiline && maxlength" class="rc-counter" :data-testid="testId ? `${testId}-count` : undefined">
        {{ modelValue.length }}/{{ maxlength }}
      </span>
    </div>
  </div>
</template>
