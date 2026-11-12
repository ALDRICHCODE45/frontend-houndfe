<script setup lang="ts">
/**
 * RequestDetailSkeleton — loading placeholder shaped like the page (main column + rail), so
 * nothing jumps when the request arrives. The bars use the shared `hf-skeleton` wash.
 */
</script>

<template>
  <div class="rd-skeleton" aria-busy="true" data-testid="detail-loading">
    <span class="sr-only">Cargando solicitud…</span>
    <div class="rd-skeleton__main">
      <div class="rd-panel" data-skeleton="section">
        <div class="hf-skeleton animate-pulse rd-skeleton__bar" style="width: 35%" />
        <div class="hf-skeleton animate-pulse rd-skeleton__bar" style="width: 70%" />
        <div class="hf-skeleton animate-pulse rd-skeleton__bar" style="width: 50%" />
      </div>
      <div class="rd-panel" data-skeleton="section">
        <div class="hf-skeleton animate-pulse rd-skeleton__bar" style="width: 30%" />
        <div class="hf-skeleton animate-pulse rd-skeleton__bar" style="width: 85%" />
        <div class="hf-skeleton animate-pulse rd-skeleton__bar" style="width: 60%" />
      </div>
      <div class="rd-panel" data-skeleton="section">
        <div class="hf-skeleton animate-pulse rd-skeleton__bar" style="width: 40%" />
        <div class="hf-skeleton animate-pulse rd-skeleton__bar" style="width: 75%" />
      </div>
    </div>
    <div class="rd-skeleton__rail">
      <div class="rd-panel" data-skeleton="rail">
        <div class="hf-skeleton animate-pulse rd-skeleton__bar" style="width: 45%" />
        <div class="hf-skeleton animate-pulse rd-skeleton__bar" style="width: 80%" />
      </div>
    </div>
  </div>
</template>
