import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { withQuery } from './withQuery'
import { settingsFixture } from '@/features/system/chatbot-settings/interfaces/__tests__/chatbot-settings.fixture'

vi.mock('@/features/system/chatbot-settings/api/chatbotSettings.api', () => ({
  chatbotSettingsApi: { get: vi.fn() },
}))
const auth = vi.hoisted(() => ({ perms: new Set<string>() }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: (action: string, subject: string) => auth.perms.has(`${action}:${subject}`),
  }),
}))

import { chatbotSettingsApi } from '@/features/system/chatbot-settings/api/chatbotSettings.api'
import { DEFAULT_TEMPLATE_COST_TEXT, useTemplateCost } from '../useTemplateCost'

const get = vi.mocked(chatbotSettingsApi.get)

beforeEach(() => {
  get.mockReset()
  auth.perms = new Set(['read:ChatbotSettings'])
})

describe('useTemplateCost — templateCostText comes from GET /chatbot-settings', () => {
  it('shows the branch text as is', async () => {
    get.mockResolvedValue({ ...settingsFixture(), templateCostText: 'Cada plantilla cuesta $0.62 MXN.' })
    const { result } = withQuery(() => useTemplateCost())
    await flushPromises()
    expect(result.costText.value).toBe('Cada plantilla cuesta $0.62 MXN.')
    expect(result.isFromSettings.value).toBe(true)
  })

  it('falls back to a generic cost warning while loading and for a role that cannot read the settings', async () => {
    auth.perms = new Set()
    const { result } = withQuery(() => useTemplateCost())
    await flushPromises()
    expect(get).not.toHaveBeenCalled()
    expect(result.costText.value).toBe(DEFAULT_TEMPLATE_COST_TEXT)
    expect(result.isFromSettings.value).toBe(false)
  })

  it('falls back when the read fails', async () => {
    get.mockRejectedValue(new Error('boom'))
    const { result } = withQuery(() => useTemplateCost())
    await flushPromises()
    expect(result.costText.value).toBe(DEFAULT_TEMPLATE_COST_TEXT)
  })
})
