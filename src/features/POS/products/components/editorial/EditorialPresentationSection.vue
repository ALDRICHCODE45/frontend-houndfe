<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { CalendarDate } from '@internationalized/date'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { calendarPartsToDateString, parseMexicoCityCalendarDate } from '@/core/shared/utils/mexicoCityCalendar'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import HfCombobox from '@/core/shared/components/form/HfCombobox.vue'
import HfFieldGrid from '@/core/shared/components/form/HfFieldGrid.vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
import HfSegmented from '@/core/shared/components/form/HfSegmented.vue'
import EditorialCareReviewDrawer from './EditorialCareReviewDrawer.vue'
import type { EditorialDimensionCode } from '../../interfaces/editorial-contract-declaration.types'
import type { EditorialDeclarationChoice } from '../../utils/editorial-contract-declaration-choices'
import type { EditorialFactsEditingRow, EditorialFactsEditingState } from '../../utils/editorial-contract-facts-editing'
import { EDITORIAL_SOURCES, applyEditorialCardSource, clearEditorialCardAnswers, copyEditorialCardAnswers, editorialCardQuestions, editorialCardSummaryParts,
  editorialEffectiveSource, editorialSourceBasis, editorialSourceKey, editorialToday, ensureEditorialFactsRow, setEditorialCardAnswer, withCareSource,
  type EditorialCardAnswer, type EditorialCardQuestion, type EditorialCardSource } from '../../utils/editorial-presentation-card'

/** The «Presentación» card: the family (slot), a switcher of the presentation being edited, its plain
 * questions, one source with its date, and the care review. Same facts rows and mapping as the T10
 * cards: each answer is one declaration with the card's source as evidence and Fundamento.
 * Controlled: it hands back the facts rows, the sources picked before any answer and the selection.
 */
const props = defineProps<{ id: string; facts: EditorialFactsEditingState; subjects: readonly { variantId: string | null; label: string }[]
  choices: readonly EditorialDeclarationChoice[]; careAllowed: boolean; nextId: () => string
  /** Sources picked per presentation (see `editorialSourceKey`); the stored evidence fills the rest. */
  sources: ReadonlyMap<string, EditorialCardSource>
  /** The product's name, the presentation text of a product without variants. */
  productName: string
  /** The presentation being edited (`editorialSourceKey`). */
  selected: string
  /** A save was tried: a missing source shows its error. */
  showErrors?: boolean
  readonly?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ 'update:facts': [facts: EditorialFactsEditingState]; 'update:sources': [sources: ReadonlyMap<string, EditorialCardSource>]
  'update:selected': [key: string] }>()

type Card = { key: string; variantId: string | null; title: string; presentation: string; row: EditorialFactsEditingRow | null }
const listed = computed<Card[]>(() => props.subjects.map(subject => ({ key: editorialSourceKey(subject.variantId), variantId: subject.variantId,
  title: subject.variantId === null ? 'Producto' : subject.label,
  presentation: subject.variantId === null ? props.productName.trim() || 'Producto' : subject.label,
  row: props.facts.find(row => row.variantId === subject.variantId) ?? null })))
// Stored rows of presentations that no longer exist: kept until someone removes them.
const gone = computed(() => props.facts.filter(row => !props.subjects.some(subject => subject.variantId === row.variantId)))
const card = computed(() => listed.value.find(item => item.key === props.selected) ?? listed.value[0] ?? null)

// The switcher: segments up to four presentations, a scrolling tab row beyond.
const switcherItems = computed(() => listed.value.map(item => ({ label: item.title, value: item.key })))
const mobile = useBreakpoints(breakpointsTailwind).smaller('md')
function choose(key: string) { if (key !== props.selected) emit('update:selected', key) }

const sourceOf = (item: Card) => editorialEffectiveSource(props.sources, item.row, item.variantId)
const source = computed(() => (card.value ? sourceOf(card.value) : { sourceRef: '', verifiedOn: editorialToday() }))
const questions = computed(() => (card.value ? editorialCardQuestions(props.choices, card.value.row) : []))
const needsSource = (row: EditorialFactsEditingRow | null) => Boolean(row && (row.declarations.some(item => item.input.state === 'known') || row.careReview.state === 'prepared'))
const hasAnswers = (row: EditorialFactsEditingRow | null) => Boolean(row && (row.declarations.some(item => item.declarationKey !== 'optionalNonpertinenceCodes') || row.careReview.state !== 'omitted'))
// A presentation with no answers can copy the first one that has some.
const copyFrom = computed(() => {
  const from = listed.value.find(item => hasAnswers(item.row))
  return !props.readonly && card.value && from && from.key !== card.value.key && !hasAnswers(card.value.row) ? from : null
})
function copy() {
  const from = copyFrom.value, to = card.value
  if (props.disabled || props.readonly || !from?.row || !to) return
  const picked = sourceOf(from)
  emit('update:sources', new Map(props.sources).set(to.key, { ...picked }))
  commit(to, row => copyEditorialCardAnswers(from.row!, row, picked, props.nextId))
}
const care = computed(() => (card.value && (props.careAllowed || (card.value.row && card.value.row.careReview.state !== 'omitted')) ? card.value.row?.careReview.state ?? 'omitted' : null))
const careBadge = computed(() => care.value === 'prepared' ? { label: 'Lista', tone: 'success' as const }
  : care.value === 'unknown' ? { label: 'No se sabe', tone: 'neutral' as const } : { label: 'Sin revisar', tone: 'neutral' as const })

