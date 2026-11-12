<script setup lang="ts">
/**
 * ChatbotRequestsView — «Chatbot → Solicitudes» (route `chatbot-requests`), the inbox grouped by
 * customer (design/chatbot-requests/01-tabla-agrupada.html + 04 mobile and states).
 *
 * Composition surface only: header with the counts, the forbidden gate (`read:ChatbotRequest`)
 * and the board that owns the URL state, the queries and the states. Opening a request is the
 * only row action here; quick actions come with the commands unit.
 */
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { useRequestAccess } from '../composables/useRequestAccess'
import { useRequestCounts } from '../composables/useRequestCounts'
import RequestsListBoard from '../components/RequestsListBoard.vue'
import RequestsListHeader from '../components/RequestsListHeader.vue'
import '../styles/chatbot-requests-list.css'

const auth = useAuthStore()
const { canRead } = useRequestAccess()
const { counts } = useRequestCounts()
</script>

<template>
  <div class="hf-theme hf-ui chatbot-requests flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <section aria-labelledby="chatbot-requests-title">
      <RequestsListHeader :counts="counts" />
    </section>

    <EmptyState
      v-if="!canRead"
      kind="forbidden"
      title="No tienes permiso para ver las solicitudes del chatbot"
      description="Pide a un administrador el permiso «Ver solicitudes del chatbot» (read:ChatbotRequest)."
    />

    <RequestsListBoard v-else :counts="counts" :current-user-id="auth.user?.id ?? null" />
  </div>
</template>
