<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue'
import type { CalendarDate } from '@internationalized/date'
import { calendarPartsToDateString, parseMexicoCityCalendarDate } from '@/core/shared/utils/mexicoCityCalendar'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { EDITORIAL_SOURCES, editorialCardSummaryParts, isEditorialCardComplete, type EditorialCardAnswer, type EditorialCardQuestion,
  type EditorialCardSource } from '../../utils/editorial-presentation-card'

/** One presentation: a few plain questions as chips and one source for all of them; once answered it
 * folds into a single line. Presentational only: the cards list turns each event into the saved facts.
 */
const props = defineProps<{ id: string; title: string; questions: readonly EditorialCardQuestion[]; source: EditorialCardSource
  /** Something known is stored, so the source is needed. */
  needsSource: boolean
  /** Answers or a care review are stored, so there is something to clear. */
  hasAnswers: boolean
  showErrors?: boolean
  /** Cuidado only: the state of the care review, which opens in a drawer. */
  care?: 'omitted' | 'unknown' | 'prepared' | null
  /** A stored row for a presentation that no longer exists. */
  orphan?: boolean
  /** Read once: whether an unanswered card starts open (with several presentations only the first does). */
  startOpen?: boolean
  /** Bumped after a save: a card whose answers and source are complete folds to its summary. */
  foldSignal?: number
  /** The presentation whose answers this empty card can copy. */
  copyFrom?: string | null
  readonly?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ answer: [key: EditorialCardQuestion['key'], answer: EditorialCardAnswer]; toyTypes: [values: string[]]
  'update:source': [source: EditorialCardSource]; rename: [name: string]; clear: []; remove: []; openCare: []; copy: [] }>()

const complete = computed(() => isEditorialCardComplete(props.questions, props.source))
const open = shallowRef(!props.readonly && !complete.value && props.startOpen !== false)
watch(() => props.foldSignal, () => { if (complete.value) open.value = false })
const canCopy = computed(() => Boolean(props.copyFrom) && !props.hasAnswers && !props.readonly && !props.orphan)
function copyAnswers() {
  if (props.disabled) return
  emit('copy')
  // The copied answers arrive with the next render; a complete card then folds to its summary.
  void nextTick(() => { if (complete.value) open.value = false })
}
const doneTried = shallowRef(false)
const otherPicked = shallowRef(false)
const sourceText = computed(() => props.source.sourceRef.trim())
const named = computed(() => EDITORIAL_SOURCES.find(entry => entry.label === sourceText.value))
const sourceKind = computed(() => named.value?.code ?? (sourceText.value || otherPicked.value ? 'other' : null))
const sourceError = computed(() => props.needsSource && !sourceText.value && (props.showErrors || doneTried.value))
watch(sourceError, shown => { if (shown) open.value = true })
const summary = computed(() => editorialCardSummaryParts(props.questions, props.source))
const careBadge = computed(() => props.care === 'prepared' ? { label: 'Lista', tone: 'success' as const }
  : props.care === 'unknown' ? { label: 'No se sabe', tone: 'neutral' as const } : { label: 'Sin revisar', tone: 'neutral' as const })

// A long list of measures shows its first row and "Ver todas (N)"; a picked option always stays in sight.
const FIRST_ROW = 3
const showAll = shallowRef(new Set<string>())
const folds = (question: EditorialCardQuestion) => question.key === 'relevantDimensionCodes' && question.options.length > FIRST_ROW + 1 && !showAll.value.has(question.key)
function lead(question: EditorialCardQuestion) {
  // "No sé" travels with the chip before it (Ninguna, or the last option) so it never wraps alone.
  const options = question.kind === 'many' ? question.options : question.options.slice(0, -1)
  return folds(question) ? options.filter((option, index) => index < FIRST_ROW || checked(question, option.value)) : options
}
const tail = (question: EditorialCardQuestion) => (question.kind === 'many' ? [] : question.options.slice(-1))
function revealAll(key: string) { showAll.value = new Set(showAll.value).add(key) }

