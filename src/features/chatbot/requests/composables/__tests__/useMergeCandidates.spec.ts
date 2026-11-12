import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { withQuery } from './withQuery'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: { listMergeCandidates: vi.fn() },
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
import { useMergeCandidates } from '../useMergeCandidates'

const list = vi.mocked(chatbotRequestApi.listMergeCandidates)
const candidates = { items: [makeRow({ id: 'req-9', folio: 'S-000141', version: 4 })] }

beforeEach(() => {
  list.mockReset()
  list.mockResolvedValue(candidates)
  auth.perms = new Set(['read:ChatbotRequest', 'update:ChatbotRequest'])
  auth.tenantId = 'tenant-1'
})

describe('useMergeCandidates', () => {
  it('reads the candidates of the request under the tenant key when the picker is wanted', async () => {
    const { result, client } = withQuery(() => useMergeCandidates('req-1', { enabled: true }))
    await flushPromises()

    expect(list).toHaveBeenCalledWith('req-1', { signal: expect.anything() })
    expect(result.candidates.value).toEqual(candidates.items)
    expect(client.getQueryData(chatbotRequestKeys.mergeCandidates('tenant-1', 'req-1'))).toEqual(candidates)
  })

  it('does not ask until the picker is wanted', async () => {
    const wanted = ref(false)
    withQuery(() => useMergeCandidates('req-1', { enabled: wanted }))
    await flushPromises()
    expect(list).not.toHaveBeenCalled()
    wanted.value = true
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('never asks without update:ChatbotRequest, even when the picker is wanted', async () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    const { result } = withQuery(() => useMergeCandidates('req-1', { enabled: true }))
    await flushPromises()

    expect(list).not.toHaveBeenCalled()
    expect(result.isEnabled.value).toBe(false)
    expect(result.candidates.value).toEqual([])
  })

  it('never asks without read:ChatbotRequest, a tenant or an id', async () => {
    auth.perms = new Set(['update:ChatbotRequest'])
    withQuery(() => useMergeCandidates('req-1', { enabled: true }))
    auth.perms = new Set(['read:ChatbotRequest', 'update:ChatbotRequest'])
    auth.tenantId = ''
    withQuery(() => useMergeCandidates('req-1', { enabled: true }))
    auth.tenantId = 'tenant-1'
    withQuery(() => useMergeCandidates('  ', { enabled: true }))
    await flushPromises()
    expect(list).not.toHaveBeenCalled()
  })

  it('refetches for another request id', async () => {
    const id = ref('req-1')
    withQuery(() => useMergeCandidates(id, { enabled: true }))
    await flushPromises()
    id.value = 'req-2'
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith('req-2', { signal: expect.anything() })
  })
})
