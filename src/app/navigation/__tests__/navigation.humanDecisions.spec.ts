// Chatbot → Solicitudes points at the request inbox (read:ChatbotRequest). The old human-decisions
// route keeps working but has no nav entry until the BE backfill (handoff 12 §5).

import { describe, expect, it } from 'vitest'
import { navigationGroups, quickActions } from '../navigation.registry'
import { resolveLandingDestination } from '../navigation.landing'
import {
  buildCanAccess,
  filterAccessibleGroups,
  toPaletteItems,
  type AccessAuthStore,
} from '../navigation.access'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'

const ENTRY_ID = 'chatbot-requests'
const ENTRY_PATH = '/chatbot/solicitudes'
const OLD_ENTRY_ID = 'pos-human-decisions'
const OLD_PATH = '/pos/decisiones-pendientes'

type UserCan = (action: AppAction, subject: AppSubject) => boolean
const canReadChatbotRequest: UserCan = (a, s) => a === 'read' && s === 'ChatbotRequest'

function store(userCan: UserCan): AccessAuthStore {
  return { isSuperAdmin: false, userCan }
}

function chatbotGroup(groups = navigationGroups) {
  return groups.find((g) => g.id === 'chatbot')
}

describe('navigation registry — Chatbot / Solicitudes', () => {
  it('registers a single request entry in Chatbot immediately after POS', () => {
    const index = navigationGroups.findIndex((g) => g.id === 'pos')
    const chatbot = navigationGroups[index + 1]!
    expect(chatbot).toMatchObject({ id: 'chatbot', label: 'Chatbot', icon: 'i-lucide-bot' })
    expect(chatbot.children).toHaveLength(1)
    expect(navigationGroups[index]!.children.some((c) => c.id === ENTRY_ID)).toBe(false)
    expect(
      navigationGroups.flatMap((g) => g.children).filter((c) => c.id === ENTRY_ID),
    ).toHaveLength(1)

    const entry = chatbot.children[0]!
    expect(entry.id).toBe(ENTRY_ID)
    expect(entry.label).toBe('Solicitudes')
    expect(entry.icon).toBe('i-lucide-inbox')
    expect(entry.to).toBe(ENTRY_PATH)
    expect(entry.permission).toEqual(['read', 'ChatbotRequest'])
    expect(entry.requiresSuperAdmin).toBeUndefined()
  })

  it('exposes no quick action for the inbox path or permission', () => {
    const offenders = quickActions.filter(
      (a) =>
        a.to === ENTRY_PATH ||
        a.to === OLD_PATH ||
        a.permission?.[1] === 'ChatbotRequest' ||
        a.permission?.[1] === 'HumanDecision',
    )
    expect(offenders).toEqual([])
  })

  it('keeps the entry only when read:ChatbotRequest is granted', () => {
    const granted = filterAccessibleGroups(
      navigationGroups,
      buildCanAccess(store(canReadChatbotRequest)),
    )
    expect(granted.map((g) => g.label)).toEqual(['Chatbot'])
    const entry = chatbotGroup(granted)!.children.find((c) => c.id === ENTRY_ID)
    expect(entry).toBeDefined()
    expect(entry!.to).toBe(ENTRY_PATH)
    expect(resolveLandingDestination(buildCanAccess(store(canReadChatbotRequest)))).toBe(ENTRY_PATH)
  })

  it.each([
    [
      'update-only',
      ((a: AppAction, s: AppSubject) => a === 'update' && s === 'ChatbotRequest') as UserCan,
    ],
    [
      'the old read:HumanDecision permission',
      ((a: AppAction, s: AppSubject) => a === 'read' && s === 'HumanDecision') as UserCan,
    ],
    [
      'unrelated read',
      ((a: AppAction, s: AppSubject) => a === 'read' && s === 'NotificationConfig') as UserCan,
    ],
    ['denied', (() => false) as UserCan],
  ])('hides the entry for %s grants', (_label, userCan) => {
    const filtered = filterAccessibleGroups(navigationGroups, buildCanAccess(store(userCan)))
    expect(filtered.flatMap((g) => g.children).some((c) => c.id === ENTRY_ID)).toBe(false)
    expect(chatbotGroup(filtered)).toBeUndefined()
  })

  it('feeds the command palette only when read:ChatbotRequest is held', () => {
    const granted = toPaletteItems(
      filterAccessibleGroups(navigationGroups, buildCanAccess(store(canReadChatbotRequest))),
    )
    expect(granted).toEqual([
      { id: ENTRY_ID, label: 'Chatbot / Solicitudes', icon: 'i-lucide-inbox', to: ENTRY_PATH },
    ])

    const denied = toPaletteItems(
      filterAccessibleGroups(navigationGroups, buildCanAccess(store(() => false))),
    )
    expect(denied.some((i) => i.id === ENTRY_ID)).toBe(false)
  })

  it('does not mutate the registry while filtering', () => {
    const before = chatbotGroup()!.children.map((c) => c.id)
    filterAccessibleGroups(navigationGroups, buildCanAccess(store(() => false)))
    expect(chatbotGroup()!.children.map((c) => c.id)).toEqual(before)
    expect(chatbotGroup()!.children.find((c) => c.id === ENTRY_ID)!.permission).toEqual([
      'read',
      'ChatbotRequest',
    ])
  })

  it('leaves no nav entry for the old human-decisions route (the route itself keeps working)', () => {
    const all = navigationGroups.flatMap((g) => g.children)
    expect(all.some((c) => c.id === OLD_ENTRY_ID || c.to === OLD_PATH)).toBe(false)
  })
})
