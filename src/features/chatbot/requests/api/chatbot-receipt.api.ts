import { http } from '@/core/shared/api/http'

export interface ChatbotReceiptReadOptions {
  signal?: AbortSignal
}

/**
 * The receipt file paths the request detail carries (`decision.file.originalUrl` / `previewUrl`)
 * are API-relative (`/sales/:id/receipts/:receiptId/file|preview`, no host) and the API streams
 * them behind the Bearer token. Only those exact shapes are fetched, so the token never goes to
 * another path or host; anything else is treated as no file.
 */
const RECEIPT_FILE_PATH = /^\/sales\/[A-Za-z0-9_-]+\/receipts\/[A-Za-z0-9_-]+\/(?:file|preview)$/

export function receiptFilePath(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null
  const value = url.trim()
  return RECEIPT_FILE_PATH.test(value) ? value : null
}

export const chatbotReceiptApi = {
  /** GET /sales/:id/receipts/:receiptId/file|preview — the file as a Blob (auth via the shared `http`). */
  async getFile(path: string, options?: ChatbotReceiptReadOptions): Promise<Blob> {
    const { data } = await http.get<Blob>(path, { responseType: 'blob', signal: options?.signal })
    return data
  },
}
