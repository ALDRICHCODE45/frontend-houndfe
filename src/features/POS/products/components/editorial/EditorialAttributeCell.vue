<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import EditorialSelect from './EditorialSelect.vue'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialEvidence } from '../../interfaces/editorial-contract-value.types'
import { parseEditorialDecimal, resolveEditorialAssignmentInput, type EditorialAssignmentInput,
  type EditorialAssignmentTarget, type EditorialPayloadInput } from '../../utils/editorial-contract-assignment-input'
import { isEditorialInputBlank } from '../../utils/editorial-attribute-table'
import { isFreshEditorialEvidence } from '../../utils/editorial-contract-evidence-validation'
import { editorialInputText } from '../../utils/editorial-value-text'

/** One cell of the attribute table: a control for the definition's type, a chip when there is no
 * known value, and a ⋯ menu for the states and the evidence. It holds no document state: the table
 * owns the assignments and creates or removes them from `update:modelValue` and `clear`.
 */
const props = withDefaults(defineProps<{ id: string; label: string; definition: EditorialDefinition; target: EditorialAssignmentTarget;
  modelValue: EditorialAssignmentInput; readonly?: boolean; disabled?: boolean; issue?: string; conservedOptions?: readonly string[];
  /** The policy admits "No aplica" for this cell; a cell shown on its own offers it. */
  naAdmitted?: boolean
  /** The policy makes the datum required to publish: a quiet marker, never an error. */
  required?: boolean }>(), { naAdmitted: true })
const emit = defineEmits<{ 'update:modelValue': [input: EditorialAssignmentInput]; clear: []; enter: [source: HTMLElement] }>()

const type = computed(() => props.definition.type)
const state = computed(() => props.modelValue.state)
const known = computed(() => (props.modelValue.state === 'known' ? props.modelValue : null))
const payload = computed(() => (known.value && known.value.payload.type === type.value ? known.value.payload : null))
const mismatch = computed(() => known.value !== null && payload.value === null)
const evidence = computed(() => known.value?.evidence ?? null)
const showControl = computed(() => !props.readonly && (state.value === 'omitted' || (known.value !== null && !mismatch.value)))
const chip = computed(() => (state.value === 'known' ? { label: 'Con dato', tone: 'success' as const } : { label: editorialInputText(props.modelValue, props.definition), tone: 'neutral' as const }))

const choices = computed(() => (props.definition.type === 'single' || props.definition.type === 'multi' ? props.definition.options : []))
const selected = computed<readonly string[]>(() => payload.value?.type === 'single' ? (payload.value.value === null ? [] : [payload.value.value])
  : payload.value?.type === 'multi' ? payload.value.value : [])
const options = computed(() => [
  ...choices.value.map(option => ({ code: option.code, label: option.label + (option.archived ? ' (archivada)' : ''),
    locked: option.archived && !props.conservedOptions?.includes(option.code) })),
  ...selected.value.filter(code => !choices.value.some(option => option.code === code)).map(code => ({ code, label: `${code} (no disponible)`, locked: true })),
])
const booleanItems = [{ label: 'Sí', value: 'true' }, { label: 'No', value: 'false' }]
const singleItems = computed(() => options.value.map(option => ({ label: option.label, value: option.code, disabled: option.locked })))
const multiText = computed(() => (selected.value.length ? selected.value.map(code => options.value.find(option => option.code === code)?.label ?? code).join(', ') : 'Elige…'))

// A unit picked before any value is a cell-local choice; the assignment exists once there is a value.
const units = computed(() => {
  const source = props.definition.type === 'number' || props.definition.type === 'range'
    ? props.definition.units.filter(unit => props.definition.type !== 'range' || unit.code !== null) : []
  return source.map(unit => ({ code: unit.code, token: JSON.stringify(unit.code), label: unit.label ?? unit.code ?? 'Sin unidad' }))
})
const chosenUnit = shallowRef<string | null | undefined>(undefined)
const stored = computed(() => (payload.value?.type === 'number' || payload.value?.type === 'range' ? payload.value : null))
const defaultUnit = computed(() => (units.value.length === 1 ? units.value[0]!.code : undefined))
const unit = computed(() => (stored.value ? stored.value.unit : chosenUnit.value !== undefined ? chosenUnit.value : defaultUnit.value))
const unitChoices = computed(() => (unit.value !== undefined && !units.value.some(item => item.code === unit.value)
  ? [...units.value, { code: unit.value, token: JSON.stringify(unit.value), label: `${unit.value ?? 'Sin unidad'} (no disponible)` }] : units.value))
