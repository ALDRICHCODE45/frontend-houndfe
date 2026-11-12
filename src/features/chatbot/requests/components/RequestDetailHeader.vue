<script setup lang="ts">
/**
 * RequestDetailHeader — breadcrumb back to the inbox, folio, type, status and the bot summary as
 * the page title (the backend has no short title: folio + type + summary). The summary is bot
 * text: rendered as text, never as HTML.
 */
import { computed } from 'vue'
import type { ChatbotRequestDetail } from '../interfaces/chatbot-request.types'
import { formatWhen, windowClosingTag } from '../utils/requestLabels'
import RequestStatusBadge from './RequestStatusBadge.vue'
import SubtypeTag from './SubtypeTag.vue'

const props = defineProps<{
  request: ChatbotRequestDetail
  currentUserId?: string | null
  timeZone?: string
  now?: Date
}>()

const inbox = { name: 'chatbot-requests' }
const created = computed(() => formatWhen(props.request.createdAt, { timeZone: props.timeZone, now: props.now }))
const windowTag = computed(() => windowClosingTag(props.request.whatsappWindowClosesAt, props.now))
</script>

<template>
  <header class="rd-header">
    <nav class="rd-crumbs" aria-label="Ruta">
      <span>Chatbot</span>
      <span aria-hidden="true">/</span>
      <RouterLink data-testid="breadcrumb-inbox" :to="inbox">Solicitudes</RouterLink>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{{ request.folio }}</span>
    </nav>
    <div class="rd-header__row">
      <RouterLink
        data-testid="back-to-inbox"
        class="rd-back"
        :to="inbox"
        aria-label="Volver a Solicitudes"
      >
        <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
      </RouterLink>
      <div class="rd-header__body">
        <div class="rd-meta">
          <RequestStatusBadge :row="request" :current-user-id="currentUserId" />
          <span class="rd-folio" data-testid="request-folio">{{ request.folio }}</span>
          <SubtypeTag :subtype="request.subtype" />
          <span v-if="created">Creada {{ created }}</span>
          <span v-if="windowTag" class="rd-tag rd-tag--warn" data-testid="window-tag">{{ windowTag }}</span>
        </div>
        <h1 class="rd-title">{{ request.summary }}</h1>
      </div>
    </div>
  </header>
</template>
