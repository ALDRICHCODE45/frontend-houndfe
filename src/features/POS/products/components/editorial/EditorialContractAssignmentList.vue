<script setup lang="ts">
import { computed } from 'vue'
import EditorialContractAttributeField from './EditorialContractAttributeField.vue'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialFamily } from '../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialAssignmentEditingRow } from '../../utils/editorial-contract-document-editing'
import type { EditorialAssignmentInput, EditorialAssignmentTarget } from '../../utils/editorial-contract-assignment-input'
import { snapshotJson } from '../../utils/editorial-contract-value'
const props = defineProps<{ id: string; modelValue: EditorialAssignmentEditingRow[]; family: EditorialFamily | null;
  definitions: readonly EditorialDefinition[]; subjects: readonly { variantId: string | null; label: string }[];
  nextId: () => string; disabled?: boolean; issue?: string;
  feedback?: ReadonlyMap<string, { issue?: string; conservedOptions?: readonly string[] }> }>()
const emit = defineEmits<{ 'update:modelValue': [rows: EditorialAssignmentEditingRow[]] }>()
// Qualified metadata and current subjects are supplied by the owner, not inferred E.
const bindings = computed(() => (props.family?.bindings ?? []).flatMap(binding => {
  const definition = props.definitions.find(d => d.id === binding.definitionId && d.code === binding.definitionCode)
  return definition ? [{ binding, definition }] : []
}))
function definitionFor(target: EditorialAssignmentTarget) {
  const subjectMatches = target.owner === 'product' ? target.variantId === null : props.subjects.some(s => s.variantId === target.variantId)
  return subjectMatches ? bindings.value.find(b => b.binding.definitionCode === target.code && b.binding.owner === target.owner)?.definition : undefined
}
function subjectLabel(target: EditorialAssignmentTarget) {
  return target.owner === 'product' && target.variantId === null ? 'Producto'
    : props.subjects.find(s => s.variantId === target.variantId)?.label ?? target.variantId ?? 'Producto simple'
}
const rows = computed(() => props.modelValue.map(row => ({ row, definition: definitionFor(row.target) })))
const choices = computed(() => bindings.value.flatMap(({ binding, definition }) => {
  const subjects = binding.owner === 'product' ? [{ variantId: null, label: 'Producto' }] : props.subjects
  return subjects.map(subject => ({ target: { code: binding.definitionCode, owner: binding.owner, variantId: subject.variantId }, label: `${definition.label} · ${subject.label}` }))
}).map((choice, index) => ({ ...choice, token: String(index) }))
  .filter(choice => !props.modelValue.some(row => row.target.code === choice.target.code && row.target.variantId === choice.target.variantId)))
function add(event: Event) {
  const select = event.target as HTMLSelectElement, token = select.value
  select.value = ''
  if (props.disabled) return
  const choice = choices.value.find(choice => choice.token === token)
  if (choice) emit('update:modelValue', [...props.modelValue, { id: props.nextId(), target: { ...choice.target }, input: { state: 'omitted' } }])
}
function update(row: EditorialAssignmentEditingRow, input: EditorialAssignmentInput) {
  const current = props.modelValue.find(item => item.id === row.id)
  if (props.disabled || !current || !definitionFor(current.target) || current.target.code !== row.target.code
    || current.target.owner !== row.target.owner || current.target.variantId !== row.target.variantId) return
  const detached = snapshotJson(input) as unknown as EditorialAssignmentInput
  emit('update:modelValue', props.modelValue.map(item => item.id === current.id ? { ...item, input: detached } : item))
}
function remove(id: string) {
  if (!props.disabled && props.modelValue.some(row => row.id === id))
    emit('update:modelValue', props.modelValue.filter(row => row.id !== id))
}
</script>

<template>
  <section class="assignment-list" :aria-labelledby="`${id}-heading`">
    <h3 :id="`${id}-heading`">Atributos</h3>
    <p v-if="issue" role="status" class="issue">{{ issue }}</p>
    <p v-if="!modelValue.length">Sin atributos en el borrador local.</p>
    <article v-for="{ row, definition } in rows" :key="row.id" class="assignment-row">
      <p class="target">{{ row.target.code }} · {{ subjectLabel(row.target) }}</p>
      <EditorialContractAttributeField v-if="definition" :id="`${id}-row-${row.id}`" :definition="definition" :target="row.target"
        :model-value="row.input" :disabled="disabled" :issue="feedback?.get(row.id)?.issue" :conserved-options="feedback?.get(row.id)?.conservedOptions"
        @update:model-value="update(row, $event)" />
      <template v-else>
        <p role="status" class="issue">No disponible en los metadatos actuales. Se conserva el contenido guardado.</p>
        <pre>{{ JSON.stringify({ target: row.target, input: row.input }) }}</pre>
      </template>
      <button type="button" data-action="remove-assignment" :disabled="disabled" @click="remove(row.id)">Quitar atributo</button>
    </article>
    <label :for="`${id}-add`">Añadir atributo</label>
    <select :id="`${id}-add`" :disabled="disabled || !choices.length" value="" @change="add">
      <option value="">Selecciona un atributo y su destino</option>
      <option v-for="choice in choices" :key="choice.token" :value="choice.token">{{ choice.label }}</option>
    </select>
  </section>
</template>

<style scoped>
.assignment-list { min-width: 0; color: var(--hf-ink); }
h3 { margin: 0 0 16px; color: var(--hf-heading); }
.assignment-row { min-width: 0; margin: 0 0 20px; padding: 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); }
.target { margin: 0 0 12px; overflow-wrap: anywhere; font-weight: 600; }
label { display: block; margin: 16px 0 6px; }
select, button { box-sizing: border-box; min-height: var(--hf-control-height); max-width: 100%; padding: 8px 12px; font: inherit; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); }
select { width: 100%; }
button { margin-top: 12px; cursor: pointer; }
select:focus-visible, button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
:disabled { cursor: not-allowed; opacity: .65; }
.issue { color: var(--hf-warning); line-height: 1.5; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
