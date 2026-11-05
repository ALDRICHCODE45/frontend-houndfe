<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import EditorialAttributeCell from './EditorialAttributeCell.vue'
import EditorialAttributeRowName from './EditorialAttributeRowName.vue'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialFamily } from '../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialAssignmentInput } from '../../utils/editorial-contract-assignment-input'
import type { EditorialAssignmentEditingRow } from '../../utils/editorial-contract-document-editing'
import type { EditorialFactsEditingState } from '../../utils/editorial-contract-facts-editing'
import { applyEditorialCellInput, buildEditorialAttributeTable, editorialTargetKey, removeEditorialCell,
  type EditorialTableCell, type EditorialTableSubject } from '../../utils/editorial-attribute-table'

/** The editable table of the family's data: rows are the definitions, columns are Producto and one
 * per presentation. It derives everything from the stored assignments and hands the new array back;
 * nothing here saves, encodes or admits content. Controlled, like the other editorial fields.
 */
const props = defineProps<{ values: EditorialAssignmentEditingRow[]; family: EditorialFamily | null;
  definitions: readonly EditorialDefinition[]; subjects: readonly EditorialTableSubject[]; nextId: () => string;
  /** The declarations being edited: with the values they decide where "No aplica" is admitted and what is required. */
  facts?: EditorialFactsEditingState
  /** Only these row codes are shown; omit for all (the "Solo faltantes" filter). */
  visibleCodes?: ReadonlySet<string> | null
  readonly?: boolean; disabled?: boolean
  /** Message per assignment row id, shown next to its cell. */
  issues?: ReadonlyMap<string, string>
  /** Archived options the saved draft holds per target (see `editorialTargetKey`), which stay selectable. */
  conserved?: ReadonlyMap<string, readonly string[]> }>()
const emit = defineEmits<{ 'update:values': [values: EditorialAssignmentEditingRow[]] }>()

const table = computed(() => buildEditorialAttributeTable({ family: props.family, definitions: props.definitions, values: props.values, subjects: props.subjects, facts: props.facts }))
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

// Below md each row is a stacked card (Mobile cards): no sideways scroll, the chip and ⋯ always in sight.
const mobile = useBreakpoints(breakpointsTailwind).smaller('md')
const presentCells = (row: { cells: (EditorialTableCell | null)[] }) => row.cells.flatMap((cell, index) => (cell ? [{ cell, column: table.value.columns[index]! }] : []))

// Enter finishes a cell and goes down the same column, to the next row that has a control there.
const root = useTemplateRef<HTMLElement>('root')
function moveDown(source: HTMLElement) {
  const from = source.closest('td')
  const start = from?.parentElement
  if (!from || !start) return
  const column = Array.from(start.children).indexOf(from)
  for (let next = start.nextElementSibling; next; next = next.nextElementSibling) {
    const control = next.children[column]?.querySelector<HTMLElement>('input[type="text"], [role="combobox"], summary')
    if (control) { control.focus(); return }
  }
}
</script>

<template>
  <div v-if="mobile" ref="root" class="hf-attr-cards" data-testid="attribute-table">
    <ul class="hf-attr-cards__list" aria-label="Datos de la ficha por producto y presentación">
      <li v-for="row in rows" :key="row.code" class="hf-attr-card" :data-row="row.code" data-testid="attribute-card">
        <template v-if="presentCells(row).length === 1">
          <EditorialAttributeCell v-for="{ cell, column } in presentCells(row)" :id="`attr-${row.code}-${cell.key}`" :key="cell.key" stacked
            :label="`${row.label} · ${column.label}`" :definition="row.definition" :target="cell.target" :model-value="cell.input" :readonly="readonly" :disabled="disabled"
            :na-admitted="cell.naAdmitted" :required="cell.required"
            :issue="cell.rowId ? issues?.get(cell.rowId) : undefined" :conserved-options="conserved?.get(editorialTargetKey(cell.target))"
            @update:model-value="change(cell, $event)" @clear="clear(cell)">
            <template #label><EditorialAttributeRowName :row="row" class="hf-attr-card__title" /></template>
          </EditorialAttributeCell>
        </template>
        <template v-else>
          <EditorialAttributeRowName :row="row" class="hf-attr-card__title" />
          <EditorialAttributeCell v-for="{ cell, column } in presentCells(row)" :id="`attr-${row.code}-${cell.key}`" :key="cell.key" stacked
            :label="`${row.label} · ${column.label}`" :definition="row.definition" :target="cell.target" :model-value="cell.input" :readonly="readonly" :disabled="disabled"
            :na-admitted="cell.naAdmitted" :required="cell.required"
            :issue="cell.rowId ? issues?.get(cell.rowId) : undefined" :conserved-options="conserved?.get(editorialTargetKey(cell.target))"
            @update:model-value="change(cell, $event)" @clear="clear(cell)">
            <template #label><span class="hf-attr-card__subject">{{ column.label }}</span></template>
          </EditorialAttributeCell>
        </template>
      </li>
    </ul>
    <p v-if="orphans" class="hf-attr-table__note" data-testid="attribute-orphans">{{ orphans }}</p>
  </div>
  <div v-else ref="root" class="hf-attr-table" data-testid="attribute-table">
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
          <th scope="row" class="hf-attr-table__label"><EditorialAttributeRowName :row="row" /></th>
          <td v-for="(cell, index) in row.cells" :key="table.columns[index]!.key" :class="{ 'hf-attr-table__none': !cell }">
            <EditorialAttributeCell v-if="cell" :id="`attr-${row.code}-${cell.key}`" :label="`${row.label} · ${table.columns[index]!.label}`"
              :definition="row.definition" :target="cell.target" :model-value="cell.input" :readonly="readonly" :disabled="disabled"
              :na-admitted="cell.naAdmitted" :required="cell.required"
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
/* Mobile cards: 12px radius, 16px padding, one per row; nothing scrolls sideways. */
.hf-attr-cards { min-width: 0; }
.hf-attr-cards__list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.hf-attr-card { display: grid; gap: 12px; min-width: 0; padding: 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); font-size: 14px; color: var(--hf-ink); }
.hf-attr-card__title { color: var(--hf-heading); font-weight: 500; }
.hf-attr-card__subject { color: var(--hf-ink); font-weight: 500; }
.hf-attr-cards .hf-attr-table__note { border-top: 0; padding-inline: 0; }
.hf-attr-table__note { margin: 0; padding: 10px 12px; border-top: 1px solid var(--hf-border); color: var(--hf-muted); font-size: 13px; }
</style>
