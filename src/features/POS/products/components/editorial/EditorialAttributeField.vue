<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { EditorialDefinition, EditorialOwner, EditorialValue } from '../../interfaces/product-editorial.types'
const props = defineProps<{
  id: string
  definition: EditorialDefinition
  assignment: EditorialValue | null
  baseline: EditorialValue | null
  target?: { owner: EditorialOwner; variantId: string | null }
  disabled: boolean
  issue?: string
}>()
const emit = defineEmits<{ 'update:assignment': [value: EditorialValue]; validity: [valid: boolean] }>()
const numberError = shallowRef(false)
const numberInput = shallowRef('')
const unitChoice = shallowRef('')
const options = computed(() => props.definition.type === 'single' || props.definition.type === 'multi'
  ? props.definition.options : [])
const units = computed(() => props.definition.type === 'number'
  ? props.definition.units : [])
watch(() => [props.definition.id, props.assignment], () => {
  numberError.value = false
  const assignment = props.assignment
  unitChoice.value = assignment?.type === 'number' ? JSON.stringify(assignment.unit) : ''
  numberInput.value = assignment?.type === 'number' && Number.isFinite(assignment.value) ? String(assignment.value) : ''
  if (assignment?.type === 'number' && !Number.isFinite(assignment.value)) {
    numberError.value = true
    emit('validity', false)
  }
}, { immediate: true })
function archivedAllowed(code: string) {
  const baseline = props.baseline
  const assignment = props.assignment
  const scope = assignment ?? props.target
  return baseline && scope && baseline.code === props.definition.code && baseline.type === props.definition.type &&
    baseline.owner === scope.owner && baseline.variantId === scope.variantId &&
    (baseline.type === 'single' ? baseline.value === code : baseline.type === 'multi' && baseline.value.includes(code))
}
const missingOptions = computed(() => {
  const assignment = props.assignment
  const codes = assignment?.type === 'single' ? [assignment.value] : assignment?.type === 'multi' ? assignment.value : []
  return codes.filter(code => !options.value.some(option => option.code === code))
})
function update(event: Event) {
  if (props.disabled) return
  const control = event.target as HTMLInputElement | HTMLSelectElement
  const scope = props.assignment ?? props.target
  if (!scope) return
  const base = { code: props.definition.code, owner: scope.owner, variantId: scope.variantId }
  const type = props.definition.type
  let value: EditorialValue
  if (type === 'number') {
    numberInput.value = control.value
    updateNumber()
    return
  } else if (type === 'boolean') {
    if (control.value !== 'true' && control.value !== 'false') return
    value = { ...base, type, value: control.value === 'true' }
  } else if (type === 'multi') {
    value = { ...base, type, value: Array.from((control as HTMLSelectElement).selectedOptions, option => option.value) }
  } else value = { ...base, type, value: control.value }
  emit('update:assignment', value)
}
function updateNumber() {
  const scope = props.assignment ?? props.target
  if (props.disabled || !scope) return
  const number = Number(numberInput.value)
  const valid = numberInput.value !== '' && Number.isFinite(number) && unitChoice.value !== ''
  numberError.value = !valid
  emit('validity', valid)
  if (!valid) {
    // An incomplete numeric edit must not leave the old valid value saveable
    // after retain/reconciliation or a field remount. T4a rejects this local-only
    // sentinel before any request; no invalid number reaches transport.
    if (props.assignment?.type === 'number') emit('update:assignment', { ...props.assignment, value: Number.NaN })
    return
  }
  emit('update:assignment', { code: props.definition.code, owner: scope.owner, variantId: scope.variantId,
    type: 'number', value: number, unit: JSON.parse(unitChoice.value) as string | null })
}
function changeUnit(event: Event) {
  unitChoice.value = (event.target as HTMLSelectElement).value
  updateNumber()
}
</script>

<template>
  <div class="attribute-control">
    <label :for="id">{{ definition.label }}</label>
    <input v-if="definition.type === 'text'" :id="id" class="editorial-control" type="text" :value="assignment?.value ?? ''" :disabled="disabled" :aria-invalid="Boolean(issue)" :aria-describedby="`${id}-issue`" @input="update">
    <select v-else-if="definition.type === 'boolean'" :id="id" class="editorial-control" :value="assignment === null ? '' : String(assignment.value)" :disabled="disabled" :aria-invalid="Boolean(issue)" :aria-describedby="`${id}-issue`" @change="update">
      <option value="" disabled>Selecciona un valor</option><option value="true">Sí</option><option value="false">No</option>
    </select>
    <template v-else-if="definition.type === 'number'">
      <input :id="id" class="editorial-control" type="number" step="any" :value="numberInput" :disabled="disabled" :aria-invalid="numberError || Boolean(issue)" :aria-describedby="`${id}-issue`" @input="update">
      <label :for="`${id}-unit`">Unidad</label>
      <select :id="`${id}-unit`" class="editorial-control" :value="unitChoice" :disabled="disabled" @change="changeUnit">
        <option value="" disabled>Selecciona una unidad</option>
        <option v-if="assignment?.type === 'number' && !units.some(unit => unit.code === (assignment?.type === 'number' ? assignment.unit : undefined))" :value="JSON.stringify(assignment.unit)" disabled>Unidad no disponible: {{ assignment.unit ?? 'Sin unidad' }}</option>
        <option v-for="unit in units" :key="JSON.stringify(unit.code)" :value="JSON.stringify(unit.code)">{{ unit.label ?? unit.code ?? 'Sin unidad' }}</option>
      </select>
    </template>
    <select v-else :id="id" class="editorial-control" :multiple="definition.type === 'multi'" :value="assignment?.value ?? (definition.type === 'multi' ? [] : '')" :disabled="disabled" :aria-invalid="Boolean(issue)" :aria-describedby="`${id}-issue`" @change="update">
      <option v-if="definition.type === 'single'" value="" disabled>Selecciona una opción</option>
      <option v-for="code in missingOptions" :key="`missing-${code}`" :value="code" disabled>No disponible: {{ code }}</option>
      <option v-for="option in options" :key="option.code" :value="option.code" :disabled="option.archived && !archivedAllowed(option.code)">{{ option.label }}{{ option.archived ? ' (archivada)' : '' }}</option>
    </select>
    <p :id="`${id}-issue`" class="editorial-help" :role="issue || numberError ? 'alert' : undefined">{{ numberError ? 'Ingresa un número finito y selecciona una unidad; este campo incompleto no se guardará.' : issue }}</p>
  </div>
</template>

<style scoped>
.attribute-control { display: grid; gap: 8px; min-width: 0; }
.editorial-control { width: 100%; min-width: 0; min-height: var(--hf-control-height, 44px); padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control, 6px); color: var(--hf-ink); background: var(--hf-field); }
.editorial-control:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.editorial-control:disabled { opacity: .65; }
.editorial-help { color: var(--hf-warning); font-size: 14px; overflow-wrap: anywhere; }
</style>
