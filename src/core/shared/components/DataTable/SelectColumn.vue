<script setup lang="ts">
import type { Table, Row } from '@tanstack/vue-table'

defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table?: Table<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row?: Row<any>
  mode: 'header' | 'cell'
}>()
</script>

<template>
  <UCheckbox
    v-if="mode === 'header' && table"
    :model-value="
      table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected()
    "
    @update:model-value="
      (value: boolean | 'indeterminate') => table!.toggleAllPageRowsSelected(!!value)
    "
    aria-label="Seleccionar todos"
  />
  <UCheckbox
    v-else-if="mode === 'cell' && row"
    :model-value="row.getIsSelected()"
    @update:model-value="(value: boolean | 'indeterminate') => row!.toggleSelected(!!value)"
    aria-label="Seleccionar fila"
  />
</template>
