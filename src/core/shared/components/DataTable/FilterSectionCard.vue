<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <!-- Card section (mobile, inside the filters bottom-sheet). On desktop
       (md+) the wrapper becomes transparent (display: contents) and the
       title is hidden, so the raw filters render inline in the toolbar
       exactly as they did before the mobile sheet — the card look must
       NEVER leak into the desktop layout. -->
  <div class="rounded-lg border border-default bg-elevated/30 px-4 py-4 md:contents">
    <p v-if="title" class="mb-4 text-sm font-semibold text-highlighted md:hidden">{{ title }}</p>
    <slot />
  </div>
</template>
