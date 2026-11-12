/**
 * Conversation mirror transport on the shared axios `http` (handoff 18, read only).
 *
 * `getPage` sends only the cursors the backend accepts (`before` and `after` never together; any
 * unknown parameter is a 400). `getMedia` fetches the file as a Blob: the route needs the Bearer
 * token, so an `<img src>` / `<audio src>` cannot use it — callers turn the Blob into an object URL.
 */
import { http } from '@/core/shared/api/http'
import type {
  ChatbotConversationPage,
  ChatbotConversationParams,
} from '../interfaces/chatbot-request.types'

export interface ChatbotConversationReadOptions {
  signal?: AbortSignal
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function cursorParams(params: ChatbotConversationParams): Record<string, number> {
  const out: Record<string, number> = {}
  if (isNumber(params.before)) out.before = params.before
  else if (isNumber(params.after)) out.after = params.after
  if (isNumber(params.limit)) out.limit = params.limit
  return out
}

export const chatbotConversationApi = {
  /** GET /chatbot-requests/:id/conversation — latest page, or `before` / `after` a `seq`. */
  async getPage(
    requestId: string,
    params: ChatbotConversationParams = {},
    options?: ChatbotConversationReadOptions,
  ): Promise<ChatbotConversationPage> {
    const { data } = await http.get<ChatbotConversationPage>(
      `/chatbot-requests/${encodeURIComponent(requestId)}/conversation`,
      { params: cursorParams(params), signal: options?.signal },
    )
    return data
  },

  /** GET /chatbot-media/:id — the original file (there are no thumbnails). */
  async getMedia(mediaId: string, options?: ChatbotConversationReadOptions): Promise<Blob> {
    const { data } = await http.get<Blob>(`/chatbot-media/${encodeURIComponent(mediaId)}`, {
      responseType: 'blob',
      signal: options?.signal,
    })
    return data
  },
}
