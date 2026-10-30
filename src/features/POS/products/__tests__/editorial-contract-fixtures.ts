import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import type { EditorialContractState } from '../interfaces/editorial-contract-response.types'
import type { EditorialContractVocabulary } from '../interfaces/editorial-contract-vocabulary.types'

export const R = `ev2-sha256-${'a'.repeat(64)}`
export const read = 'read:ProductEditorialDraft'
export const update = 'update:ProductEditorialDraft'
export const publish = 'publish:ProductEditorialDraft'
export const document = (): EditorialContractDocument => ({ schemaVersion: 2, commercialTitle: ' exact ', description: null,
  mediaRefs: [], familyCode: null, values: [], facts: [] })
export const state = (doc = document(), revision = 3): EditorialContractState => ({ cycle: 2,
  draft: { revision, basePublishedRevision: null, document: doc }, published: null })
export const envelope = (snapshot = state(), revision = R) => ({ contractVersion: 2 as const, vocabularyRevision: revision, state: snapshot })
export const vocabulary = (): EditorialContractVocabulary => ({ semanticsVersion: 'editorial-production-1', families: [], definitions: [] })
export const vocabularyEnvelope = (vocab = vocabulary(), revision = R) => ({ contractVersion: 2 as const, vocabularyRevision: revision, vocabulary: vocab })
export const success = (snapshot = state(), status = 200, revision = R) => ({ status, data: envelope(snapshot, revision),
  headers: { 'Editorial-Contract-Version': '2', 'Editorial-Vocabulary-Revision': revision } })
export const failure = (status: number, error: string) => ({ isAxiosError: true, response: { status, data: { statusCode: status, error } } })
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
export const careDocument = (): EditorialContractDocument => ({ ...document(), familyCode: 'care', facts: [
  { variantId: null, presentation: 'Presentación exacta', declarations: [], careReview: { state: 'unknown' } },
] })
export const careVocabulary = (): EditorialContractVocabulary => ({ ...vocabulary(), families: [{ id: 'care', code: 'care', label: 'Cuidado', bindings: [] }] })
