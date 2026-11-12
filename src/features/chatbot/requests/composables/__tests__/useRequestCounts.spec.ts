import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { axiosError, defaultsClient, withQuery } from './withQuery'
import { countsFixture } from '../../interfaces/__tests__/chatbot-request.fixture'
import { chatbotRequestKeys } from '../../constants/queryKeys'

vi.mock('../../api/chatbot-request.api', () => ({ chatbotRequestApi: { getCounts: vi.fn() } }))

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
import { useRequestCounts } from '../useRequestCounts'

const getCounts = vi.mocked(chatbotRequestApi.getCounts)

beforeEach(() => {
  getCounts.mockReset()
  auth.canRead = true
  auth.tenantId = 'tenant-1'
  getCounts.mockResolvedValue(countsFixture)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useRequestCounts', () => {
  it('reads the counts under the tenant key', async () => {
    const { result, client } = withQuery(() => useRequestCounts())
    await flushPromises()

    expect(getCounts).toHaveBeenCalledWith({ signal: expect.anything() })
    expect(result.counts.value).toEqual(countsFixture)
    expect(client.getQueryData(chatbotRequestKeys.counts('tenant-1'))).toEqual(countsFixture)
  })

  it('does not fire without read:ChatbotRequest or without a tenant', async () => {
    auth.canRead = false
    const first = withQuery(() => useRequestCounts())
    await flushPromises()
    expect(getCounts).not.toHaveBeenCalled()
    expect(first.result.counts.value).toBeNull()

    auth.canRead = true
    auth.tenantId = ''
    withQuery(() => useRequestCounts())
    await flushPromises()
    expect(getCounts).not.toHaveBeenCalled()
  })

  it('polls every 30 s while the tab is visible and pauses while hidden', async () => {
    vi.useFakeTimers()
    withQuery(() => useRequestCounts())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(getCounts).toHaveBeenCalledTimes(2)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await vi.advanceTimersByTimeAsync(90_000)
    expect(getCounts).toHaveBeenCalledTimes(2)
  })

  it('does not retry a failed read', async () => {
    getCounts.mockRejectedValue(axiosError(500))
    const { result } = withQuery(() => useRequestCounts(), defaultsClient())
    await flushPromises()
    expect(getCounts).toHaveBeenCalledTimes(1)
    expect(result.isError.value).toBe(true)
  })
})