function checked(question: EditorialCardQuestion, value: string) {
  const answer = question.answer
  if (value === 'unknown') return answer === 'unknown'
  if (question.kind === 'many') return value === 'none' ? Array.isArray(answer) && answer.length === 0 : Array.isArray(answer) && answer.includes(value)
  return answer !== undefined && String(answer) === value
}
function picked(question: EditorialCardQuestion, value: string, event: Event) {
  if (props.disabled) return
  const on = (event.target as HTMLInputElement).checked
  if (value === 'unknown') return emit('answer', question.key, on ? { state: 'unknown' } : null)
  if (question.kind === 'yn') return emit('answer', question.key, { state: 'known', value: value === 'true' })
  if (question.kind === 'one') return emit('answer', question.key, { state: 'known', value } as EditorialCardAnswer)
  if (value === 'none') return emit('answer', question.key, on ? { state: 'known', value: [] } as EditorialCardAnswer : null)
  const current = Array.isArray(question.answer) ? question.answer : []
  const next = question.options.map(option => option.value).filter(code => code === value ? on : current.includes(code))
  emit('answer', question.key, next.length ? { state: 'known', value: next } as EditorialCardAnswer : null)
}
function toyPicked(question: EditorialCardQuestion, value: string, event: Event) {
  const current = question.toyTypes?.selected ?? [], on = (event.target as HTMLInputElement).checked
  if (!props.disabled) emit('toyTypes', question.toyTypes!.options.map(option => option.value).filter(code => code === value ? on : current.includes(code)))
}
function sourcePicked(code: string) {
  if (props.disabled) return
  otherPicked.value = code === 'other'
  const entry = EDITORIAL_SOURCES.find(item => item.code === code)
  emit('update:source', { ...props.source, sourceRef: entry ? entry.label : '' })
}
function otherTyped(event: Event) { if (!props.disabled) emit('update:source', { ...props.source, sourceRef: (event.target as HTMLInputElement).value }) }
// "Revisada el" is the app's calendar field; only a complete, real date commits, as AAAA-MM-DD.
const toCalendar = (value: string): CalendarDate | undefined => parseMexicoCityCalendarDate(value) ?? undefined
const dateModel = shallowRef(toCalendar(props.source.verifiedOn))
watch(() => props.source.verifiedOn, value => { dateModel.value = toCalendar(value) })
const dateOpen = shallowRef(false)
function setDateOpen(value: boolean) { dateOpen.value = !props.disabled && value }
function dateChanged(value: unknown) {
  const date = calendarPartsToDateString(value)
  if (date === null || props.disabled) { dateModel.value = toCalendar(props.source.verifiedOn); return }
  dateModel.value = toCalendar(date)
  dateOpen.value = false
  if (date !== props.source.verifiedOn) emit('update:source', { ...props.source, verifiedOn: date })
}
function cleared() {
  confirmClear.value = false
  otherPicked.value = false
  emit('clear')
}
function done() {
  doneTried.value = true
  if (!(props.needsSource && !sourceText.value)) { open.value = false; doneTried.value = false }
}

const confirmClear = shallowRef(false)
const confirmRemove = shallowRef(false)
const renaming = shallowRef(false)
const nameDraft = shallowRef('')
const actions = computed<RowAction[]>(() => [
  { key: 'rename', label: 'Cambiar nombre en la ficha…', icon: 'i-lucide-pencil' },
  { key: 'clear', label: 'Borrar respuestas…', icon: 'i-lucide-trash-2', destructive: true, disabled: !props.hasAnswers },
])
function act(key: string) {
  if (props.disabled) return
  if (key === 'clear') confirmClear.value = true
  else if (key === 'rename') { nameDraft.value = props.title; renaming.value = true }
}
function rename() {
  const name = nameDraft.value.trim()
  if (name) emit('rename', name)
  renaming.value = false
}
</script>

