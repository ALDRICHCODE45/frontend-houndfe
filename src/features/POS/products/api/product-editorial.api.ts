import { isAxiosError, type AxiosResponse } from 'axios'
import { http } from '@/core/shared/api/http'
import type {
  EditorialErrorEnvelope, EditorialInitializeRequest, EditorialSaveRequest,
  EditorialState, EditorialVocabulary, EditorialWriteResponse,
} from '../interfaces/product-editorial.types'

const errorCodes = {
  400: 'MALFORMED', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
  404: 'NOT_FOUND', 409: 'CONFLICT', 500: 'INTERNAL_ERROR',
} as const

export class EditorialApiError extends Error {
  readonly code: EditorialErrorEnvelope['error'] | 'UNKNOWN'

  constructor(
    readonly status: number | null,
    readonly envelope: EditorialErrorEnvelope | null,
  ) {
    super('Editorial request failed')
    this.name = 'EditorialApiError'
    this.code = envelope?.error ?? 'UNKNOWN'
  }
}

function normalizeError(error: unknown): EditorialApiError {
  if (!isAxiosError(error)) return new EditorialApiError(null, null)
  const status = error.response?.status ?? null
  const body: unknown = error.response?.data
  if (status !== null && Object.prototype.hasOwnProperty.call(errorCodes, status) &&
    typeof body === 'object' && body !== null && !Array.isArray(body)) {
    const candidate = body as Record<string, unknown>
    const code = errorCodes[status as keyof typeof errorCodes]
    if (candidate.statusCode === status && candidate.error === code) {
      // Only closed contract fields escape the transport, never raw backend messages.
      return new EditorialApiError(status, { statusCode: status, error: code } as EditorialErrorEnvelope)
    }
  }
  return new EditorialApiError(status, null)
}

async function unwrap<T>(request: Promise<AxiosResponse<T>>): Promise<T> {
  try {
    return (await request).data
  } catch (error) {
    throw normalizeError(error)
  }
}

const editorialPath = (productId: string) => `/products/${encodeURIComponent(productId)}/editorial`
const writeConfig = (idempotencyKey: string) => ({
  headers: { 'Idempotency-Key': idempotencyKey },
})

// No retry or key generation: immutable intent ownership belongs to the caller.
// Shared HTTP owns auth refresh/replay and the GET request no-cache policy;
// response Cache-Control: no-store is the backend's separate responsibility.
export const editorialApi = {
  getState: (productId: string): Promise<EditorialState> =>
    unwrap(http.get<EditorialState>(editorialPath(productId))),
  getVocabulary: (): Promise<EditorialVocabulary> =>
    unwrap(http.get<EditorialVocabulary>('/catalog-editorial/vocabulary')),
  initialize: (
    productId: string, body: EditorialInitializeRequest, idempotencyKey: string,
  ): Promise<EditorialWriteResponse> => unwrap(http.post<EditorialWriteResponse>(
    `${editorialPath(productId)}/draft/initialize`, body, writeConfig(idempotencyKey),
  )),
  save: (
    productId: string, body: EditorialSaveRequest, idempotencyKey: string,
  ): Promise<EditorialWriteResponse> => unwrap(http.put<EditorialWriteResponse>(
    `${editorialPath(productId)}/draft`, body, writeConfig(idempotencyKey),
  )),
}
