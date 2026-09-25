<script setup lang="ts">
/**
 * HumanDecisionsView — routed shell at /pos/decisiones-pendientes (HD3A).
 *
 * Deliberately inert: this slice ships no list, detail or resolve UI and
 * issues no backend read. HD3B layers the pending list on the same route, so
 * the copy states the boundary instead of rendering a false empty result.
 */
</script>

<template>
  <section class="w-full space-y-4 p-4 sm:p-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-highlighted">Decisiones pendientes</h1>
      <p class="text-sm text-muted">
        Bandeja de decisiones de reposición que requieren una intervención antes de continuar.
      </p>
    </header>

    <div
      role="status"
      class="rounded-lg border border-default bg-elevated/50 p-6 text-sm text-muted"
    >
      Aquí aparecerán las solicitudes de reposición que necesitan una respuesta.
    </div>
  </section>
</template>