<template>
  <article class="pcard" :data-open="open || orphan ? 'true' : 'false'" data-testid="presentation-card" :aria-labelledby="`${id}-title`">
    <template v-if="orphan">
      <header class="pcard__head">
        <h4 :id="`${id}-title`" class="pcard__title">{{ title }}</h4>
        <button v-if="!readonly" type="button" class="pcard__ghost" data-testid="card-remove" :disabled="disabled" @click="confirmRemove = true">Quitar</button>
      </header>
      <p class="pcard__quiet-warning"><UIcon name="i-lucide-circle-alert" class="size-4" aria-hidden="true" />Esta presentación ya no existe. Lo guardado se conserva hasta que la quites.</p>
    </template>

    <template v-else-if="!open">
      <div class="pcard__line">
        <UIcon v-if="complete" name="i-lucide-circle-check" class="pcard__done-icon size-5" aria-hidden="true" />
        <h4 :id="`${id}-title`" class="pcard__title">{{ title }}</h4>
        <p class="pcard__summary" data-testid="card-summary">
          <span v-if="summary.answers" class="pcard__answers" data-testid="card-summary-answers" :title="summary.answers">{{ summary.answers }}</span>
          <template v-if="summary.answers && summary.source"> · </template>
          <span v-if="summary.source" class="pcard__when" data-testid="card-summary-source">{{ summary.source }}</span>
        </p>
        <StatusBadge v-if="care" :label="careBadge.label" :tone="careBadge.tone" aria-prefix="Revisión de cuidado:" />
        <template v-if="!readonly">
          <button type="button" class="pcard__ghost" data-testid="card-edit" :disabled="disabled"
            :aria-label="hasAnswers ? `Editar respuestas de ${title}` : `Responder sobre ${title}`" @click="open = true">
            <UIcon v-if="hasAnswers" name="i-lucide-pencil" class="size-4" aria-hidden="true" />{{ hasAnswers ? 'Editar' : 'Responder' }}
          </button>
          <RowActionsMenu :actions="actions" :row-label="title" portal-class="editorial-portal" @select="act" />
        </template>
      </div>
      <button v-if="canCopy" type="button" class="pcard__copy" data-testid="card-copy" :disabled="disabled" @click="copyAnswers">
        <UIcon name="i-lucide-copy" class="size-4" aria-hidden="true" />Copiar respuestas de {{ copyFrom }}
      </button>
    </template>

    <template v-else>
      <header class="pcard__head">
        <h4 :id="`${id}-title`" class="pcard__title">{{ title }}</h4>
        <RowActionsMenu :actions="actions" :row-label="title" portal-class="editorial-portal" @select="act" />
      </header>
      <button v-if="canCopy" type="button" class="pcard__copy" data-testid="card-copy" :disabled="disabled" @click="copyAnswers">
        <UIcon name="i-lucide-copy" class="size-4" aria-hidden="true" />Copiar respuestas de {{ copyFrom }}
      </button>

      <div class="pcard__questions">
      <fieldset v-for="question in questions" :key="question.key" class="pcard__question" data-testid="card-question" :disabled="disabled">
        <legend class="sr-only">{{ question.text }}</legend>
        <span class="pcard__label" aria-hidden="true">{{ question.text }}</span>
        <div class="pcard__chips">
          <label v-for="option in lead(question)" :key="option.value" class="pcard__chip" :data-checked="checked(question, option.value)">
            <input :type="question.kind === 'many' ? 'checkbox' : 'radio'" class="sr-only" :name="`${id}-${question.key}`" :value="option.value"
              :checked="checked(question, option.value)" @change="picked(question, option.value, $event)">
            <UIcon v-if="checked(question, option.value)" name="i-lucide-check" class="size-4" aria-hidden="true" />{{ option.label }}
          </label>
          <button v-if="folds(question)" type="button" class="pcard__more" data-testid="card-show-all" @click="revealAll(question.key)">Ver todas ({{ question.options.length }})</button>
          <span class="pcard__tail">
            <label v-for="option in tail(question)" :key="option.value" class="pcard__chip" :data-checked="checked(question, option.value)">
              <input type="radio" class="sr-only" :name="`${id}-${question.key}`" :value="option.value"
                :checked="checked(question, option.value)" @change="picked(question, option.value, $event)">
              <UIcon v-if="checked(question, option.value)" name="i-lucide-check" class="size-4" aria-hidden="true" />{{ option.label }}
            </label>
            <label v-if="question.kind === 'many'" class="pcard__chip" :data-checked="checked(question, 'none')">
              <input type="checkbox" class="sr-only" :checked="checked(question, 'none')" @change="picked(question, 'none', $event)">
              <UIcon v-if="checked(question, 'none')" name="i-lucide-check" class="size-4" aria-hidden="true" />Ninguna
            </label>
            <label class="pcard__chip pcard__chip--quiet" :data-checked="checked(question, 'unknown')">
              <input :type="question.kind === 'many' ? 'checkbox' : 'radio'" class="sr-only" :name="`${id}-${question.key}`" value="unknown"
                :checked="checked(question, 'unknown')" @change="picked(question, 'unknown', $event)">No sé
            </label>
          </span>
        </div>
        <div v-if="question.toyTypes" class="pcard__sub">
          <span :id="`${id}-${question.key}-toys`" class="pcard__sublabel">¿Qué tipo de juguete es?</span>
          <div class="pcard__chips" role="group" :aria-labelledby="`${id}-${question.key}-toys`">
            <label v-for="option in question.toyTypes.options" :key="option.value" class="pcard__chip" :data-checked="question.toyTypes.selected.includes(option.value)">
              <input type="checkbox" class="sr-only" :checked="question.toyTypes.selected.includes(option.value)" @change="toyPicked(question, option.value, $event)">
              <UIcon v-if="question.toyTypes.selected.includes(option.value)" name="i-lucide-check" class="size-4" aria-hidden="true" />{{ option.label }}
            </label>
          </div>
        </div>
      </fieldset>
      </div>

      <div class="pcard__source" data-testid="card-source">
        <span :id="`${id}-source-label`" class="pcard__label">¿De dónde sale esta información?</span>
        <div class="pcard__chips" role="radiogroup" :aria-labelledby="`${id}-source-label`" :aria-invalid="sourceError ? 'true' : undefined"
          :aria-describedby="sourceError ? `${id}-source-error` : undefined">
          <label v-for="entry in [...EDITORIAL_SOURCES, { code: 'other', label: 'Otro' }]" :key="entry.code" class="pcard__chip" :data-checked="sourceKind === entry.code" :data-invalid="sourceError || undefined">
            <input type="radio" class="sr-only" :name="`${id}-source`" :value="entry.code" :checked="sourceKind === entry.code" :disabled="disabled" @change="sourcePicked(entry.code)">
            <UIcon v-if="sourceKind === entry.code" name="i-lucide-check" class="size-4" aria-hidden="true" />{{ entry.label }}
          </label>
        </div>
        <input v-if="sourceKind === 'other'" class="pcard__input" type="text" maxlength="200" data-testid="card-source-other" aria-label="¿Cuál es la fuente?"
          placeholder="Por ejemplo, catálogo del proveedor" :value="named ? '' : source.sourceRef" :disabled="disabled" @input="otherTyped">
        <p v-if="sourceError" :id="`${id}-source-error`" class="pcard__error" data-testid="card-source-error">
          <UIcon name="i-lucide-circle-alert" class="size-4" aria-hidden="true" />Indica de dónde sale la información
        </p>
        <div class="pcard__date">
          <span :id="`${id}-date-label`">Revisada el</span>
          <UPopover :open="dateOpen" :content="{ align: 'start', side: 'bottom', sideOffset: 8 }" :ui="{ content: 'hf-theme hf-ui editorial-portal' }" @update:open="setDateOpen">
            <UInputDate data-testid="card-source-date" class="pcard__date-field" :model-value="dateModel" :disabled="disabled"
              :aria-labelledby="`${id}-date-label`" @update:model-value="dateChanged" />
            <template #content>
              <UCalendar class="p-2" :model-value="dateModel" :disabled="disabled" @update:model-value="dateChanged" />
            </template>
          </UPopover>
        </div>
      </div>

      <div v-if="care" class="pcard__care">
        <span class="pcard__label">Revisión de cuidado</span>
        <StatusBadge :label="careBadge.label" :tone="careBadge.tone" aria-prefix="Revisión de cuidado:" />
        <button type="button" class="pcard__button" data-testid="card-open-care" :disabled="disabled" @click="emit('openCare')">
          <UIcon name="i-lucide-shield-check" class="size-4" aria-hidden="true" />Revisar
        </button>
      </div>

      <footer class="pcard__foot">
        <button type="button" class="pcard__button" data-testid="card-done" @click="done">Listo</button>
      </footer>
    </template>

    <ConfirmModal v-model:open="confirmClear" :title="`¿Borrar las respuestas de ${title}?`" confirm-label="Borrar respuestas" confirm-color="error"
      description="Se quitan las respuestas y la revisión de esta presentación. Los datos de la tabla no cambian." :ui="{ content: 'hf-theme hf-ui' }"
      @confirm="cleared" />
    <ConfirmModal v-model:open="confirmRemove" :title="`¿Quitar ${title}?`" confirm-label="Quitar" confirm-color="error"
      description="Se quita lo guardado de esta presentación, que ya no existe." :ui="{ content: 'hf-theme hf-ui' }"
      @confirm="confirmRemove = false; emit('remove')" />
    <UModal v-model:open="renaming" title="Nombre en la ficha" description="Así se nombra esta presentación en el catálogo." :ui="{ content: 'hf-theme hf-ui' }">
      <template #body>
        <input v-model="nameDraft" class="pcard__input" type="text" maxlength="300" aria-label="Nombre en la ficha" data-testid="card-name" @keydown.enter.prevent="rename">
      </template>
      <template #footer>
        <div class="pcard__modal-actions">
          <UButton label="Cancelar" color="neutral" variant="outline" @click="renaming = false" />
          <UButton label="Guardar" :disabled="!nameDraft.trim()" @click="rename" />
        </div>
      </template>
    </UModal>
  </article>