const unitItems = computed(() => unitChoices.value.map(item => ({ label: item.label, value: item.token })))
const impliedUnit = computed(() => (units.value.length === 1 ? units.value[0]!.label : ''))

const message = computed(() => {
  if (props.issue) return props.issue
  if (mismatch.value) return 'El dato guardado tiene otro formato. Cambia su estado o quítalo para corregirlo.'
  const current = payload.value
  if (!current || props.readonly) return ''
  if (current.type === 'number' || current.type === 'range') {
    const numbers = current.type === 'number' ? [current.value] : [current.min, current.max]
    if (numbers.some(value => value !== '' && parseEditorialDecimal(value) === null)) return 'Escribe solo números'
    if (current.type === 'range' && numbers.some(value => value === '') && numbers.some(value => value !== '')) return 'Completa mínimo y máximo'
    if (current.unit === undefined) return 'Elige la unidad'
  }
  return resolveEditorialAssignmentInput(props.target, props.modelValue).status === 'incomplete' ? 'Completa este dato' : ''
})
const requiredMarker = computed(() => Boolean(props.required) && !props.readonly && state.value !== 'known')
const described = computed(() => (message.value ? `${props.id}-issue` : undefined))

function update(next: EditorialAssignmentInput) {
  if (props.disabled || props.readonly) return
  // A control back at its placeholder leaves nothing to save: the cell clears instead of keeping a blank.
  if (isEditorialInputBlank(next)) emit('clear')
  else emit('update:modelValue', next)
}
function setKnown(next: EditorialPayloadInput) { update({ state: 'known', payload: next, evidence: evidence.value }) }
function textChanged(event: Event) { setKnown({ type: 'text', value: (event.target as HTMLInputElement).value }) }
// A list has no empty pick (the placeholder is its empty state), so an undefined pick changes nothing.
function booleanChanged(raw: string | undefined) {
  if (raw === 'true' || raw === 'false') setKnown({ type: 'boolean', value: raw === 'true' })
}
function singleChanged(raw: string | undefined) {
  if (raw !== undefined) setKnown({ type: 'single', value: raw })
}
function multiChanged(code: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const current = payload.value?.type === 'multi' ? payload.value.value : []
  setKnown({ type: 'multi', value: checked ? [...current.filter(item => item !== code), code] : current.filter(item => item !== code) })
}
function numberChanged(event: Event) { setKnown({ type: 'number', value: (event.target as HTMLInputElement).value, unit: unit.value }) }
function rangeChanged(part: 'min' | 'max', event: Event) {
  const current = payload.value?.type === 'range' ? payload.value : { min: '', max: '' }
  setKnown({ type: 'range', min: current.min, max: current.max, [part]: (event.target as HTMLInputElement).value, unit: unit.value })
}
function unitChanged(raw: string | undefined) {
  if (props.disabled || raw === undefined) return
  const next = JSON.parse(raw) as string | null
  if (stored.value) setKnown({ ...stored.value, unit: next })
  else chosenUnit.value = next
}
watch(stored, current => { if (current) chosenUnit.value = current.unit })

// Evidence is a small secondary form; it only makes sense on a known value.
const evidenceOpen = shallowRef(false)
const draft = shallowRef<EditorialEvidence>({ sourceRef: '', verifiedOn: '' })
const evidenceError = shallowRef('')
const evidenceFilled = computed(() => known.value !== null)
watch(evidenceOpen, open => { if (open) { draft.value = { ...(evidence.value ?? { sourceRef: '', verifiedOn: '' }) }; evidenceError.value = '' } })
function saveEvidence() {
  if (!isFreshEditorialEvidence(draft.value)) { evidenceError.value = 'Escribe la fuente y una fecha válida.'; return }
  if (known.value) update({ ...known.value, evidence: { ...draft.value } })
  evidenceOpen.value = false
}
function removeEvidence() {
  if (known.value) update({ ...known.value, evidence: null })
  evidenceOpen.value = false
}