/** Write a changed row back, creating it the first time the card needs one. */
function commit(item: Card, change: (row: EditorialFactsEditingRow) => EditorialFactsEditingRow | null) {
  if (props.disabled || props.readonly) return
  const { state, row } = ensureEditorialFactsRow(props.facts, { variantId: item.variantId, presentation: item.presentation }, props.nextId)
  const next = change(row)
  emit('update:facts', next ? state.map(entry => (entry.id === row.id ? next : entry)) : state.filter(entry => entry.id !== row.id))
}
function answer(key: EditorialCardQuestion['key'], value: EditorialCardAnswer) {
  const item = card.value
  if (!item) return
  commit(item, row => {
    // The dimensions declaration also holds the toy types, which its question leaves as they are.
    if (key === 'relevantDimensionCodes' && value?.state === 'known') {
      const current = row.declarations.find(entry => entry.declarationKey === key)?.input
      const toyTypes = current?.state === 'known' && current.key === 'relevantDimensionCodes' ? current.value.toyTypes : []
      value = { state: 'known', value: { codes: value.value as EditorialDimensionCode[], toyTypes } }
    }
    return setEditorialCardAnswer(row, key, value, sourceOf(item), props.nextId)
  })
}

// One short choice is a segmented control with «No sé» as a segment; a list of codes is a combobox.
const UNKNOWN = { label: 'No sé', value: 'unknown' }
const segmentItems = (question: EditorialCardQuestion) => [...question.options, UNKNOWN]
const segmentValue = (question: EditorialCardQuestion) => (question.answer === undefined ? null : Array.isArray(question.answer) ? null : String(question.answer))
function segmentPicked(question: EditorialCardQuestion, value: string) {
  if (props.disabled) return
  if (value === 'unknown') return answer(question.key, { state: 'unknown' })
  if (question.kind === 'yn') return answer(question.key, { state: 'known', value: value === 'true' })
  answer(question.key, { state: 'known', value } as EditorialCardAnswer)
}
const LIST_ANSWERS = [{ value: 'none', label: 'Ninguna' }, { value: 'unknown', label: 'No sé' }]
const listValue = (question: EditorialCardQuestion) => (Array.isArray(question.answer) ? question.answer : [])
const listSpecial = (question: EditorialCardQuestion) => (question.answer === 'unknown' ? 'unknown' : Array.isArray(question.answer) && question.answer.length === 0 ? 'none' : null)
function listPicked(question: EditorialCardQuestion, picked: string | string[] | null) {
  const codes = Array.isArray(picked) ? picked : []
  const next = question.options.map(option => option.value).filter(code => codes.includes(code))
  answer(question.key, next.length ? { state: 'known', value: next } as EditorialCardAnswer : null)
}
function listSpecialPicked(question: EditorialCardQuestion, value: string | null) {
  if (value === 'unknown') answer(question.key, { state: 'unknown' })
  else if (value === 'none') answer(question.key, { state: 'known', value: [] } as EditorialCardAnswer)
}
function toyTypes(question: EditorialCardQuestion, picked: string | string[] | null) {
  const item = card.value
  if (!item || !question.toyTypes) return
  const values = question.toyTypes.options.map(option => option.value).filter(code => Array.isArray(picked) && picked.includes(code))
  commit(item, row => {
    const current = row.declarations.find(entry => entry.declarationKey === 'relevantDimensionCodes')?.input
    if (current?.state !== 'known' || current.key !== 'relevantDimensionCodes') return row
    return setEditorialCardAnswer(row, 'relevantDimensionCodes', { state: 'known', value: { codes: current.value.codes, toyTypes: values } }, sourceOf(item), props.nextId)
  })
}

