<script setup lang="ts">
import { computed } from 'vue'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialEvidence } from '../../interfaces/editorial-contract-value.types'
import { resolveEditorialAssignmentInput, type EditorialAssignmentInput, type EditorialAssignmentTarget, type EditorialPayloadInput } from '../../utils/editorial-contract-assignment-input'
const props = defineProps<{ id: string; definition: EditorialDefinition; target: EditorialAssignmentTarget;
  modelValue: EditorialAssignmentInput; disabled?: boolean; issue?: string; conservedOptions?: readonly string[] }>()
const emit = defineEmits<{ 'update:modelValue': [input: EditorialAssignmentInput] }>()
// Raw state belongs to the parent, including partial edits. This component never saves.
const payload = computed(() => props.modelValue.state === 'known' && props.modelValue.payload.type === props.definition.type ? props.modelValue.payload : null)
const mismatch = computed(() => props.modelValue.state === 'known' && payload.value === null)
const message = computed(() => props.issue || (mismatch.value ? 'El tipo guardado no coincide. Cambia el estado para corregirlo.'
  : resolveEditorialAssignmentInput(props.target, props.modelValue).status === 'incomplete' ? 'Completa el valor, la unidad y la evidencia indicada antes de guardar.' : ''))
const described = computed(() => message.value ? `${props.id}-issue` : undefined)
const selected = computed(() => payload.value?.type === 'single' ? (payload.value.value === null ? [] : [payload.value.value]) : payload.value?.type === 'multi' ? payload.value.value : [])
const options = computed(() => {
  const source = props.definition.type === 'single' || props.definition.type === 'multi' ? props.definition.options : []
  return [...source.map(o => ({ code: o.code, label: o.label + (o.archived ? ' (archivada)' : ''),
    disabled: o.archived && !props.conservedOptions?.includes(o.code) })),
  ...selected.value.filter(code => !source.some(o => o.code === code)).map(code => ({ code, label: `${code} (No disponible)`, disabled: true }))]
})
const unit = computed(() => payload.value?.type === 'number' || payload.value?.type === 'range' ? payload.value.unit : undefined)
const units = computed(() => {
  const source = props.definition.type === 'number' || props.definition.type === 'range'
    ? props.definition.units.filter(u => props.definition.type !== 'range' || u.code !== null) : []
  const available = source.map(u => ({ token: JSON.stringify(u.code), label: u.label ?? u.code ?? 'Sin unidad', disabled: false }))
  if (unit.value !== undefined && !source.some(u => u.code === unit.value)) available.push({ token: JSON.stringify(unit.value), label: `${unit.value ?? 'Sin unidad'} (No disponible)`, disabled: true })
  return available
})
function update(input: EditorialAssignmentInput) { if (!props.disabled) emit('update:modelValue', input) }
function empty(type: EditorialDefinition['type']): EditorialPayloadInput {
  switch (type) {
    case 'text': return { type, value: '' }
    case 'boolean': return { type, value: null }
    case 'single': return { type, value: null }
    case 'multi': return { type, value: [] }
    case 'number': return { type, value: '' }
    case 'range': return { type, min: '', max: '' }
  }
}
function stateChanged(event: Event) {
  if (props.disabled) return
  const state = (event.target as HTMLSelectElement).value
  if (state === 'known') update({ state, payload: empty(props.definition.type), evidence: null })
  else if (state === 'omitted' || state === 'unknown' || state === 'not_applicable') update({ state })
}
function updatePayload(next: EditorialPayloadInput) {
  if (props.modelValue.state === 'known') update({ ...props.modelValue, payload: next })
}
function valueChanged(event: Event) {
  if (props.disabled || !payload.value) return
  const control = event.target as HTMLInputElement | HTMLSelectElement, raw = control.value, p = payload.value
  switch (p.type) {
    case 'text': case 'number': updatePayload({ ...p, value: raw }); break
    case 'boolean': updatePayload({ ...p, value: raw === '' ? null : raw === 'true' }); break
    case 'single': updatePayload({ ...p, value: raw === '' ? null : raw }); break
    case 'multi': updatePayload({ ...p, value: Array.from((control as HTMLSelectElement).selectedOptions, o => o.value) }); break
  }
}
function rangeChanged(part: 'min' | 'max', event: Event) {
  if (!props.disabled && payload.value?.type === 'range') updatePayload({ ...payload.value, [part]: (event.target as HTMLInputElement).value })
}
function unitChanged(event: Event) {
  if (props.disabled || (payload.value?.type !== 'number' && payload.value?.type !== 'range')) return
  const raw = (event.target as HTMLSelectElement).value
  if (raw === '') updatePayload({ ...payload.value, unit: undefined })
  else if (units.value.some(u => u.token === raw && !u.disabled)) updatePayload({ ...payload.value, unit: JSON.parse(raw) as string | null })
}
function evidenceChanged(evidence: EditorialEvidence | null) {
  if (props.modelValue.state === 'known') update({ ...props.modelValue, evidence })
}
function evidenceText(part: keyof EditorialEvidence, event: Event) {
  if (!props.disabled && props.modelValue.state === 'known' && props.modelValue.evidence !== null)
    evidenceChanged({ ...props.modelValue.evidence, [part]: (event.target as HTMLInputElement).value })
}
</script>

