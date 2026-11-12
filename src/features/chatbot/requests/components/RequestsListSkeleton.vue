<script setup lang="ts">
/** RequestsListSkeleton — loading placeholders that keep the final space (table rows or cards). */
defineProps<{ layout: 'table' | 'cards' }>()
</script>

<template>
  <div class="chatbot-skeleton" data-testid="list-skeleton" aria-busy="true">
    <template v-if="layout === 'table'">
      <div v-for="n in 6" :key="n" class="chatbot-skeleton__row" data-testid="skeleton-row">
        <span class="chatbot-skel" style="width: 35%" />
        <span class="chatbot-skel" style="width: 70%" />
      </div>
    </template>
    <template v-else>
      <div v-for="n in 3" :key="n" class="chatbot-card chatbot-skeleton__card" data-testid="skeleton-card">
        <span class="chatbot-skel" style="width: 75%" />
        <span class="chatbot-skel" style="width: 45%" />
        <span class="chatbot-skel" style="width: 30%; margin-top: 8px" />
      </div>
    </template>
    <p class="sr-only">Cargando solicitudes</p>
  </div>
</template>
