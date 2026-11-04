<script setup lang="ts">
import { computed } from 'vue'
import EditorialSelect from './EditorialSelect.vue'
import RequirementField from './EditorialCareRequirementField.vue'
import WarningField from './EditorialCareWarningField.vue'
import type { EditorialCareReviewInput } from '../../utils/editorial-contract-care-input'
import { renameEditorialCareRequirement, type PreparedEditorialCareInput } from '../../utils/editorial-contract-care-edits'
import { snapshotJson } from '../../utils/editorial-contract-value'
import type { EditorialEvidence } from '../../interfaces/editorial-contract-value.types'

/** Controlled raw composition only, not capture/readiness or save authority.
 * Caller supplies unique stable IDs aligned with each list and owns creation,
 * deletion and remount persistence. Apply removeEditorialCareRequirement in the
 * parent's removal handler; warning references must remain verbatim (S38).
 * Explicit state discard has no hidden restoration, HTTP or Published effects.
 */
const props = defineProps<{ id: string; modelValue: EditorialCareReviewInput;
  rowIds: { requirements: readonly string[]; warnings: readonly string[] }; disabled?: boolean; issue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: EditorialCareReviewInput]; addRequirement: []; addWarning: [];
  removeRequirement: [index: number]; removeWarning: [index: number] }>()
const described = computed(() => props.issue ? `${props.id}-issue` : undefined)
const prepared = computed(() => props.modelValue.state === 'prepared' ? props.modelValue : null)
const prose = [
  { key: 'jurisdiction', label: 'Jurisdicción' }, { key: 'intendedUse', label: 'Uso previsto' }, { key: 'basis', label: 'Fundamento' },
] as const
function copy<T>(value: T): T { return snapshotJson(value) as unknown as T }
function update(patch: Partial<PreparedEditorialCareInput>) {
  if (!props.disabled && prepared.value) emit('update:modelValue', copy({ ...prepared.value, ...patch }))
}
const stateItems = [{ label: 'Sin revisión', value: 'omitted' }, { label: 'Desconocida', value: 'unknown' }, { label: 'Preparada', value: 'prepared' }]
const determinationItems = [{ label: 'Identificada', value: 'identified' }, { label: 'Ninguna aplicable', value: 'none_applicable' }]
// The list is controlled: until the discard is confirmed it keeps showing the current state.
function stateChanged(state: string | undefined) {
  if (props.disabled || state === props.modelValue.state) return
  if (state !== 'prepared' && state !== 'unknown' && state !== 'omitted') return
  const current = prepared.value
  const populated = current && (current.jurisdiction.length > 0 || current.intendedUse.length > 0 || current.basis.length > 0
    || current.determination !== null || current.evidence.length > 0 || current.requirements.length > 0 || current.warnings.length > 0)
  if (populated && !window.confirm('¿Descartar el contenido de la revisión de cuidado? Se perderán los cambios locales.')) return
  emit('update:modelValue', state === 'prepared' ? { state, jurisdiction: '', intendedUse: '', determination: null,
    evidence: [], basis: '', requirements: [], warnings: [] } : { state })
}
function textChanged(part: 'jurisdiction' | 'intendedUse' | 'basis', event: Event) {
  update({ [part]: (event.target as HTMLTextAreaElement).value })
}
// A list has no empty pick: the placeholder is the empty state, so only an offered code changes anything.
function determinationChanged(raw: string | undefined) {
  if (raw === 'identified' || raw === 'none_applicable') update({ determination: raw })
}
function evidenceChanged(index: number, part: keyof EditorialEvidence, event: Event) {
  const raw = (event.target as HTMLInputElement).value
  update({ evidence: prepared.value?.evidence.map((entry, i) => i === index ? { ...entry, [part]: raw } : entry) ?? [] })
}
function addEvidence() { if (prepared.value) update({ evidence: [...prepared.value.evidence, { sourceRef: '', verifiedOn: '' }] }) }
function removeEvidence(index: number) { if (prepared.value) update({ evidence: prepared.value.evidence.filter((_, i) => i !== index) }) }
function requirementChanged(index: number, row: PreparedEditorialCareInput['requirements'][number]) {
  if (props.disabled || !prepared.value) return
  const next = renameEditorialCareRequirement(prepared.value, index, row.key)
  next.requirements[index] = copy(row)
  emit('update:modelValue', next)
}
function warningChanged(index: number, row: PreparedEditorialCareInput['warnings'][number]) {
  if (prepared.value) update({ warnings: prepared.value.warnings.map((entry, i) => i === index ? row : entry) })
}
function addRequirement() { if (!props.disabled) emit('addRequirement') }
function addWarning() { if (!props.disabled) emit('addWarning') }
function removeRequirement(index: number) { if (!props.disabled) emit('removeRequirement', index) }
function removeWarning(index: number) { if (!props.disabled) emit('removeWarning', index) }
</script>

