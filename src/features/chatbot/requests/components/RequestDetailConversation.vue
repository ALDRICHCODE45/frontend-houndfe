<script setup lang="ts">
/**
 * RequestDetailConversation — placeholder of the conversation block. The messages arrive with
 * backend unit 9 (shape pending), so there is nothing to read or write yet. The view only mounts
 * it with `read:ChatbotConversation`.
 */
import { useId } from 'vue'

const headingId = useId()
</script>

<template>
  <section class="rd-panel" :aria-labelledby="headingId" data-testid="detail-conversation">
    <h2 :id="headingId">Conversación</h2>
    <div class="rd-soon">
      <UIcon name="i-lucide-messages-square" aria-hidden="true" />
      <p><b>Disponible próximamente</b></p>
      <p class="rd-sub">Aquí se verán los mensajes del cliente y del bot cuando llegue la conversación en vivo.</p>
    </div>
  </section>
</template>
