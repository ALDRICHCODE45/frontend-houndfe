<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import EditorialPresentationCard from './EditorialPresentationCard.vue'
import EditorialCareReviewDrawer from './EditorialCareReviewDrawer.vue'
import type { EditorialDimensionCode } from '../../interfaces/editorial-contract-declaration.types'
import type { EditorialDeclarationChoice } from '../../utils/editorial-contract-declaration-choices'
import type { EditorialFactsEditingRow, EditorialFactsEditingState } from '../../utils/editorial-contract-facts-editing'
import { applyEditorialCardSource, clearEditorialCardAnswers, copyEditorialCardAnswers, editorialCardQuestions, editorialEffectiveSource, editorialSourceBasis,
  editorialSourceKey, editorialToday, ensureEditorialFactsRow, isEditorialCardComplete, setEditorialCardAnswer, withCareSource, type EditorialCardAnswer, type EditorialCardSource,
} from '../../utils/editorial-presentation-card'

/** The cards above the table, one per presentation (a single "Producto" without variants), plus the
 * stored rows of presentations that no longer exist. Controlled: it hands back the facts rows and the
 * sources picked before any answer; the saved shape is the one the facts always had.
 */
const props = defineProps<{ facts: EditorialFactsEditingState; subjects: readonly { variantId: string | null; label: string }[]
  choices: readonly EditorialDeclarationChoice[]; careAllowed: boolean; nextId: () => string
  /** Sources picked per presentation (see `editorialSourceKey`); the stored evidence fills the rest. */
  sources: ReadonlyMap<string, EditorialCardSource>
  /** The product's name, the presentation text of a product without variants. */
  productName: string
  /** A save was tried: missing sources show their error. */
  showErrors?: boolean
  /** Bumped after a successful save: complete cards fold to their summary. */
  foldSignal?: number
  readonly?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ 'update:facts': [facts: EditorialFactsEditingState]; 'update:sources': [sources: ReadonlyMap<string, EditorialCardSource>] }>()

type Card = { key: string; variantId: string | null; title: string; presentation: string; row: EditorialFactsEditingRow | null; orphan: boolean }
const cards = computed<Card[]>(() => {
  const listed: Card[] = props.subjects.map(subject => {
    const title = subject.variantId === null ? 'Producto' : subject.label
    return { key: editorialSourceKey(subject.variantId), variantId: subject.variantId, title,
      presentation: subject.variantId === null ? props.productName.trim() || title : subject.label,
      row: props.facts.find(row => row.variantId === subject.variantId) ?? null, orphan: false }
  })
  const gone = props.facts.filter(row => !props.subjects.some(subject => subject.variantId === row.variantId)).map(row => ({
    key: `gone:${row.id}`, variantId: row.variantId, title: row.presentation.trim() || 'Presentación', presentation: row.presentation, row, orphan: true }))
  return [...listed, ...gone]
})
const shownCards = computed(() => (props.readonly ? cards.value.filter(card => card.row) : cards.value))
const sourceOf = (card: Card) => editorialEffectiveSource(props.sources, card.row, card.variantId)
const questionsOf = (card: Card) => editorialCardQuestions(props.choices, card.row)
const needsSource = (row: EditorialFactsEditingRow | null) => Boolean(row && (row.declarations.some(item => item.input.state === 'known') || row.careReview.state === 'prepared'))
const hasAnswers = (row: EditorialFactsEditingRow | null) => Boolean(row && (row.declarations.some(item => item.declarationKey !== 'optionalNonpertinenceCodes') || row.careReview.state !== 'omitted'))
// With several presentations only the first unfinished card starts open; the others are one line each.
const firstOpen = computed(() => cards.value.find(card => !card.orphan && !isEditorialCardComplete(questionsOf(card), sourceOf(card)))?.key ?? null)
const startsOpen = (card: Card) => cards.value.length < 2 || card.key === firstOpen.value
// A later card with no answers can copy the first presentation that has some.
const copySource = computed(() => cards.value.find(card => !card.orphan && hasAnswers(card.row)) ?? null)
const copyFromOf = (card: Card) => (card === cards.value[0] || card.orphan || hasAnswers(card.row) || !copySource.value || copySource.value.key === card.key ? null : copySource.value.title)
function copy(card: Card) {
  const from = copySource.value
  if (props.disabled || props.readonly || !from?.row || from.key === card.key) return
  const source = sourceOf(from)
  emit('update:sources', new Map(props.sources).set(card.key, { ...source }))
  commit(card, row => copyEditorialCardAnswers(from.row!, row, source, props.nextId))
}
const careOf = (card: Card) => (props.careAllowed || (card.row && card.row.careReview.state !== 'omitted') ? card.row?.careReview.state ?? 'omitted' : null)

