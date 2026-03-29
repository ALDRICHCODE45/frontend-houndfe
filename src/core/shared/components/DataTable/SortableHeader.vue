<script setup lang="ts">
import type { Column } from '@tanstack/vue-table'

defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Column<any>
  label: string
}>()
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    :label="label"
    :trailing-icon="
      column.getIsSorted()
        ? column.getIsSorted() === 'asc'
          ? 'i-lucide-arrow-up-narrow-wide'
          : 'i-lucide-arrow-down-wide-narrow'
        : 'i-lucide-arrow-up-down'
    "
    class="-mx-2.5"
    @click="column.toggleSorting(column.getIsSorted() === 'asc')"
  />
</template>
