// navigation.humanDecisions.spec.ts — STRICT-TDD tests for the HD3A POS
// "Decisiones pendientes" entry (ODD human-decisions-restock-inbox HD3A).
//
// Registry contract: POS child id `pos-human-decisions`, label
// `Decisiones pendientes`, icon `i-lucide-inbox`, path
// `/pos/decisiones-pendientes`, exact `['read', 'HumanDecision']`, placed
// immediately after Ventas, with no quick action.

import { describe, expect, it } from 'vitest'
import { navigationGroups, quickActions } from '../navigation.registry'
import {
  buildCanAccess,
  filterAccessibleGroups,
  toPaletteItems,
  type AccessAuthStore,
} from '../navigation.access'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'

const ENTRY_ID = 'pos-human-decisions'
const ENTRY_PATH = '/pos/decisiones-pendientes'

type UserCan = (action: AppAction, subject: AppSubject) => boolean
const canReadHumanDecision: UserCan = (a, s) => a === 'read' && s === 'HumanDecision'

function store(userCan: UserCan): AccessAuthStore {
  return { isSuperAdmin: false, userCan }
}

function posGroup(groups = navigationGroups) {
  return groups.find((g) => g.id === 'pos')
}

describe('navigation registry — POS "Decisiones pendientes" entry (HD3A)', () => {
  it('registers the exact entry immediately after Ventas', () => {
    const pos = posGroup()!
    const index = pos.children.findIndex((c) => c.id === ENTRY_ID)
    expect(index).toBe(1)
    expect(pos.children[0]!.id).toBe('pos-sales')

    const entry = pos.children[index]!
    expect(entry.label).toBe('Decisiones pendientes')
    expect(entry.icon).toBe('i-lucide-inbox')
    expect(entry.to).toBe(ENTRY_PATH)
    expect(entry.permission).toEqual(['read', 'HumanDecision'])
    expect(entry.requiresSuperAdmin).toBeUndefined()
  })

  it('exposes no quick action for the inbox path or permission', () => {
    const offenders = quickActions.filter(
      (a) => a.to === ENTRY_PATH || a.permission?.[1] === 'HumanDecision',
    )
    expect(offenders).toEqual([])
  })

  it('keeps the entry only when read:HumanDecision is granted', () => {
    const granted = filterAccessibleGroups(
      navigationGroups,
      buildCanAccess(store(canReadHumanDecision)),
    )
    const entry = posGroup(granted)!.children.find((c) => c.id === ENTRY_ID)
    expect(entry).toBeDefined()
    expect(entry!.to).toBe(ENTRY_PATH)
  })

  it.each([
    [
      'update-only',
      ((a: AppAction, s: AppSubject) => a === 'update' && s === 'HumanDecision') as UserCan,
    ],
    [
      'unrelated read',
      ((a: AppAction, s: AppSubject) => a === 'read' && s === 'NotificationConfig') as UserCan,
    ],
    ['denied', (() => false) as UserCan],
  ])('hides the entry for %s grants', (_label, userCan) => {
    const filtered = filterAccessibleGroups(navigationGroups, buildCanAccess(store(userCan)))
    expect(filtered.flatMap((g) => g.children).some((c) => c.id === ENTRY_ID)).toBe(false)
  })

  it('feeds the command palette only when read:HumanDecision is held', () => {
    const granted = toPaletteItems(
      filterAccessibleGroups(navigationGroups, buildCanAccess(store(canReadHumanDecision))),
    )
    expect(granted.some((i) => i.id === ENTRY_ID && i.to === ENTRY_PATH)).toBe(true)

    const denied = toPaletteItems(
      filterAccessibleGroups(navigationGroups, buildCanAccess(store(() => false))),
    )
    expect(denied.some((i) => i.id === ENTRY_ID)).toBe(false)
  })

  it('does not mutate the registry while filtering', () => {
    const before = posGroup()!.children.map((c) => c.id)
    filterAccessibleGroups(navigationGroups, buildCanAccess(store(() => false)))
    expect(posGroup()!.children.map((c) => c.id)).toEqual(before)
    expect(posGroup()!.children.find((c) => c.id === ENTRY_ID)!.permission).toEqual([
      'read',
      'HumanDecision',
    ])
  })
})
