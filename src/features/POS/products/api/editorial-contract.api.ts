import { AxiosHeaders, isAxiosError, type AxiosResponse } from 'axios'
import { z } from 'zod'
import { http } from '@/core/shared/api/http'
import type {
  EditorialContractCareConfirmation, EditorialContractContext, EditorialContractErrorEnvelope,
  EditorialContractInitializeRequest, EditorialContractSaveRequest, EditorialContractTransitionRequest,
} from '../interfaces/editorial-contract-request.types'
import type { EditorialReadiness, EditorialReadinessIssues } from '../interfaces/editorial-contract-readiness.types'
import type { EditorialStateResponse, EditorialVocabularyResponse } from '../interfaces/editorial-contract-response.types'
import { decodeEditorialReadiness, editorialReadinessIssuesShape } from '../utils/editorial-contract-readiness'
import {
  decodeEditorialStateResponse, decodeEditorialVocabularyResponse, isEditorialVocabularyRevision,
} from '../utils/editorial-contract-response'
import { scalarString, snapshotJson } from '../utils/editorial-contract-value'

const errorSchema: z.ZodType<EditorialContractErrorEnvelope> = z.union([
  z.object({ statusCode: z.literal(400), error: z.literal('MALFORMED') }).strict(),
  // A publish of a saved draft that is not ready: the same items and bySection as readiness.
  z.object({ statusCode: z.literal(400), error: z.literal('MALFORMED'), ...editorialReadinessIssuesShape }).strict(),
  z.object({ statusCode: z.literal(401), error: z.literal('UNAUTHORIZED') }).strict(),
  z.object({ statusCode: z.literal(403), error: z.literal('FORBIDDEN') }).strict(),
  z.object({ statusCode: z.literal(404), error: z.literal('NOT_FOUND') }).strict(),
  z.object({ statusCode: z.literal(409), error: z.enum(['CONFLICT', 'VOCABULARY_CHANGED']) }).strict(),
  z.object({ statusCode: z.literal(500), error: z.enum([
    'EDITORIAL_VOCABULARY_UNREPRESENTABLE', 'INTERNAL_ERROR',
  ]) }).strict(),
])
const contextSchema: z.ZodType<EditorialContractContext> = z.object({
  variants: z.array(z.object({ id: scalarString, name: scalarString }).strict()),
}).strict()

export class EditorialContractApiError extends Error {
  readonly code: EditorialContractErrorEnvelope['error'] | 'UNKNOWN'
  /** What is missing to publish, only on a 400 for a saved draft that is not ready. */
  readonly readiness: EditorialReadinessIssues | null

  constructor(readonly status: number | null, readonly envelope: EditorialContractErrorEnvelope | null) {
    super('Editorial request failed')
    this.name = 'EditorialContractApiError'
    this.code = envelope?.error ?? 'UNKNOWN'
    this.readiness = envelope && 'items' in envelope ? { items: envelope.items, bySection: envelope.bySection } : null
  }
}

function normalizeError(error: unknown): EditorialContractApiError {
  if (!isAxiosError(error)) return new EditorialContractApiError(null, null)
  const status = error.response?.status ?? null
  try {
    const result = errorSchema.safeParse(snapshotJson(error.response?.data))
    if (result.success && result.data.statusCode === status) {
      return new EditorialContractApiError(status, result.data)
    }
  } catch { /* Non-JSON/framework bodies are generic failures too. */ }
  return new EditorialContractApiError(status, null)
}

async function unwrap<T>(
  request: Promise<AxiosResponse<unknown>>, status: number, read: (response: AxiosResponse<unknown>) => T | null,
): Promise<T> {
  let response: AxiosResponse<unknown>
  try {
    response = await request
  } catch (error) {
    throw normalizeError(error)
  }
  // Keep protocol failures outside the network catch, preserving the actual status.
  if (response.status === status) {
    try {
      const decoded = read(response)
      if (decoded !== null) return decoded
    } catch { /* Never expose raw payloads or decoder/header exceptions. */ }
  }
  throw new EditorialContractApiError(response.status, null)
}

