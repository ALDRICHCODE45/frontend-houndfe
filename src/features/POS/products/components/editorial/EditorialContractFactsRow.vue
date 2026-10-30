<script setup lang="ts">
import { computed } from 'vue'
import EditorialDeclarationList from './EditorialDeclarationList.vue'
import EditorialCareReviewField from './EditorialCareReviewField.vue'
import type { EditorialFactsEditingRow } from '../../utils/editorial-contract-facts-editing'
import type { EditorialDeclarationChoice } from '../../utils/editorial-contract-declaration-choices'
import type { EditorialDeclarationInput } from '../../utils/editorial-contract-declaration-input'
import type { EditorialCareReviewInput } from '../../utils/editorial-contract-care-input'
import { appendEditorialFactsDeclaration, updateEditorialFactsDeclaration, removeEditorialFactsDeclaration,
  replaceEditorialFactsCare, appendEditorialFactsCareRow, removeEditorialFactsCareRow } from '../../utils/editorial-contract-facts-edits'
import { snapshotJson } from '../../utils/editorial-contract-value'

/** Controlled composition, never a second buffer or admission authority.
 * Parent owns raw state, qualified choices and unique ID allocation. Care child
 * confirms its own discard; whole-row removal is only an intent, requiring S46
 * confirmation in the collection. Unavailable history remains explicitly editable.
 */
const props = defineProps<{ id: string; subjectLabel: string; modelValue: EditorialFactsEditingRow;
  allowed: readonly EditorialDeclarationChoice[]; careAllowed: boolean; nextId: () => string; disabled?: boolean; issue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: EditorialFactsEditingRow]; remove: [id: string] }>()
const showCare = computed(() => props.careAllowed || props.modelValue.careReview.state !== 'omitted')
const described = computed(() => props.issue ? `${props.id}-issue` : undefined)
function presentationChanged(event: Event) {
  if (props.disabled) return
  // SAFETY: caller owns a typed JSON editing row; snapshot only detaches raw data.
  const row = snapshotJson(props.modelValue) as unknown as EditorialFactsEditingRow
  row.presentation = (event.target as HTMLTextAreaElement).value
  emit('update:modelValue', row)
}
function addDeclaration(key: EditorialDeclarationChoice['key']) {
  if (!props.disabled && props.allowed.some(entry => entry.key === key))
    emit('update:modelValue', appendEditorialFactsDeclaration(props.modelValue, key, props.nextId))
}
function updateDeclaration(id: string, input: EditorialDeclarationInput) {
  if (!props.disabled && props.modelValue.declarations.some(row => row.id === id))
    emit('update:modelValue', updateEditorialFactsDeclaration(props.modelValue, id, input))
}
function removeDeclaration(id: string) {
  if (!props.disabled && props.modelValue.declarations.some(row => row.id === id))
    emit('update:modelValue', removeEditorialFactsDeclaration(props.modelValue, id))
}
function updateCare(input: EditorialCareReviewInput) {
  if (!props.disabled && showCare.value)
    emit('update:modelValue', replaceEditorialFactsCare(props.modelValue, input, props.nextId))
}
function addCare(kind: 'requirements' | 'warnings') {
  if (!props.disabled && props.modelValue.careReview.state === 'prepared')
    emit('update:modelValue', appendEditorialFactsCareRow(props.modelValue, kind, props.nextId))
}
function removeCare(kind: 'requirements' | 'warnings', index: number) {
  if (props.disabled || props.modelValue.careReview.state !== 'prepared' || !Number.isInteger(index) || index < 0) return
  const id = props.modelValue.careRowIds[kind][index]
  if (id !== undefined) emit('update:modelValue', removeEditorialFactsCareRow(props.modelValue, kind, id))
}
function remove() { if (!props.disabled) emit('remove', props.modelValue.id) }
</script>

<template>
  <fieldset class="facts-row" :disabled="disabled" :aria-describedby="described">
    <legend class="legend">{{ subjectLabel }}</legend>
    <p v-if="issue" :id="`${id}-issue`" class="notice" role="status">{{ issue }}</p>
    <div class="presentation">
      <label :for="`${id}-presentation`" class="label">Presentación</label>
      <textarea :id="`${id}-presentation`" class="control" rows="2" :value="modelValue.presentation"
        :disabled="disabled" :aria-describedby="described" @input="presentationChanged" />
    </div>
    <EditorialDeclarationList :id="`${id}-declarations`" :rows="modelValue.declarations" :allowed="allowed" :disabled="disabled"
      @add="addDeclaration" @update="updateDeclaration" @remove="removeDeclaration" />
    <p v-if="showCare && !careAllowed" class="notice">No disponible para esta familia. La revisión existente se conserva para su corrección explícita.</p>
    <EditorialCareReviewField v-if="showCare" :id="`${id}-care`" :model-value="modelValue.careReview"
      :row-ids="modelValue.careRowIds" :disabled="disabled" @update:model-value="updateCare"
      @add-requirement="addCare('requirements')" @add-warning="addCare('warnings')"
      @remove-requirement="removeCare('requirements', $event)" @remove-warning="removeCare('warnings', $event)" />
    <button type="button" class="control remove" data-action="remove-facts" :disabled="disabled"
      :aria-label="`Eliminar hechos: ${subjectLabel}`" @click="remove">Eliminar hechos</button>
  </fieldset>
</template>

<style scoped>
.facts-row { display: grid; gap: 20px; min-width: 0; margin: 0; padding: 16px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); color: var(--hf-ink); }
.legend { padding: 0 6px; max-width: 100%; overflow-wrap: anywhere; color: var(--hf-heading); font-weight: 600; }
.presentation { min-width: 0; }
.label { display: block; margin-bottom: 6px; line-height: 1.5; }
.control { box-sizing: border-box; width: 100%; min-height: max(44px, var(--hf-control-height, 44px)); padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; }
.control:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.control:disabled { cursor: not-allowed; opacity: .65; }
textarea.control { resize: vertical; }
.remove { width: auto; justify-self: start; max-width: 100%; cursor: pointer; }
.notice { margin: 0; overflow-wrap: anywhere; line-height: 1.5; color: var(--hf-warning); }
</style>
