import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { axiosError, defaultsClient, withQuery } from './withQuery'
import { chatbotRequestKeys } from '../../constants/queryKeys'
import type { ChatbotRequestDetail } from '../../interfaces/chatbot-request.types'

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: { getDetail: vi.fn(), listAudit: vi.fn() },
}))

const auth = vi.hoisted(() => ({ canRead: true, tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) =>
      auth.canRead && action === 'read' && subject === 'ChatbotRequest',
  }),
}))

import { chatbotRequestApi } from '../../api/chatbot-request.api'
import { useRequestAudit } from '../useRequestAudit'
import { useRequestDetail } from '../useRequestDetail'

const getDetail = vi.mocked(chatbotRequestApi.getDetail)
const listAudit = vi.mocked(chatbotRequestApi.listAudit)
const detail = { id: 'req-1', version: 3 } as unknown as ChatbotRequestDetail

beforeEach(() => {
  getDetail.mockReset()
  listAudit.mockReset()
  auth.canRead = true
  auth.tenantId = 'tenant-1'
  getDetail.mockResolvedValue(detail)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useRequestDetail', () => {
  it('reads the detail by id under the tenant key', async () => {
    const { result, client } = withQuery(() => useRequestDetail('req-1'))
    await flushPromises()

    expect(getDetail).toHaveBeenCalledWith('req-1', { signal: expect.anything() })
    expect(result.detail.value).toEqual(detail)
    expect(client.getQueryData(chatbotRequestKeys.detail('tenant-1', 'req-1'))).toEqual(detail)
  })

  it('waits for an id, and refetches when the id changes while keeping the previous detail', async () => {
    const id = ref<string | null>(null)
    const { result } = withQuery(() => useRequestDetail(id))
    await flushPromises()
    expect(getDetail).not.toHaveBeenCalled()

    id.value = 'req-1'
    await flushPromises()
    expect(getDetail).toHaveBeenCalledTimes(1)
    expect(result.detail.value).toEqual(detail)
  })

  it('does not fire without read:ChatbotRequest or without a tenant', async () => {
    auth.canRead = false
    withQuery(() => useRequestDetail('req-1'))
    await flushPromises()
    auth.canRead = true
    auth.tenantId = ''
    withQuery(() => useRequestDetail('req-1'))
    await flushPromises()
    expect(getDetail).not.toHaveBeenCalled()
  })

  it('polls every 30 s while the tab is visible and pauses while hidden', async () => {
    vi.useFakeTimers()
    withQuery(() => useRequestDetail('req-1'))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(getDetail).toHaveBeenCalledTimes(2)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await vi.advanceTimersByTimeAsync(90_000)
    expect(getDetail).toHaveBeenCalledTimes(2)
  })

  it('does not retry (a 404 is a gone request) and exposes the error', async () => {
    getDetail.mockRejectedValue(axiosError(404, { code: 'NOT_FOUND' }))
    const { result } = withQuery(() => useRequestDetail('req-1'), defaultsClient())
    await flushPromises()
    expect(getDetail).toHaveBeenCalledTimes(1)
    expect(result.isError.value).toBe(true)
    expect(result.isNotFound.value).toBe(true)
  })

  it('stops polling after a 404 (the request does not come back)', async () => {
    vi.useFakeTimers()
    getDetail.mockRejectedValue(axiosError(404, { code: 'NOT_FOUND' }))
    withQuery(() => useRequestDetail('req-1'), defaultsClient())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(getDetail).toHaveBeenCalledTimes(1)
  })
})

describe('useRequestDetail — T5L.F M3: polls faster while the session changes state', () => {
  const withSession = (state: string) =>
    ({ id: 'req-1', version: 3, liveSession: { state, handoffEpoch: 1 } }) as unknown as ChatbotRequestDetail

  it.each(['STARTING', 'ENDING'])('%s polls every 4 s, not every 30 s', async (state) => {
    vi.useFakeTimers()
    getDetail.mockResolvedValue(withSession(state))
    withQuery(() => useRequestDetail('req-1'))
    await vi.advanceTimersByTimeAsync(0)
    expect(getDetail).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(4_000)
    expect(getDetail).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(4_000)
    expect(getDetail).toHaveBeenCalledTimes(3)
  })

  it('goes back to 30 s once the session is ACTIVE (and for ENDED, WAITING or no session)', async () => {
    vi.useFakeTimers()
    getDetail.mockResolvedValueOnce(withSession('STARTING')).mockResolvedValue(withSession('ACTIVE'))
    withQuery(() => useRequestDetail('req-1'))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(4_000)
    expect(getDetail).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(getDetail).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(getDetail).toHaveBeenCalledTimes(3)
  })

  it('does not poll in the background, even while STARTING', async () => {
    vi.useFakeTimers()
    getDetail.mockResolvedValue(withSession('STARTING'))
    withQuery(() => useRequestDetail('req-1'))
    await vi.advanceTimersByTimeAsync(0)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(getDetail).toHaveBeenCalledTimes(1)
  })

  it('a 404 still stops the polling while STARTING', async () => {
    vi.useFakeTimers()
    getDetail.mockResolvedValueOnce(withSession('STARTING')).mockRejectedValue(axiosError(404, { code: 'NOT_FOUND' }))
    withQuery(() => useRequestDetail('req-1'), defaultsClient())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(4_000)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(getDetail).toHaveBeenCalledTimes(2)
  })
})

describe('useRequestAudit (events beyond the 20 of the detail)', () => {
  const event = (id: string) => ({ id, type: 'CLAIMED' }) as never

  it('reads the audit by id, paging by cursor', async () => {
    listAudit
      .mockResolvedValueOnce({ items: [event('e1')], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [event('e2')], nextCursor: null })
    const { result, client } = withQuery(() => useRequestAudit('req-1'))
    await flushPromises()

    expect(listAudit.mock.calls[0]![0]).toBe('req-1')
    expect(listAudit.mock.calls[0]![1]).toEqual({ limit: 50 })
    expect(client.getQueryData(chatbotRequestKeys.audit('tenant-1', 'req-1', { limit: 50 }))).toBeDefined()

    await result.fetchNextPage()
    await flushPromises()
    expect(listAudit.mock.calls[1]![1]).toEqual({ cursor: 'c2', limit: 50 })
    expect(result.events.value.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(result.hasNextPage.value).toBe(false)
  })

  it('only fires when enabled (the detail already carries the first 20)', async () => {
    const enabled = ref(false)
    withQuery(() => useRequestAudit('req-1', { enabled }))
    await flushPromises()
    expect(listAudit).not.toHaveBeenCalled()

    listAudit.mockResolvedValue({ items: [], nextCursor: null })
    enabled.value = true
    await flushPromises()
    expect(listAudit).toHaveBeenCalledTimes(1)
  })

  it('does not fire without permission and does not retry', async () => {
    auth.canRead = false
    withQuery(() => useRequestAudit('req-1'))
    await flushPromises()
    expect(listAudit).not.toHaveBeenCalled()

    auth.canRead = true
    listAudit.mockRejectedValue(axiosError(500))
    const { result } = withQuery(() => useRequestAudit('req-1'), defaultsClient())
    await flushPromises()
    expect(listAudit).toHaveBeenCalledTimes(1)
    expect(result.isError.value).toBe(true)
  })
})