</template>

<style scoped>
.pcard { container-type: inline-size; display: grid; gap: 20px; min-width: 0; padding: 20px 24px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); color: var(--hf-ink); }
.pcard[data-open='false'] { padding: 8px 8px 8px 20px; }
.pcard__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: -6px -8px -6px 0; }
.pcard__title { margin: 0; min-width: 0; overflow: hidden; color: var(--hf-heading); font-size: 15px; font-weight: 600; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.pcard__line { display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 44px; }
.pcard__line .pcard__title { flex: 0 1 auto; max-width: 40%; }
.pcard__done-icon { flex-shrink: 0; color: var(--hf-success); }
.pcard__summary { display: flex; flex: 1 1 0; gap: 0.3em; min-width: 0; margin: 0; color: var(--hf-muted); font-size: 14px; white-space: nowrap; }
/* The answers give way first; the source and its date always stay whole. */
.pcard__answers { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.pcard__when { flex: none; white-space: nowrap; }
/* Each label sits above its chips at every width, so the chips use the whole card. */
.pcard__questions { display: grid; gap: 16px; min-width: 0; }
.pcard__question { display: grid; gap: 8px; min-width: 0; margin: 0; padding: 0; border: 0; }
.pcard__label { color: var(--hf-ink); font-size: 14px; font-weight: 500; }
.pcard__chips { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
/* "No sé" and the chip before it wrap as one, so "No sé" is never alone on a row. */
.pcard__tail { display: inline-flex; flex-wrap: nowrap; gap: 8px; white-space: nowrap; }
.pcard__chip { position: relative; display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border: 1px solid var(--hf-border); border-radius: 999px; background: var(--hf-surface); font-size: 14px; cursor: pointer; transition: background-color .15s, border-color .15s, color .15s; }
.pcard__chip:hover { background: var(--hf-surface-muted); }
.pcard__chip:has(input:focus-visible) { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.pcard__chip[data-checked='true'] { border-color: var(--hf-active); background: var(--hf-active-soft); color: var(--hf-active); font-weight: 600; }
.pcard__chip--quiet { border-color: transparent; background: transparent; color: var(--hf-muted); }
.pcard__chip--quiet[data-checked='true'] { border-color: var(--hf-border); background: var(--hf-surface-muted); color: var(--hf-ink); }
.pcard__chip[data-invalid='true'] { border-color: var(--hf-danger); }
fieldset:disabled .pcard__chip, .pcard__chip:has(input:disabled) { cursor: not-allowed; opacity: .65; }
.pcard__sub { display: grid; gap: 8px; padding-left: 2px; }
.pcard__sublabel { color: var(--hf-muted); font-size: 13px; }
.pcard__source { display: grid; gap: 10px; padding-top: 20px; border-top: 1px solid var(--hf-border); }
.pcard__input { box-sizing: border-box; width: 100%; max-width: 24rem; min-height: var(--hf-control-height); padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: var(--hf-radius-control); background: var(--hf-field); color: var(--hf-ink); font: inherit; font-size: 14px; }
.pcard__input:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 1px; }
.pcard__date { display: inline-flex; align-items: center; gap: 8px; color: var(--hf-muted); font-size: 13px; }
.pcard__date-field { width: auto; }
.pcard__error { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--hf-danger); font-size: 13px; font-weight: 500; }
.pcard__quiet-warning { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--hf-warning); font-size: 14px; }
.pcard__care { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-top: 20px; border-top: 1px solid var(--hf-border); }
.pcard__care .pcard__label { margin-right: auto; }
.pcard__foot { display: flex; justify-content: flex-end; }
.pcard__button, .pcard__ghost { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-control); background: var(--hf-surface); color: var(--hf-ink); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.pcard__ghost { border-color: transparent; background: transparent; color: var(--hf-action); }
.pcard__more, .pcard__copy { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 10px; border: 0; border-radius: var(--hf-radius-control); background: transparent; color: var(--hf-action); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.pcard__copy { justify-self: start; min-height: 32px; margin: -12px 0 0 -10px; color: var(--hf-muted); font-weight: 400; }
.pcard[data-open='false'] .pcard__copy { margin: -16px 0 0 -10px; }
.pcard__more:hover:not(:disabled), .pcard__copy:hover:not(:disabled) { background: var(--hf-surface-muted); color: var(--hf-action); }
.pcard__more:focus-visible, .pcard__copy:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.pcard__copy:disabled { cursor: not-allowed; opacity: .65; }
.pcard__button:hover:not(:disabled), .pcard__ghost:hover:not(:disabled) { background: var(--hf-surface-muted); }
.pcard__button:focus-visible, .pcard__ghost:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.pcard__button:disabled, .pcard__ghost:disabled { cursor: not-allowed; opacity: .65; }
.pcard__modal-actions { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
@container (max-width: 30rem) {
  .pcard__line { flex-wrap: wrap; gap: 4px 12px; }
  .pcard__line .pcard__title { flex: 1 1 0; max-width: none; }
  .pcard__summary { order: 3; flex-basis: 100%; padding-bottom: 6px; }
}
@media (max-width: 767px) { .pcard { padding: 16px; } .pcard[data-open='false'] { padding: 8px 8px 8px 16px; } }
@media (prefers-reduced-motion: reduce) { .pcard__chip { transition: none; } }
</style>