<template>
  <fieldset class="contract-field" :disabled="disabled">
    <legend>{{ definition.label }}</legend>
    <label :for="`${id}-state`">Estado</label>
    <select :id="`${id}-state`" :value="modelValue.state" :aria-describedby="described" @change="stateChanged">
      <option value="omitted">Sin asignación</option><option value="unknown">Desconocido</option>
      <option value="not_applicable">No aplica</option><option value="known">Valor conocido</option>
    </select>
    <template v-if="payload && modelValue.state === 'known'">
      <template v-if="payload.type === 'text' || payload.type === 'number'">
        <label :for="`${id}-value`">Valor</label>
        <input :id="`${id}-value`" type="text" :inputmode="payload.type === 'number' ? 'decimal' : undefined" :value="payload.value"
          :aria-invalid="!!message" :aria-describedby="described" @input="valueChanged">
      </template>
      <template v-else-if="payload.type === 'boolean'">
        <label :for="`${id}-value`">Valor</label>
        <select :id="`${id}-value`" :value="payload.value === null ? '' : String(payload.value)" :aria-invalid="!!message" :aria-describedby="described" @change="valueChanged">
          <option value="">Selecciona un valor</option><option value="true">Sí</option><option value="false">No</option>
        </select>
      </template>
      <template v-else-if="payload.type === 'single' || payload.type === 'multi'">
        <label :for="`${id}-value`">{{ payload.type === 'multi' ? 'Opciones' : 'Opción' }}</label>
        <select :id="`${id}-value`" :multiple="payload.type === 'multi'" :aria-invalid="!!message" :aria-describedby="described" @change="valueChanged">
          <option v-if="payload.type === 'single'" value="" :selected="payload.value === null">Selecciona una opción</option>
          <option v-for="option in options" :key="option.code" :value="option.code" :selected="selected.includes(option.code)" :disabled="option.disabled">{{ option.label }}</option>
        </select>
      </template>
      <div v-else class="pair">
        <div><label :for="`${id}-min`">Mínimo</label><input :id="`${id}-min`" type="text" inputmode="decimal" :value="payload.min" :aria-invalid="!!message" :aria-describedby="described" @input="rangeChanged('min', $event)"></div>
        <div><label :for="`${id}-max`">Máximo</label><input :id="`${id}-max`" type="text" inputmode="decimal" :value="payload.max" :aria-invalid="!!message" :aria-describedby="described" @input="rangeChanged('max', $event)"></div>
      </div>
      <template v-if="payload.type === 'number' || payload.type === 'range'">
        <label :for="`${id}-unit`">Unidad</label>
        <select :id="`${id}-unit`" :value="unit === undefined ? '' : JSON.stringify(unit)" :aria-invalid="!!message" :aria-describedby="described" @change="unitChanged">
          <option value="">Selecciona una unidad</option><option v-for="item in units" :key="item.token" :value="item.token" :disabled="item.disabled">{{ item.label }}</option>
        </select>
      </template>
      <fieldset v-if="modelValue.evidence !== null" class="evidence">
        <legend>Evidencia</legend>
        <div class="pair">
          <div><label :for="`${id}-source`">Fuente</label><input :id="`${id}-source`" type="text" :value="modelValue.evidence.sourceRef" :aria-invalid="!!message" :aria-describedby="described" @input="evidenceText('sourceRef', $event)"></div>
          <div><label :for="`${id}-date`">Fecha de verificación (AAAA-MM-DD)</label><input :id="`${id}-date`" type="text" :value="modelValue.evidence.verifiedOn" :aria-invalid="!!message" :aria-describedby="described" @input="evidenceText('verifiedOn', $event)"></div>
        </div>
        <button type="button" data-action="remove-evidence" @click="evidenceChanged(null)">Quitar evidencia</button>
      </fieldset>
      <button v-else type="button" data-action="add-evidence" @click="evidenceChanged({ sourceRef: '', verifiedOn: '' })">Añadir evidencia</button>
    </template>
    <pre v-if="mismatch && modelValue.state === 'known'">{{ JSON.stringify(modelValue.payload) }}</pre>
    <p v-if="message" :id="`${id}-issue`" class="issue" role="status">{{ message }}</p>
  </fieldset>
</template>

<style scoped>
.contract-field { min-width: 0; margin: 0; padding: 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); color: var(--hf-ink); }
legend { max-width: 100%; padding: 0 6px; font-weight: 650; overflow-wrap: anywhere; color: var(--hf-heading); }
label { display: block; margin: 12px 0 6px; font-size: .875rem; line-height: 1.5; }
input, select, button { box-sizing: border-box; min-height: var(--hf-control-height); max-width: 100%; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; padding: 8px 12px; }
input, select { width: 100%; }
input:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
button { margin-top: 12px; cursor: pointer; }
:disabled { cursor: not-allowed; }
.contract-field:disabled { opacity: .65; }
.pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.evidence { min-width: 0; margin: 16px 0 0; padding: 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); }
.issue { margin: 12px 0 0; color: var(--hf-warning); line-height: 1.5; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 600px) { .pair { grid-template-columns: 1fr; gap: 0; } }
</style>
