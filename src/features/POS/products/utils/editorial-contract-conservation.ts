import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import type { EditorialContractContext } from '../interfaces/editorial-contract-request.types'
import type { EditorialArchivedWarning } from '../interfaces/editorial-contract-response.types'
import type { EditorialContractVocabulary } from '../interfaces/editorial-contract-vocabulary.types'
import { decodeEditorialContractDocument } from './editorial-contract-document'
import { inspectEditorialDocumentReferences, type EditorialDocumentReferenceIssue } from './editorial-contract-document-references'

export type EditorialConservationIssue = EditorialDocumentReferenceIssue
  | { code: 'STRUCTURE' }
  | { code: 'ARCHIVED_OPTION_NOT_CONSERVED'; valueIndex: number; optionCode: string }
export type EditorialArchivedConservationInput = {
  document: unknown
  baseline: unknown
  vocabulary: EditorialContractVocabulary
  context: EditorialContractContext
}

/** Whole historical qualification: primitive/reference integrity, never fresh admission. */
export function qualifyEditorialConservationBaseline(
  raw: unknown, vocabulary: EditorialContractVocabulary, context: EditorialContractContext,
): EditorialContractDocument | null {
  const document = decodeEditorialContractDocument(raw)
  return document && inspectEditorialDocumentReferences({ document, vocabulary, context }).length === 0
    ? document : null
}

type Choice = { identity: string; valueIndex: number; warning: EditorialArchivedWarning }
/** Called only for whole reference-valid documents; current metadata owns all IDs. */
function archivedChoices(document: EditorialContractDocument, vocabulary: EditorialContractVocabulary): Choice[] {
  const family = vocabulary.families.find(item => item.code === document.familyCode)
  if (!family) return []
  const definitions = new Map(vocabulary.definitions.map(item => [item.code, item]))
  const choices: Choice[] = []
  document.values.forEach((value, valueIndex) => {
    if (value.state !== 'known') return
    const payload = value.payload
    const definition = definitions.get(value.code)
    if ((payload.type !== 'single' && payload.type !== 'multi')
      || !definition || (definition.type !== 'single' && definition.type !== 'multi')) return
    const archived = new Set(definition.options.filter(option => option.archived).map(option => option.code))
    const selected = payload.type === 'single' ? [payload.value] : payload.value
    selected.forEach(optionCode => {
      if (!archived.has(optionCode)) return
      // JSON tuples preserve null vs strings, separators, exact case and whitespace.
      const identity = JSON.stringify([family.id, definition.id, value.owner, value.variantId, payload.type, optionCode])
      choices.push({ identity, valueIndex, warning: { code: 'ARCHIVED_OPTION', familyId: family.id,
        definitionId: definition.id, owner: value.owner, variantId: value.variantId, optionCode } })
    })
  })
  return choices
}

/**
 * Reference/conservation inspection only, not save/publish authorization.
 * Caller explicitly selects stored Draft for save or current Published for publish.
 * Helper warnings[] are not wire omission rules and must never reconstruct replay receipts.
 */
export function inspectEditorialArchivedConservation({ document: raw, baseline, vocabulary, context }: EditorialArchivedConservationInput): {
  document: EditorialContractDocument | null
  issues: EditorialConservationIssue[]
  warnings: EditorialArchivedWarning[]
} {
  const document = decodeEditorialContractDocument(raw)
  if (!document) return { document: null, issues: [{ code: 'STRUCTURE' }], warnings: [] }
  const issues: EditorialConservationIssue[] = inspectEditorialDocumentReferences({ document, vocabulary, context })
  if (issues.length) return { document, issues, warnings: [] }
  const qualified = qualifyEditorialConservationBaseline(baseline, vocabulary, context)
  const previous = new Set(qualified ? archivedChoices(qualified, vocabulary).map(choice => choice.identity) : [])
  const warnings: EditorialArchivedWarning[] = []
  for (const choice of archivedChoices(document, vocabulary)) {
    if (previous.has(choice.identity)) warnings.push(choice.warning)
    else issues.push({ code: 'ARCHIVED_OPTION_NOT_CONSERVED', valueIndex: choice.valueIndex, optionCode: choice.warning.optionCode })
  }
  return { document, issues, warnings }
}