// The menu hands focus back to its ⋯ button as it closes; that focus move must not dismiss the form
// it just opened. A click or Escape outside still closes it.
function keepOnFocusMove(event: Event) { event.preventDefault() }

const root = useTemplateRef<HTMLElement>('root')
// The option list is a plain <details>: Escape or a press outside it closes it, like any menu.
const multi = useTemplateRef<HTMLDetailsElement>('multi')
function closeMulti(refocus = false) {
  if (!multi.value?.open) return
  multi.value.open = false
  if (refocus) multi.value.querySelector<HTMLElement>('summary')?.focus()
}
function closeOnOutsidePress(event: Event) {
  if (multi.value?.open && !multi.value.contains(event.target as Node)) closeMulti()
}
onMounted(() => document.addEventListener('pointerdown', closeOnOutsidePress))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsidePress))
async function focusControl() {
  await nextTick()
  root.value?.querySelector<HTMLElement>('input, [role="combobox"], summary')?.focus()
}
const actions = computed<RowAction[]>(() => {
  const items: RowAction[] = []
  if (state.value === 'unknown' || state.value === 'not_applicable') items.push({ key: 'value', label: 'Escribir valor', icon: 'i-lucide-pencil' })
  if (state.value !== 'unknown') items.push({ key: 'unknown', label: 'Desconocido', icon: 'i-lucide-circle-help' })
  if (state.value !== 'not_applicable') {
    if (props.naAdmitted) items.push({ key: 'na', label: 'No aplica', icon: 'i-lucide-ban' })
    else {
      items.push({ key: 'na-unavailable', label: 'No aplica no disponible', icon: 'i-lucide-ban', disabled: true })
      items.push({ key: 'na-hint', label: 'Déjalo vacío si no corresponde.', disabled: true })
    }
  }
  items.push({ key: 'evidence', label: evidence.value ? 'Editar evidencia' : 'Agregar evidencia', icon: 'i-lucide-paperclip', disabled: !evidenceFilled.value })
  items.push({ key: 'clear', label: 'Quitar dato', icon: 'i-lucide-eraser', destructive: true, disabled: state.value === 'omitted' })
  return items
})
function act(key: string) {
  if (props.disabled || props.readonly) return
  if (key === 'unknown') update({ state: 'unknown' })
  else if (key === 'na') update({ state: 'not_applicable' })
  else if (key === 'clear') emit('clear')
  else if (key === 'value') { emit('clear'); void focusControl() }
  // After the menu has closed and handed focus back: a popover opened in the same tick would dismiss itself.
  else if (key === 'evidence') setTimeout(() => { evidenceOpen.value = true }, 0)
}
</script>

