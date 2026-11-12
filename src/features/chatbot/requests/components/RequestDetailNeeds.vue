<script setup lang="ts">
/**
 * RequestDetailNeeds — what the customer needs (free text) and the flat context of the moment.
 * Both come from the bot or the customer: plain text only, never `v-html`.
 */
import { computed, useId } from 'vue'
import type { ChatbotRequestContext } from '../interfaces/chatbot-request.types'
import { contextEntries } from '../utils/detail-format'

const props = defineProps<{
  needs: string | null
  context: ChatbotRequestContext | null
}>()

const headingId = useId()
const entries = computed(() => contextEntries(props.context))
const needsText = computed(() => props.needs?.trim() || 'El bot no dejó más detalles.')
</script>

<template>
  <section class="rd-panel" :aria-labelledby="headingId" data-testid="needs-card">
    <h2 :id="headingId">Qué necesita el cliente</h2>
    <p class="rd-quote" data-testid="request-needs">{{ needsText }}</p>
    <div v-if="entries.length" data-testid="request-context">
      <h3 class="rd-subhead">Contexto del momento</h3>
      <dl class="rd-kv">
        <template v-for="entry in entries" :key="entry.key">
          <dt>{{ entry.label }}</dt>
          <dd :title="entry.title">{{ entry.value }}</dd>
        </template>
      </dl>
    </div>
  </section>
</template>
