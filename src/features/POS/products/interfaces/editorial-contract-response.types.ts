import type { EditorialContractDocument } from './editorial-contract-document.types'
import type { EditorialOwner } from './editorial-contract-value.types'
import type { EditorialContractVocabulary } from './editorial-contract-vocabulary.types'

export type EditorialArchivedWarning = {
  code: 'ARCHIVED_OPTION'
  familyId: string
  definitionId: string
  owner: EditorialOwner
  variantId: string | null
  optionCode: string
}

export type EditorialContractState = {
  cycle: number | null
  draft: {
    revision: number
    basePublishedRevision: number | null
    document: EditorialContractDocument
  } | null
  published: { revision: number; document: EditorialContractDocument } | null
  warnings?: EditorialArchivedWarning[]
}

export type EditorialStateResponse = {
  contractVersion: 2
  vocabularyRevision: string
  state: EditorialContractState
}

export type EditorialVocabularyResponse = {
  contractVersion: 2
  vocabularyRevision: string
  vocabulary: EditorialContractVocabulary
}
