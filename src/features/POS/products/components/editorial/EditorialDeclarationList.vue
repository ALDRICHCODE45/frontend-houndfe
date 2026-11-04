<script setup lang="ts">
import { computed } from 'vue'
import EditorialContractDeclarationField from './EditorialContractDeclarationField.vue'
import { editorialDeclarationLabel } from '../../utils/editorial-contract-declaration-choices'
import type { EditorialDeclarationValues } from '../../interfaces/editorial-contract-declaration.types'
import type { EditorialDeclarationInput } from '../../utils/editorial-contract-declaration-input'

type DeclarationKey = keyof EditorialDeclarationValues
type Choice = { code: string; label: string }
type AllowedDeclaration = { key: DeclarationKey; label: string; choices?: readonly Choice[]; toyTypeChoices?: readonly Choice[] }
/**
 * UI wrappers retain caller-owned unique stable IDs and declaration keys even when
 * raw input is omitted or mismatched. IDs and wrapper keys never enter raw facts.
 * The caller supplies qualified allowed choices and applies all list intents,
 * including explicit omitted-row creation. This list grants no admission authority.
 */
const props = defineProps<{
  id: string
  rows: readonly { id: string; declarationKey: DeclarationKey; input: EditorialDeclarationInput }[]
  allowed: readonly AllowedDeclaration[]
  disabled?: boolean
  issue?: string
}>()
const emit = defineEmits<{
  update: [id: string, input: EditorialDeclarationInput]
  add: [key: DeclarationKey]
  remove: [id: string]
}>()
const displayedRows = computed(() => props.rows.map(row => ({
  ...row, metadata: props.allowed.find(entry => entry.key === row.declarationKey),
})))
const described = computed(() => props.issue ? `${props.id}-issue` : undefined)
function add(event: Event) {
  const control = event.target as HTMLSelectElement
  const entry = props.allowed.find(item => item.key === control.value)
  // Reset the actual native selection, including rejected synthetic selections.
  control.value = ''
  if (!props.disabled && entry) emit('add', entry.key)
}
function update(id: string, input: EditorialDeclarationInput) {
  if (!props.disabled) emit('update', id, input)
}
function remove(id: string) {
  if (!props.disabled) emit('remove', id)
}
</script>

<template>
  <section class="declaration-list" :aria-labelledby="`${id}-heading`" :aria-describedby="described">
    <h3 :id="`${id}-heading`" class="heading">Declaraciones</h3>
    <p v-if="issue" :id="`${id}-issue`" class="issue" role="status">{{ issue }}</p>
    <div v-for="row in displayedRows" :key="row.id" class="declaration-row" :data-row-id="row.id">
      <p v-if="!row.metadata" class="unavailable">{{ editorialDeclarationLabel(row.declarationKey) }}: ya no está disponible para esta familia. Se conserva hasta que lo corrijas.</p>
      <EditorialContractDeclarationField
        :id="`${id}-row-${row.id}`"
        :declaration-key="row.declarationKey"
        :label="row.metadata?.label ?? editorialDeclarationLabel(row.declarationKey)"
        :model-value="row.input"
        :choices="row.metadata?.choices ?? []"
        :toy-type-choices="row.metadata?.toyTypeChoices ?? []"
        :disabled="disabled"
        @update:model-value="update(row.id, $event)"
      />
      <button type="button" class="control remove" data-action="remove" :disabled="disabled"
        :aria-label="`Quitar declaración: ${row.metadata?.label ?? editorialDeclarationLabel(row.declarationKey)}`" @click="remove(row.id)">
        Quitar declaración
      </button>
    </div>
    <div class="add">
      <label :for="`${id}-add`" class="label">Agregar declaración</label>
      <select :id="`${id}-add`" class="control add-select" value="" :disabled="disabled"
        :aria-describedby="described" @change="add">
        <option value="">Elige una declaración</option>
        <option v-for="entry in allowed" :key="entry.key" :value="entry.key">{{ entry.label }}</option>
      </select>
    </div>
  </section>
</template>

<style scoped>
.declaration-list { min-width: 0; color: var(--hf-ink); }
.heading { margin: 0 0 16px; color: var(--hf-heading); font-size: 1rem; }
.declaration-row { min-width: 0; margin-bottom: 20px; }
.control { box-sizing: border-box; min-height: max(44px, var(--hf-control-height, 44px)); max-width: 100%; padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; }
.control:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.control:disabled { cursor: not-allowed; opacity: .65; }
.remove { margin-top: 8px; cursor: pointer; }
.label { display: block; margin-bottom: 6px; font-size: .875rem; line-height: 1.5; }
.add-select { width: 100%; }
.issue, .unavailable { overflow-wrap: anywhere; line-height: 1.5; color: var(--hf-warning); margin: 0 0 12px; }
</style>
