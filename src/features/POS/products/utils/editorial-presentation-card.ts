import type { EditorialDeclarationValues } from '../interfaces/editorial-contract-declaration.types'
import type { EditorialEvidence } from '../interfaces/editorial-contract-value.types'
import type { EditorialCareReviewInput } from './editorial-contract-care-input'
import type { EditorialDeclarationChoice } from './editorial-contract-declaration-choices'
import type { EditorialDeclarationInput } from './editorial-contract-declaration-input'
import type { EditorialFactsEditingRow, EditorialFactsEditingState } from './editorial-contract-facts-editing'
import { isFreshEditorialEvidence } from './editorial-contract-evidence-validation'
import { snapshotJson } from './editorial-contract-value'

/** The presentation card writes the same facts rows as before: each answered question is one
 * declaration, and the card's single source is the evidence of every known answer, with a Fundamento
 * written from it. Pure functions over the editing rows; no state, no saving, no admission.
 */
type Key = keyof EditorialDeclarationValues
export type EditorialCardSource = { sourceRef: string; verifiedOn: string }
/** A stored declaration value as the card reads it. */
export type EditorialCardValue = EditorialDeclarationValues[Key]
export type EditorialCardAnswer = { state: 'known'; value: EditorialCardValue } | { state: 'unknown' } | null
/** What a question shows as answered: its value, `unknown` for "No sé", undefined when not answered. */
export type EditorialCardStoredAnswer = string | boolean | readonly string[] | 'unknown' | undefined
export type EditorialCardOption = { value: string; label: string }
export type EditorialCardQuestion = {
  key: Key
  text: string
  /** `one`: a single choice; `yn`: Sí or No; `many`: several codes, with "Ninguna" for an empty list. */
  kind: 'one' | 'yn' | 'many'
  options: EditorialCardOption[]
  answer: EditorialCardStoredAnswer
  /** Toy types share the dimensions declaration: offered under it, never counted on their own. */
  toyTypes?: { options: EditorialCardOption[]; selected: string[] }
}

export const EDITORIAL_SOURCES = [
  { code: 'label', label: 'Etiqueta del empaque', phrase: 'la etiqueta del empaque' },
  { code: 'maker', label: 'Ficha del fabricante', phrase: 'la ficha del fabricante' },
  { code: 'site', label: 'Sitio del fabricante', phrase: 'el sitio del fabricante' },
] as const

const yesNo: EditorialCardOption[] = [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }]
const magnitudes = [['mass', 'Peso', 'peso'], ['volume', 'Volumen', 'volumen'], ['count', 'Piezas', 'piezas'], ['length', 'Largo', 'largo'], ['area', 'Área', 'área']] as const
const kinds = [['formulation', 'Fórmula'], ['device', 'Dispositivo'], ['packaging', 'Envase']] as const
type Wording = { text: string; noun: string; yes?: string; no?: string; parent?: Key }
const wording: Partial<Record<Key, Wording>> = {
  contentMagnitude: { text: '¿Cómo se mide el contenido?', noun: 'medida' },
  consumable: { text: '¿Se consume?', noun: 'si se consume', yes: 'se consume', no: 'no se consume' },
  animalApplied: { text: '¿Se aplica sobre la mascota?', noun: 'si se aplica sobre la mascota', yes: 'se aplica sobre la mascota', no: 'no se aplica sobre la mascota' },
  fitDeterminesChoice: { text: '¿La talla define la compra?', noun: 'talla', yes: 'la talla define la compra', no: 'la talla no define la compra' },
  relevantFitCodes: { text: '¿Qué medidas de talla cuentan?', noun: 'medidas de talla', parent: 'fitDeterminesChoice' },
  capacityDeterminesChoice: { text: '¿La capacidad define la compra?', noun: 'capacidad', yes: 'la capacidad define la compra', no: 'la capacidad no define la compra' },
  relevantCapacityCodes: { text: '¿Qué capacidades cuentan?', noun: 'capacidades', parent: 'capacityDeterminesChoice' },
  electricalApplies: { text: '¿Usa electricidad?', noun: 'electricidad', yes: 'usa electricidad', no: 'sin electricidad' },
  relevantEquipmentCodes: { text: '¿Qué especificaciones cuentan?', noun: 'especificaciones', parent: 'electricalApplies' },
  relevantDimensionCodes: { text: '¿Qué medidas aplican?', noun: 'medidas' },
  presentationKind: { text: '¿Qué tipo de producto es?', noun: 'tipo' },
}
const followUps = new Map<Key, Key>(Object.entries(wording).flatMap(([key, entry]) => entry.parent ? [[entry.parent, key as Key]] : []))

