<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import HfCombobox, { type HfSpecialAnswer } from '@/core/shared/components/form/HfCombobox.vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import HfUnitField, { type HfUnitValue } from '@/core/shared/components/form/HfUnitField.vue'
import type { EditorialEvidence } from '../../interfaces/editorial-contract-value.types'
import { parseEditorialDecimal, resolveEditorialAssignmentInput, type EditorialAssignmentInput,
  type EditorialPayloadInput } from '../../utils/editorial-contract-assignment-input'
import { isEditorialInputBlank, type EditorialTableCell, type EditorialTableRow } from '../../utils/editorial-attribute-table'
import { isFreshEditorialEvidence } from '../../utils/editorial-contract-evidence-validation'
import { editorialInputText } from '../../utils/editorial-value-text'

/** One datum of a section card: the label row (markers, evidence), one control for the definition's
 * type and one message line. «No lo sé» and «No aplica» live inside the control, offered only where the
 * policy admits them. It holds no document state: the owner creates or removes the assignment from
 * `update` and `clear`, exactly as the table cells did.
 */
const props = defineProps<{ id: string; row: EditorialTableRow; cell: EditorialTableCell; readonly?: boolean; disabled?: boolean
  issue?: string; conservedOptions?: readonly string[] }>()
const emit = defineEmits<{ update: [input: EditorialAssignmentInput]; clear: [] }>()

type Special = 'unknown' | 'not_applicable'
const SPECIAL_LABELS: Record<Special, string> = { unknown: 'No lo sé', not_applicable: 'No aplica' }

const definition = computed(() => props.row.definition)
const type = computed(() => definition.value.type)
const input = computed(() => props.cell.input)
const state = computed(() => input.value.state)
const known = computed(() => (input.value.state === 'known' ? input.value : null))
const payload = computed(() => (known.value && known.value.payload.type === type.value ? known.value.payload : null))
const mismatch = computed(() => known.value !== null && payload.value === null)
const evidence = computed(() => known.value?.evidence ?? null)
const special = computed<Special | null>(() => (state.value === 'unknown' || state.value === 'not_applicable' ? state.value : null))
// «No aplica» only where the policy admits it; a stored one stays listed so the control can show it.
const specialAnswers = computed<HfSpecialAnswer[]>(() => (['unknown', 'not_applicable'] as const)
  .filter(value => value === 'unknown' || props.cell.naAdmitted || state.value === value)
  .map(value => ({ value, label: SPECIAL_LABELS[value] })))

const choices = computed(() => (definition.value.type === 'single' || definition.value.type === 'multi' ? definition.value.options : []))
const selected = computed<readonly string[]>(() => payload.value?.type === 'single' ? (payload.value.value === null ? [] : [payload.value.value])
  : payload.value?.type === 'multi' ? payload.value.value : [])
const optionItems = computed(() => [
  ...choices.value.map(option => ({ value: option.code, label: option.label + (option.archived ? ' (archivada)' : ''),
    disabled: option.archived && !props.conservedOptions?.includes(option.code) && !selected.value.includes(option.code) })),
  ...selected.value.filter(code => !choices.value.some(option => option.code === code)).map(code => ({ value: code, label: `${code} (no disponible)`, disabled: true })),
])
const booleanItems = [{ label: 'Sí', value: 'true' }, { label: 'No', value: 'false' }]

// A unit picked before any value is a field-local choice; the assignment exists once there is a value.
const units = computed(() => {
  const source = definition.value.type === 'number' || definition.value.type === 'range'
    ? definition.value.units.filter(unit => definition.value.type !== 'range' || unit.code !== null) : []
  return source.map(unit => ({ code: unit.code, token: JSON.stringify(unit.code), label: unit.label ?? unit.code ?? 'Sin unidad' }))
})
const chosenUnit = shallowRef<string | null | undefined>(undefined)
const stored = computed(() => (payload.value?.type === 'number' || payload.value?.type === 'range' ? payload.value : null))
const defaultUnit = computed(() => (units.value.length === 1 ? units.value[0]!.code : undefined))
const unit = computed(() => (stored.value ? stored.value.unit : chosenUnit.value !== undefined ? chosenUnit.value : defaultUnit.value))
const unitChoices = computed(() => (unit.value !== undefined && !units.value.some(item => item.code === unit.value)
  ? [...units.value, { code: unit.value, token: JSON.stringify(unit.value), label: `${unit.value ?? 'Sin unidad'} (no disponible)` }] : units.value))
