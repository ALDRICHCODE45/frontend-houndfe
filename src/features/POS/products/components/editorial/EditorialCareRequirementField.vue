<script setup lang="ts">
import { computed } from 'vue'
import type { PreparedEditorialCareInput } from '../../utils/editorial-contract-care-edits'
import type { EditorialEvidence } from '../../interfaces/editorial-contract-value.types'

type Requirement = PreparedEditorialCareInput['requirements'][number]
const props = defineProps<{ id: string; modelValue: Requirement; disabled?: boolean; issue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: Requirement]; remove: [] }>()
const described = computed(() => props.issue ? `${props.id}-issue` : undefined)
const dispositions = [
  { code: 'satisfied', label: 'Satisfecho' }, { code: 'not_applicable', label: 'No aplica' },
  { code: 'unresolved', label: 'Sin resolver' }, { code: 'conflicting', label: 'En conflicto' },
] as const

// Parent owns stable row identity and raw review state. Apply S38 rename/remove
// helpers there: warnings and requirementKeys must remain unchanged for correction.
// This field edits encoding only, never capture/readiness/save/publication authority.
function update(patch: Partial<Requirement>) {
  if (props.disabled) return
  const next = { ...props.modelValue, ...patch }
  emit('update:modelValue', { ...next, evidence: next.evidence.map(entry => ({ ...entry })) })
}
function textChanged(part: 'key' | 'description' | 'basis', event: Event) {
  if (!props.disabled) update({ [part]: (event.target as HTMLInputElement | HTMLTextAreaElement).value })
}
function dispositionChanged(event: Event) {
  if (props.disabled) return
  const raw = (event.target as HTMLSelectElement).value
  if (raw === '') update({ disposition: null })
  else {
    const choice = dispositions.find(item => item.code === raw)
    if (choice) update({ disposition: choice.code })
  }
}
function evidenceChanged(index: number, part: keyof EditorialEvidence, event: Event) {
  if (props.disabled) return
  const value = (event.target as HTMLInputElement).value
  update({ evidence: props.modelValue.evidence.map((entry, position) => position === index ? { ...entry, [part]: value } : entry) })
}
function addEvidence() {
  if (!props.disabled) update({ evidence: [...props.modelValue.evidence, { sourceRef: '', verifiedOn: '' }] })
}
function removeEvidence(index: number) {
  if (!props.disabled) update({ evidence: props.modelValue.evidence.filter((_, position) => position !== index) })
}
function removeRequirement() { if (!props.disabled) emit('remove') }
</script>

<template>
  <fieldset class="requirement-field" :disabled="disabled" :aria-describedby="described">
    <legend>Requisito de cuidado</legend>
    <label :for="`${id}-key`">Clave del requisito</label>
    <input :id="`${id}-key`" type="text" :value="modelValue.key" :disabled="disabled"
      :aria-invalid="!!issue" :aria-describedby="described" @input="textChanged('key', $event)">
    <label :for="`${id}-description`">Descripción</label>
    <textarea :id="`${id}-description`" :value="modelValue.description" :disabled="disabled" rows="3"
      :aria-invalid="!!issue" :aria-describedby="described" @input="textChanged('description', $event)" />
    <label :for="`${id}-disposition`">Disposición</label>
    <select :id="`${id}-disposition`" :value="modelValue.disposition ?? ''" :disabled="disabled"
      :aria-invalid="!!issue" :aria-describedby="described" @change="dispositionChanged">
      <option value="">Selecciona una disposición</option>
      <option v-for="item in dispositions" :key="item.code" :value="item.code">{{ item.label }}</option>
    </select>
    <label :for="`${id}-basis`">Fundamento</label>
    <textarea :id="`${id}-basis`" :value="modelValue.basis" :disabled="disabled" rows="3"
      :aria-invalid="!!issue" :aria-describedby="described" @input="textChanged('basis', $event)" />
    <fieldset class="evidence">
      <legend>Evidencias</legend>
      <div v-for="(entry, index) in modelValue.evidence" :key="index" class="evidence-entry">
        <div class="pair">
          <div>
            <label :for="`${id}-evidence-${index}-source`">Fuente {{ index + 1 }}</label>
            <input :id="`${id}-evidence-${index}-source`" type="text" :value="entry.sourceRef" :disabled="disabled"
              :aria-invalid="!!issue" :aria-describedby="described" @input="evidenceChanged(index, 'sourceRef', $event)">
          </div>
          <div>
            <label :for="`${id}-evidence-${index}-date`">Fecha de verificación {{ index + 1 }} (AAAA-MM-DD)</label>
            <input :id="`${id}-evidence-${index}-date`" type="text" :value="entry.verifiedOn" :disabled="disabled"
              :aria-invalid="!!issue" :aria-describedby="described" @input="evidenceChanged(index, 'verifiedOn', $event)">
          </div>
        </div>
        <button type="button" :data-action="`remove-evidence-${index}`" :disabled="disabled"
          :aria-label="`Quitar evidencia ${index + 1}`" @click="removeEvidence(index)">Quitar evidencia</button>
      </div>
      <button type="button" data-action="add-evidence" :disabled="disabled" @click="addEvidence">Añadir evidencia</button>
    </fieldset>
    <button type="button" data-action="remove-requirement" :disabled="disabled" @click="removeRequirement">Eliminar requisito</button>
    <p v-if="issue" :id="`${id}-issue`" class="issue" role="status">{{ issue }}</p>
  </fieldset>
</template>

<style scoped>
.requirement-field { min-width: 0; margin: 0; padding: 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); color: var(--hf-ink); }
legend { max-width: 100%; padding: 0 6px; font-weight: 650; overflow-wrap: anywhere; color: var(--hf-heading); }
label { display: block; margin: 12px 0 6px; font-size: .875rem; line-height: 1.5; }
input, textarea, select, button { box-sizing: border-box; min-height: max(44px, var(--hf-control-height, 44px)); max-width: 100%; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; padding: 8px 12px; }
input, textarea, select { width: 100%; }
textarea { resize: vertical; }
input:focus-visible, textarea:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
button { margin-top: 12px; cursor: pointer; }
:disabled { cursor: not-allowed; }
.requirement-field:disabled { opacity: .65; }
.pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.evidence { min-width: 0; margin: 16px 0 0; padding: 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); }
.evidence-entry + .evidence-entry { margin-top: 16px; padding-top: 4px; border-top: 1px solid var(--hf-border); }
.issue { margin: 12px 0 0; color: var(--hf-warning); line-height: 1.5; overflow-wrap: anywhere; }
@media (max-width: 600px) { .pair { grid-template-columns: 1fr; gap: 0; } }
</style>
