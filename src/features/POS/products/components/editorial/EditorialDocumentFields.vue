<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import EditorialAttributeField from './EditorialAttributeField.vue'
import type { EditorialContext, EditorialDefinition, EditorialDocument, EditorialValue, EditorialVocabulary } from '../../interfaces/product-editorial.types'
import { editorialIssueMessage } from '../../composables/useEditorialEditor'
import { qualifyEditorialBaseline, type EditorialAssignmentIssue } from '../../utils/product-editorial-assignment-validation'
const props = defineProps<{
  document: EditorialDocument
  baseline: unknown
  vocabulary: EditorialVocabulary
  context: EditorialContext
  issues: EditorialAssignmentIssue[]
  disabled: boolean
}>()
const emit = defineEmits<{ 'update:document': [document: EditorialDocument]; validity: [valid: boolean] }>()
const familyPending = shallowRef<string | null | undefined>(undefined)
const selectedBinding = shallowRef('')
const selectedVariant = shallowRef('')
const newValue = shallowRef<EditorialValue | null>(null)
const invalidControls = shallowRef<Set<string>>(new Set())
// Ordering belongs to the backend's database collation, including equal sortOrder entries.
const families = computed(() => props.vocabulary.families)
const family = computed(() => props.vocabulary.families.find(item => item.code === props.document.familyCode))
const bindings = computed(() => family.value?.bindings ?? [])
const qualifiedBaseline = computed(() => qualifyEditorialBaseline({ persistedBaseline: props.baseline,
  vocabulary: props.vocabulary, context: props.context }))
function definitionFor(code: string): EditorialDefinition | null {
  const binding = bindings.value.find(item => item.definitionCode === code)
  return props.vocabulary.definitions.find(item => item.code === code && item.id === binding?.definitionId) ?? null
}
const additionBinding = computed(() => bindings.value.find(item => item.definitionCode === selectedBinding.value))
const additionDefinition = computed(() => definitionFor(selectedBinding.value))
const additionTarget = computed(() => {
  const binding = additionBinding.value
  if (!binding || (binding.owner === 'sellable' && props.context.variants.length && !selectedVariant.value)) return undefined
  return { owner: binding.owner, variantId: binding.owner === 'sellable' && props.context.variants.length ? selectedVariant.value : null }
})
const duplicate = computed(() => Boolean(additionTarget.value && props.document.values.some(value =>
  value.code === selectedBinding.value && value.variantId === additionTarget.value!.variantId)))
const canAdd = computed(() => !props.disabled && !duplicate.value && newValue.value !== null && additionTarget.value !== undefined)
const counts = computed(() => ({ title: [...(props.document.commercialTitle ?? '')].length, description: [...(props.document.description ?? '')].length }))
const familyIssues = computed(() => props.issues.filter(issue => issue.code === 'family').map(editorialIssueMessage).join(' '))
watch(() => [props.document.familyCode, selectedBinding.value, selectedVariant.value], () => { newValue.value = null })
watch(() => props.document, () => {
  // Replaced snapshots and explicit removals reset transient incomplete controls.
  if (invalidControls.value.size && props.document.values.length === 0) {
    invalidControls.value = new Set(); emit('validity', true)
  }
})
function replace(patch: Partial<EditorialDocument>) {
  if (!props.disabled) emit('update:document', { ...props.document, ...patch })
}
function text(event: Event, key: 'commercialTitle' | 'description') { replace({ [key]: (event.target as HTMLInputElement).value }) }
function changeFamily(event: Event) {
  const control = event.target as HTMLSelectElement
  const next = control.value === '' ? null : control.value
  control.value = props.document.familyCode ?? ''
  if (next === props.document.familyCode || props.disabled) return
  if (props.document.values.length) familyPending.value = next
  else replace({ familyCode: next })
}
function confirmFamily() {
  if (familyPending.value === undefined) return
  replace({ familyCode: familyPending.value, values: [] })
  familyPending.value = undefined
  selectedBinding.value = ''; selectedVariant.value = ''
  invalidControls.value = new Set(); emit('validity', true)
}
function updateValue(index: number, assignment: EditorialValue) {
  replace({ values: props.document.values.map((value, i) => i === index ? assignment : value) })
}
function assignmentKey(value: EditorialValue) { return JSON.stringify([value.code, value.variantId]) }
function remove(index: number) {
  const removed = props.document.values[index]
  if (!removed) return
  replace({ values: props.document.values.filter((_value, i) => i !== index) })
  const next = new Set(invalidControls.value)
  next.delete(assignmentKey(removed))
  invalidControls.value = next; emit('validity', !next.size)
}
function validity(value: EditorialValue, valid: boolean) {
  const next = new Set(invalidControls.value)
  const key = assignmentKey(value)
  if (valid) next.delete(key); else next.add(key)
  invalidControls.value = next; emit('validity', !next.size)
}
function add() {
  if (!canAdd.value || !newValue.value) return
  replace({ values: [...props.document.values, newValue.value] })
  selectedBinding.value = ''; newValue.value = null
}
function orphan(value: EditorialValue) {
  const definition = definitionFor(value.code)
  const binding = bindings.value.find(item => item.definitionCode === value.code)
  return !definition || definition.type !== value.type || binding?.owner !== value.owner ||
    (value.owner === 'sellable' && (props.context.variants.length ? !props.context.variants.some(item => item.id === value.variantId) : value.variantId !== null))
}
function valueText(value: EditorialValue) {
  if (value.type === 'number') return `${value.value}${value.unit ? ` ${value.unit}` : ''}`
  return value.type === 'multi' ? value.value.join(', ') : value.type === 'boolean' ? value.value ? 'Sí' : 'No' : String(value.value)
}
function baselineFor(value: Pick<EditorialValue, 'code' | 'owner' | 'variantId' | 'type'>): EditorialValue | null {
  const raw = qualifiedBaseline.value
  if (!raw || raw.familyCode !== props.document.familyCode) return null
  return raw.values.find(previous => previous.code === value.code && previous.owner === value.owner &&
    previous.variantId === value.variantId && previous.type === value.type) ?? null
}
function variantLabel(id: string | null) {
  if (id === null) return 'Sin presentación'
  const variant = props.context.variants.find(item => item.id === id)
  const shortId = id.slice(0, 8)
  const uniqueShortId = props.context.variants.some(item => item.id !== id && item.id.slice(0, 8) === shortId) ? id : shortId
  return variant ? `${variant.name} · ${uniqueShortId}` : `Presentación no disponible · ${id}`
}
function assignmentIssue(index: number) { return props.issues.filter(issue => issue.valueIndex === index).map(editorialIssueMessage).join(' ') }
</script>

