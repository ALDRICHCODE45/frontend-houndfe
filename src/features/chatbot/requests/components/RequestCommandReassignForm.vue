<script setup lang="ts">
/**
 * RequestCommandReassignForm — pick who gets the request (the people `assignable-users` lists, the
 * exact set the route accepts) plus an optional note kept in the audit. The current assignee is
 * not offered.
 */
import { computed, reactive, ref } from 'vue'
import type { ChatbotRequestPerson } from '../interfaces/chatbot-request.types'
import { emptyReassignDraft, NOTE_MAX, validateReassign, type ReassignDraft } from '../utils/command-forms'
import RequestCommandField from './RequestCommandField.vue'
import RequestCommandFooter from './RequestCommandFooter.vue'
import RequestCommandRadioGroup from './RequestCommandRadioGroup.vue'

const props = defineProps<{
  users: ChatbotRequestPerson[]
  loading?: boolean
  loadFailed?: boolean
  /** The holder, left out of the list. */
  assigneeId?: string | null
  pending?: boolean
  serverErrors?: Record<string, string>
}>()
const emit = defineEmits<{ submit: [draft: ReassignDraft]; back: []; reload: [] }>()

const draft = reactive<ReassignDraft>(emptyReassignDraft())
const submitted = ref(false)
const items = computed(() =>
  props.users.filter((user) => user.id !== props.assigneeId).map((user) => ({ value: user.id, label: user.displayName })),
)
const errors = computed(() => ({
  ...(props.serverErrors ?? {}),
  ...(submitted.value ? validateReassign(draft) : {}),
}))

function submit(): void {
  submitted.value = true
  if (Object.keys(validateReassign(draft)).length > 0) return
  emit('submit', { ...draft })
}
</script>

<template>
  <form class="rc-form" data-testid="reassign-form" novalidate @submit.prevent="submit">
    <p class="rc-lead">Elige a quién se la pasas. Sigue En atención.</p>

    <p v-if="loading" class="rc-help" role="status" data-testid="reassign-loading">Cargando personas…</p>
    <div v-else-if="loadFailed" class="rc-hint" role="alert" data-testid="reassign-load-failed">
      No se pudo cargar la lista de personas.
      <UButton size="sm" color="neutral" variant="outline" label="Reintentar" @click="emit('reload')" />
    </div>
    <p v-else-if="items.length === 0" class="rc-hint" data-testid="reassign-empty">
      No hay otras personas disponibles en esta sucursal.
    </p>
    <RequestCommandRadioGroup
      v-else
      :model-value="draft.toUserId"
      :items="items"
      label="Persona"
      :error="errors.toUserId"
      :disabled="pending"
      @update:model-value="draft.toUserId = $event"
    />

    <RequestCommandField
      v-model="draft.note"
      label="Nota"
      multiline
      :maxlength="NOTE_MAX"
      optional
      help="Queda en el historial."
      :error="errors.note"
      :disabled="pending"
      test-id="reassign-note"
    />
    <RequestCommandFooter label="Reasignar" :pending="pending" :disabled="loading || loadFailed" @back="emit('back')" />
  </form>
</template>
