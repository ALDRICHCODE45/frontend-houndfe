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

describe('useTemplateCost — T12: the detail carries the text first', () => {
  it('uses the detail text and never reads the settings, even with read:ChatbotSettings', async () => {
    get.mockResolvedValue({ ...settingsFixture(), templateCostText: 'Del ajuste.' })
    const { result } = withQuery(() => useTemplateCost(() => 'Cada plantilla cuesta $0.62 MXN.'))
    await flushPromises()
    expect(get).not.toHaveBeenCalled()
    expect(result.costText.value).toBe('Cada plantilla cuesta $0.62 MXN.')
    expect(result.isFromSettings.value).toBe(true)
  })

  it('an attendee without read:ChatbotSettings still gets the detail text and no call is made', async () => {
    auth.perms = new Set()
    const { result } = withQuery(() => useTemplateCost(() => 'Cuesta $0.62.'))
    await flushPromises()
    expect(get).not.toHaveBeenCalled()
    expect(result.costText.value).toBe('Cuesta $0.62.')
  })

  it.each([null, undefined, '   '])('falls back to GET /chatbot-settings when the detail text is %j', async (text) => {
    get.mockResolvedValue({ ...settingsFixture(), templateCostText: 'Del ajuste.' })
    const { result } = withQuery(() => useTemplateCost(() => text))
    await flushPromises()
    expect(get).toHaveBeenCalledTimes(1)
    expect(result.costText.value).toBe('Del ajuste.')
  })

  it('falls back to the generic line when neither the detail nor the settings have it', async () => {
    auth.perms = new Set()
    const { result } = withQuery(() => useTemplateCost(() => null))
    await flushPromises()
    expect(get).not.toHaveBeenCalled()
    expect(result.costText.value).toBe(DEFAULT_TEMPLATE_COST_TEXT)
    expect(result.isFromSettings.value).toBe(false)
  })
})