<template>
  <div class="document-fields">
    <section class="editorial-panel field-section" aria-labelledby="editorial-document-heading">
      <h2 id="editorial-document-heading">Contenido del borrador</h2>
      <label for="editorial-commercialTitle">Título comercial editorial</label>
      <input id="editorial-commercialTitle" class="editorial-control" type="text" :value="document.commercialTitle ?? ''" :disabled="disabled" :aria-invalid="counts.title > 200" aria-describedby="editorial-title-count" @input="text($event, 'commercialTitle')">
      <p id="editorial-title-count" class="editorial-help" :class="{ warning: counts.title > 200 }">{{ counts.title }} / 200 caracteres{{ counts.title > 200 ? ' · Reduce el título antes de guardar.' : '' }}</p>
      <label for="editorial-description">Descripción editorial</label>
      <textarea id="editorial-description" class="editorial-control" rows="6" :value="document.description ?? ''" :disabled="disabled" :aria-invalid="counts.description > 20000" aria-describedby="editorial-description-count" @input="text($event, 'description')" />
      <p id="editorial-description-count" class="editorial-help" :class="{ warning: counts.description > 20000 }">{{ counts.description }} / 20,000 caracteres{{ counts.description > 20000 ? ' · Reduce la descripción antes de guardar.' : '' }}</p>
      <label for="editorial-family">Familia editorial</label>
      <select id="editorial-family" class="editorial-control" :value="document.familyCode ?? ''" :disabled="disabled" :aria-invalid="Boolean(familyIssues)" aria-describedby="editorial-family-issue" @change="changeFamily">
        <option value="">Sin familia</option>
        <option v-if="document.familyCode && !family" :value="document.familyCode" disabled>No disponible: {{ document.familyCode }}</option>
        <option v-for="item in families" :key="item.id" :value="item.code">{{ item.label }}</option>
      </select>
      <p id="editorial-family-issue" class="warning">{{ familyIssues }}</p>
      <p v-if="!families.length" class="editorial-help">No hay familias disponibles en el vocabulario actual.</p>
      <div v-if="familyPending !== undefined" role="group" aria-labelledby="family-confirm-heading" class="confirmation">
        <h3 id="family-confirm-heading">Confirmar cambio de familia</h3>
        <p>Se quitarán los atributos del borrador local. El título, la descripción y los medios se conservan. El servidor no cambia hasta guardar.</p>
        <div class="field-actions"><button type="button" class="editorial-button" data-testid="cancel-family" @click="familyPending = undefined">Cancelar</button><button type="button" class="editorial-button" data-testid="confirm-family" :disabled="disabled" @click="confirmFamily">Cambiar familia y quitar atributos</button></div>
      </div>
      <p class="editorial-help">{{ document.mediaRefs.length }} referencias de medios conservadas · Solo lectura; no se cargan ni modifican archivos.</p>
    </section>
    <section class="editorial-panel field-section" aria-labelledby="editorial-attributes-heading">
      <h2 id="editorial-attributes-heading">Atributos editoriales</h2>
      <p class="editorial-help">Agrega solo los atributos que necesites. La familia determina su alcance; no son obligatorios.</p>
      <p v-if="!document.values.length">Sin atributos.</p>
      <div v-for="(value, index) in document.values" :key="JSON.stringify([value.code, value.variantId])" class="assignment" :data-testid="`assignment-${index}`">
        <p class="editorial-help">{{ value.owner === 'product' ? 'Producto' : variantLabel(value.variantId) }}</p>
        <template v-if="orphan(value)">
          <p class="warning">Atributo huérfano o contexto no disponible: {{ value.code }}</p>
          <p class="stored-value">{{ valueText(value) }}</p>
          <p class="editorial-help">Se conserva sin cambios. Quítalo o corrígelo para poder guardar el borrador.</p>
        </template>
        <EditorialAttributeField v-else :id="`editorial-value-${index}`" :definition="definitionFor(value.code)!" :assignment="value" :baseline="baselineFor(value)" :disabled="disabled" :issue="assignmentIssue(index)" @update:assignment="updateValue(index, $event)" @validity="validity(value, $event)" />
        <p v-if="orphan(value) && assignmentIssue(index)" role="alert" class="warning">{{ assignmentIssue(index) }}</p>
        <button type="button" class="editorial-button" :data-testid="`remove-${index}`" :disabled="disabled" :aria-label="`Quitar atributo ${definitionFor(value.code)?.label ?? value.code}`" @click="remove(index)">Quitar atributo</button>
      </div>
      <template v-if="family">
        <label for="editorial-add-binding">Agregar atributo de la familia</label>
        <select id="editorial-add-binding" v-model="selectedBinding" class="editorial-control" :disabled="disabled">
          <option value="">Selecciona un atributo</option>
          <option v-for="binding in bindings" :key="binding.definitionId" :value="binding.definitionCode" :disabled="!definitionFor(binding.definitionCode)">{{ definitionFor(binding.definitionCode)?.label ?? binding.definitionCode }} · {{ binding.owner === 'product' ? 'Producto' : 'Presentación' }}</option>
        </select>
        <template v-if="additionBinding?.owner === 'sellable' && context.variants.length">
          <label for="editorial-add-variant">Presentación del atributo</label>
          <select id="editorial-add-variant" v-model="selectedVariant" class="editorial-control" :disabled="disabled">
            <option value="">Selecciona una presentación</option><option v-for="variant in context.variants" :key="variant.id" :value="variant.id">{{ variantLabel(variant.id) }}</option>
          </select>
        </template>
        <EditorialAttributeField v-if="additionDefinition && additionTarget" :key="JSON.stringify([selectedBinding, selectedVariant])" id="editorial-new-value" :definition="additionDefinition" :assignment="newValue" :baseline="baselineFor({ code: additionDefinition.code, ...additionTarget, type: additionDefinition.type })" :target="additionTarget" :disabled="disabled" @update:assignment="newValue = $event" @validity="!$event && (newValue = null)" />
        <p v-if="duplicate" class="warning">Este atributo ya existe para ese alcance. Edita el valor existente.</p>
        <button type="button" class="editorial-button" data-testid="add-attribute" :disabled="!canAdd" @click="add">Agregar atributo</button>
      </template>
      <p v-else class="editorial-help">Selecciona una familia disponible para agregar atributos.</p>
    </section>
  </div>
