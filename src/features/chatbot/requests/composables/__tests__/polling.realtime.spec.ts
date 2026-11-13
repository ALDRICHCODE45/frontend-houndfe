import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { withQuery } from './withQuery'
import { createFakeRealtime } from '@/core/realtime/__tests__/fake-realtime'
import { setRealtimeServiceForTests } from '@/core/realtime/useRealtime'
import { countsFixture, makeGroup } from '../../interfaces/__tests__/chatbot-request.fixture'
import { makeDetail } from '../../utils/detail-fixture'
import { makeMessage } from '../../utils/conversation-fixture'

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: { getCounts: vi.fn(), listGroups: vi.fn(), getDetail: vi.fn() },
}))
vi.mock('../../api/chatbot-conversation.api', () => ({
  chatbotConversationApi: { getPage: vi.fn() },
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

import { chatbotRequestApi } from '../../api/chatbot-request.api'
import { chatbotConversationApi } from '../../api/chatbot-conversation.api'
import { REQUESTS_LIVE_TRANSITION_REFETCH_MS, REQUESTS_REFETCH_MS } from '../polling'
import { useRequestCounts } from '../useRequestCounts'
import { useRequestDetail } from '../useRequestDetail'
import { useRequestGroups } from '../useRequestGroups'
import { CONVERSATION_LIVE_POLL_MS, useRequestConversation } from '../useRequestConversation'
import { REALTIME_OPEN_REFETCH_MS } from '@/core/realtime'

const getCounts = vi.mocked(chatbotRequestApi.getCounts)
const listGroups = vi.mocked(chatbotRequestApi.listGroups)
const getDetail = vi.mocked(chatbotRequestApi.getDetail)
const getPage = vi.mocked(chatbotConversationApi.getPage)

const OPEN = { state: 'open', role: 'leader' } as const

function streamWith(status: Parameters<typeof createFakeRealtime>[0]) {
  vi.stubEnv('VITE_REALTIME_SSE', 'true')
  const fake = createFakeRealtime(status)
  setRealtimeServiceForTests(fake.service)
  return fake
}

beforeEach(() => {
  vi.useFakeTimers()
  auth.perms = new Set(['read:ChatbotRequest', 'read:ChatbotConversation'])
  auth.tenantId = 'tenant-1'
  getCounts.mockReset().mockResolvedValue(countsFixture)
  listGroups.mockReset().mockResolvedValue({ items: [makeGroup('k1.a')], nextCursor: null })
  getDetail.mockReset().mockResolvedValue(makeDetail())
  getPage.mockReset().mockResolvedValue({ items: [makeMessage({ seq: 1 })], hasMoreBefore: false })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  setRealtimeServiceForTests(null)
})

async function tick(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('chatbot polling with the stream', () => {
  it('counts, groups and detail poll at 30 s while the stream is not open', async () => {
    streamWith({ state: 'reconnecting', role: 'leader' })
    withQuery(() => useRequestCounts())
    withQuery(() => useRequestGroups({ filters: { status: 'open' } }))
    withQuery(() => useRequestDetail('req-1'))
    await tick(0)
    await tick(REQUESTS_REFETCH_MS)
    expect(getCounts).toHaveBeenCalledTimes(2)
    expect(listGroups).toHaveBeenCalledTimes(2)
    expect(getDetail).toHaveBeenCalledTimes(2)
  })

  it('counts, groups and detail drop to the safety net while the stream is open', async () => {
    streamWith(OPEN)
    withQuery(() => useRequestCounts())
    withQuery(() => useRequestGroups({ filters: { status: 'open' } }))
    withQuery(() => useRequestDetail('req-1'))
    await tick(0)
    await tick(REQUESTS_REFETCH_MS * 5)
    expect(getCounts).toHaveBeenCalledTimes(1)
    expect(listGroups).toHaveBeenCalledTimes(1)
    expect(getDetail).toHaveBeenCalledTimes(1)

    await tick(REALTIME_OPEN_REFETCH_MS)
    expect(getCounts).toHaveBeenCalledTimes(2)
    expect(listGroups).toHaveBeenCalledTimes(2)
    expect(getDetail).toHaveBeenCalledTimes(2)
  })

  it('goes back to 30 s as soon as the stream stops being open', async () => {
    const fake = streamWith(OPEN)
    withQuery(() => useRequestCounts())
    await tick(0)
    await tick(100_000)
    expect(getCounts).toHaveBeenCalledTimes(1)

    fake.setStatus({ state: 'reconnecting', role: 'leader' })
    await tick(REQUESTS_REFETCH_MS)
    expect(getCounts).toHaveBeenCalledTimes(2)
    await tick(REQUESTS_REFETCH_MS)
    expect(getCounts).toHaveBeenCalledTimes(3)
  })

  it('slows down again when the stream reopens', async () => {
    const fake = streamWith({ state: 'connecting', role: 'leader' })
    withQuery(() => useRequestCounts())
    await tick(0)
    fake.setStatus(OPEN)
    getCounts.mockClear()
    await tick(REQUESTS_REFETCH_MS * 4)
    expect(getCounts).not.toHaveBeenCalled()
  })

  it('the 4 s detail cadence of a STARTING session only runs while the stream is not open', async () => {
    const starting = makeDetail({
      liveSession: { state: 'STARTING', handoffEpoch: 1, lastStaffActivityAt: null, lastCustomerMessageAt: null },
    })
    getDetail.mockResolvedValue(starting)
    const fake = streamWith({ state: 'reconnecting', role: 'leader' })
    withQuery(() => useRequestDetail('req-1'))
    await tick(0)
    await tick(REQUESTS_LIVE_TRANSITION_REFETCH_MS * 2)
    expect(getDetail).toHaveBeenCalledTimes(3)

    fake.setStatus(OPEN)
    getDetail.mockClear()
    await tick(REQUESTS_REFETCH_MS * 3)
    expect(getDetail).not.toHaveBeenCalled()
  })

  it('the live thread polls every 4 s without the stream and slows down with it (reader)', async () => {
    const closed = streamWith({ state: 'reconnecting', role: 'leader' })
    withQuery(() => useRequestConversation('req-1', { live: () => true }))
    await tick(0)
    await tick(CONVERSATION_LIVE_POLL_MS * 2)
    expect(getPage).toHaveBeenCalledTimes(3)

    closed.setStatus(OPEN)
    getPage.mockClear()
    await tick(CONVERSATION_LIVE_POLL_MS * 10)
    expect(getPage).not.toHaveBeenCalled()
  })

  it('an attendee without read:ChatbotConversation gets no conversation events, so keeps the 4 s poll', async () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    streamWith(OPEN)
    withQuery(() => useRequestConversation('req-1', { live: () => true, asAttendee: () => true }))
    await tick(0)
    getPage.mockClear()
    await tick(CONVERSATION_LIVE_POLL_MS * 2)
    expect(getPage).toHaveBeenCalledTimes(2)
  })

  it('flag off: nothing changes (30 s, no realtime service created)', async () => {
    const fake = createFakeRealtime(OPEN)
    setRealtimeServiceForTests(fake.service)
    withQuery(() => useRequestCounts())
    await tick(0)
    await tick(REQUESTS_REFETCH_MS)
    expect(getCounts).toHaveBeenCalledTimes(2)
    expect(fake.mocks.onStatus).not.toHaveBeenCalled()
  })
})
