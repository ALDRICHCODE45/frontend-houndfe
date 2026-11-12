<script setup lang="ts">
/**
 * ChatbotRequestDetailView — `/chatbot/solicitudes/:id` (email deep link). Route stub of T2.U1:
 * the read side (customer, decision, audit, action panel) is filled in by T2.U3.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const requestId = computed(() => String(route.params.id ?? ''))
</script>

<template>
  <section class="space-y-2" aria-labelledby="chatbot-request-title" :data-request-id="requestId">
    <h1 id="chatbot-request-title" class="hf-page-title">Solicitud</h1>
  </section>
</template>
