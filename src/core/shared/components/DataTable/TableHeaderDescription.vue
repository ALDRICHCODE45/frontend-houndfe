<script setup lang="ts">
interface Props {
  title: string
  description: string
}

defineProps<Props>()
</script>

<template>
  <div>
    <h1 class="text-2xl text-black dark:text-white font-bold tracking-tight">{{ title }}</h1>
    <p class="text-muted mt-1 text-sm">{{ description }}</p>
  </div>
</template>
