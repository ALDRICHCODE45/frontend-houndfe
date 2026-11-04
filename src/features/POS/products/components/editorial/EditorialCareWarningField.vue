<script setup lang="ts">
import { computed } from 'vue'
import EditorialSelect from './EditorialSelect.vue'
import type { PreparedEditorialCareInput } from '../../utils/editorial-contract-care-edits'
import type { EditorialEvidence } from '../../interfaces/editorial-contract-value.types'

type Warning = PreparedEditorialCareInput['warnings'][number]
const props = defineProps<{ id: string; modelValue: Warning; disabled?: boolean; issue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: Warning]; remove: [] }>()
const described = computed(() => props.issue ? `${props.id}-issue` : undefined)
const disclosures = [
  { code: 'private_only', label: 'Solo privada' }, { code: 'public_required', label: 'Pública requerida' },
  { code: 'unresolved', label: 'Sin resolver' },
] as const
const disclosureItems = disclosures.map(item => ({ label: item.label, value: item.code }))

// Parent owns stable row identity, review state and removal. Only explicit edits
// change reference entries: retain exact order, duplicates, blanks and dangling keys.
// Encoding only; disclosure never grants publication or save authority.
function update(patch: Partial<Warning>) {
  if (props.disabled) return
  const next = { ...props.modelValue, ...patch }
  emit('update:modelValue', { ...next, requirementKeys: [...next.requirementKeys], evidence: next.evidence.map(entry => ({ ...entry })) })
}
function textChanged(part: 'key' | 'text' | 'handlingBasis', event: Event) {
  if (!props.disabled) update({ [part]: (event.target as HTMLInputElement | HTMLTextAreaElement).value })
}
// A list has no empty pick: the placeholder is the empty state, so only an offered code changes anything.
function disclosureChanged(raw: string | undefined) {
  const choice = disclosures.find(item => item.code === raw)
  if (!props.disabled && choice) update({ disclosure: choice.code })
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
function referenceChanged(index: number, event: Event) {
  if (props.disabled) return
  const value = (event.target as HTMLInputElement).value
  update({ requirementKeys: props.modelValue.requirementKeys.map((key, position) => position === index ? value : key) })
}
function addReference() {
  if (!props.disabled) update({ requirementKeys: [...props.modelValue.requirementKeys, ''] })
}
function removeReference(index: number) {
  if (!props.disabled) update({ requirementKeys: props.modelValue.requirementKeys.filter((_, position) => position !== index) })
}
function removeWarning() { if (!props.disabled) emit('remove') }
</script>

<template>
  <fieldset class="warning-field" :disabled="disabled" :aria-describedby="described">
    <legend>Advertencia de cuidado</legend>
    <label :for="`${id}-key`">Clave de la advertencia</label>
    <input :id="`${id}-key`" type="text" :value="modelValue.key" :disabled="disabled"
      :aria-invalid="!!issue" :aria-describedby="described" @input="textChanged('key', $event)">
    <label :for="`${id}-text`">Texto de la advertencia</label>
    <textarea :id="`${id}-text`" :value="modelValue.text" :disabled="disabled" rows="3"
      :aria-invalid="!!issue" :aria-describedby="described" @input="textChanged('text', $event)" />
    <label :for="`${id}-disclosure`">Divulgación</label>
    <EditorialSelect :id="`${id}-disclosure`" label="Divulgación" :items="disclosureItems" :model-value="modelValue.disclosure ?? undefined"
      :disabled="disabled" :invalid="!!issue" :describedby="described" @update:model-value="disclosureChanged" />
    <label :for="`${id}-handlingBasis`">Fundamento</label>
    <textarea :id="`${id}-handlingBasis`" :value="modelValue.handlingBasis" :disabled="disabled" rows="3"
      :aria-invalid="!!issue" :aria-describedby="described" @input="textChanged('handlingBasis', $event)" />
    <fieldset class="evidence">
      <legend>Referencias a requisitos</legend>
      <div v-for="(key, index) in modelValue.requirementKeys" :key="index">
        <label :for="`${id}-reference-${index}`">Clave de requisito {{ index + 1 }}</label>
        <input :id="`${id}-reference-${index}`" data-reference type="text" :value="key" :disabled="disabled"
          :aria-invalid="!!issue" :aria-describedby="described" @input="referenceChanged(index, $event)">
        <button type="button" :data-action="`remove-reference-${index}`" :disabled="disabled"
          :aria-label="`Quitar referencia ${index + 1}`" @click="removeReference(index)">Quitar referencia</button>
      </div>
      <button type="button" data-action="add-reference" :disabled="disabled" @click="addReference">Añadir referencia</button>
    </fieldset>
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
    <button type="button" data-action="remove-warning" :disabled="disabled" @click="removeWarning">Eliminar advertencia</button>
    <p v-if="issue" :id="`${id}-issue`" class="issue" role="status">{{ issue }}</p>
  </fieldset>
</template>

<style scoped>
.warning-field { min-width: 0; margin: 0; padding: 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); color: var(--hf-ink); }
legend { max-width: 100%; padding: 0 6px; font-weight: 650; overflow-wrap: anywhere; color: var(--hf-heading); }
label { display: block; margin: 12px 0 6px; font-size: .875rem; line-height: 1.5; }
input, textarea, button { box-sizing: border-box; min-height: max(44px, var(--hf-control-height, 44px)); max-width: 100%; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; padding: 8px 12px; }
input, textarea { width: 100%; }
textarea { resize: vertical; }
input:focus-visible, textarea:focus-visible, button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
button { margin-top: 12px; cursor: pointer; }
:disabled { cursor: not-allowed; }
.warning-field:disabled { opacity: .65; }
.pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.evidence { min-width: 0; margin: 16px 0 0; padding: 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); }
.evidence-entry + .evidence-entry { margin-top: 16px; padding-top: 4px; border-top: 1px solid var(--hf-border); }
.issue { margin: 12px 0 0; color: var(--hf-warning); line-height: 1.5; overflow-wrap: anywhere; }
@media (max-width: 600px) { .pair { grid-template-columns: 1fr; gap: 0; } }
</style>
