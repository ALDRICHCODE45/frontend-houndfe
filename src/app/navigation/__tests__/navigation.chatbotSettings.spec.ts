// «Atención del chatbot» sits in the Sistema group, gated by read:ChatbotSettings (T5.S).

import { describe, expect, it } from 'vitest'
import { navigationGroups, quickActions } from '../navigation.registry'
import { buildCanAccess, filterAccessibleGroups } from '../navigation.access'

const sistema = () => navigationGroups.find((group) => group.id === 'sistema')!

function visibleIds(granted: [string, string][]) {
  const canAccess = buildCanAccess({
    isSuperAdmin: false,
    userCan: (action, subject) => granted.some(([a, s]) => a === action && s === subject),
  })
  return filterAccessibleGroups(navigationGroups, canAccess).flatMap((group) =>
    group.children.map((child) => child.id),
  )
}

describe('navigation registry — Atención del chatbot', () => {
  it('adds the entry to Sistema with its path and permission', () => {
    expect(sistema().children.find((child) => child.id === 'sistema-chatbot-settings')).toEqual({
      id: 'sistema-chatbot-settings',
      label: 'Atención del chatbot',
      icon: 'i-lucide-bot',
      to: '/sistema/atencion-chatbot',
      permission: ['read', 'ChatbotSettings'],
    })
  })

  it('shows it only with read:ChatbotSettings', () => {
    expect(visibleIds([['read', 'ChatbotSettings']])).toEqual(['sistema-chatbot-settings'])
    expect(visibleIds([['update', 'ChatbotSettings']])).toEqual([])
    expect(visibleIds([['read', 'ChatbotRequest']])).not.toContain('sistema-chatbot-settings')
    expect(visibleIds([])).toEqual([])
  })

  it('adds no quick action', () => {
    expect(quickActions.some((action) => action.to.startsWith('/sistema/atencion-chatbot'))).toBe(false)
  })
})
