<script setup lang="ts">
import { computed } from 'vue'
import EditorialSelect from './EditorialSelect.vue'
import EditorialSelectMenu from './EditorialSelectMenu.vue'
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
const stateItems = [{ label: 'Sin asignación', value: 'omitted' }, { label: 'Desconocido', value: 'unknown' }, { label: 'Valor conocido', value: 'known' }]
const scalarItems = computed(() => enumChoices.value.length ? enumChoices.value.map(item => ({ label: item.label, value: item.code }))
  : [{ label: 'Sí', value: 'true' }, { label: 'No', value: 'false' }])
const toItems = (source: readonly { code: string; label: string; disabled: boolean }[]) => source.map(item => ({ label: item.label, value: item.code, disabled: item.disabled }))
const message = computed(() => mismatch.value ? 'La clave guardada no coincide. Cambia el estado para corregirla.' : props.issue ||
  (resolveEditorialDeclarationInput(props.modelValue).status === 'incomplete' ? 'Completa el valor y la evidencia indicada. La admisión se valida por separado.' : ''))
const described = computed(() => message.value ? `${props.id}-issue` : undefined)
function update(input: EditorialDeclarationInput) { if (!props.disabled) emit('update:modelValue', input) }
function stateChanged(state: string | undefined) {
  if (props.disabled) return
  const key = props.declarationKey
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
// The lists are controlled and have no empty pick: the placeholder is the empty state, so an undefined
// pick changes nothing. Several picks come back in the order of the offered choices, as a native list did.
function inOrder(source: readonly { code: string }[], picked: readonly string[]) {
  return [...source.map(item => item.code), ...picked].filter((code, index, all) => picked.includes(code) && all.indexOf(code) === index)
}
function valueChanged(raw: string | readonly string[] | undefined, toys = false) {
  const current = known.value
  if (props.disabled || !current || raw === undefined) return
  if (current.key === 'relevantDimensionCodes') {
    const picked = Array.isArray(raw) ? raw : []
    const values = inOrder(toys ? toyOptions.value : listOptions.value, picked)
    update({ ...current, value: { ...current.value, [toys ? 'toyTypes' : 'codes']: values } } as EditorialDeclarationInput)
  } else if (Array.isArray(current.value)) {
    // Qualified choices retain the key's finite type; selected missing history stays visible.
    update({ ...current, value: inOrder(listOptions.value, Array.isArray(raw) ? raw : []) } as EditorialDeclarationInput)
  } else if (typeof raw === 'string' && (current.key === 'contentMagnitude' || current.key === 'presentationKind')) {
    if (enumChoices.value.some(item => item.code === raw)) update({ ...current, value: raw } as EditorialDeclarationInput)
  } else if (typeof raw === 'string' && (current.key === 'consumable' || current.key === 'animalApplied' || current.key === 'fitDeterminesChoice' || current.key === 'capacityDeterminesChoice' || current.key === 'electricalApplies')) {
    if (raw === 'true' || raw === 'false') update({ ...current, value: raw === 'true' })
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
    <EditorialSelect :id="`${id}-state`" :label="`${label} · Estado`" :items="stateItems" :model-value="modelValue.state" :describedby="described"
      :invalid="!!message" @update:model-value="stateChanged" />
    <template v-if="known">
      <label :for="`${id}-value`">{{ dimension ? 'Dimensiones pertinentes' : scalar ? 'Valor' : 'Opciones' }}</label>
      <EditorialSelect v-if="scalar" :id="`${id}-value`" :label="`${label} · Valor`" :items="scalarItems" :model-value="known.value === null ? undefined : String(known.value)"
        :describedby="described" :invalid="!!message" @update:model-value="valueChanged($event)" />
      <EditorialSelectMenu v-else :id="`${id}-value`" :label="`${label} · ${dimension ? 'Dimensiones pertinentes' : 'Opciones'}`" :items="toItems(listOptions)"
        :model-value="[...selectedCodes]" :describedby="described" :invalid="!!message" @update:model-value="valueChanged($event)" />
      <template v-if="dimension">
        <label :for="`${id}-toys`">Tipos de juguete</label>
        <EditorialSelectMenu :id="`${id}-toys`" :label="`${label} · Tipos de juguete`" :items="toItems(toyOptions)" :model-value="[...dimension.toyTypes]"
          :describedby="described" :invalid="!!message" @update:model-value="valueChanged($event, true)" />
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
input, textarea, button { box-sizing: border-box; min-height: max(44px, var(--hf-control-height, 44px)); max-width: 100%; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; padding: 8px 12px; }
input, textarea { width: 100%; }
textarea { resize: vertical; }
input:focus-visible, textarea:focus-visible, button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
button { margin-top: 12px; cursor: pointer; }
:disabled { cursor: not-allowed; }
.contract-field:disabled { opacity: .65; }
.pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.evidence { min-width: 0; margin: 16px 0 0; padding: 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); }
.issue { margin: 12px 0 0; color: var(--hf-warning); line-height: 1.5; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 600px) { .pair { grid-template-columns: 1fr; gap: 0; } }
</style>
