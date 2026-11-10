import { afterEach, describe, expect, it } from 'vitest'
import { ability, resetAbility, updateAbilityFromPermissionCodes } from '../ability'
import type { AppAction, AppSubject } from '../../interfaces/auth.types'

afterEach(resetAbility)

// ODD chatbot-requests-inbox T1 (S1): the backend codes from
// houndfe-backend docs/chatbot-requests-permissions.md, verbatim.
const CHATBOT_CODES: Array<[AppAction, AppSubject]> = [
  ['read', 'ChatbotRequest'],
  ['update', 'ChatbotRequest'],
  ['update', 'ChatbotRequestAssignment'],
  ['read', 'ChatbotConversation'],
  ['read', 'ChatbotEscalation'],
  ['read', 'CustomerPhone'],
  ['read', 'ChatbotSettings'],
  ['update', 'ChatbotSettings'],
  ['update', 'ChatbotSettingsAllBranches'],
]

const CHATBOT_SUBJECTS = Array.from(new Set(CHATBOT_CODES.map(([, subject]) => subject)))

describe('chatbot request permission registration (ODD chatbot-requests-inbox T1)', () => {
  it.each(CHATBOT_CODES)('keeps %s:%s and grants only that rule', (action, subject) => {
    updateAbilityFromPermissionCodes([`${action}:${subject}`])
    expect(ability.can(action, subject)).toBe(true)
    expect(ability.rules).toEqual([{ action, subject }])
  })

  it('grants no other verb on the chatbot subjects, manage included', () => {
    updateAbilityFromPermissionCodes(CHATBOT_CODES.map(([action, subject]) => `${action}:${subject}`))
    expect(ability.rules).toHaveLength(CHATBOT_CODES.length)
    CHATBOT_SUBJECTS.forEach((subject) => {
      for (const action of ['create', 'delete', 'batch_delete', 'validate', 'manage'] as const) {
        expect(ability.can(action, subject)).toBe(false)
      }
    })
    expect(ability.can('update', 'ChatbotConversation')).toBe(false)
    expect(ability.can('update', 'CustomerPhone')).toBe(false)
    expect(ability.can('read', 'ChatbotRequestAssignment')).toBe(false)
    expect(ability.can('read', 'ChatbotSettingsAllBranches')).toBe(false)
  })

  it('does not derive the chatbot grants from HumanDecision, Customer or ShippingSettings', () => {
    updateAbilityFromPermissionCodes([
      'read:HumanDecision',
      'update:HumanDecision',
      'read:Customer',
      'update:ShippingSettings',
    ])
    CHATBOT_CODES.forEach(([action, subject]) => {
      expect(ability.can(action, subject)).toBe(false)
    })
  })

  it('only the super admin wildcard implies them', () => {
    updateAbilityFromPermissionCodes(['manage:all'])
    CHATBOT_CODES.forEach(([action, subject]) => {
      expect(ability.can(action, subject)).toBe(true)
    })
  })

  it('keeps well-formed chatbot grants beside malformed siblings', () => {
    updateAbilityFromPermissionCodes([
      'read:ChatbotRequest',
      'read:ChatbotRequest:extra',
      'claim:ChatbotRequest',
      'read:ChatbotRequests',
    ])
    expect(ability.rules).toEqual([{ action: 'read', subject: 'ChatbotRequest' }])
  })
})

describe('ReceiptEvidence permission registration (ODD chatbot-requests-inbox T1)', () => {
  it.each(['read', 'update', 'manage'] as const)('keeps %s:ReceiptEvidence', (action) => {
    updateAbilityFromPermissionCodes([`${action}:ReceiptEvidence`])
    expect(ability.can(action, 'ReceiptEvidence')).toBe(true)
  })

  it('does not widen read:ReceiptEvidence into update', () => {
    updateAbilityFromPermissionCodes(['read:ReceiptEvidence'])
    expect(ability.can('update', 'ReceiptEvidence')).toBe(false)
  })
})