<template>
  <div ref="root" class="hf-cell" :data-state="state">
    <div class="hf-cell__line">
      <span v-if="readonly" class="hf-cell__text">{{ state === 'known' ? editorialInputText(modelValue, definition) : '' }}</span>
      <fieldset v-else-if="showControl" class="hf-cell__fields" :disabled="disabled">
        <input v-if="type === 'text'" :id="`${id}-value`" class="hf-cell__control" type="text" :value="payload?.type === 'text' ? payload.value : ''"
          :disabled="disabled" :aria-label="label" :aria-invalid="message ? 'true' : undefined" :aria-describedby="described"
          @input="textChanged" @keydown.enter.prevent="emit('enter', $event.target as HTMLElement)">
        <EditorialSelect v-else-if="type === 'boolean'" :id="`${id}-value`" class="hf-cell__select" :label="label" :items="booleanItems"
          :model-value="payload?.type === 'boolean' && payload.value !== null ? String(payload.value) : undefined" :disabled="disabled"
          :invalid="!!message" :describedby="described" @update:model-value="booleanChanged" />
        <EditorialSelect v-else-if="type === 'single'" :id="`${id}-value`" class="hf-cell__select" :label="label" :items="singleItems"
          :model-value="payload?.type === 'single' && payload.value !== null ? payload.value : undefined" :disabled="disabled"
          :invalid="!!message" :describedby="described" @update:model-value="singleChanged" />
        <details v-else-if="type === 'multi'" ref="multi" class="hf-cell__multi" @keydown.esc="closeMulti(true)">
          <summary class="hf-cell__control" :aria-label="label" :aria-invalid="message ? 'true' : undefined">{{ multiText }}</summary>
          <div class="hf-cell__options" role="group" :aria-label="label">
            <label v-for="option in options" :key="option.code" class="hf-cell__option">
              <input type="checkbox" :value="option.code" :checked="selected.includes(option.code)" :disabled="disabled || (option.locked && !selected.includes(option.code))"
                @change="multiChanged(option.code, $event)">
              {{ option.label }}
            </label>
          </div>
        </details>
        <template v-else-if="type === 'number'">
          <input :id="`${id}-value`" class="hf-cell__control" type="text" inputmode="decimal" :value="payload?.type === 'number' ? payload.value : ''"
            :disabled="disabled" :aria-label="label" :aria-invalid="message ? 'true' : undefined" :aria-describedby="described"
            @input="numberChanged" @keydown.enter.prevent="emit('enter', $event.target as HTMLElement)">
        </template>
        <div v-else class="hf-cell__range">
          <input :id="`${id}-min`" class="hf-cell__control" type="text" inputmode="decimal" placeholder="Desde" :value="payload?.type === 'range' ? payload.min : ''"
            :disabled="disabled" :aria-label="`${label}, mínimo`" :aria-invalid="message ? 'true' : undefined" :aria-describedby="described"
            @input="rangeChanged('min', $event)" @keydown.enter.prevent="emit('enter', $event.target as HTMLElement)">
          <input :id="`${id}-max`" class="hf-cell__control" type="text" inputmode="decimal" placeholder="Hasta" :value="payload?.type === 'range' ? payload.max : ''"
            :disabled="disabled" :aria-label="`${label}, máximo`" :aria-invalid="message ? 'true' : undefined" :aria-describedby="described"
            @input="rangeChanged('max', $event)" @keydown.enter.prevent="emit('enter', $event.target as HTMLElement)">
        </div>
        <template v-if="type === 'number' || type === 'range'">
          <EditorialSelect v-if="unitChoices.length > 1 || (unit !== undefined && !units.some(item => item.code === unit))" :id="`${id}-unit`"
            class="hf-cell__select hf-cell__unit" :label="`${label}, unidad`" :items="unitItems" :model-value="unit === undefined ? undefined : JSON.stringify(unit)"
            :disabled="disabled" :invalid="!!message" :describedby="described" @update:model-value="unitChanged" />
          <span v-else-if="impliedUnit" class="hf-cell__suffix">{{ impliedUnit }}</span>
        </template>
      </fieldset>
      <span v-else-if="!readonly && state !== 'known'" class="hf-cell__text" aria-hidden="true">—</span>
      <StatusBadge :label="chip.label" :tone="chip.tone" :aria-prefix="state === 'known' ? 'Estado:' : 'Valor:'" class="hf-cell__chip" />
      <span v-if="evidence" class="hf-cell__evidence" data-evidence title="Con evidencia">
        <UIcon name="i-lucide-paperclip" class="size-4" aria-hidden="true" /><span class="sr-only">Con evidencia</span>
      </span>
      <RowActionsMenu v-if="!readonly && !disabled" :actions="actions" :row-label="label" portal-class="hf-cell-menu" @select="act" />
      <UPopover v-if="!readonly" v-model:open="evidenceOpen" :content="{ side: 'bottom', align: 'end', onFocusOutside: keepOnFocusMove }" :ui="{ content: 'hf-theme hf-ui hf-cell-popover' }">
        <span class="hf-cell__anchor" aria-hidden="true" />
        <template #content>
          <div class="hf-cell__evidence-form" role="group" :aria-label="`Evidencia de ${label}`">
            <p class="hf-cell__evidence-note">Solo la ve tu equipo.</p>
            <label :for="`${id}-evidence-source`">Fuente</label>
            <input :id="`${id}-evidence-source`" v-model="draft.sourceRef" class="hf-cell__control" type="text" @keydown.enter.prevent="saveEvidence">
            <label :for="`${id}-evidence-date`">Fecha</label>
            <input :id="`${id}-evidence-date`" v-model="draft.verifiedOn" class="hf-cell__control" type="date" @keydown.enter.prevent="saveEvidence">
            <p v-if="evidenceError" :id="`${id}-evidence-error`" class="hf-cell__error" role="alert">{{ evidenceError }}</p>
            <div class="hf-cell__evidence-actions">
              <button v-if="evidence" type="button" class="hf-cell__button" data-action="remove-evidence" @click="removeEvidence">Quitar evidencia</button>
              <button type="button" class="hf-cell__button" data-action="save-evidence" @click="saveEvidence">Guardar evidencia</button>
            </div>
          </div>
        </template>
      </UPopover>
    </div>
    <p v-if="message" :id="`${id}-issue`" class="hf-cell__error" role="alert">{{ message }}</p>
    <p v-if="requiredMarker" class="hf-cell__required" data-testid="required-marker">
      <UIcon name="i-lucide-asterisk" class="size-3" aria-hidden="true" />Requerido para publicar
    </p>
  </div>
