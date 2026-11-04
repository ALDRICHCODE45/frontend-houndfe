import type { EditorialContractDocument, EditorialSellableFacts } from '../interfaces/editorial-contract-document.types'
import type { EditorialContractContext } from '../interfaces/editorial-contract-request.types'
import type { EditorialContractVocabulary } from '../interfaces/editorial-contract-vocabulary.types'
import { editorialValueText } from './editorial-value-text'

export type EditorialHistoryChange = { key: string; label: string; before: string | null; after: string | null }

// Same object, any key order: stored arrays keep their order and duplicates.
function comparable(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))) : item)
}

function plural(count: number, one: string, many: string) { return `${count} ${count === 1 ? one : many}` }

function factsText(row: EditorialSellableFacts): string {
  const parts = [plural(row.declarations.length, 'declaración', 'declaraciones')]
  if (row.careReview !== null) parts.push('con revisión de cuidado')
  return parts.join(' · ')
}

/**
 * The readable difference between the published version and the draft: only fields that changed,
 * in plain words (labels, options and presentation names; never codes, revisions or ids).
 */
export function buildEditorialHistoryChanges({ published, draft, vocabulary, context }: {
  published: EditorialContractDocument | null
  draft: EditorialContractDocument | null
  vocabulary: EditorialContractVocabulary | null
  context: EditorialContractContext | null
}): EditorialHistoryChange[] {
  if (!draft) return []
  const changes: EditorialHistoryChange[] = []
  const add = (key: string, label: string, before: string | null, after: string | null, same: boolean) => {
    if (!same) changes.push({ key, label, before, after })
  }
  const text = (value: string | null | undefined) => (value === null || value === undefined || value === '' ? null : value)
  const subject = (id: string | null) => (id === null ? 'Sin presentación'
    : context?.variants.find(item => item.id === id)?.name ?? 'Presentación')
  const familyLabel = (code: string | null | undefined) => code === null || code === undefined ? null
    : vocabulary?.families.find(item => item.code === code)?.label ?? code

  add('title', 'Título comercial', text(published?.commercialTitle), text(draft.commercialTitle),
    text(published?.commercialTitle) === text(draft.commercialTitle))
  add('description', 'Descripción', text(published?.description), text(draft.description),
    text(published?.description) === text(draft.description))
  add('family', 'Familia', familyLabel(published?.familyCode), familyLabel(draft.familyCode),
    (published?.familyCode ?? null) === draft.familyCode)
  add('media', 'Imágenes vinculadas', published?.mediaRefs.length ? plural(published.mediaRefs.length, 'imagen', 'imágenes') : null,
    draft.mediaRefs.length ? plural(draft.mediaRefs.length, 'imagen', 'imágenes') : null,
    comparable(published?.mediaRefs ?? []) === comparable(draft.mediaRefs))

  // The nth stored occurrence of a target pairs with the nth occurrence on the other side.
  function pair<T>(oldItems: readonly T[], newItems: readonly T[], identity: (item: T) => string,
    emit: (index: number, oldItem: T | undefined, newItem: T | undefined) => void) {
    const used = new Set<number>()
    let index = 0
    for (const oldItem of oldItems) {
      const at = newItems.findIndex((item, position) => !used.has(position) && identity(item) === identity(oldItem))
      if (at !== -1) used.add(at)
      emit(index++, oldItem, at === -1 ? undefined : newItems[at])
    }
    newItems.forEach((item, position) => { if (!used.has(position)) emit(index++, undefined, item) })
  }
  const definitionOf = (code: string) => vocabulary?.definitions.find(item => item.code === code)
  pair(published?.values ?? [], draft.values, value => JSON.stringify([value.code, value.owner, value.variantId]),
    (index, before, after) => {
      const source = before ?? after!
      const definition = definitionOf(source.code)
      add(`value-${index}`, `${definition?.label ?? 'Dato'}${source.owner === 'sellable' ? ` · ${subject(source.variantId)}` : ''}`,
        before ? editorialValueText(before, definition) : null, after ? editorialValueText(after, definition) : null,
        before !== undefined && after !== undefined && comparable(before) === comparable(after))
    })
  pair(published?.facts ?? [], draft.facts, row => JSON.stringify(row.variantId),
    (index, before, after) => {
      const source = before ?? after!
      add(`facts-${index}`, `Declaraciones y cuidado · ${subject(source.variantId)}`,
        before ? factsText(before) : null, after ? factsText(after) : null,
        before !== undefined && after !== undefined && comparable(before) === comparable(after))
    })
  return changes
}
