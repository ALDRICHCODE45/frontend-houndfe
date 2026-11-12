<script setup lang="ts">
/**
 * RequestCommandPickForm — choose one option and confirm. Shared by MERGE (pick the request that
 * stays) and LINK_CUSTOMER (pick the customer): same radio rows, same states, different words.
 */
import { computed, ref } from 'vue'
import RequestCommandFooter from './RequestCommandFooter.vue'
import RequestCommandRadioGroup, { type RadioItem } from './RequestCommandRadioGroup.vue'

const props = defineProps<{
  testId: string
  lead: string
  groupLabel: string
  items: RadioItem[]
  loading?: boolean
  loadFailed?: boolean
  /** Shown when the choice list is empty. */
  emptyText: string
  /** Error when nothing is chosen. */
  requiredMessage: string
  hint?: string
  submitLabel: string
  pending?: boolean
  /** Server error for the choice (`CUSTOMER_PHONE_MISMATCH`, …). */
  serverError?: string
}>()
const emit = defineEmits<{ submit: [value: string]; back: []; reload: [] }>()

const chosen = ref('')
const submitted = ref(false)
const error = computed(() => (submitted.value && chosen.value === '' ? props.requiredMessage : props.serverError))

function submit(): void {
  submitted.value = true
  if (chosen.value === '') return
  emit('submit', chosen.value)
}
</script>

<template>
  <form class="rc-form" :data-testid="testId" novalidate @submit.prevent="submit">
    <p class="rc-lead">{{ lead }}</p>

    <p v-if="loading" class="rc-help" role="status" data-testid="pick-loading">Cargando…</p>
    <div v-else-if="loadFailed" class="rc-hint" role="alert" data-testid="pick-load-failed">
      No se pudo cargar la lista.
      <UButton size="sm" color="neutral" variant="outline" label="Reintentar" @click="emit('reload')" />
    </div>
    <p v-else-if="items.length === 0" class="rc-hint" data-testid="pick-empty">{{ emptyText }}</p>
    <RequestCommandRadioGroup
      v-else
      v-model="chosen"
      :items="items"
      :label="groupLabel"
      :error="error"
      :disabled="pending"
    />

    <p v-if="hint" class="rc-hint" data-testid="pick-hint">{{ hint }}</p>
    <RequestCommandFooter
      :label="submitLabel"
      :pending="pending"
      :disabled="loading || loadFailed || items.length === 0"
      @back="emit('back')"
    />
  </form>
</template>