// The source: three named ones and «Otro», which asks for a short text.
const sourceItems = [...EDITORIAL_SOURCES.map(entry => ({ label: entry.label, value: entry.code })), { label: 'Otro', value: 'other' }]
const otherPicked = shallowRef(false)
watch(() => props.selected, () => { otherPicked.value = false })
const sourceText = computed(() => source.value.sourceRef.trim())
const named = computed(() => EDITORIAL_SOURCES.find(entry => entry.label === sourceText.value))
const sourceKind = computed(() => named.value?.code ?? (sourceText.value || otherPicked.value ? 'other' : null))
const sourceError = computed(() => Boolean(card.value && needsSource(card.value.row) && !sourceText.value && props.showErrors))
function sourceChanged(next: EditorialCardSource) {
  const item = card.value
  if (props.disabled || props.readonly || !item) return
  emit('update:sources', new Map(props.sources).set(item.key, next))
  // Picking a source alone creates nothing; a stored row takes it at once.
  if (item.row) commit(item, row => applyEditorialCardSource(row, next))
}
function sourcePicked(code: string | string[] | null) {
  if (props.disabled || typeof code !== 'string') return
  otherPicked.value = code === 'other'
  const entry = EDITORIAL_SOURCES.find(item => item.code === code)
  sourceChanged({ ...source.value, sourceRef: entry ? entry.label : '' })
}
function otherTyped(event: Event) { sourceChanged({ ...source.value, sourceRef: (event.target as HTMLInputElement).value }) }
// «Revisada el» is the app's calendar field; only a complete, real date commits, as AAAA-MM-DD.
const toCalendar = (value: string): CalendarDate | undefined => parseMexicoCityCalendarDate(value) ?? undefined
const dateModel = shallowRef(toCalendar(source.value.verifiedOn))
watch(() => source.value.verifiedOn, value => { dateModel.value = toCalendar(value) })
const dateOpen = shallowRef(false)
function setDateOpen(value: boolean) { dateOpen.value = !props.disabled && value }
function dateChanged(value: unknown) {
  const date = calendarPartsToDateString(value)
  if (date === null || props.disabled) { dateModel.value = toCalendar(source.value.verifiedOn); return }
  dateModel.value = toCalendar(date)
  dateOpen.value = false
  if (date !== source.value.verifiedOn) sourceChanged({ ...source.value, verifiedOn: date })
}

const readSummary = computed(() => editorialCardSummaryParts(questions.value, source.value))

// The presentation's own actions: its name in the catalog, and clearing its answers.
const confirmClear = shallowRef(false)
const removing = shallowRef<EditorialFactsEditingRow | null>(null)
const removeOpen = computed({ get: () => removing.value !== null, set: open => { if (!open) removing.value = null } })
const renaming = shallowRef(false)
const nameDraft = shallowRef('')
const actions = computed<RowAction[]>(() => [
  { key: 'rename', label: 'Cambiar nombre en la ficha…', icon: 'i-lucide-pencil' },
  { key: 'clear', label: 'Borrar respuestas…', icon: 'i-lucide-trash-2', destructive: true, disabled: !hasAnswers(card.value?.row ?? null) },
])
function act(key: string) {
  if (props.disabled || !card.value) return
  if (key === 'clear') confirmClear.value = true
  else if (key === 'rename') { nameDraft.value = card.value.row?.presentation || card.value.presentation; renaming.value = true }
}
function rename() {
  const name = nameDraft.value.trim()
  if (name && card.value) commit(card.value, row => ({ ...row, presentation: name.slice(0, 300) }))
  renaming.value = false
}
// The answers go with their source: the presentation starts again with no source and today's date.
function cleared() {
  confirmClear.value = false
  const item = card.value
  if (!item?.row || props.disabled || props.readonly) return
  otherPicked.value = false
  emit('update:sources', new Map(props.sources).set(item.key, { sourceRef: '', verifiedOn: editorialToday() }))
  commit(item, row => clearEditorialCardAnswers(row))
}
function removed() {
  const row = removing.value
  removing.value = null
  if (row && !props.disabled && !props.readonly) emit('update:facts', props.facts.filter(entry => entry.id !== row.id))
}

// The care review of the presentation, in a drawer. Its evidence and Fundamento are always the card's source.
const careOpen = shallowRef(false)
const blankRow = (item: Card): EditorialFactsEditingRow => ({ id: '', variantId: item.variantId, presentation: item.presentation, declarations: [],
  careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } })
function careChanged(next: EditorialFactsEditingRow) {
  const item = card.value
  if (!item) return
  const picked = sourceOf(item), evidence = picked.sourceRef.trim() ? { sourceRef: picked.sourceRef.trim(), verifiedOn: picked.verifiedOn } : null
  commit(item, row => ({ ...row, careReview: withCareSource(next.careReview, evidence, evidence ? editorialSourceBasis(evidence.sourceRef) : ''), careRowIds: next.careRowIds }))
}
</script>