/** Write a changed row back, creating it the first time a card needs one. */
function commit(card: Card, change: (row: EditorialFactsEditingRow) => EditorialFactsEditingRow | null) {
  if (props.disabled || props.readonly) return
  const { state, row } = ensureEditorialFactsRow(props.facts, { variantId: card.variantId, presentation: card.presentation }, props.nextId)
  const next = change(row)
  emit('update:facts', next ? state.map(item => (item.id === row.id ? next : item)) : state.filter(item => item.id !== row.id))
}
function answer(card: Card, key: EditorialDeclarationChoice['key'], value: EditorialCardAnswer) {
  commit(card, row => {
    // The dimensions declaration also holds the toy types, which its question leaves as they are.
    if (key === 'relevantDimensionCodes' && value?.state === 'known') {
      const current = row.declarations.find(item => item.declarationKey === key)?.input
      const toyTypes = current?.state === 'known' && current.key === 'relevantDimensionCodes' ? current.value.toyTypes : []
      value = { state: 'known', value: { codes: value.value as EditorialDimensionCode[], toyTypes } }
    }
    return setEditorialCardAnswer(row, key, value, sourceOf(card), props.nextId)
  })
}
function toyTypes(card: Card, values: string[]) {
  commit(card, row => {
    const current = row.declarations.find(item => item.declarationKey === 'relevantDimensionCodes')?.input
    if (current?.state !== 'known' || current.key !== 'relevantDimensionCodes') return row
    return setEditorialCardAnswer(row, 'relevantDimensionCodes', { state: 'known', value: { codes: current.value.codes, toyTypes: values } }, sourceOf(card), props.nextId)
  })
}
function sourceChanged(card: Card, source: EditorialCardSource) {
  if (props.disabled || props.readonly) return
  emit('update:sources', new Map(props.sources).set(card.key, source))
  // Picking a source alone creates nothing; a stored row takes it at once.
  if (card.row) commit(card, row => applyEditorialCardSource(row, source))
}
function rename(card: Card, name: string) { commit(card, row => ({ ...row, presentation: name.slice(0, 300) })) }
// The answers go with their source: the card starts again with no source and today's date.
function clear(card: Card) {
  if (!card.row || props.disabled || props.readonly) return
  emit('update:sources', new Map(props.sources).set(card.key, { sourceRef: '', verifiedOn: editorialToday() }))
  commit(card, row => clearEditorialCardAnswers(row))
}
function remove(card: Card) {
  if (!props.disabled && !props.readonly && card.row) emit('update:facts', props.facts.filter(row => row.id !== card.row!.id))
}

// The care review of one card, in a drawer. Its evidence and Fundamento are always the card's source.
const careKey = shallowRef<string | null>(null)
const careCard = computed(() => cards.value.find(card => card.key === careKey.value) ?? null)
const careOpen = computed({ get: () => careCard.value !== null, set: open => { if (!open) careKey.value = null } })
const blankRow = (card: Card): EditorialFactsEditingRow => ({ id: '', variantId: card.variantId, presentation: card.presentation, declarations: [],
  careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } })
function careChanged(next: EditorialFactsEditingRow) {
  const card = careCard.value
  if (!card) return
  const source = sourceOf(card), evidence = source.sourceRef.trim() ? { sourceRef: source.sourceRef.trim(), verifiedOn: source.verifiedOn } : null
  commit(card, row => ({ ...row, careReview: withCareSource(next.careReview, evidence, evidence ? editorialSourceBasis(evidence.sourceRef) : ''), careRowIds: next.careRowIds }))
}
</script>

<template>
  <section v-if="shownCards.length" class="pcards" aria-labelledby="presentation-cards-title" data-testid="presentation-cards">
    <h3 id="presentation-cards-title" class="pcards__title">{{ cards.length > 1 ? 'Sobre cada presentación' : 'Sobre la presentación' }}</h3>
    <div class="pcards__grid" :data-many="shownCards.length > 1">
      <EditorialPresentationCard v-for="card in shownCards" :id="`pcard-${card.key}`" :key="card.key" :title="card.title" :questions="questionsOf(card)"
        :source="sourceOf(card)" :needs-source="needsSource(card.row)" :has-answers="hasAnswers(card.row)" :show-errors="showErrors" :care="careOf(card)"
        :orphan="card.orphan" :start-open="startsOpen(card)" :fold-signal="foldSignal" :copy-from="copyFromOf(card)" :readonly="readonly" :disabled="disabled"
        @copy="copy(card)" @answer="(key, value) => answer(card, key, value)" @toy-types="toyTypes(card, $event)" @update:source="sourceChanged(card, $event)"
        @rename="rename(card, $event)" @clear="clear(card)" @remove="remove(card)" @open-care="careKey = card.key" />
    </div>
    <EditorialCareReviewDrawer v-if="!readonly" v-model:open="careOpen" :title="careCard ? careCard.row?.presentation || careCard.presentation : ''"
      :row="careCard ? careCard.row ?? blankRow(careCard) : null" :source-missing="careCard ? !sourceOf(careCard).sourceRef.trim() : false"
      :next-id="nextId" :disabled="disabled" @update:row="careChanged" />
  </section>
</template>

<style scoped>
.pcards { display: grid; gap: 12px; min-width: 0; }
.pcards__title { margin: 0; color: var(--hf-heading); font-size: 16px; font-weight: 600; }
.pcards__grid { display: grid; gap: 12px; min-width: 0; }
.pcards__grid[data-many='true'] { grid-template-columns: repeat(auto-fit, minmax(min(100%, 30rem), 1fr)); align-items: start; }
</style>
