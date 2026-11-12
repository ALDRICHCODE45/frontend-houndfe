import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { axiosError, defaultsClient, withQuery } from './withQuery'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import { chatbotRequestKeys } from '../../constants/queryKeys'

vi.mock('../../api/chatbot-request.api', () => ({ chatbotRequestApi: { listByCustomer: vi.fn() } }))

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
import { useCustomerRequests } from '../useCustomerRequests'

const listByCustomer = vi.mocked(chatbotRequestApi.listByCustomer)

beforeEach(() => {
  listByCustomer.mockReset()
  auth.canRead = true
  auth.tenantId = 'tenant-1'
  listByCustomer.mockResolvedValue({ items: [makeRow({ id: 'a' })], nextCursor: null })
})
afterEach(() => vi.useRealTimers())

describe('useCustomerRequests («Ver las N restantes»)', () => {
  it('reads the customer rows by the opaque token under its own key', async () => {
    const { result, client } = withQuery(() =>
      useCustomerRequests({ customerKey: 'k1.a', status: 'open' }),
    )
    await flushPromises()

    expect(listByCustomer.mock.calls[0]![0]).toEqual({ customerKey: 'k1.a', status: 'open', limit: 25 })
    expect(result.requests.value.map((r) => r.id)).toEqual(['a'])
    expect(
      client.getQueryData(chatbotRequestKeys.byCustomer('tenant-1', 'k1.a', { status: 'open', limit: 25 })),
    ).toBeDefined()
  })

  it('passes the list filters, so the rest of the group respects them', async () => {
    const filters = ref({ assignee: 'unassigned', subtype: 'COMPLAINT' as const, q: 'rosa' })
    const { client } = withQuery(() =>
      useCustomerRequests({ customerKey: 'k1.a', status: 'open', filters }),
    )
    await flushPromises()

    expect(listByCustomer.mock.calls[0]![0]).toEqual({
      customerKey: 'k1.a',
      status: 'open',
      assignee: 'unassigned',
      subtype: 'COMPLAINT',
      q: 'rosa',
      limit: 25,
    })
    expect(
      client.getQueryData(
        chatbotRequestKeys.byCustomer('tenant-1', 'k1.a', {
          status: 'open',
          assignee: 'unassigned',
          subtype: 'COMPLAINT',
          q: 'rosa',
          limit: 25,
        }),
      ),
    ).toBeDefined()
  })

  it('a filter change reads again with the new filters (and the same token)', async () => {
    const filters = ref<{ overdue?: boolean }>({})
    withQuery(() => useCustomerRequests({ customerKey: 'k1.a', filters }))
    await flushPromises()
    filters.value = { overdue: true }
    await flushPromises()

    expect(listByCustomer).toHaveBeenCalledTimes(2)
    expect(listByCustomer.mock.calls[1]![0]).toMatchObject({ customerKey: 'k1.a', overdue: true })
    expect(listByCustomer.mock.calls[0]![0]).not.toHaveProperty('overdue')
  })

  it('accumulates pages by cursor', async () => {
    listByCustomer
      .mockResolvedValueOnce({ items: [makeRow({ id: 'a' })], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [makeRow({ id: 'b' })], nextCursor: null })
    const { result } = withQuery(() => useCustomerRequests({ customerKey: 'k1.a' }))
    await flushPromises()
    await result.fetchNextPage()
    await flushPromises()

    expect(listByCustomer.mock.calls[1]![0]).toMatchObject({ customerKey: 'k1.a', cursor: 'c2' })
    expect(result.requests.value.map((r) => r.id)).toEqual(['a', 'b'])
    expect(result.hasNextPage.value).toBe(false)
  })

  it('waits for a customerKey (a ref may be empty) and for read:ChatbotRequest', async () => {
    const key = ref<string | null>(null)
    const { result } = withQuery(() => useCustomerRequests({ customerKey: key }))
    await flushPromises()
    expect(listByCustomer).not.toHaveBeenCalled()

    key.value = 'k1.a'
    await flushPromises()
    expect(listByCustomer).toHaveBeenCalledTimes(1)
    expect(result.isEnabled.value).toBe(true)
  })

  it('does not fire without permission', async () => {
    auth.canRead = false
    withQuery(() => useCustomerRequests({ customerKey: 'k1.a' }))
    await flushPromises()
    expect(listByCustomer).not.toHaveBeenCalled()
  })

  it('a stale customerKey (400) is a «reload» state and is never retried', async () => {
    listByCustomer.mockRejectedValue(axiosError(400, { code: 'VALIDATION_ERROR' }))
    const { result } = withQuery(() => useCustomerRequests({ customerKey: 'k1.old' }), defaultsClient())
    await flushPromises()

    expect(listByCustomer).toHaveBeenCalledTimes(1)
    expect(result.needsReload.value).toBe(true)
    expect(result.isError.value).toBe(true)
  })

  it('any other failure is an error, not a reload', async () => {
    listByCustomer.mockRejectedValue(axiosError(500))
    const { result } = withQuery(() => useCustomerRequests({ customerKey: 'k1.a' }), defaultsClient())
    await flushPromises()
    expect(listByCustomer).toHaveBeenCalledTimes(1)
    expect(result.needsReload.value).toBe(false)
    expect(result.isError.value).toBe(true)
  })
})