<template>
  <fieldset class="review-field" :disabled="disabled" :aria-describedby="described">
    <legend>Revisión de cuidado</legend>
    <label :for="`${id}-state`">Estado de la revisión</label>
    <EditorialSelect :id="`${id}-state`" label="Estado de la revisión" :items="stateItems" :model-value="modelValue.state" :disabled="disabled"
      :invalid="!!issue" :describedby="described" @update:model-value="stateChanged" />
    <template v-if="prepared">
      <div v-for="part in prose" :key="part.key">
        <label :for="`${id}-${part.key}`">{{ part.label }}</label>
        <textarea :id="`${id}-${part.key}`" :value="prepared[part.key]" :disabled="disabled" rows="3"
          :aria-describedby="described" :aria-invalid="!!issue" @input="textChanged(part.key, $event)" />
      </div>
      <label :for="`${id}-determination`">Determinación</label>
      <EditorialSelect :id="`${id}-determination`" label="Determinación" :items="determinationItems" :model-value="prepared.determination ?? undefined"
        :disabled="disabled" :invalid="!!issue" :describedby="described" @update:model-value="determinationChanged" />
      <fieldset class="evidence">
        <legend>Evidencias de la revisión</legend>
        <div v-for="(entry, index) in prepared.evidence" :key="index" class="evidence-entry">
          <div class="pair">
            <div>
              <label :for="`${id}-evidence-${index}-source`">Fuente {{ index + 1 }}</label>
              <input :id="`${id}-evidence-${index}-source`" type="text" :value="entry.sourceRef" :disabled="disabled"
                :aria-describedby="described" :aria-invalid="!!issue" @input="evidenceChanged(index, 'sourceRef', $event)">
            </div>
            <div>
              <label :for="`${id}-evidence-${index}-date`">Fecha de verificación {{ index + 1 }} (AAAA-MM-DD)</label>
              <input :id="`${id}-evidence-${index}-date`" type="text" :value="entry.verifiedOn" :disabled="disabled"
                :aria-describedby="described" :aria-invalid="!!issue" @input="evidenceChanged(index, 'verifiedOn', $event)">
            </div>
          </div>
          <button type="button" :data-action="`remove-review-evidence-${index}`" :disabled="disabled"
            :aria-label="`Quitar evidencia de la revisión ${index + 1}`" @click="removeEvidence(index)">Quitar evidencia</button>
        </div>
        <button type="button" data-action="add-review-evidence" :disabled="disabled" @click="addEvidence">Añadir evidencia</button>
      </fieldset>
      <div class="rows">
        <RequirementField v-for="(row, index) in prepared.requirements" :key="rowIds.requirements[index]"
          :id="`${id}-${rowIds.requirements[index]}`" :model-value="row" :disabled="disabled"
          @update:model-value="requirementChanged(index, $event)" @remove="removeRequirement(index)" />
        <button type="button" data-action="add-requirement" :disabled="disabled" @click="addRequirement">Añadir requisito</button>
        <WarningField v-for="(row, index) in prepared.warnings" :key="rowIds.warnings[index]"
          :id="`${id}-${rowIds.warnings[index]}`" :model-value="row" :disabled="disabled"
          @update:model-value="warningChanged(index, $event)" @remove="removeWarning(index)" />
        <button type="button" data-action="add-warning" :disabled="disabled" @click="addWarning">Añadir advertencia</button>
      </div>
    </template>
    <p v-if="issue" :id="`${id}-issue`" class="issue" role="status">{{ issue }}</p>
  </fieldset>
</template>

<style scoped>
.review-field { min-width: 0; margin: 0; padding: 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); color: var(--hf-ink); }
legend { max-width: 100%; padding: 0 6px; font-weight: 650; overflow-wrap: anywhere; color: var(--hf-heading); }
label { display: block; margin: 12px 0 6px; font-size: .875rem; line-height: 1.5; }
input, textarea, button { box-sizing: border-box; min-height: max(44px, var(--hf-control-height, 44px)); max-width: 100%; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; padding: 8px 12px; }
input, textarea { width: 100%; }
textarea { resize: vertical; }
input:focus-visible, textarea:focus-visible, button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
button { margin-top: 12px; cursor: pointer; }
:disabled { cursor: not-allowed; }
.review-field:disabled { opacity: .65; }
.pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.evidence { min-width: 0; margin: 16px 0 0; padding: 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); }
.evidence-entry + .evidence-entry { margin-top: 16px; border-top: 1px solid var(--hf-border); }
.rows { display: grid; gap: 16px; margin-top: 16px; }
.rows > button { justify-self: start; margin-top: 0; }
.issue { margin: 12px 0 0; color: var(--hf-warning); line-height: 1.5; overflow-wrap: anywhere; }
@media (max-width: 600px) { .pair { grid-template-columns: 1fr; gap: 0; } }
</style>
