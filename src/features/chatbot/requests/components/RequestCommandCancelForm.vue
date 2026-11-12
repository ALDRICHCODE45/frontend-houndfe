<script setup lang="ts">
/**
 * RequestCommandCancelForm — cancel with a staff reason (radio rows), an internal note (required
 * with «Otro motivo») and an optional «Mensaje para el cliente». With «Duplicada» the customer
 * message is hidden and never sent (handoff 11 §3.4).
 */
import { computed, reactive, ref } from 'vue'
import { emptyCancelDraft, NOTE_MAX, validateCancel, type CancelDraft } from '../utils/command-forms'
import type { ChatbotRequestStaffCancelReason } from '../interfaces/chatbot-request.types'
import RequestCommandField from './RequestCommandField.vue'
import RequestCommandFooter from './RequestCommandFooter.vue'
import RequestCommandRadioGroup, { type RadioItem } from './RequestCommandRadioGroup.vue'

const props = defineProps<{ pending?: boolean; serverErrors?: Record<string, string> }>()
const emit = defineEmits<{ submit: [draft: CancelDraft]; back: [] }>()

const REASONS: RadioItem[] = [
  { value: 'DUPLICATE', label: 'Duplicada' },
  { value: 'NOT_ACTIONABLE', label: 'No se puede atender' },
  { value: 'CUSTOMER_UNREACHABLE', label: 'El cliente no responde' },
  { value: 'OTHER', label: 'Otro motivo', hint: 'Pide una nota interna.' },
]

const draft = reactive<CancelDraft>(emptyCancelDraft())
const submitted = ref(false)
const errors = computed(() => ({
  ...(props.serverErrors ?? {}),
  ...(submitted.value ? validateCancel(draft) : {}),
}))
const isDuplicate = computed(() => draft.reason === 'DUPLICATE')

function submit(): void {
  submitted.value = true
  if (Object.keys(validateCancel(draft)).length > 0) return
  emit('submit', { ...draft })
}
</script>

<template>
  <form class="rc-form" data-testid="cancel-form" novalidate @submit.prevent="submit">
    <p class="rc-lead">La solicitud sale de la bandeja y queda en Canceladas.</p>
    <RequestCommandRadioGroup
      :model-value="draft.reason"
      :items="REASONS"
      label="Motivo"
      :error="errors.reason"
      :disabled="pending"
      @update:model-value="draft.reason = $event as ChatbotRequestStaffCancelReason"
    />
    <RequestCommandField
      v-model="draft.note"
      label="Nota interna"
      multiline
      :maxlength="NOTE_MAX"
      :optional="draft.reason !== 'OTHER'"
      help="Solo la ve el personal."
      :error="errors.note"
      :disabled="pending"
      test-id="cancel-note"
    />
    <p v-if="isDuplicate" class="rc-hint" data-testid="cancel-duplicate-hint">
      Con «Duplicada» no se envía mensaje al cliente.
    </p>
    <RequestCommandField
      v-else
      v-model="draft.customerNote"
      label="Mensaje para el cliente"
      multiline
      :maxlength="NOTE_MAX"
      optional
      help="Si lo dejas vacío, el bot manda su aviso genérico."
      :error="errors.customerNote"
      :disabled="pending"
      test-id="cancel-customer-note"
    />
    <RequestCommandFooter label="Cancelar solicitud" danger :pending="pending" @back="emit('back')" />
  </form>
</template>