function copy<T>(value: T): T {
  // SAFETY: typed JSON editing rows keep their shape through a detached snapshot.
  return snapshotJson(value) as unknown as T
}
function stored(row: EditorialFactsEditingRow | null, key: Key): EditorialDeclarationInput | undefined {
  return row?.declarations.find(entry => entry.declarationKey === key)?.input
}
function answerOf(input: EditorialDeclarationInput | undefined): EditorialCardStoredAnswer {
  if (!input || input.state === 'omitted') return undefined
  if (input.state === 'unknown') return 'unknown'
  const value = input.value
  if (value === null) return undefined
  // The dimensions declaration also carries the toy types; its question answers with the codes.
  return typeof value === 'object' && !Array.isArray(value) ? value.codes : value
}
function toyTypesOf(input: EditorialDeclarationInput | undefined): string[] | null {
  return input?.state === 'known' && input.key === 'relevantDimensionCodes' ? [...input.value.toyTypes] : null
}

/** The questions a card asks: the declarations the family offers, minus the hidden non-pertinence
 * list; a follow-up list shows only once its question is answered Sí. */
export function editorialCardQuestions(choices: readonly EditorialDeclarationChoice[], row: EditorialFactsEditingRow | null): EditorialCardQuestion[] {
  const offered = new Set(choices.map(entry => entry.key))
  const questions: EditorialCardQuestion[] = []
  for (const entry of choices) {
    const words = wording[entry.key]
    if (!words) continue
    if (words.parent && offered.has(words.parent) && answerOf(stored(row, words.parent)) !== true) continue
    const answer = answerOf(stored(row, entry.key))
    const many = entry.key.startsWith('relevant')
    if (many && entry.choices.length === 0) continue
    const options = entry.key === 'contentMagnitude' ? magnitudes.map(([value, label]) => ({ value, label }))
      : entry.key === 'presentationKind' ? kinds.map(([value, label]) => ({ value, label }))
        : many ? entry.choices.map(item => ({ value: item.code, label: item.label })) : yesNo
    const question: EditorialCardQuestion = { key: entry.key, text: words.text, kind: many ? 'many' : words.yes ? 'yn' : 'one', options, answer }
    const toyTypes = toyTypesOf(stored(row, entry.key))
    if (toyTypes && entry.toyTypeChoices.length)
      question.toyTypes = { options: entry.toyTypeChoices.map(item => ({ value: item.code, label: item.label })), selected: toyTypes }
    questions.push(question)
  }
  return questions
}

/** The Fundamento written from the source: "Según la etiqueta del empaque." */
export function editorialSourceBasis(sourceRef: string): string {
  const text = sourceRef.trim()
  if (!text) return ''
  const named = EDITORIAL_SOURCES.find(entry => entry.label === text)
  return `Según ${named ? named.phrase : text.charAt(0).toLowerCase() + text.slice(1)}.`
}
function evidenceOf(source: EditorialCardSource): EditorialEvidence | null {
  const evidence = { sourceRef: source.sourceRef.trim(), verifiedOn: source.verifiedOn }
  return isFreshEditorialEvidence(evidence) ? evidence : null
}

/** The source the row already carries: the evidence of its first known answer, or of its care review. */
export function editorialCardSourceOf(row: EditorialFactsEditingRow | null): EditorialCardSource | null {
  for (const entry of row?.declarations ?? []) {
    if (entry.input.state === 'known' && entry.input.evidence) return { ...entry.input.evidence }
  }
  const care = row?.careReview
  return care?.state === 'prepared' && care.evidence[0] ? { ...care.evidence[0] } : null
}

