<script setup lang="ts">
/**
 * InlinePriceInput — The price cell of a price table: `$ [ 70.55 ]`, typed as
 * text and read with the one app-wide money rule (HfMoneyInput). It saves on
 * blur or Enter only a valid, changed amount: text that does not parse keeps
 * the parser error under the field, and a blank price says «Escribe el monto.»
 * instead of saving $0.00.
 *
 * Props:
 *   priceCents — the saved price, in cents
 *   label      — aria-label of the input
 *   disabled
 *
 * Events:
 *   commit(cents) — the field was left (or Enter) with a new valid amount
 */
import { ref, watch } from 'vue'
import HfMoneyInput from '@/core/shared/components/form/HfMoneyInput.vue'
import { MONEY_INPUT_ERRORS } from '@/core/shared/utils/money-input.utils'

const props = defineProps<{
  priceCents: number
  label: string
  disabled?: boolean
}>()

const emit = defineEmits<{ commit: [cents: number] }>()

const draft = ref<number | null>(props.priceCents)
const parseError = ref<string | null>(null)
const blankError = ref<string | null>(null)

watch(() => props.priceCents, (cents) => {
  draft.value = cents
  blankError.value = null
})

function onModel(cents: number | null) {
  draft.value = cents
  blankError.value = null
}

function commit() {
  if (parseError.value) return
  if (draft.value == null) {
    blankError.value = MONEY_INPUT_ERRORS.empty
    return
  }
  if (draft.value !== props.priceCents) emit('commit', draft.value)
}

function blurOnEnter(event: KeyboardEvent) {
  ;(event.target as HTMLInputElement).blur()
}
</script>

<template>
  <HfMoneyInput
    :model-value="draft"
    :error="blankError"
    :disabled="disabled"
    :aria-label="label"
    :ui="{ base: 'hf-figure text-right' }"
    @update:model-value="onModel"
    @validation="parseError = $event"
    @blur="commit"
    @keyup.enter="blurOnEnter"
  />
</template>