<template>
  <HfSectionCard :id="id" title="Presentación" data-testid="presentation-section">
    <template v-if="!readonly && card" #meta>
      <RowActionsMenu :actions="actions" :row-label="card.title" portal-class="editorial-portal" @select="act" />
    </template>
    <div class="psection">
      <slot name="family" />

      <div v-if="listed.length > 1" class="psection__switcher" data-testid="presentation-switcher">
        <span :id="`${id}-switcher`" class="psection__label">Presentación que editas</span>
        <HfSegmented v-if="listed.length <= 4" :items="switcherItems" :model-value="card?.key" :labelledby="`${id}-switcher`"
          :columns="mobile ? Math.min(2, listed.length) : listed.length" @update:model-value="choose" />
        <div v-else class="psection__tabs" role="radiogroup" :aria-labelledby="`${id}-switcher`">
          <button v-for="item in switcherItems" :key="item.value" type="button" role="radio" class="psection__tab"
            :aria-checked="item.value === card?.key" @click="choose(item.value)">{{ item.label }}</button>
        </div>
      </div>

      <template v-if="card && readonly">
        <p class="psection__read" data-testid="presentation-summary">
          {{ [readSummary.answers, readSummary.source].filter(Boolean).join(' · ') || 'Sin responder' }}
        </p>
      </template>

      <HfFieldGrid v-else-if="card && (questions.length || care)">
        <div v-if="copyFrom" span="full">
          <UButton color="neutral" variant="ghost" icon="i-lucide-copy" class="psection__copy" data-testid="card-copy" :disabled="disabled"
            :label="`Copiar respuestas de ${copyFrom.title}`" @click="copy" />
        </div>
        <template v-for="question in questions" :key="question.key">
          <div :span="question.kind === 'many' ? undefined : 'full'" :data-question="question.key">
            <HfFormField :label="question.text" :label-id="`${id}-${question.key}`">
              <HfCombobox v-if="question.kind === 'many'" :items="question.options" :model-value="listValue(question)" multiple :label="question.text"
                placeholder="Elige una o varias" :disabled="disabled" :special-answers="LIST_ANSWERS" :special="listSpecial(question)"
                @update:model-value="listPicked(question, $event)" @update:special="listSpecialPicked(question, $event)" />
              <HfSegmented v-else :items="segmentItems(question)" :model-value="segmentValue(question)" :labelledby="`${id}-${question.key}`"
                :columns="mobile && segmentItems(question).length > 3 ? 3 : undefined" :disabled="disabled" @update:model-value="segmentPicked(question, $event)" />
            </HfFormField>
          </div>
          <div v-if="question.toyTypes" data-question="toyTypes">
            <HfFormField label="¿Qué tipo de juguete es?" :label-id="`${id}-toy-types`">
              <HfCombobox :items="question.toyTypes.options" :model-value="question.toyTypes.selected" multiple label="¿Qué tipo de juguete es?"
                placeholder="Elige uno o varios" :disabled="disabled" @update:model-value="toyTypes(question, $event)" />
            </HfFormField>
          </div>
        </template>

        <div data-testid="card-source">
          <HfFormField label="Fuente" :label-id="`${id}-source`" :error="sourceError ? 'Indica de dónde sale la información' : undefined">
            <HfCombobox :id="`${id}-source-value`" :items="sourceItems" :model-value="sourceKind" label="Fuente" :invalid="sourceError" :disabled="disabled"
              :describedby="sourceError ? `${id}-source-message` : undefined" @update:model-value="sourcePicked" />
          </HfFormField>
          <input v-if="sourceKind === 'other'" class="psection__input" type="text" maxlength="200" data-testid="card-source-other" aria-label="¿Cuál es la fuente?"
            placeholder="Por ejemplo, catálogo del proveedor" :value="named ? '' : source.sourceRef" :disabled="disabled" @input="otherTyped">
        </div>
        <div>
          <HfFormField label="Revisada el" :label-id="`${id}-date`">
            <UPopover :open="dateOpen" :content="{ align: 'start', side: 'bottom', sideOffset: 8 }" :ui="{ content: 'hf-theme hf-ui editorial-portal' }" @update:open="setDateOpen">
              <UInputDate data-testid="card-source-date" class="psection__date" :model-value="dateModel" :disabled="disabled"
                :aria-labelledby="`${id}-date`" @update:model-value="dateChanged" />
              <template #content>
                <UCalendar class="p-2" :model-value="dateModel" :disabled="disabled" @update:model-value="dateChanged" />
              </template>
            </UPopover>
          </HfFormField>
        </div>

        <div v-if="care" span="full" class="psection__care">
          <span class="psection__label">Revisión de cuidado</span>
          <StatusBadge :label="careBadge.label" :tone="careBadge.tone" aria-prefix="Revisión de cuidado:" />
          <UButton color="neutral" variant="outline" icon="i-lucide-shield-check" label="Revisar" data-testid="card-open-care" :disabled="disabled" @click="careOpen = true" />
        </div>
      </HfFieldGrid>

      <ul v-if="gone.length" class="psection__gone" aria-label="Presentaciones que ya no existen">
        <li v-for="row in gone" :key="row.id" data-testid="presentation-gone">
          <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
          <span><b>{{ row.presentation.trim() || 'Presentación' }}</b> ya no existe. Lo guardado se conserva hasta que lo quites.</span>
          <UButton v-if="!readonly" color="neutral" variant="ghost" label="Quitar" data-testid="card-remove" :disabled="disabled" @click="removing = row" />
        </li>
      </ul>
    </div>

    <EditorialCareReviewDrawer v-if="!readonly && card" v-model:open="careOpen" :title="card.row?.presentation || card.presentation"
      :row="card.row ?? blankRow(card)" :source-missing="!source.sourceRef.trim()" :next-id="nextId" :disabled="disabled" @update:row="careChanged" />
    <ConfirmModal v-model:open="confirmClear" :title="`¿Borrar las respuestas de ${card?.title ?? 'la presentación'}?`" confirm-label="Borrar respuestas" confirm-color="error"
      description="Se quitan las respuestas y la revisión de esta presentación. Los demás datos no cambian." :ui="{ content: 'hf-theme hf-ui' }" @confirm="cleared" />
    <ConfirmModal v-model:open="removeOpen" :title="`¿Quitar ${removing?.presentation.trim() || 'la presentación'}?`" confirm-label="Quitar" confirm-color="error"
      description="Se quita lo guardado de esta presentación, que ya no existe." :ui="{ content: 'hf-theme hf-ui' }" @confirm="removed" />
    <UModal v-model:open="renaming" title="Nombre en la ficha" description="Así se nombra esta presentación en el catálogo." :ui="{ content: 'hf-theme hf-ui' }">
      <template #body>
        <input v-model="nameDraft" class="psection__input" type="text" maxlength="300" aria-label="Nombre en la ficha" data-testid="card-name" @keydown.enter.prevent="rename">
      </template>
      <template #footer>
        <div class="psection__modal-actions">
          <UButton label="Cancelar" color="neutral" variant="outline" @click="renaming = false" />
          <UButton label="Guardar" :disabled="!nameDraft.trim()" @click="rename" />
        </div>
      </template>
    </UModal>
  </HfSectionCard>
