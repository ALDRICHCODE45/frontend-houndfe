import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { axiosError, withQuery } from './withQuery'
import { settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'
import { chatbotSettingsKeys } from '../../constants/queryKeys'

vi.mock('../../api/chatbotSettings.api', () => ({ chatbotSettingsApi: { get: vi.fn() } }))

const auth = vi.hoisted(() => ({ canRead: true, tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) =>
      auth.canRead && action === 'read' && subject === 'ChatbotSettings',
  }),
}))

import { chatbotSettingsApi } from '../../api/chatbotSettings.api'
import { useChatbotSettingsQuery } from '../useChatbotSettingsQuery'

const get = vi.mocked(chatbotSettingsApi.get)

beforeEach(() => {
  get.mockReset()
  auth.canRead = true
  auth.tenantId = 'tenant-1'
  get.mockResolvedValue(settingsFixture())
})

describe('useChatbotSettingsQuery', () => {
  it('reads the settings under the tenant key', async () => {
    const { result, client } = withQuery(() => useChatbotSettingsQuery())
    await flushPromises()

    expect(get).toHaveBeenCalledWith({ signal: expect.anything() })
    expect(result.settings.value).toEqual(settingsFixture())
    expect(client.getQueryData(chatbotSettingsKeys.detail('tenant-1'))).toEqual(settingsFixture())
  })

  it('does not fire without read:ChatbotSettings or without a tenant', async () => {
    auth.canRead = false
    const first = withQuery(() => useChatbotSettingsQuery())
    await flushPromises()
    expect(get).not.toHaveBeenCalled()
    expect(first.result.settings.value).toBeUndefined()

    auth.canRead = true
    auth.tenantId = ''
    withQuery(() => useChatbotSettingsQuery())
    await flushPromises()
    expect(get).not.toHaveBeenCalled()
  })

  it('exposes a load error without retrying', async () => {
    get.mockRejectedValue(axiosError(500))
    const { result } = withQuery(() => useChatbotSettingsQuery())
    await flushPromises()

    expect(result.isError.value).toBe(true)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('answers the version 0 defaults as a normal body', async () => {
    get.mockResolvedValue(settingsFixture({ version: 0 }))
    const { result } = withQuery(() => useChatbotSettingsQuery())
    await flushPromises()

    expect(result.settings.value?.version).toBe(0)
  })
})
