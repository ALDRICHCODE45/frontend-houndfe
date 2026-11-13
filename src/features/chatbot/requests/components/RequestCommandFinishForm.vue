<script setup lang="ts">
/**
 * RequestCommandFinishForm — ends a live conversation (handoff 20 §4). The note is internal and
 * required (1–1000). A COMPLAINT also needs its outcome, one of four radio rows (stored for
 * metrics only: nothing is refunded or changed). Validation runs here; the host builds the body.
 */
import { computed, reactive, ref } from 'vue'
import type { ChatbotRequestSubtype } from '../interfaces/chatbot-request.types'
import { emptyFinishDraft, FINISH_NOTE_MAX, validateFinish, type FinishDraft } from '../utils/command-forms'
import { COMPLAINT_OUTCOME_LABELS } from '../utils/requestLabels'
import RequestCommandField from './RequestCommandField.vue'
import RequestCommandFooter from './RequestCommandFooter.vue'
import RequestCommandRadioGroup, { type RadioItem } from './RequestCommandRadioGroup.vue'

const props = defineProps<{
  subtype: ChatbotRequestSubtype
  /** `FINISH_IDLE` is offered: the customer has been silent for 30 minutes. */
  idle?: boolean
  pending?: boolean
  serverErrors?: Record<string, string>
}>()
const emit = defineEmits<{ submit: [draft: FinishDraft]; back: [] }>()

const OUTCOMES: RadioItem[] = [
  { value: 'RETURN', label: COMPLAINT_OUTCOME_LABELS.RETURN },
  { value: 'REPLACEMENT', label: COMPLAINT_OUTCOME_LABELS.REPLACEMENT },
  { value: 'REFUND', label: COMPLAINT_OUTCOME_LABELS.REFUND },
  { value: 'NO_ACTION', label: COMPLAINT_OUTCOME_LABELS.NO_ACTION },
]

const draft = reactive<FinishDraft>(emptyFinishDraft())
const submitted = ref(false)
const isComplaint = computed(() => props.subtype === 'COMPLAINT')
const errors = computed(() => ({
  ...(props.serverErrors ?? {}),
  ...(submitted.value ? validateFinish(props.subtype, draft) : {}),
}))

function submit(): void {
  submitted.value = true
  if (Object.keys(validateFinish(props.subtype, draft)).length > 0) return
  emit('submit', { ...draft })
}
</script>

<template>
  <form class="rc-form" data-testid="finish-form" novalidate @submit.prevent="submit">
    <p class="rc-lead">La solicitud queda resuelta y el bot retoma la conversación con el cliente.</p>
    <p v-if="idle" class="rc-hint" data-testid="finish-idle">
      El cliente lleva 30 min sin escribir: ya puedes finalizar sin esperar más.
    </p>

    <template v-if="isComplaint">
      <p class="rc-label">Resultado de la queja</p>
      <RequestCommandRadioGroup
        :model-value="draft.complaintOutcome"
        :items="OUTCOMES"
        label="Resultado de la queja"
        :error="errors.complaintOutcome"
        :disabled="pending"
        @update:model-value="draft.complaintOutcome = $event"
      />
      <p class="rc-help">Solo se guarda para las métricas: no se devuelve dinero ni se cambia ningún pedido.</p>
    </template>

    <RequestCommandField
      v-model="draft.note"
      label="Nota interna"
      multiline
      :maxlength="FINISH_NOTE_MAX"
      help="Solo la ve el personal."
      :error="errors.note"
      :disabled="pending"
      test-id="finish-note"
    />
    <RequestCommandFooter label="Finalizar conversación" :pending="pending" @back="emit('back')" />
  </form>
</template>
