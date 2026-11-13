<script setup lang="ts">
/**
 * RequestCommandReplyForm — answers a clarification (handoff 19). One plain-text field, 1–1500
 * characters; the reply closes the request and the bot relays it to the customer. On a `NEW`
 * request replying also takes it, in the same step. Validation runs here; the host builds the body.
 */
import { computed, reactive, ref } from 'vue'
import { emptyReplyDraft, REPLY_MAX, validateReply, type ReplyDraft } from '../utils/command-forms'
import RequestCommandField from './RequestCommandField.vue'
import RequestCommandFooter from './RequestCommandFooter.vue'

const props = defineProps<{
  /** The request is `NEW`: replying also takes it and resolves it. */
  claimsOnReply?: boolean
  pending?: boolean
  serverErrors?: Record<string, string>
}>()
const emit = defineEmits<{ submit: [draft: ReplyDraft]; back: [] }>()

const draft = reactive<ReplyDraft>(emptyReplyDraft())
const submitted = ref(false)
const errors = computed(() => ({
  ...(props.serverErrors ?? {}),
  ...(submitted.value ? validateReply(draft) : {}),
}))

function submit(): void {
  submitted.value = true
  if (Object.keys(validateReply(draft)).length > 0) return
  emit('submit', { ...draft })
}
</script>

<template>
  <form class="rc-form" data-testid="reply-form" novalidate @submit.prevent="submit">
    <p v-if="claimsOnReply" class="rc-lead" data-testid="reply-claims">
      Al responder también la tomas y la resuelves.
    </p>
    <p v-else class="rc-lead">La solicitud queda resuelta y el bot le envía tu respuesta al cliente.</p>
    <RequestCommandField
      v-model="draft.text"
      label="Respuesta"
      multiline
      :maxlength="REPLY_MAX"
      help="Texto sin formato, tal cual lo recibirá el cliente por WhatsApp."
      :error="errors.text"
      :disabled="pending"
      test-id="reply-text"
    />
    <RequestCommandFooter label="Enviar respuesta" :pending="pending" @back="emit('back')" />
  </form>
</template>