/** Every known answer, and the care review, take the card source as their evidence and Fundamento. */
export function applyEditorialCardSource(row: EditorialFactsEditingRow, source: EditorialCardSource): EditorialFactsEditingRow {
  const next = copy(row), evidence = evidenceOf(source), basis = evidence ? editorialSourceBasis(evidence.sourceRef) : ''
  for (const entry of next.declarations) {
    if (entry.input.state === 'known') entry.input = { ...entry.input, evidence: evidence && { ...evidence }, basis }
  }
  next.careReview = withCareSource(next.careReview, evidence, basis)
  return next
}
export function withCareSource(care: EditorialCareReviewInput, evidence: EditorialEvidence | null, basis: string): EditorialCareReviewInput {
  if (care.state !== 'prepared') return care
  const list = () => (evidence ? [{ ...evidence }] : [])
  return { ...care, evidence: list(), basis,
    requirements: care.requirements.map(item => ({ ...item, evidence: list(), basis })),
    warnings: care.warnings.map(item => ({ ...item, requirementKeys: [...item.requirementKeys], evidence: list(), handlingBasis: basis })) }
}

/** The key of a presentation in the map of sources picked before any answer. */
export const editorialSourceKey = (variantId: string | null) => (variantId === null ? 'product' : `variant:${variantId}`)
/** The source a card shows and writes: the one picked in this session, else the stored one, else none from today. */
export function editorialEffectiveSource(picked: ReadonlyMap<string, EditorialCardSource>, row: EditorialFactsEditingRow | null, variantId: string | null): EditorialCardSource {
  return picked.get(editorialSourceKey(variantId)) ?? editorialCardSourceOf(row) ?? { sourceRef: '', verifiedOn: editorialToday() }
}

/** The subject's facts row, created the first time the card or the table needs it. */
export function ensureEditorialFactsRow(state: EditorialFactsEditingState, subject: { variantId: string | null; presentation: string }, nextId: () => string) {
  const found = state.find(row => row.variantId === subject.variantId)
  if (found) return { state, row: found }
  const row: EditorialFactsEditingRow = { id: nextId(), variantId: subject.variantId, presentation: subject.presentation.slice(0, 300),
    declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }
  return { state: [...state, row], row }
}

function write(row: EditorialFactsEditingRow, key: Key, input: EditorialDeclarationInput | null, nextId: () => string): EditorialFactsEditingRow {
  const next = copy(row), index = next.declarations.findIndex(entry => entry.declarationKey === key)
  if (input === null) { if (index >= 0) next.declarations.splice(index, 1) }
  else if (index >= 0) next.declarations[index]!.input = input
  else next.declarations.push({ id: nextId(), declarationKey: key, input })
  return next
}

/** One answer becomes one declaration: known with the card source, unknown for "No sé", none when cleared. */
export function setEditorialCardAnswer(row: EditorialFactsEditingRow, key: Key, answer: EditorialCardAnswer, source: EditorialCardSource, nextId: () => string): EditorialFactsEditingRow {
  const evidence = evidenceOf(source)
  const input = answer === null ? null : answer.state === 'unknown' ? { key, state: 'unknown' } as EditorialDeclarationInput
    : { key, state: 'known', value: answer.value, evidence, basis: evidence ? editorialSourceBasis(evidence.sourceRef) : '' } as EditorialDeclarationInput
  let next = write(row, key, input, nextId)
  // A follow-up list only means something under a Sí: any other answer drops it.
  const followUp = followUps.get(key)
  if (followUp && !(answer?.state === 'known' && answer.value === true)) next = write(next, followUp, null, nextId)
  return next
}

/** "Copiar respuestas de …": the other presentation's answers, each written as this card writes it, with
 * the given source. This row keeps its own "No aplica" list; the care review is not copied. */
