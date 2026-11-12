import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { withQuery } from './withQuery'

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: { listAssignableUsers: vi.fn() },
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
import { useAssignableUsers } from '../useAssignableUsers'

const list = vi.mocked(chatbotRequestApi.listAssignableUsers)
const people = { items: [{ id: 'u-2', displayName: 'Luis Ortega' }] }

beforeEach(() => {
  list.mockReset()
  list.mockResolvedValue(people)
  auth.perms = new Set(['read:ChatbotRequest', 'update:ChatbotRequestAssignment'])
  auth.tenantId = 'tenant-1'
})

describe('useAssignableUsers', () => {
  it('reads the assignable people under the tenant key when the picker is wanted', async () => {
    const { result, client } = withQuery(() => useAssignableUsers({ enabled: true }))
    await flushPromises()

    expect(list).toHaveBeenCalledWith({ signal: expect.anything() })
    expect(result.users.value).toEqual(people.items)
    expect(client.getQueryData(chatbotRequestKeys.assignableUsers('tenant-1'))).toEqual(people)
  })

  it('does not ask until the picker is wanted, then asks once', async () => {
    const wanted = ref(false)
    withQuery(() => useAssignableUsers({ enabled: wanted }))
    await flushPromises()
    expect(list).not.toHaveBeenCalled()

    wanted.value = true
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('never asks without update:ChatbotRequestAssignment, even when the picker is wanted', async () => {
    auth.perms = new Set(['read:ChatbotRequest', 'update:ChatbotRequest'])
    const { result } = withQuery(() => useAssignableUsers({ enabled: true }))
    await flushPromises()

    expect(list).not.toHaveBeenCalled()
    expect(result.isEnabled.value).toBe(false)
    expect(result.users.value).toEqual([])
  })

  it('never asks without a tenant or without read:ChatbotRequest', async () => {
    auth.tenantId = ''
    withQuery(() => useAssignableUsers({ enabled: true }))
    auth.tenantId = 'tenant-1'
    auth.perms = new Set(['update:ChatbotRequestAssignment'])
    withQuery(() => useAssignableUsers({ enabled: true }))
    await flushPromises()
    expect(list).not.toHaveBeenCalled()
  })

  it('exposes a failed read as an error, not as an empty list', async () => {
    list.mockRejectedValue(new Error('Network Error'))
    const { result } = withQuery(() => useAssignableUsers({ enabled: true }))
    await flushPromises()
    expect(result.isError.value).toBe(true)
  })
})
