<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <div class="rounded-lg border border-default bg-elevated/30 px-4 py-4">
    <p v-if="title" class="mb-4 text-sm font-semibold text-highlighted">{{ title }}</p>
    <slot />
  </div>
</template>