</template>

<style scoped>
.document-fields { display: grid; gap: 24px; min-width: 0; }
.editorial-panel { padding: 24px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); }
.field-section { display: grid; gap: 12px; min-width: 0; overflow-wrap: anywhere; }
.field-section h2 { font-size: 18px; font-weight: 600; color: var(--hf-heading); }
.editorial-control { width: 100%; min-width: 0; min-height: var(--hf-control-height); padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); color: var(--hf-ink); background: var(--hf-field); }
.editorial-button { min-height: var(--hf-control-height); padding: 8px 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); color: var(--hf-ink); background: var(--hf-surface); cursor: pointer; }
.editorial-button:focus-visible, .editorial-control:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.editorial-button:disabled, .editorial-control:disabled { opacity: .65; cursor: default; }
.editorial-help { font-size: 14px; color: var(--hf-muted); }
.warning { color: var(--hf-warning); font-size: 14px; }
.assignment { display: grid; gap: 12px; padding-block: 16px; border-bottom: 1px solid var(--hf-border); }
.stored-value { white-space: pre-wrap; }
.confirmation { display: grid; gap: 12px; padding: 16px; background: var(--hf-warning-soft); border-radius: var(--hf-radius-control); }
.field-actions { display: flex; flex-wrap: wrap; gap: 12px; }
@media (max-width: 480px) { .editorial-panel { padding: 16px; } }
</style>
