<script lang="ts">
import type { Table } from '@tanstack/vue-table'

/**
 * The row last toggled in each table: the anchor of a Shift+click range. Kept per
 * table instance so two tables on one screen never share it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rangeAnchors = new WeakMap<Table<any>, string>()
</script>

<script setup lang="ts">
/**
 * SelectColumn — the table selection column without a checkbox
 * (docs/design-system.md §Selección sin checkboxes, «Row mark»): a round mark
 * in a 44px button (`HfRowMark`, `aria-pressed`) for the header (empty → all →
 * some = mixed, on the current page) and for every row. Shift+click on a row
 * applies the clicked row's new state to every row between it and the row last
 * toggled. The mark's click never reaches a clickable row.
 */
import type { Row } from '@tanstack/vue-table'
import { computed } from 'vue'
import { HfRowMark } from '@/core/shared/components/selection'

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table?: Table<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row?: Row<any>
  mode: 'header' | 'cell'
  /** Accessible name of a row's mark (`Seleccionar a Laura Méndez`); defaults to `Seleccionar fila`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  label?: string | ((original: any) => string)
  /** Accessible name of the header mark. */
  headerLabel?: string
}>()

const headerState = computed<boolean | 'mixed'>(() => {
  const table = props.table
  if (!table) return false
  if (table.getIsAllPageRowsSelected()) return true
  return table.getIsSomePageRowsSelected() ? 'mixed' : false
})

const rowLabel = computed(() => {
  if (!props.row) return ''
  if (typeof props.label === 'function') return props.label(props.row.original)
  return props.label ?? 'Seleccionar fila'
})

function toggleAll(value: boolean) {
  props.table?.toggleAllPageRowsSelected(value)
}

function toggleRow(value: boolean, event: MouseEvent) {
  const { row, table } = props
  if (!row) return
  const anchorId = table ? rangeAnchors.get(table) : undefined
  if (table && event.shiftKey && anchorId !== undefined && anchorId !== row.id) {
    const rows = table.getRowModel().rows
    const from = rows.findIndex((candidate) => candidate.id === anchorId)
    const to = rows.findIndex((candidate) => candidate.id === row.id)
    if (from >= 0 && to >= 0) {
      const range = rows.slice(Math.min(from, to), Math.max(from, to) + 1)
      table.setRowSelection((previous) => {
        const next = { ...previous }
        for (const candidate of range) {
          if (!candidate.getCanSelect()) continue
          if (value) next[candidate.id] = true
          else delete next[candidate.id]
        }
        return next
      })
      rangeAnchors.set(table, row.id)
      return
    }
  }
  row.toggleSelected(value)
  if (table) rangeAnchors.set(table, row.id)
}
</script>

<template>
  <HfRowMark
    v-if="mode === 'header' && table"
    :checked="headerState"
    :label="headerLabel ?? 'Seleccionar todos'"
    @update:checked="toggleAll"
  />
  <HfRowMark
    v-else-if="mode === 'cell' && row"
    :checked="row.getIsSelected()"
    :label="rowLabel"
    :disabled="!row.getCanSelect()"
    @toggle="toggleRow"
  />
</template>
