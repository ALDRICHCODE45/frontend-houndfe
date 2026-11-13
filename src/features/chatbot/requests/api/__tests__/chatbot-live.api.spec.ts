/**
 * Live conversation transport (handoff 20 §3): exact URLs, `Idempotency-Key` = `clientMessageId`,
 * allow-listed bodies, and the multipart upload with its own key.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import type { SendMessageBody } from '../../interfaces/chatbot-request.types'
import { chatbotLiveApi } from '../chatbot-live.api'

vi.mock('@/core/shared/api/http', () => ({ http: { post: vi.fn() } }))

const post = vi.mocked(http.post)
beforeEach(() => post.mockReset())

describe('chatbotLiveApi.sendMessage', () => {
  it('POST …/messages with the text body and Idempotency-Key equal to clientMessageId', async () => {
    const message = { id: 'm-1', seq: 17 }
    post.mockResolvedValue({ data: { message } })

    const result = await chatbotLiveApi.sendMessage('req-1', {
      clientMessageId: 'c-1',
      expectedEpoch: 3,
      text: 'Hola, soy Ana.',
    })

    expect(result).toEqual({ message })
    expect(post).toHaveBeenCalledWith(
      '/chatbot-requests/req-1/messages',
      { clientMessageId: 'c-1', expectedEpoch: 3, text: 'Hola, soy Ana.' },
      { headers: { 'Idempotency-Key': 'c-1' } },
    )
  })

  it('sends a photo as type + mediaId + caption and no text', async () => {
    post.mockResolvedValue({ data: { message: {} } })
    // A caller that slips a `text` in (the type does not stop a spread): it must never reach the wire.
    const sloppy = {
      clientMessageId: 'c-2',
      expectedEpoch: 3,
      type: 'IMAGE',
      mediaId: 'media-1',
      caption: 'Así quedó',
      text: 'nope',
    } as unknown as SendMessageBody
    await chatbotLiveApi.sendMessage('req-1', sloppy)
    expect(post.mock.calls[0]![1]).toEqual({
      clientMessageId: 'c-2',
      expectedEpoch: 3,
      type: 'IMAGE',
      mediaId: 'media-1',
      caption: 'Así quedó',
    })
  })

  it('leaves the caption out when there is none and encodes the id in the path', async () => {
    post.mockResolvedValue({ data: { message: {} } })
    await chatbotLiveApi.sendMessage('a/b', {
      clientMessageId: 'c-3',
      expectedEpoch: 1,
      type: 'DOCUMENT',
      mediaId: 'media-2',
    })
    expect(post.mock.calls[0]![0]).toBe('/chatbot-requests/a%2Fb/messages')
    expect(post.mock.calls[0]![1]).toEqual({
      clientMessageId: 'c-3',
      expectedEpoch: 1,
      type: 'DOCUMENT',
      mediaId: 'media-2',
    })
  })
})

describe('chatbotLiveApi.uploadMedia', () => {
  it('POST …/media as multipart with one `file` part and its own Idempotency-Key', async () => {
    const reply = { mediaId: 'media-1', mimeType: 'image/jpeg', sizeBytes: 3, sha256: 'x', filename: 'foto.jpg' }
    post.mockResolvedValue({ data: reply })
    const file = new File(['abc'], 'foto.jpg', { type: 'image/jpeg' })
    const onProgress = vi.fn()

    const result = await chatbotLiveApi.uploadMedia('req-1', file, 'key-1', { onProgress })

    expect(result).toEqual(reply)
    const [url, body, config] = post.mock.calls[0]!
    expect(url).toBe('/chatbot-requests/req-1/media')
    expect(body).toBeInstanceOf(FormData)
    expect([...(body as FormData).keys()]).toEqual(['file'])
    expect((body as FormData).get('file')).toBeInstanceOf(File)
    expect(config).toMatchObject({ headers: { 'Idempotency-Key': 'key-1' } })
    // The browser sets the multipart boundary: no Content-Type of ours.
    expect(JSON.stringify((config as { headers: object }).headers)).not.toMatch(/content-type/i)

    ;(config as { onUploadProgress: (e: { loaded: number; total?: number }) => void }).onUploadProgress({
      loaded: 50,
      total: 200,
    })
    expect(onProgress).toHaveBeenCalledWith(25)
  })
})

describe('chatbotLiveApi.sendTemplate', () => {
  it('POST …/template with exactly {expectedEpoch} and the key', async () => {
    post.mockResolvedValue({ data: { message: { type: 'TEMPLATE' } } })
    await chatbotLiveApi.sendTemplate(
      'req-1',
      // @ts-expect-error no other key is accepted
      { expectedEpoch: 3, templateName: 'x' },
      'tpl-key',
    )
    expect(post).toHaveBeenCalledWith(
      '/chatbot-requests/req-1/template',
      { expectedEpoch: 3 },
      { headers: { 'Idempotency-Key': 'tpl-key' } },
    )
  })
})