</template>

<style scoped>
.psection { display: grid; gap: 20px; min-width: 0; color: var(--hf-ink); }
.psection__label { color: var(--hf-ink); font-size: 13px; font-weight: 500; }
.psection__switcher { display: grid; gap: 6px; min-width: 0; padding-bottom: 20px; border-bottom: 1px solid var(--hf-border); }
.psection__tabs { display: flex; gap: 4px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.psection__tab { flex-shrink: 0; min-height: 44px; padding: 0 12px; border: 1px solid var(--hf-border); border-radius: 999px; background: var(--hf-surface); color: var(--hf-muted);
  font: inherit; font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; }
.psection__tab:hover { color: var(--hf-ink); }
.psection__tab[aria-checked='true'] { border-color: transparent; background: var(--hf-active-soft); color: var(--hf-active); font-weight: 600; }
.psection__tab:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.psection__read { margin: 0; color: var(--hf-ink); font-size: 14px; }
.psection__copy { justify-self: start; }
.psection__input { box-sizing: border-box; width: 100%; height: 44px; margin-top: 8px; padding: 0 12px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control);
  background: var(--hf-field); color: var(--hf-ink); font: inherit; font-size: 14px; }
.psection__input:hover:not(:disabled) { border-color: var(--hf-field-border); }
.psection__input:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.psection__date { width: 100%; }
.psection__care { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-top: 4px; }
.psection__care .psection__label { margin-right: auto; }
.psection__gone { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.psection__gone li { display: flex; align-items: center; gap: 8px; color: var(--hf-warning); font-size: 13px; }
.psection__gone b { font-weight: 600; }
.psection__modal-actions { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
@media (min-width: 768px) { .psection__input { height: 40px; } }
</style>