function envelopeReader<T extends { vocabularyRevision: string }>(
  decode: (raw: unknown) => T | null, pinnedRevision?: string,
): (response: AxiosResponse<unknown>) => T | null {
  return response => {
    const headers = AxiosHeaders.from(response.headers as ConstructorParameters<typeof AxiosHeaders>[0])
    const revision = headers.get('Editorial-Vocabulary-Revision')
    // Axios/browser normalization hides some raw duplicates; reject observable lists/arrays.
    if (headers.get('Editorial-Contract-Version') !== '2' || !isEditorialVocabularyRevision(revision)) return null
    const decoded = decode(response.data)
    if (!decoded || decoded.vocabularyRevision !== revision ||
      (pinnedRevision !== undefined && revision !== pinnedRevision)) return null
    return decoded
  }
}

const editorialPath = (productId: string) => `/products/${encodeURIComponent(productId)}/editorial`
const writeConfig = (
  key: string, revision: string, confirmation: EditorialContractCareConfirmation, signal?: AbortSignal,
) => ({
  signal,
  headers: {
    'Idempotency-Key': key,
    'Editorial-Vocabulary-Revision': revision,
    ...(confirmation === null ? {} : { 'Editorial-Care-Confirmation': confirmation }),
  },
})

// Callers own frozen intent, keys and reconciliation. No cache, retry, admission or care inference here.
// Shared HTTP owns authenticated GET no-cache and auth refresh; backend owns CORS/no-store/raw headers.
export const editorialContractApi = {
  getVocabulary: (signal?: AbortSignal): Promise<EditorialVocabularyResponse> => unwrap(
    http.get('/catalog-editorial/vocabulary', { signal }), 200, envelopeReader(decodeEditorialVocabularyResponse),
  ),
  getState: (productId: string, revision: string, signal?: AbortSignal): Promise<EditorialStateResponse> => unwrap(
    http.get(editorialPath(productId), { signal, headers: { 'Editorial-Vocabulary-Revision': revision } }),
    200, envelopeReader(decodeEditorialStateResponse, revision),
  ),
  /** What is missing to publish the SAVED draft; read-only, the same R header as the read. */
  getReadiness: (productId: string, revision: string, signal?: AbortSignal): Promise<EditorialReadiness> => unwrap(
    http.get(`${editorialPath(productId)}/draft/readiness`, { signal, headers: { 'Editorial-Vocabulary-Revision': revision } }),
    200, envelopeReader(decodeEditorialReadiness, revision),
  ),
  getContext: (productId: string, signal?: AbortSignal): Promise<EditorialContractContext> => unwrap(
    http.get(`${editorialPath(productId)}/context`, { signal }), 200, response => {
      const result = contextSchema.safeParse(snapshotJson(response.data))
      return result.success ? result.data : null
    },
  ),
  initialize: (
    productId: string, body: EditorialContractInitializeRequest, key: string, revision: string, signal?: AbortSignal,
  ): Promise<EditorialStateResponse> => unwrap(
    http.post(`${editorialPath(productId)}/draft/initialize`, body, writeConfig(key, revision, null, signal)),
    201, envelopeReader(decodeEditorialStateResponse, revision),
  ),
  save: (
    productId: string, body: EditorialContractSaveRequest, key: string, revision: string, signal?: AbortSignal,
  ): Promise<EditorialStateResponse> => unwrap(
    http.put(`${editorialPath(productId)}/draft`, body, writeConfig(key, revision, null, signal)),
    200, envelopeReader(decodeEditorialStateResponse, revision),
  ),
  publish: (
    productId: string, body: EditorialContractTransitionRequest, key: string, revision: string,
    confirmation: EditorialContractCareConfirmation, signal?: AbortSignal,
  ): Promise<EditorialStateResponse> => unwrap(
    http.post(`${editorialPath(productId)}/draft/publish`, body, writeConfig(key, revision, confirmation, signal)),
    200, envelopeReader(decodeEditorialStateResponse, revision),
  ),
  discard: (
    productId: string, body: EditorialContractTransitionRequest, key: string, revision: string, signal?: AbortSignal,
  ): Promise<EditorialStateResponse> => unwrap(
    http.post(`${editorialPath(productId)}/draft/discard`, body, writeConfig(key, revision, null, signal)),
    200, envelopeReader(decodeEditorialStateResponse, revision),
  ),
}
