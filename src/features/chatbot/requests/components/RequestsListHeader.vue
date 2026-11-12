<script setup lang="ts">
/**
 * RequestsListHeader — «Solicitudes», the open count and the counts line of `/counts`
 * (design 01-tabla-agrupada `listHTML` header).
 */
import { computed } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { ChatbotRequestCounts } from '../interfaces/chatbot-request.types'

const props = defineProps<{ counts: ChatbotRequestCounts | null }>()

const open = computed(() => (props.counts ? props.counts.new + props.counts.inProgress : 0))
const openLabel = computed(() => `${open.value} ${open.value === 1 ? 'abierta' : 'abiertas'}`)
const countsLine = computed(() => {
  const c = props.counts
  if (!c) return null
  const news = `${c.new} ${c.new === 1 ? 'nueva' : 'nuevas'}`
  const overdue = `${c.overdue} ${c.overdue === 1 ? 'vencida' : 'vencidas'}`
  return `${news} · ${c.inProgress} en atención · ${overdue}`
})
</script>

<template>
  <header class="hf-page-header chatbot-list-header">
    <div class="chatbot-list-header__title">
      <h1 id="chatbot-requests-title" class="hf-page-title">Solicitudes</h1>
      <StatusBadge
        v-if="counts"
        data-testid="open-count"
        :label="openLabel"
        tone="warning"
        aria-prefix=""
      />
    </div>
    <p v-if="countsLine" class="hf-page-subtitle" data-testid="counts-line">
      {{ countsLine }}. Las solicitudes del mismo cliente van juntas; las más urgentes primero.
    </p>
    <p v-else class="hf-page-subtitle">Solicitudes del chatbot que necesitan a una persona.</p>
  </header>
</template>
