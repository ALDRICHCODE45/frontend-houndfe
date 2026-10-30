import type { EditorialContractContext } from '../interfaces/editorial-contract-request.types'
import type { EditorialStateResponse, EditorialVocabularyResponse } from '../interfaces/editorial-contract-response.types'

export interface EditorialContractReadPort {
  getVocabulary(signal: AbortSignal): Promise<EditorialVocabularyResponse>
  getState(productId: string, revision: string, signal: AbortSignal): Promise<EditorialStateResponse>
  getContext(productId: string, signal: AbortSignal): Promise<EditorialContractContext>
}

export type EditorialContractSnapshot = {
  vocabulary: EditorialVocabularyResponse
  state: EditorialStateResponse
  context: EditorialContractContext
}

export async function loadEditorialContractSnapshot(
  readPort: EditorialContractReadPort,
  productId: string,
  signal: AbortSignal,
): Promise<EditorialContractSnapshot> {
  if (signal.aborted) throw new Error('Editorial snapshot load cancelled')
  const vocabulary = await readPort.getVocabulary(signal)
  if (signal.aborted) throw new Error('Editorial snapshot load cancelled')

  const revision = vocabulary.vocabularyRevision
  const [state, context] = await Promise.all([
    readPort.getState(productId, revision, signal),
    readPort.getContext(productId, signal),
  ])
  if (signal.aborted) throw new Error('Editorial snapshot load cancelled')
  if (state.vocabularyRevision !== revision) {
    throw new Error('Editorial snapshot revisions do not match')
  }
  return { vocabulary, state, context }
}
