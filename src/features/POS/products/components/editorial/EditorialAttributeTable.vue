<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import EditorialAttributeCell from './EditorialAttributeCell.vue'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialFamily } from '../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialAssignmentInput } from '../../utils/editorial-contract-assignment-input'
import type { EditorialAssignmentEditingRow } from '../../utils/editorial-contract-document-editing'
import { applyEditorialCellInput, buildEditorialAttributeTable, editorialTargetKey, removeEditorialCell,
  type EditorialTableCell, type EditorialTableSubject } from '../../utils/editorial-attribute-table'

/** The editable table of the family's data: rows are the definitions, columns are Producto and one
 * per presentation. It derives everything from the stored assignments and hands the new array back;
 * nothing here saves, encodes or admits content. Controlled, like the other editorial fields.
 */
const props = defineProps<{ values: EditorialAssignmentEditingRow[]; family: EditorialFamily | null;
  definitions: readonly EditorialDefinition[]; subjects: readonly EditorialTableSubject[]; nextId: () => string;
  /** Only these row codes are shown; omit for all (the "Solo faltantes" filter). */
  visibleCodes?: ReadonlySet<string> | null
  readonly?: boolean; disabled?: boolean
  /** Message per assignment row id, shown next to its cell. */
  issues?: ReadonlyMap<string, string>
  /** Archived options the saved draft holds per target (see `editorialTargetKey`), which stay selectable. */
  conserved?: ReadonlyMap<string, readonly string[]> }>()
const emit = defineEmits<{ 'update:values': [values: EditorialAssignmentEditingRow[]] }>()

const table = computed(() => buildEditorialAttributeTable({ family: props.family, definitions: props.definitions, values: props.values, subjects: props.subjects }))
const rows = computed(() => (props.visibleCodes ? table.value.rows.filter(row => props.visibleCodes!.has(row.code)) : table.value.rows))
const orphans = computed(() => {
  const count = table.value.orphanCount
  return count ? `${count} ${count === 1 ? 'dato guardado no aparece' : 'datos guardados no aparecen'} en la tabla. Se conservan.` : ''
})

function change(cell: EditorialTableCell, input: EditorialAssignmentInput) {
  if (props.disabled || props.readonly) return
  emit('update:values', applyEditorialCellInput(props.values, cell, input, props.nextId))
}
function clear(cell: EditorialTableCell) {
  if (props.disabled || props.readonly || cell.rowId === null) return
  emit('update:values', removeEditorialCell(props.values, cell.rowId))
}
// A dash has no control, so it says where the datum is filled instead.
function whereItIsFilled(row: { cells: (EditorialTableCell | null)[] }) {
  return row.cells.find(Boolean)?.target.owner === 'product' ? 'Este dato se llena en Producto' : 'Este dato se llena en cada presentación'
}

// Enter finishes a cell and goes down the same column, to the next row that has a control there.
const root = useTemplateRef<HTMLElement>('root')
function moveDown(source: HTMLElement) {
  const from = source.closest('td')
  const start = from?.parentElement
  if (!from || !start) return
  const column = Array.from(start.children).indexOf(from)
  for (let next = start.nextElementSibling; next; next = next.nextElementSibling) {
    const control = next.children[column]?.querySelector<HTMLElement>('input[type="text"], select, summary')
    if (control) { control.focus(); return }
  }
}
</script>

<template>
  <div ref="root" class="hf-attr-table" data-testid="attribute-table">
    <table class="hf-attr-table__table">
      <caption class="sr-only">Datos de la ficha por producto y presentación</caption>
      <thead>
        <tr>
          <th scope="col" class="hf-attr-table__label">Dato</th>
          <th v-for="column in table.columns" :key="column.key" scope="col">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.code" :data-row="row.code">
          <th scope="row" class="hf-attr-table__label">{{ row.label }}</th>
          <td v-for="(cell, index) in row.cells" :key="table.columns[index]!.key" :class="{ 'hf-attr-table__none': !cell }">
            <EditorialAttributeCell v-if="cell" :id="`attr-${row.code}-${cell.key}`" :label="`${row.label} · ${table.columns[index]!.label}`"
              :definition="row.definition" :target="cell.target" :model-value="cell.input" :readonly="readonly" :disabled="disabled"
              :issue="cell.rowId ? issues?.get(cell.rowId) : undefined" :conserved-options="conserved?.get(editorialTargetKey(cell.target))"
              @update:model-value="change(cell, $event)" @clear="clear(cell)" @enter="moveDown" />
            <template v-else>
              <span aria-hidden="true">—</span>
              <span class="sr-only">{{ whereItIsFilled(row) }}</span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="orphans" class="hf-attr-table__note" data-testid="attribute-orphans">{{ orphans }}</p>
  </div>
</template>

<style scoped>
.hf-attr-table { min-width: 0; max-width: 100%; overflow-x: auto; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); }
.hf-attr-table__table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 42rem; font-size: 14px; color: var(--hf-ink); }
.hf-attr-table__table th, .hf-attr-table__table td { padding: 10px 12px; border-bottom: 1px solid var(--hf-border); text-align: left; vertical-align: top; }
.hf-attr-table__table tbody tr:last-child > * { border-bottom: 0; }
.hf-attr-table__table thead th { background: color-mix(in srgb, var(--hf-ink) 4%, var(--hf-surface)); color: var(--hf-muted); font-size: 13px; font-weight: 600; white-space: nowrap; }
.hf-attr-table__table td { min-width: 13rem; }
.hf-attr-table__table th[scope='row'], .hf-attr-table__table thead th:first-child { position: sticky; left: 0; z-index: 1; width: 14rem; min-width: 11rem; background: var(--hf-surface); }
.hf-attr-table__table thead th:first-child { background: color-mix(in srgb, var(--hf-ink) 4%, var(--hf-surface)); }
.hf-attr-table__table th[scope='row'] { padding-top: 18px; color: var(--hf-heading); font-weight: 500; }
.hf-attr-table__none { color: var(--hf-muted); padding-top: 18px; }
.hf-attr-table__note { margin: 0; padding: 10px 12px; border-top: 1px solid var(--hf-border); color: var(--hf-muted); font-size: 13px; }
@media (max-width: 767px) {
  .hf-attr-table__table th[scope='row'], .hf-attr-table__table thead th:first-child { width: 8rem; min-width: 8rem; }
  .hf-attr-table__table th[scope='row'] { font-size: 13px; }
  .hf-attr-table__table th, .hf-attr-table__table td { padding-inline: 10px; }
}
</style>
