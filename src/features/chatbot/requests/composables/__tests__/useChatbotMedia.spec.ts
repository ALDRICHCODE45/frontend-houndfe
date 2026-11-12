import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { QueryClient } from '@tanstack/vue-query'
import { axiosError, withQuery } from './withQuery'
import { chatbotMediaKeys } from '../../constants/queryKeys'
import { MEDIA_PURGED_COPY } from '../../utils/conversation-copy'

vi.mock('../../api/chatbot-conversation.api', () => ({
  chatbotConversationApi: { getPage: vi.fn(), getMedia: vi.fn() },
}))

const auth = vi.hoisted(() => ({ perms: new Set<string>(), tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) => auth.perms.has(`${action}:${subject}`),
  }),
}))

import { chatbotConversationApi } from '../../api/chatbot-conversation.api'
import { MEDIA_STALE_MS, useChatbotMedia } from '../useChatbotMedia'

const getMedia = vi.mocked(chatbotConversationApi.getMedia)
const createObjectURL = vi.fn<(blob: Blob) => string>()
const revokeObjectURL = vi.fn<(url: string) => void>()
let counter = 0

beforeEach(() => {
  getMedia.mockReset()
  createObjectURL.mockReset()
  revokeObjectURL.mockReset()
  counter = 0
  createObjectURL.mockImplementation(() => `blob:app/${++counter}`)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
  auth.perms = new Set(['read:ChatbotRequest', 'read:ChatbotConversation'])
  auth.tenantId = 'tenant-1'
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const blobOf = (type = 'image/jpeg') => new Blob(['bytes'], { type })

describe('useChatbotMedia — blob fetch and object URL', () => {
  it('fetches the file through the api and exposes an object URL of the blob', async () => {
    const blob = blobOf()
    getMedia.mockResolvedValue(blob)
    const { result } = withQuery(() => useChatbotMedia('m-1'))
    expect(result.isLoading.value).toBe(true)
    await flushPromises()

    expect(getMedia).toHaveBeenCalledWith('m-1', { signal: expect.anything() })
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(result.url.value).toBe('blob:app/1')
    expect(result.isLoading.value).toBe(false)
    expect(result.errorMessage.value).toBeNull()
  })

  it('revokes the object URL when the component unmounts', async () => {
    getMedia.mockResolvedValue(blobOf())
    const { result, wrapper } = withQuery(() => useChatbotMedia('m-1'))
    await flushPromises()
    expect(result.url.value).toBe('blob:app/1')
    expect(revokeObjectURL).not.toHaveBeenCalled()

    wrapper.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:app/1')
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('revokes the previous object URL when another media id replaces it', async () => {
    getMedia.mockResolvedValueOnce(blobOf()).mockResolvedValueOnce(blobOf('image/png'))
    const id = ref('m-1')
    const { result } = withQuery(() => useChatbotMedia(id))
    await flushPromises()
    expect(result.url.value).toBe('blob:app/1')

    id.value = 'm-2'
    await flushPromises()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:app/1')
    expect(result.url.value).toBe('blob:app/2')
  })

  it('caches per media id: a second consumer reuses the blob (one request) with its own URL, revoked on its own', async () => {
    getMedia.mockResolvedValue(blobOf())
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const a = withQuery(() => useChatbotMedia('m-1'), client)
    await flushPromises()
    const b = withQuery(() => useChatbotMedia('m-1'), client)
    await flushPromises()

    expect(getMedia).toHaveBeenCalledTimes(1)
    expect(a.result.url.value).not.toBe(b.result.url.value)
    expect(client.getQueryData(chatbotMediaKeys.file('tenant-1', 'm-1'))).toBeInstanceOf(Blob)

    b.wrapper.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith(b.result.url.value)
    expect(revokeObjectURL).not.toHaveBeenCalledWith(a.result.url.value)
  })

  it('keeps a long staleTime and never refetches on its own', () => {
    expect(MEDIA_STALE_MS).toBeGreaterThanOrEqual(30 * 60_000)
  })
})

describe('useChatbotMedia — gating', () => {
  it('does not fetch when disabled, and fetches once enabled (a PDF opens on click)', async () => {
    getMedia.mockResolvedValue(blobOf('application/pdf'))
    const enabled = ref(false)
    const { result } = withQuery(() => useChatbotMedia('m-1', { enabled }))
    await flushPromises()
    expect(getMedia).not.toHaveBeenCalled()
    expect(result.url.value).toBeNull()
    expect(result.isLoading.value).toBe(false)

    enabled.value = true
    await flushPromises()
    expect(getMedia).toHaveBeenCalledTimes(1)
    expect(result.url.value).toBe('blob:app/1')
  })

  it('never fetches without read:ChatbotConversation, without read:ChatbotRequest, or with no id', async () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    withQuery(() => useChatbotMedia('m-1'))
    auth.perms = new Set(['read:ChatbotConversation'])
    withQuery(() => useChatbotMedia('m-1'))
    auth.perms = new Set(['read:ChatbotRequest', 'read:ChatbotConversation'])
    withQuery(() => useChatbotMedia(null))
    await flushPromises()
    expect(getMedia).not.toHaveBeenCalled()
  })

  it('does not fetch a file already known as purged and says so with the retention copy', async () => {
    const { result } = withQuery(() => useChatbotMedia('m-1', { purged: true }))
    await flushPromises()
    expect(getMedia).not.toHaveBeenCalled()
    expect(result.isPurged.value).toBe(true)
    expect(result.errorMessage.value).toBe(MEDIA_PURGED_COPY)
  })
})

describe('useChatbotMedia — errors', () => {
  it('410 reads «Este archivo ya no está disponible (se elimina a los 12 meses)» and is not retried', async () => {
    getMedia.mockRejectedValue(axiosError(410, { code: 'MEDIA_PURGED' }))
    const { result } = withQuery(() => useChatbotMedia('m-1'), new QueryClient())
    await flushPromises()

    expect(getMedia).toHaveBeenCalledTimes(1)
    expect(result.isPurged.value).toBe(true)
    expect(result.isError.value).toBe(true)
    expect(result.errorMessage.value).toBe(
      'Este archivo ya no está disponible (se elimina a los 12 meses)',
    )
    expect(result.url.value).toBeNull()
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('503 is a retryable error with its own copy; retry fetches again', async () => {
    getMedia.mockRejectedValueOnce(axiosError(503, { code: 'MEDIA_STORAGE_FAILED' }))
    const { result } = withQuery(() => useChatbotMedia('m-1'))
    await flushPromises()
    expect(result.isPurged.value).toBe(false)
    expect(result.errorMessage.value).toContain('inténtalo de nuevo')

    getMedia.mockResolvedValueOnce(blobOf())
    await result.refetch()
    await flushPromises()
    expect(result.errorMessage.value).toBeNull()
    expect(result.url.value).toBe('blob:app/1')
  })
})
