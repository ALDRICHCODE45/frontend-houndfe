/**
 * Live conversation transport on the shared axios `http` (handoff 20 §3).
 *
 * Bodies are built from explicit allow-lists: the backend answers `400` to any unknown key, to
 * `text` together with media and to `mediaId` / `caption` on a text message. `Idempotency-Key` of a
 * message is its `clientMessageId` (a different value is a `400`); an upload and a template carry
 * their own keys, chosen by the caller (one per user attempt).
 */
import { http } from '@/core/shared/api/http'
import type {
  SendMessageBody,
  SendMessageResponse,
  SendTemplateBody,
  UploadMediaResponse,
} from '../interfaces/chatbot-request.types'

const BASE = '/chatbot-requests'
const IDEMPOTENCY_HEADER = 'Idempotency-Key'

const path = (id: string, suffix: string) => `${BASE}/${encodeURIComponent(id)}${suffix}`

function messageWire(body: SendMessageBody): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    clientMessageId: body.clientMessageId,
    expectedEpoch: body.expectedEpoch,
  }
  if ('mediaId' in body) {
    wire.type = body.type
    wire.mediaId = body.mediaId
    if (typeof body.caption === 'string' && body.caption.length > 0) wire.caption = body.caption
  } else {
    wire.text = body.text
  }
  return wire
}

export interface UploadMediaOptions {
  /** 0–100, from the browser's upload progress. */
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export const chatbotLiveApi = {
  /** POST /chatbot-requests/:id/messages */
  async sendMessage(id: string, body: SendMessageBody): Promise<SendMessageResponse> {
    const { data } = await http.post<SendMessageResponse>(path(id, '/messages'), messageWire(body), {
      headers: { [IDEMPOTENCY_HEADER]: body.clientMessageId },
    })
    return data
  },

  /** POST /chatbot-requests/:id/media — multipart, one `file` part (JPEG, PNG, WebP, PDF; ≤ 10 MB). */
  async uploadMedia(
    id: string,
    file: File,
    idempotencyKey: string,
    options: UploadMediaOptions = {},
  ): Promise<UploadMediaResponse> {
    const form = new FormData()
    form.append('file', file)
    const { data } = await http.post<UploadMediaResponse>(path(id, '/media'), form, {
      // No Content-Type: the browser sets the multipart boundary.
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      signal: options.signal,
      onUploadProgress: (event: { loaded: number; total?: number }) => {
        if (!options.onProgress || !event.total) return
        options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      },
    })
    return data
  },

  /** POST /chatbot-requests/:id/template — exactly `{expectedEpoch}`. */
  async sendTemplate(id: string, body: SendTemplateBody, idempotencyKey: string): Promise<SendMessageResponse> {
    const { data } = await http.post<SendMessageResponse>(
      path(id, '/template'),
      { expectedEpoch: body.expectedEpoch },
      { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } },
    )
    return data
  },
}