export function copyEditorialCardAnswers(from: EditorialFactsEditingRow, to: EditorialFactsEditingRow, source: EditorialCardSource, nextId: () => string): EditorialFactsEditingRow {
  let next = to
  for (const entry of from.declarations) {
    if (entry.declarationKey === 'optionalNonpertinenceCodes' || entry.input.state === 'omitted') continue
    next = write(next, entry.declarationKey, copy(entry.input), nextId)
  }
  const evidence = evidenceOf(source), basis = evidence ? editorialSourceBasis(evidence.sourceRef) : ''
  return { ...next, declarations: next.declarations.map(entry => (entry.declarationKey === 'optionalNonpertinenceCodes' || entry.input.state !== 'known' ? entry
    : { ...entry, input: { ...entry.input, evidence: evidence && { ...evidence }, basis } })) }
}

/** "No aplica" on an optional datum of the table: its code joins or leaves the hidden list. */
export function setEditorialOptionalNonpertinence(row: EditorialFactsEditingRow, code: string, include: boolean, source: EditorialCardSource, nextId: () => string): EditorialFactsEditingRow {
  type Codes = EditorialDeclarationValues['optionalNonpertinenceCodes']
  const current = stored(row, 'optionalNonpertinenceCodes')
  const codes: string[] = current?.state === 'known' && current.key === 'optionalNonpertinenceCodes' ? [...current.value] : []
  // The table offers only the family's bound codes, so the picked code is one of the production codes.
  const next = (include ? (codes.includes(code) ? codes : [...codes, code]) : codes.filter(item => item !== code)) as Codes
  if (!next.length) return write(row, 'optionalNonpertinenceCodes', null, nextId)
  if (current?.state === 'known' && current.key === 'optionalNonpertinenceCodes') return write(row, 'optionalNonpertinenceCodes', { ...current, value: next }, nextId)
  return setEditorialCardAnswer(row, 'optionalNonpertinenceCodes', { state: 'known', value: next }, source, nextId)
}

/** "Borrar respuestas": the questions and the care review go; the list behind the table's "No aplica" stays.
 * Null when nothing is left, so the row itself can go. */
export function clearEditorialCardAnswers(row: EditorialFactsEditingRow): EditorialFactsEditingRow | null {
  const kept = row.declarations.filter(entry => entry.declarationKey === 'optionalNonpertinenceCodes')
  if (!kept.length) return null
  return { ...copy(row), declarations: copy(kept), careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }
}

export function isEditorialCardComplete(questions: readonly EditorialCardQuestion[], source: EditorialCardSource): boolean {
  return questions.length > 0 && questions.every(question => question.answer !== undefined) && evidenceOf(source) !== null
}

const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** "4 nov", with the year only when it is not the current one. */
export function editorialShortDate(iso: string, now = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const year = Number(match[1]) === now.getFullYear() ? '' : ` ${match[1]}`
  return `${Number(match[3])} ${months[Number(match[2]) - 1]}${year}`
}
/** Today as AAAA-MM-DD in local time, the default date of a source. */
export function editorialToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function phrase(question: EditorialCardQuestion): string {
  const words = wording[question.key]!
  const answer = question.answer
  if (answer === 'unknown') return `${words.noun}: no se sabe`
  if (question.key === 'contentMagnitude') return `se mide en ${magnitudes.find(entry => entry[0] === answer)?.[2] ?? answer}`
  if (question.kind === 'yn') return (answer === true ? words.yes : words.no)!
  if (question.kind === 'many') {
    const picked = (answer as string[]).map(code => question.options.find(option => option.value === code)?.label.toLowerCase() ?? code)
    return `${words.noun}: ${picked.length ? picked.join(', ') : 'ninguna'}`
  }
  return (kinds.find(entry => entry[0] === answer)?.[1] ?? String(answer)).toLowerCase()
}
/** The one line of a collapsed card: "Se mide en peso · Etiqueta del empaque · 4 nov". */
export function editorialCardSummary(questions: readonly EditorialCardQuestion[], source: EditorialCardSource, now = new Date()): string {
  const parts = questions.filter(question => question.answer !== undefined).map(phrase)
  if (source.sourceRef.trim()) parts.push(source.sourceRef.trim(), editorialShortDate(source.verifiedOn, now))
  const text = parts.join(' · ')
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Sin responder'
}