const unitItems = computed(() => unitChoices.value.map(item => ({ label: item.label, value: item.token })))
watch(stored, current => { if (current) chosenUnit.value = current.unit })
// Number and range join their unit in one control; a number whose only unit is "none" is a plain input.
const unitControl = computed(() => type.value === 'range' || (type.value === 'number' && units.value.some(item => item.code !== null)))
const plainNumber = computed(() => type.value === 'number' && !unitControl.value)
const textual = computed(() => type.value === 'text' || plainNumber.value)

const message = computed(() => {
  if (props.issue) return props.issue
  if (mismatch.value) return 'El dato guardado tiene otro formato. Quítalo para corregirlo.'
  const current = payload.value
  if (!current || props.readonly) return ''
  if (current.type === 'number' || current.type === 'range') {
    const numbers = current.type === 'number' ? [current.value] : [current.min, current.max]
    if (numbers.some(value => value !== '' && parseEditorialDecimal(value) === null)) return 'Escribe solo números'
    if (current.type === 'range' && numbers.some(value => value === '') && numbers.some(value => value !== '')) return 'Completa mínimo y máximo'
    if (current.unit === undefined) return 'Elige la unidad'
  }
  return resolveEditorialAssignmentInput(props.cell.target, input.value).status === 'incomplete' ? 'Completa este dato' : ''
})
const required = computed(() => props.cell.required && !props.readonly && state.value !== 'known')
const controlId = computed(() => `${props.id}-value`)
const labelId = computed(() => `${props.id}-label`)
const nativeLabel = computed(() => !props.readonly && !mismatch.value && special.value === null && (textual.value || (unitControl.value && !special.value)))
const described = computed(() => (message.value ? `${nativeLabel.value ? controlId.value : labelId.value}-message` : undefined))
const readText = computed(() => (special.value ? SPECIAL_LABELS[special.value] : state.value === 'omitted' ? 'Sin dato' : editorialInputText(input.value, definition.value)))

function update(next: EditorialAssignmentInput) {
  if (props.disabled || props.readonly) return
  // A control back at its placeholder leaves nothing to save: the field clears instead of keeping a blank.
  if (isEditorialInputBlank(next)) emit('clear')
  else emit('update', next)
}
function clear() { if (!props.disabled && !props.readonly) emit('clear') }
function setKnown(next: EditorialPayloadInput) { update({ state: 'known', payload: next, evidence: evidence.value }) }
function setSpecial(value: string | null) {
  if (value === 'unknown' || value === 'not_applicable') update({ state: value })
}
function textChanged(event: Event) {
  const value = (event.target as HTMLTextAreaElement | HTMLInputElement).value
  if (type.value === 'text') setKnown({ type: 'text', value })
  else setKnown({ type: 'number', value, unit: unit.value })
}
// A list has no empty pick (the placeholder is its empty state), so an empty pick changes nothing.
function choiceChanged(raw: string | string[] | null) {
  if (type.value === 'multi') {
    const picked = Array.isArray(raw) ? raw : []
    setKnown({ type: 'multi', value: choices.value.map(option => option.code).filter(code => picked.includes(code))
      .concat(picked.filter(code => !choices.value.some(option => option.code === code))) })
  } else if (typeof raw === 'string' && type.value === 'boolean') {
    if (raw === 'true' || raw === 'false') setKnown({ type: 'boolean', value: raw === 'true' })
  } else if (typeof raw === 'string') setKnown({ type: 'single', value: raw })
}
const choiceModel = computed(() => (type.value === 'multi' ? selected.value
  : type.value === 'boolean' ? (payload.value?.type === 'boolean' && payload.value.value !== null ? String(payload.value.value) : null) : selected.value[0] ?? null))

const unitModel = computed<HfUnitValue>(() => {
  const number = (text: string | undefined) => (text === undefined ? undefined : parseEditorialDecimal(text) ?? undefined)
  const token = unit.value === undefined ? undefined : JSON.stringify(unit.value)
  if (payload.value?.type === 'range') return { min: number(payload.value.min), max: number(payload.value.max), unit: token }
  return { value: number(payload.value?.type === 'number' ? payload.value.value : undefined), unit: token }
})
function unitText(part: 'value' | 'min' | 'max', text: string) {
  if (part === 'value') return setKnown({ type: 'number', value: text, unit: unit.value })
  const current = payload.value?.type === 'range' ? payload.value : { min: '', max: '' }
  setKnown({ type: 'range', min: current.min, max: current.max, [part]: text, unit: unit.value })
}
function unitModelChanged(next: HfUnitValue) {
  if (props.disabled || next.unit === undefined || next.unit === unitModel.value.unit) return
  const code = JSON.parse(next.unit) as string | null
  if (stored.value) setKnown({ ...stored.value, unit: code })
  else chosenUnit.value = code
}
// Picking a unit again after «No lo sé» takes the answer away; the unit then waits for a number.
function unitSpecial(value: string | null) {
  if (value === null) clear()
  else setSpecial(value)
}

