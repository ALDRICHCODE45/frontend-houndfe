<script setup lang="ts">
import { computed } from 'vue'
import type { EditorialDeclarationValues } from '../../interfaces/editorial-contract-declaration.types'
import type { EditorialEvidence } from '../../interfaces/editorial-contract-value.types'
import { resolveEditorialDeclarationInput, type EditorialDeclarationInput } from '../../utils/editorial-contract-declaration-input'
type Choice = { code: string; label: string }
const props = defineProps<{ id: string; declarationKey: keyof EditorialDeclarationValues; label: string;
  modelValue: EditorialDeclarationInput; disabled?: boolean; issue?: string; choices?: readonly Choice[]; toyTypeChoices?: readonly Choice[] }>()
const emit = defineEmits<{ 'update:modelValue': [input: EditorialDeclarationInput] }>()
// The caller supplies qualified, key-appropriate choices; this control never infers eligibility.
// Parent-owned raw input survives remounts. Encoding completion is NOT save/publication permission.
const mismatch = computed(() => props.modelValue.state !== 'omitted' && props.modelValue.key !== props.declarationKey)
const known = computed(() => !mismatch.value && props.modelValue.state === 'known' ? props.modelValue : null)
const dimension = computed(() => known.value?.key === 'relevantDimensionCodes' ? known.value.value : null)
const enumChoices = computed<readonly Choice[]>(() => props.declarationKey === 'contentMagnitude'
  ? [{ code: 'mass', label: 'Masa' }, { code: 'volume', label: 'Volumen' }, { code: 'count', label: 'Cantidad' }, { code: 'length', label: 'Longitud' }, { code: 'area', label: 'Área' }]
  : props.declarationKey === 'presentationKind'
    ? [{ code: 'formulation', label: 'Formulación' }, { code: 'device', label: 'Dispositivo' }, { code: 'packaging', label: 'Envase' }] : [])
const scalar = computed(() => enumChoices.value.length > 0 || (known.value !== null && !Array.isArray(known.value.value) && dimension.value === null))
const selectedCodes = computed<readonly string[]>(() => dimension.value?.codes ?? (Array.isArray(known.value?.value) ? known.value.value : []))
function options(source: readonly Choice[], selected: readonly string[]) {
  return [...source.map(item => ({ ...item, disabled: false })),
    ...selected.filter(code => !source.some(item => item.code === code)).map(code => ({ code, label: `${code} (No disponible)`, disabled: true }))]
}
const listOptions = computed(() => options(props.choices ?? [], selectedCodes.value))
const toyOptions = computed(() => options(props.toyTypeChoices ?? [], dimension.value?.toyTypes ?? []))
const message = computed(() => mismatch.value ? 'La clave guardada no coincide. Cambia el estado para corregirla.' : props.issue ||
  (resolveEditorialDeclarationInput(props.modelValue).status === 'incomplete' ? 'Completa el valor y la evidencia indicada. La admisión se valida por separado.' : ''))
const described = computed(() => message.value ? `${props.id}-issue` : undefined)
function update(input: EditorialDeclarationInput) { if (!props.disabled) emit('update:modelValue', input) }
function stateChanged(event: Event) {
  if (props.disabled) return
  const state = (event.target as HTMLSelectElement).value, key = props.declarationKey
  if (state === 'omitted') update({ state })
  else if (state === 'unknown') update({ key, state })
  else if (state === 'known') {
    switch (key) {
      case 'relevantDimensionCodes': update({ key, state, value: { codes: [], toyTypes: [] }, evidence: null, basis: '' }); break
      case 'relevantFitCodes': case 'relevantCapacityCodes': case 'relevantEquipmentCodes': case 'optionalNonpertinenceCodes':
        update({ key, state, value: [], evidence: null, basis: '' }); break
      default: update({ key, state, value: null, evidence: null, basis: '' })
    }
  }
}
function valueChanged(event: Event, toys = false) {
  const current = known.value
  if (props.disabled || !current) return
  const control = event.target as HTMLSelectElement
  if (current.key === 'relevantDimensionCodes') {
    const values = Array.from(control.selectedOptions, o => o.value)
    update({ ...current, value: { ...current.value, [toys ? 'toyTypes' : 'codes']: values } } as EditorialDeclarationInput)
  } else if (Array.isArray(current.value)) {
    // Qualified choices retain the key's finite type; selected missing history stays visible.
    update({ ...current, value: Array.from(control.selectedOptions, o => o.value) } as EditorialDeclarationInput)
  } else if (current.key === 'contentMagnitude' || current.key === 'presentationKind') {
    if (control.value === '' || enumChoices.value.some(item => item.code === control.value))
      update({ ...current, value: control.value === '' ? null : control.value } as EditorialDeclarationInput)
  } else if (current.key === 'consumable' || current.key === 'animalApplied' || current.key === 'fitDeterminesChoice' || current.key === 'capacityDeterminesChoice' || current.key === 'electricalApplies') {
    if (control.value === '' || control.value === 'true' || control.value === 'false')
      update({ ...current, value: control.value === '' ? null : control.value === 'true' })
  }
}
function basisChanged(event: Event) {
  if (known.value) update({ ...known.value, basis: (event.target as HTMLTextAreaElement).value })
}
function evidenceChanged(evidence: EditorialEvidence | null) {
  if (known.value) update({ ...known.value, evidence })
}
function evidenceText(part: keyof EditorialEvidence, event: Event) {
  if (!props.disabled && known.value?.evidence) evidenceChanged({ ...known.value.evidence, [part]: (event.target as HTMLInputElement).value })
}
</script>

