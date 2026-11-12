import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { withQuery } from './withQuery'

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: { getZoneImpact: vi.fn() },
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
import { chatbotRequestKeys } from '../../constants/queryKeys'
import { useZoneImpact } from '../useZoneImpact'

const getImpact = vi.mocked(chatbotRequestApi.getZoneImpact)

beforeEach(() => {
  getImpact.mockReset()
  getImpact.mockResolvedValue({ requests: 4, customers: 3, setVersion: 7 })
  auth.perms = new Set(['read:ChatbotRequest'])
  auth.tenantId = 'tenant-1'
})

describe('useZoneImpact', () => {
  it('reads the impact of the request when the zone form is open', async () => {
    const { result, client } = withQuery(() => useZoneImpact('req-1', { enabled: true }))
    await flushPromises()

    expect(getImpact).toHaveBeenCalledWith('req-1', { signal: expect.anything() })
    expect(result.impact.value).toEqual({ requests: 4, customers: 3, setVersion: 7 })
    expect(client.getQueryData(chatbotRequestKeys.zoneImpact('tenant-1', 'req-1'))).toEqual({
      requests: 4,
      customers: 3,
      setVersion: 7,
    })
  })

  it('does not ask until the form is open', async () => {
    const open = ref(false)
    withQuery(() => useZoneImpact('req-1', { enabled: open }))
    await flushPromises()
    expect(getImpact).not.toHaveBeenCalled()
    open.value = true
    await flushPromises()
    expect(getImpact).toHaveBeenCalledTimes(1)
  })

  it('does not ask without read:ChatbotRequest, a tenant or an id', async () => {
    auth.perms = new Set()
    withQuery(() => useZoneImpact('req-1', { enabled: true }))
    auth.perms = new Set(['read:ChatbotRequest'])
    auth.tenantId = ''
    withQuery(() => useZoneImpact('req-1', { enabled: true }))
    auth.tenantId = 'tenant-1'
    withQuery(() => useZoneImpact('', { enabled: true }))
    await flushPromises()
    expect(getImpact).not.toHaveBeenCalled()
  })

  it('is a failed read, not an impact of zero, when the request errors', async () => {
    getImpact.mockRejectedValue(new Error('Network Error'))
    const { result } = withQuery(() => useZoneImpact('req-1', { enabled: true }))
    await flushPromises()
    expect(result.impact.value).toBeNull()
    expect(result.isError.value).toBe(true)
  })
})
