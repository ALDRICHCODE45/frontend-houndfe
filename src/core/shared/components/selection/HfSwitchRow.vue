<script setup lang="ts">
/**
 * HfSwitchRow — one on/off option as a whole-row switch (docs/design-system.md
 * §Selección sin checkboxes, «Switch row»). The row is a native button with
 * `role="switch"`: the label, the description, the state word and the painted
 * track are one target, so Space and Enter work natively.
 *
 * Disabled keeps the row focusable (`aria-disabled`) so its reason is read.
 * Optimistic saves: `saving` says «Guardando…» with `aria-busy`; `error` shows
 * an alert linked to the switch with «Reintentar» (emits `retry`).
 */
import { computed, useId } from 'vue'
import './hf-selection.css'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    label: string
    description?: string
    /** Show the state word (`onLabel` / `offLabel`). */
    showState?: boolean
    onLabel?: string
    offLabel?: string
    savingLabel?: string
    disabled?: boolean
    /** Why the row is disabled; shown under the description and read with it. */
    disabledReason?: string
    saving?: boolean
    /** A failed save: the message of the alert under the row. */
    error?: string
    retryLabel?: string
    testId?: string
    errorTestId?: string
    retryTestId?: string
  }>(),
  {
    description: undefined,
    showState: true,
    onLabel: 'Activado',
    offLabel: 'Desactivado',
    savingLabel: 'Guardando…',
    disabled: false,
    disabledReason: undefined,
    saving: false,
    error: undefined,
    retryLabel: 'Reintentar',
    testId: undefined,
    errorTestId: undefined,
    retryTestId: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean]; retry: [] }>()

const labelId = useId()
const descriptionId = useId()
const reasonId = useId()
const errorId = useId()

const stateLabel = computed(() => {
  if (props.saving) return props.savingLabel
  return props.modelValue ? props.onLabel : props.offLabel
})
const describedBy = computed(() => {
  const ids: string[] = []
  if (props.description) ids.push(descriptionId)
  if (props.disabled && props.disabledReason) ids.push(reasonId)
  if (props.error) ids.push(errorId)
  return ids.length ? ids.join(' ') : undefined
})

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <div class="hf-switch-row" :class="{ 'is-error': !!error }">
    <button
      type="button"
      role="switch"
      class="hf-switch-row__button"
      :aria-checked="modelValue"
      :aria-disabled="disabled ? 'true' : undefined"
      :aria-busy="saving ? 'true' : undefined"
      :aria-labelledby="labelId"
      :aria-describedby="describedBy"
      :data-testid="testId"
      @click="toggle"
    >
      <span class="hf-switch-row__text">
        <span :id="labelId" class="hf-switch-row__label">{{ label }}</span>
        <span v-if="description" :id="descriptionId" class="hf-switch-row__desc">{{ description }}</span>
        <span v-if="disabled && disabledReason" :id="reasonId" class="hf-switch-row__reason">
          <UIcon name="i-lucide-lock" aria-hidden="true" />
          {{ disabledReason }}
        </span>
      </span>
      <span v-if="showState" class="hf-switch-row__state">{{ stateLabel }}</span>
      <span class="hf-switch-row__track" aria-hidden="true" />
    </button>
    <div v-if="error" :id="errorId" class="hf-switch-row__error" role="alert" :data-testid="errorTestId">
      <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
      <span>{{ error }}</span>
      <UButton
        :label="retryLabel"
        size="xs"
        color="neutral"
        variant="outline"
        :data-testid="retryTestId"
        @click="emit('retry')"
      />
    </div>
  </div>
</template>