</template>

<style scoped>
.hf-cell { display: grid; gap: 4px; min-width: 0; }
.hf-cell__line { display: flex; align-items: center; gap: 6px; min-width: 0; position: relative; }
.hf-cell__fields { display: flex; flex: 1 1 auto; align-items: center; gap: 6px; min-width: 0; margin: 0; padding: 0; border: 0; }
.hf-cell__text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; color: var(--hf-ink); }
.hf-cell__control { box-sizing: border-box; flex: 1 1 auto; width: 100%; min-width: 0; min-height: var(--hf-control-height); padding: 8px 10px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; font-size: 14px; }
.hf-cell__control:focus-visible, .hf-cell__button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.hf-cell__control[aria-invalid='true'] { border-color: var(--hf-danger); box-shadow: 0 0 0 1px var(--hf-danger); }
.hf-cell__control:disabled { cursor: not-allowed; opacity: .65; }
.hf-cell__select { flex: 1 1 auto; width: 100%; min-width: 0; min-height: var(--hf-control-height); }
.hf-cell__unit { flex: 0 0 8.5rem; width: 8.5rem; }
.hf-cell__suffix { flex: none; color: var(--hf-muted); font-size: 13px; }
.hf-cell__range { display: flex; flex: 1 1 auto; gap: 6px; min-width: 0; }
.hf-cell__multi { position: relative; flex: 1 1 auto; min-width: 0; }
.hf-cell__multi > summary { display: flex; align-items: center; cursor: pointer; list-style: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hf-cell__multi > summary::-webkit-details-marker { display: none; }
.hf-cell__options { position: absolute; z-index: 10; inset-inline: 0; top: calc(100% + 4px); display: grid; gap: 2px; max-height: 14rem; overflow-y: auto; padding: 6px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); background: var(--hf-surface); box-shadow: 0 8px 24px color-mix(in srgb, var(--hf-ink) 14%, transparent); }
.hf-cell__option { display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 6px; border-radius: 6px; font-size: 14px; cursor: pointer; }
.hf-cell__option:hover { background: var(--hf-surface-muted); }
.hf-cell__chip { flex: none; }
.hf-cell__evidence { display: inline-flex; flex: none; color: var(--hf-muted); }
.hf-cell__required { display: flex; align-items: center; gap: 4px; margin: 0; color: var(--hf-muted); font-size: 12px; line-height: 1.4; }
.hf-cell__anchor { position: absolute; right: 0; bottom: 0; width: 1px; height: 1px; pointer-events: none; }
.hf-cell__error { margin: 0; color: var(--hf-danger); font-size: 13px; line-height: 1.4; }
.hf-cell__evidence-form { display: grid; gap: 6px; width: min(20rem, 86vw); padding: 12px; color: var(--hf-ink); }
.hf-cell__evidence-form label { font-size: 13px; font-weight: 500; }
.hf-cell__evidence-note { margin: 0; color: var(--hf-muted); font-size: 13px; }
.hf-cell__evidence-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.hf-cell__button { min-height: var(--hf-control-height); padding: 8px 14px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); background: var(--hf-surface); color: var(--hf-ink); font: inherit; font-size: 14px; cursor: pointer; }
.hf-cell__button:hover { background: var(--hf-surface-muted); }
</style>
