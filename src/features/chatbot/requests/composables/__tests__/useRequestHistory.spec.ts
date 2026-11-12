import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { axiosError, defaultsClient, withQuery } from './withQuery'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import { chatbotRequestKeys } from '../../constants/queryKeys'

vi.mock('../../api/chatbot-request.api', () => ({ chatbotRequestApi: { listHistory: vi.fn() } }))

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
import { useRequestHistory } from '../useRequestHistory'

const listHistory = vi.mocked(chatbotRequestApi.listHistory)

beforeEach(() => {
  listHistory.mockReset()
  auth.canRead = true
  auth.tenantId = 'tenant-1'
  listHistory.mockResolvedValue({ items: [makeRow({ id: 'h1', status: 'RESOLVED' })], nextCursor: null })
})
afterEach(() => vi.useRealTimers())

describe('useRequestHistory («Historial», closed more than 7 days ago)', () => {
  it('reads with filters and the default limit', async () => {
    const { result, client } = withQuery(() =>
      useRequestHistory({ filters: { subtype: 'RESTOCK', from: '2026-10-01', to: '2026-10-31' } }),
    )
    await flushPromises()

    expect(listHistory.mock.calls[0]![0]).toEqual({
      subtype: 'RESTOCK',
      from: '2026-10-01',
      to: '2026-10-31',
      limit: 25,
    })
    expect(result.requests.value.map((r) => r.id)).toEqual(['h1'])
    expect(
      client.getQueryData(
        chatbotRequestKeys.history('tenant-1', { subtype: 'RESTOCK', from: '2026-10-01', to: '2026-10-31', limit: 25 }),
      ),
    ).toBeDefined()
  })

  it('accumulates pages by cursor', async () => {
    listHistory
      .mockResolvedValueOnce({ items: [makeRow({ id: 'h1' })], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [makeRow({ id: 'h2' })], nextCursor: null })
    const { result } = withQuery(() => useRequestHistory({ filters: {} }))
    await flushPromises()
    await result.fetchNextPage()
    await flushPromises()
    expect(listHistory.mock.calls[1]![0]).toMatchObject({ cursor: 'c2' })
    expect(result.requests.value.map((r) => r.id)).toEqual(['h1', 'h2'])
  })

  it('does not fire while inactive (another tab is open), and fires once activated', async () => {
    const active = ref(false)
    withQuery(() => useRequestHistory({ filters: {}, active }))
    await flushPromises()
    expect(listHistory).not.toHaveBeenCalled()

    active.value = true
    await flushPromises()
    expect(listHistory).toHaveBeenCalledTimes(1)
  })

  it('does not fire without permission; does not poll', async () => {
    auth.canRead = false
    withQuery(() => useRequestHistory({ filters: {} }))
    await flushPromises()
    expect(listHistory).not.toHaveBeenCalled()

    auth.canRead = true
    vi.useFakeTimers()
    withQuery(() => useRequestHistory({ filters: {} }))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(listHistory).toHaveBeenCalledTimes(1)
  })

  it('a 400 (bad range or stale token) is a «reload» state and is not retried; RANGE_TOO_LARGE is not', async () => {
    listHistory.mockRejectedValue(axiosError(400, { code: 'VALIDATION_ERROR' }))
    const stale = withQuery(() => useRequestHistory({ filters: {} }), defaultsClient())
    await flushPromises()
    expect(listHistory).toHaveBeenCalledTimes(1)
    expect(stale.result.needsReload.value).toBe(true)

    listHistory.mockReset()
    listHistory.mockRejectedValue(axiosError(400, { code: 'RANGE_TOO_LARGE' }))
    const range = withQuery(() => useRequestHistory({ filters: {} }), defaultsClient())
    await flushPromises()
    expect(range.result.needsReload.value).toBe(false)
    expect(range.result.isError.value).toBe(true)
  })
})
