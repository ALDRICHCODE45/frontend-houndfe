/**
 * Conversation mirror transport (handoff 18): exact URLs, the only cursors that are sent, and the
 * media fetch as a blob through the shared `http` (the Bearer token cannot ride an <img src>).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { chatbotConversationApi } from '../chatbot-conversation.api'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn() } }))

const get = vi.mocked(http.get)
const signal = new AbortController().signal

beforeEach(() => get.mockReset())

describe('chatbotConversationApi.getPage', () => {
  it('GET /chatbot-requests/:id/conversation without params reads the latest page', async () => {
    const page = { items: [], hasMoreBefore: false }
    get.mockResolvedValue({ data: page })

    const result = await chatbotConversationApi.getPage('req-1', {}, { signal })

    expect(result).toBe(page)
    expect(get).toHaveBeenCalledWith('/chatbot-requests/req-1/conversation', { params: {}, signal })
  })

  it('sends before and limit for «Cargar mensajes anteriores»', async () => {
    get.mockResolvedValue({ data: { items: [], hasMoreBefore: false } })
    await chatbotConversationApi.getPage('req-1', { before: 18, limit: 50 })
    expect(get).toHaveBeenCalledWith('/chatbot-requests/req-1/conversation', {
      params: { before: 18, limit: 50 },
      signal: undefined,
    })
  })

  it('sends after (0 is a value) for polling newer messages', async () => {
    get.mockResolvedValue({ data: { items: [], hasMoreBefore: false } })
    await chatbotConversationApi.getPage('req-1', { after: 0 })
    expect(get).toHaveBeenCalledWith('/chatbot-requests/req-1/conversation', {
      params: { after: 0 },
      signal: undefined,
    })
  })

  it('never sends both cursors nor unknown params (the backend answers 400)', async () => {
    get.mockResolvedValue({ data: { items: [], hasMoreBefore: false } })
    await chatbotConversationApi.getPage('req-1', {
      before: 5,
      after: 2,
      // @ts-expect-error unknown params must never reach the wire
      foo: 'bar',
    })
    const sent = get.mock.calls[0]![1] as { params: Record<string, unknown> }
    expect(sent.params).toEqual({ before: 5 })
  })

  it('encodes the request id in the path', async () => {
    get.mockResolvedValue({ data: { items: [], hasMoreBefore: false } })
    await chatbotConversationApi.getPage('a/b', {})
    expect(get.mock.calls[0]![0]).toBe('/chatbot-requests/a%2Fb/conversation')
  })
})

describe('chatbotConversationApi.getMedia', () => {
  it('GET /chatbot-media/:id as a blob with the signal and returns the Blob', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    get.mockResolvedValue({ data: blob })

    const result = await chatbotConversationApi.getMedia('m-1', { signal })

    expect(result).toBe(blob)
    expect(get).toHaveBeenCalledWith('/chatbot-media/m-1', { responseType: 'blob', signal })
  })

  it('never asks for ?variant=thumb (there are no thumbnails)', async () => {
    get.mockResolvedValue({ data: new Blob() })
    await chatbotConversationApi.getMedia('m-1')
    expect(JSON.stringify(get.mock.calls[0])).not.toContain('variant')
  })
})
