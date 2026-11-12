import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { axiosError, defaultsClient, withQuery } from './withQuery'
import { makeGroup } from '../../interfaces/__tests__/chatbot-request.fixture'
import { chatbotRequestKeys } from '../../constants/queryKeys'
import type { ChatbotRequestGroupsFilters } from '../../interfaces/chatbot-request.types'

vi.mock('../../api/chatbot-request.api', () => ({ chatbotRequestApi: { listGroups: vi.fn() } }))

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
import { REQUESTS_REFETCH_MS } from '../polling'
import { useRequestGroups } from '../useRequestGroups'

const listGroups = vi.mocked(chatbotRequestApi.listGroups)

beforeEach(() => {
  listGroups.mockReset()
  auth.canRead = true
  auth.tenantId = 'tenant-1'
  listGroups.mockResolvedValue({ items: [makeGroup('k1.a')], nextCursor: null })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useRequestGroups', () => {
  it('reads the first page with the filters and the default limit, no cursor', async () => {
    const { result, client } = withQuery(() => useRequestGroups({ filters: { status: 'open', overdue: true } }))
    await flushPromises()

    expect(listGroups).toHaveBeenCalledTimes(1)
    expect(listGroups.mock.calls[0]![0]).toEqual({ status: 'open', overdue: true, limit: 25 })
    expect(listGroups.mock.calls[0]![1]).toEqual({ signal: expect.anything() })
    expect(result.groups.value.map((g) => g.customerKey)).toEqual(['k1.a'])
    expect(
      client.getQueryData(chatbotRequestKeys.groups('tenant-1', { status: 'open', overdue: true, limit: 25 })),
    ).toBeDefined()
  })

  it('accumulates pages by cursor and stops when nextCursor is null', async () => {
    listGroups
      .mockResolvedValueOnce({ items: [makeGroup('k1.a')], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [makeGroup('k1.b')], nextCursor: null })
    const { result } = withQuery(() => useRequestGroups({ filters: { status: 'open' } }))
    await flushPromises()
    expect(result.hasNextPage.value).toBe(true)

    await result.fetchNextPage()
    await flushPromises()

    expect(listGroups.mock.calls[1]![0]).toEqual({ status: 'open', cursor: 'c2', limit: 25 })
    expect(result.groups.value.map((g) => g.customerKey)).toEqual(['k1.a', 'k1.b'])
    expect(result.hasNextPage.value).toBe(false)
  })

  it('does not fetch a next page while one is loading or when there is none', async () => {
    const { result } = withQuery(() => useRequestGroups({ filters: {} }))
    await flushPromises()
    await result.fetchNextPage()
    await flushPromises()
    expect(listGroups).toHaveBeenCalledTimes(1)
  })

  it('never shows the same customer twice when pages overlap', async () => {
    listGroups
      .mockResolvedValueOnce({ items: [makeGroup('k1.a')], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [makeGroup('k1.a'), makeGroup('k1.b')], nextCursor: null })
    const { result } = withQuery(() => useRequestGroups({ filters: {} }))
    await flushPromises()
    await result.fetchNextPage()
    await flushPromises()
    expect(result.groups.value.map((g) => g.customerKey)).toEqual(['k1.a', 'k1.b'])
  })

  it('does not fire without read:ChatbotRequest and shows nothing', async () => {
    auth.canRead = false
    const { result } = withQuery(() => useRequestGroups({ filters: {} }))
    await flushPromises()
    expect(listGroups).not.toHaveBeenCalled()
    expect(result.groups.value).toEqual([])
    expect(result.isEnabled.value).toBe(false)
  })

  it('does not fire without a tenant', async () => {
    auth.tenantId = ''
    withQuery(() => useRequestGroups({ filters: {} }))
    await flushPromises()
    expect(listGroups).not.toHaveBeenCalled()
  })

  it('keeps the previous groups on screen while new filters load', async () => {
    const filters = ref<ChatbotRequestGroupsFilters>({ status: 'open' })
    const { result } = withQuery(() => useRequestGroups({ filters }))
    await flushPromises()
    expect(result.groups.value.map((g) => g.customerKey)).toEqual(['k1.a'])

    let release!: (page: { items: ReturnType<typeof makeGroup>[]; nextCursor: null }) => void
    listGroups.mockReturnValueOnce(new Promise((resolve) => (release = resolve)))
    filters.value = { status: 'resolved' }
    await nextTick()
    await flushPromises()

    expect(result.groups.value.map((g) => g.customerKey)).toEqual(['k1.a'])
    expect(result.isPlaceholder.value).toBe(true)

    release({ items: [makeGroup('k1.z')], nextCursor: null })
    await flushPromises()
    expect(result.groups.value.map((g) => g.customerKey)).toEqual(['k1.z'])
    expect(result.isPlaceholder.value).toBe(false)
  })

  it('does not retry a failed read (TanStack defaults would retry 3 times)', async () => {
    listGroups.mockRejectedValue(axiosError(500))
    const { result } = withQuery(() => useRequestGroups({ filters: {} }), defaultsClient())
    await flushPromises()
    expect(listGroups).toHaveBeenCalledTimes(1)
    expect(result.isError.value).toBe(true)
    expect(result.needsReload.value).toBe(false)
  })

  it('a 400 on a stale customerKey/cursor surfaces as «reload», is never retried and stops polling', async () => {
    vi.useFakeTimers()
    listGroups.mockRejectedValue(axiosError(400, { code: 'VALIDATION_ERROR' }))
    const { result } = withQuery(() => useRequestGroups({ filters: {} }), defaultsClient())
    await vi.advanceTimersByTimeAsync(0)
    expect(result.needsReload.value).toBe(true)

    await vi.advanceTimersByTimeAsync(REQUESTS_REFETCH_MS * 3)
    expect(listGroups).toHaveBeenCalledTimes(1)
  })

  it('reload() refetches and clears the reload state', async () => {
    listGroups.mockRejectedValueOnce(axiosError(400, { code: 'VALIDATION_ERROR' }))
    const { result } = withQuery(() => useRequestGroups({ filters: {} }))
    await flushPromises()
    expect(result.needsReload.value).toBe(true)

    await result.reload()
    await flushPromises()
    expect(result.needsReload.value).toBe(false)
    expect(result.groups.value).toHaveLength(1)
  })

  it('polls every 30 s while the tab is visible', async () => {
    vi.useFakeTimers()
    expect(REQUESTS_REFETCH_MS).toBe(30_000)
    withQuery(() => useRequestGroups({ filters: {} }))
    await vi.advanceTimersByTimeAsync(0)
    expect(listGroups).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(listGroups).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(listGroups).toHaveBeenCalledTimes(3)
  })

  it('does not poll while the tab is hidden', async () => {
    vi.useFakeTimers()
    withQuery(() => useRequestGroups({ filters: {} }))
    await vi.advanceTimersByTimeAsync(0)
    expect(listGroups).toHaveBeenCalledTimes(1)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await vi.advanceTimersByTimeAsync(90_000)
    expect(listGroups).toHaveBeenCalledTimes(1)
  })

  it('exposes the empty page as no groups, not as an error', async () => {
    listGroups.mockResolvedValue({ items: [], nextCursor: null })
    const { result } = withQuery(() => useRequestGroups({ filters: {} }))
    await flushPromises()
    expect(result.groups.value).toEqual([])
    expect(result.isError.value).toBe(false)
    expect(result.isLoading.value).toBe(false)
  })
})
