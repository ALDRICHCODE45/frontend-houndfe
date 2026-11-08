<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted } from 'vue'
import type { Column } from '@tanstack/vue-table'
import { DATA_TABLE_HEADER } from './headerContext'

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Column<any>
  label: string
}>()

// Inside an AppDataTable header the header itself is the control, so the label is plain text with
// the sort arrow and the table learns that this column sorts.
const header = inject(DATA_TABLE_HEADER, null)
// Registered once mounted: a change made while the table renders would not re-render it.
let unregister: (() => void) | undefined
onMounted(() => {
  unregister = header?.registerSortable(props.column.id)
})
onBeforeUnmount(() => unregister?.())

const sorted = computed(() => props.column.getIsSorted())
const icon = computed(() =>
  sorted.value
    ? sorted.value === 'asc'
      ? 'i-lucide-arrow-up-narrow-wide'
      : 'i-lucide-arrow-down-wide-narrow'
    : 'i-lucide-arrow-up-down',
)
</script>

<template>
  <span v-if="header" class="hf-th-sort" :data-sorted="sorted || undefined">
    <span class="hf-th-sort-label">{{ label }}</span>
    <UIcon :name="icon" class="hf-th-sort-icon" aria-hidden="true" />
  </span>
  <UButton
    v-else
    color="neutral"
    variant="ghost"
    :label="label"
    :trailing-icon="icon"
    class="-mx-2.5"
    @click="column.toggleSorting(column.getIsSorted() === 'asc')"
  />
</template>