<template>
  <fieldset class="contract-field" :disabled="disabled">
    <legend>{{ label }}</legend>
    <label :for="`${id}-state`">Estado</label>
    <select :id="`${id}-state`" :value="modelValue.state" :aria-describedby="described" :aria-invalid="!!message" @change="stateChanged">
      <option value="omitted">Sin asignación</option><option value="unknown">Desconocido</option><option value="known">Valor conocido</option>
    </select>
    <template v-if="known">
      <label :for="`${id}-value`">{{ dimension ? 'Dimensiones pertinentes' : scalar ? 'Valor' : 'Opciones' }}</label>
      <select v-if="scalar" :id="`${id}-value`" :value="known.value === null ? '' : String(known.value)" :aria-describedby="described" :aria-invalid="!!message" @change="valueChanged($event)">
        <option value="">Selecciona un valor</option>
        <template v-if="enumChoices.length"><option v-for="item in enumChoices" :key="item.code" :value="item.code">{{ item.label }}</option></template>
        <template v-else><option value="true">Sí</option><option value="false">No</option></template>
      </select>
      <select v-else :id="`${id}-value`" multiple :aria-describedby="described" :aria-invalid="!!message" @change="valueChanged($event)">
        <option v-for="item in listOptions" :key="item.code" :value="item.code" :selected="selectedCodes.includes(item.code)" :disabled="item.disabled">{{ item.label }}</option>
      </select>
      <template v-if="dimension">
        <label :for="`${id}-toys`">Tipos de juguete</label>
        <select :id="`${id}-toys`" multiple :aria-describedby="described" :aria-invalid="!!message" @change="valueChanged($event, true)">
          <option v-for="item in toyOptions" :key="item.code" :value="item.code" :selected="dimension.toyTypes.includes(item.code)" :disabled="item.disabled">{{ item.label }}</option>
        </select>
      </template>
      <label :for="`${id}-basis`">Fundamento</label>
      <textarea :id="`${id}-basis`" rows="3" :value="known.basis" :aria-describedby="described" :aria-invalid="!!message" @input="basisChanged" />
      <fieldset v-if="known.evidence !== null" class="evidence">
        <legend>Evidencia</legend>
        <div class="pair">
          <div><label :for="`${id}-source`">Fuente</label><input :id="`${id}-source`" type="text" :value="known.evidence.sourceRef" :aria-describedby="described" :aria-invalid="!!message" @input="evidenceText('sourceRef', $event)"></div>
          <div><label :for="`${id}-date`">Fecha de verificación (AAAA-MM-DD)</label><input :id="`${id}-date`" type="text" :value="known.evidence.verifiedOn" :aria-describedby="described" :aria-invalid="!!message" @input="evidenceText('verifiedOn', $event)"></div>
        </div>
        <button type="button" data-action="remove-evidence" @click="evidenceChanged(null)">Quitar evidencia</button>
      </fieldset>
      <button v-else type="button" data-action="add-evidence" @click="evidenceChanged({ sourceRef: '', verifiedOn: '' })">Añadir evidencia</button>
    </template>
    <pre v-if="mismatch">{{ JSON.stringify(modelValue) }}</pre>
    <p v-if="message" :id="`${id}-issue`" class="issue" role="status">{{ message }}</p>
  </fieldset>
</template>

<style scoped>
.contract-field { min-width: 0; margin: 0; padding: 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); color: var(--hf-ink); }
legend { max-width: 100%; padding: 0 6px; font-weight: 650; overflow-wrap: anywhere; color: var(--hf-heading); }
label { display: block; margin: 12px 0 6px; font-size: .875rem; line-height: 1.5; }
input, select, textarea, button { box-sizing: border-box; min-height: max(44px, var(--hf-control-height, 44px)); max-width: 100%; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; padding: 8px 12px; }
input, select, textarea { width: 100%; }
textarea { resize: vertical; }
input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
button { margin-top: 12px; cursor: pointer; }
:disabled { cursor: not-allowed; }
.contract-field:disabled { opacity: .65; }
.pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.evidence { min-width: 0; margin: 16px 0 0; padding: 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); }
.issue { margin: 12px 0 0; color: var(--hf-warning); line-height: 1.5; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 600px) { .pair { grid-template-columns: 1fr; gap: 0; } }
</style>
