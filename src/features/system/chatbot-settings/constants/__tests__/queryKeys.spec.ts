import { describe, expect, it } from 'vitest'
import { chatbotSettingsKeys } from '../queryKeys'

describe('chatbotSettingsKeys', () => {
  it('scopes the settings by tenant so a branch switch never reuses another branch', () => {
    expect(chatbotSettingsKeys.detail('t1')).toEqual(['chatbot-settings', 't1', 'detail'])
    expect(chatbotSettingsKeys.detail('t1')).not.toEqual(chatbotSettingsKeys.detail('t2'))
  })

  it('all(tenant) is a prefix of detail(tenant)', () => {
    expect(chatbotSettingsKeys.all('t1')).toEqual(['chatbot-settings', 't1'])
    expect(chatbotSettingsKeys.detail('t1').slice(0, 2)).toEqual(chatbotSettingsKeys.all('t1'))
  })
})
