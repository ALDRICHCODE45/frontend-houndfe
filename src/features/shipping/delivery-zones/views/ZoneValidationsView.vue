<script setup lang="ts">
/**
 * ZoneValidationsView — «Validaciones de zona» (ODD shipping-settings T1, S2):
 * the chatbot's pending delivery-zone validations, guarded by
 * validate:DeliveryZone. Placeholder until T2 lands the queue.
 */
import EmptyState from '@/core/shared/components/EmptyState.vue'
</script>

<template>
  <div class="hf-theme hf-ui flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <header class="hf-page-header">
      <h1 class="hf-page-title">Validaciones de zona</h1>
      <p class="hf-page-subtitle">Códigos postales que el chatbot pidió confirmar.</p>
    </header>

    <EmptyState title="Validaciones de zona: todavía no disponible" />
  </div>
</template>