const root = useTemplateRef<HTMLElement>('root')
// «Escribir» on a special answer: the answer goes and the empty control takes the focus.
async function writeValue() {
  clear()
  await nextTick()
  root.value?.querySelector<HTMLElement>('textarea, input')?.focus()
}
// The control has no way back to empty: «Quitar dato» is how its stored answer goes.
const removable = computed(() => props.cell.rowId !== null && state.value !== 'omitted'
  && (mismatch.value || special.value !== null || type.value === 'single' || type.value === 'boolean'))

// Evidence is a small secondary form; it only makes sense on a known value.
const evidenceOpen = shallowRef(false)
const draft = shallowRef<EditorialEvidence>({ sourceRef: '', verifiedOn: '' })
const evidenceError = shallowRef('')
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
</script>

<template>
  <div ref="root" class="attr-field" :span="type === 'text' ? 'full' : undefined" :data-field="row.code" :data-state="state" data-testid="attribute-field">
    <HfFormField :label="row.label" :for="nativeLabel ? controlId : undefined" :label-id="nativeLabel ? undefined : labelId" :help="row.description ?? undefined"
      :error="message || undefined" :required="required" :internal="row.internal"
      :special-answers="!readonly && !disabled && textual && special === null && !mismatch ? specialAnswers : []" @special="setSpecial">
      <template v-if="evidence || (!readonly && (known || removable))" #actions>
        <span v-if="readonly && evidence" class="attr-field__evidence" data-evidence title="Con evidencia">
          <UIcon name="i-lucide-paperclip" class="size-4" aria-hidden="true" /><span class="sr-only">Con evidencia</span>
        </span>
        <UPopover v-if="!readonly && known && !mismatch" v-model:open="evidenceOpen" :content="{ side: 'bottom', align: 'end' }" :ui="{ content: 'hf-theme hf-ui attr-field-popover' }">
          <button type="button" class="attr-field__action" :data-active="evidence ? 'true' : undefined" data-action="evidence" :disabled="disabled"
            :aria-label="`${evidence ? 'Editar evidencia' : 'Agregar evidencia'} de ${row.label}`" :title="evidence ? 'Editar evidencia' : 'Agregar evidencia'">
            <UIcon name="i-lucide-paperclip" class="size-4" aria-hidden="true" />
          </button>
          <template #content>
            <div class="attr-field__evidence-form" role="group" :aria-label="`Evidencia de ${row.label}`">
              <p class="attr-field__evidence-note">Solo la ve tu equipo.</p>
              <label :for="`${id}-evidence-source`">Fuente</label>
              <input :id="`${id}-evidence-source`" v-model="draft.sourceRef" class="attr-field__input" type="text" @keydown.enter.prevent="saveEvidence">
              <label :for="`${id}-evidence-date`">Fecha</label>
              <input :id="`${id}-evidence-date`" v-model="draft.verifiedOn" class="attr-field__input" type="date" @keydown.enter.prevent="saveEvidence">
              <p v-if="evidenceError" class="attr-field__error" role="alert">{{ evidenceError }}</p>
              <div class="attr-field__evidence-actions">
                <UButton v-if="evidence" color="neutral" variant="ghost" label="Quitar evidencia" data-action="remove-evidence" @click="removeEvidence" />
                <UButton color="neutral" variant="outline" label="Guardar evidencia" data-action="save-evidence" @click="saveEvidence" />
              </div>
            </div>
          </template>
        </UPopover>
        <button v-if="!readonly && removable" type="button" class="attr-field__action" data-action="clear" :disabled="disabled"
          :aria-label="`Quitar dato de ${row.label}`" title="Quitar dato" @click="clear">
          <UIcon name="i-lucide-eraser" class="size-4" aria-hidden="true" />
        </button>
      </template>

      <p v-if="readonly" class="attr-field__text" :data-muted="state !== 'known' || undefined" :aria-labelledby="labelId">{{ readText }}</p>
      <p v-else-if="mismatch" class="attr-field__text" :aria-labelledby="labelId">{{ readText }}</p>
      <!-- A special answer of a text-like field shows in the control's place; a click goes back to writing. -->
      <button v-else-if="textual && special" type="button" class="attr-field__special" :aria-labelledby="labelId" :disabled="disabled"
        :aria-describedby="described" data-action="write" @click="writeValue">
        <span class="attr-field__special-text">{{ SPECIAL_LABELS[special] }}</span>
        <span class="attr-field__special-hint" aria-hidden="true"><UIcon name="i-lucide-pencil" class="size-3.5" />Escribir</span>
      </button>
      <textarea v-else-if="type === 'text'" :id="controlId" class="attr-field__control attr-field__textarea" rows="2"
        :value="payload?.type === 'text' ? payload.value : ''" :disabled="disabled" :aria-invalid="message ? 'true' : undefined"
        :aria-describedby="described" @input="textChanged" />
      <input v-else-if="plainNumber" :id="controlId" class="attr-field__control" type="text" inputmode="decimal" autocomplete="off" placeholder="Escribe un número"
        :value="payload?.type === 'number' ? payload.value : ''" :disabled="disabled" :aria-invalid="message ? 'true' : undefined"
        :aria-describedby="described" @input="textChanged">
      <HfUnitField v-else-if="unitControl" :id="controlId" :model-value="unitModel" :units="unitItems" :range="type === 'range'" :label="row.label"
        :invalid="!!message" :disabled="disabled" :describedby="described" :special-answers="specialAnswers" :special="special"
        @update:text="unitText" @update:model-value="unitModelChanged" @update:special="unitSpecial" />
      <HfCombobox v-else :id="controlId" :items="type === 'boolean' ? booleanItems : optionItems" :model-value="choiceModel" :multiple="type === 'multi'"
        :label="row.label" :placeholder="type === 'multi' ? 'Elige una o varias' : 'Elige una opción'" :invalid="!!message" :disabled="disabled"
        :describedby="described" :special-answers="specialAnswers" :special="special"
        @update:model-value="choiceChanged" @update:special="setSpecial" />
    </HfFormField>
  </div>
</template>

<style scoped>
.attr-field { min-width: 0; }
.attr-field__text { margin: 0; min-height: 24px; overflow-wrap: anywhere; white-space: pre-wrap; color: var(--hf-ink); font-size: 14px; }
.attr-field__text[data-muted] { color: var(--hf-muted); font-style: italic; }
/* The control style of the shared form patterns: soft rest border, field-border hover, focus ring. */
.attr-field__control { box-sizing: border-box; display: block; width: 100%; min-width: 0; height: 44px; padding: 0 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control);
  background: var(--hf-field); color: var(--hf-ink); font: inherit; font-size: 14px; transition: border-color .12s; }
.attr-field__textarea { height: auto; min-height: 64px; padding: 9px 12px; line-height: 1.5; resize: vertical; }
.attr-field__control::placeholder { color: var(--hf-muted); opacity: 1; }
.attr-field__control:hover:not(:disabled) { border-color: var(--hf-field-border); }
.attr-field__control:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.attr-field__control[aria-invalid='true'] { border-color: var(--hf-danger); }
.attr-field__control:disabled { cursor: not-allowed; background: var(--hf-surface-muted); }
.attr-field__special { box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; height: 44px; padding: 0 12px;
  border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.attr-field__special:hover:not(:disabled) { border-color: var(--hf-field-border); }
.attr-field__special:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.attr-field__special-text { color: var(--hf-muted); font-style: italic; }
.attr-field__special-hint { display: inline-flex; align-items: center; gap: 4px; color: var(--hf-muted); font-size: 12px; font-weight: 500; }
.attr-field__special:hover .attr-field__special-hint, .attr-field__special:focus-visible .attr-field__special-hint { color: var(--hf-action); }
.attr-field__action { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 4px;
  background: transparent; color: var(--hf-muted); cursor: pointer; }
/* 44px touch target around the 24px action. */
.attr-field__action::after { content: ''; position: absolute; inset: -10px; }
.attr-field__action:hover:not(:disabled) { background: var(--hf-surface-muted); color: var(--hf-ink); }
.attr-field__action[data-active='true'] { color: var(--hf-active); }
.attr-field__action:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.attr-field__action:disabled { cursor: not-allowed; opacity: .65; }
.attr-field__evidence { display: inline-flex; color: var(--hf-muted); }
.attr-field__evidence-form { display: grid; gap: 6px; width: min(20rem, 86vw); padding: 12px; color: var(--hf-ink); font-size: 14px; }
.attr-field__evidence-form label { font-size: 13px; font-weight: 500; }
.attr-field__evidence-note { margin: 0; color: var(--hf-muted); font-size: 13px; }
.attr-field__input { box-sizing: border-box; width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; }
.attr-field__input:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.attr-field__error { margin: 0; color: var(--hf-danger); font-size: 13px; }
.attr-field__evidence-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
@media (min-width: 768px) { .attr-field__control, .attr-field__special { height: 40px; } .attr-field__textarea { height: auto; } }
</style>
