// navigation.analytics.spec.ts — STRICT-TDD tests for the "Analítica" navigation
// group and its "Resumen de ventas" child (ODD branch-sales-summary A3d).
//
// The registry must carry exactly one top-level `analytics` group immediately
// between POS and RR.HH., with exactly one child gated by
// `['read', 'Analytics']`; the existing access filter must hide the child — and
// therefore the empty group — while still federating it into the command
// palette for authorized users. No analytics quick action may exist.
//
// Drift this suite must fail on: path, name, subject, action, group label,
// child label, group position, a second child, a new quick action, an
// accidental super-admin-only entry, or an ungated entry.

import { describe, expect, it } from 'vitest'
import { navigationGroups, quickActions } from '../navigation.registry'
import {
  buildCanAccess,
  filterAccessibleGroups,
  toPaletteItems,
  type AccessAuthStore,
  type CanAccess,
} from '../navigation.access'
import type { NavGroup } from '../navigation.types'

const GROUP_ID = 'analytics'
const CHILD_ID = 'analytics-sales-summary'
const CHILD_PATH = '/analytics/resumen-ventas'
const GROUP_LABEL = 'Analítica'
const CHILD_LABEL = 'Resumen de ventas'
const PALETTE_LABEL = 'Analítica / Resumen de ventas'

function findAnalyticsGroup(groups: NavGroup[]) {
  return groups.find((g) => g.id === GROUP_ID)
}

/** Authorized only for the exact read:Analytics grant. */
function canAccessAnalytics(): CanAccess {
  const store: AccessAuthStore = {
    isSuperAdmin: false,
    userCan: (action, subject) => action === 'read' && subject === 'Analytics',
  }
  return buildCanAccess(store)
}

/** Authorized for an unrelated subject only (cross-subject isolation). */
function canAccessUnrelated(): CanAccess {
  const store: AccessAuthStore = {
    isSuperAdmin: false,
    userCan: (action, subject) => action === 'read' && subject === 'NotificationConfig',
  }
  return buildCanAccess(store)
}

const denyAll: CanAccess = () => false

describe('navigation registry — "Analítica" group (ODD branch-sales-summary A3d)', () => {
  it('registers exactly one analytics group', () => {
    const matches = navigationGroups.filter((g) => g.id === GROUP_ID)
    expect(matches).toHaveLength(1)
  })

  it('places the group exactly between POS and RR.HH. (adjacent, unique)', () => {
    const ids = navigationGroups.map((g) => g.id)
    expect(ids.filter((id) => id === 'pos')).toHaveLength(1)
    expect(ids.filter((id) => id === GROUP_ID)).toHaveLength(1)
    expect(ids.filter((id) => id === 'rrhh')).toHaveLength(1)

    const posIndex = ids.indexOf('pos')
    const analyticsIndex = ids.indexOf(GROUP_ID)
    const rrhhIndex = ids.indexOf('rrhh')
    expect(analyticsIndex).toBe(posIndex + 1)
    expect(rrhhIndex).toBe(analyticsIndex + 1)
  })

  it('labels the group and opens it by default', () => {
    const group = findAnalyticsGroup(navigationGroups)
    expect(group).toBeDefined()
    expect(group!.label).toBe(GROUP_LABEL)
    expect(group!.defaultOpen).toBe(true)
    expect(group!.icon).toMatch(/^i-lucide-/)
  })

  it('registers exactly one child total, at the exact path', () => {
    const group = findAnalyticsGroup(navigationGroups)
    expect(group!.children).toHaveLength(1)
    const child = group!.children[0]!
    expect(child.id).toBe(CHILD_ID)
    expect(child.label).toBe(CHILD_LABEL)
    expect(child.to).toBe(CHILD_PATH)
    expect(child.icon).toMatch(/^i-lucide-/)
  })

  it('registers no analytics quick action (id, path or permission)', () => {
    const offenders = quickActions.filter(
      (action) =>
        action.id === CHILD_ID ||
        action.to.startsWith('/analytics') ||
        action.permission?.[1] === 'Analytics',
    )
    expect(offenders).toEqual([])
  })

  it('gates the child with the exact read:Analytics permission', () => {
    const group = findAnalyticsGroup(navigationGroups)
    const child = group!.children.find((c) => c.id === CHILD_ID)
    expect(child!.permission).toEqual(['read', 'Analytics'])
  })

  it('is never an ungated or super-admin-only entry', () => {
    const group = findAnalyticsGroup(navigationGroups)
    const child = group!.children.find((c) => c.id === CHILD_ID)
    expect(child!.permission).toBeDefined()
    expect(child!.requiresSuperAdmin).toBeUndefined()
  })

  it('exposes the child to filterAccessibleGroups only with read:Analytics', () => {
    const filtered = filterAccessibleGroups(navigationGroups, canAccessAnalytics())
    const group = findAnalyticsGroup(filtered)
    expect(group).toBeDefined()
    expect(group!.children.map((c) => c.id)).toContain(CHILD_ID)
  })

  it('drops the empty analytics group for denied users', () => {
    const filtered = filterAccessibleGroups(navigationGroups, denyAll)
    expect(findAnalyticsGroup(filtered)).toBeUndefined()
  })

  it('drops the empty analytics group for unrelated grants', () => {
    const filtered = filterAccessibleGroups(navigationGroups, canAccessUnrelated())
    expect(findAnalyticsGroup(filtered)).toBeUndefined()
  })

  it('does not mutate the source registry while filtering', () => {
    filterAccessibleGroups(navigationGroups, denyAll)
    const group = findAnalyticsGroup(navigationGroups)
    const child = group!.children.find((c) => c.id === CHILD_ID)
    expect(child!.permission).toEqual(['read', 'Analytics'])
    expect(group!.children).toHaveLength(1)
  })
})

describe('toPaletteItems — "Analítica / Resumen de ventas" (ODD branch-sales-summary A3d)', () => {
  it('includes the child with exact id, label and target for authorized users', () => {
    const items = toPaletteItems(filterAccessibleGroups(navigationGroups, canAccessAnalytics()))
    const item = items.find((i) => i.id === CHILD_ID)
    expect(item).toBeDefined()
    expect(item!.id).toBe(CHILD_ID)
    expect(item!.label).toBe(PALETTE_LABEL)
    expect(item!.to).toBe(CHILD_PATH)
  })

  it('excludes the child for denied users', () => {
    const items = toPaletteItems(filterAccessibleGroups(navigationGroups, denyAll))
    expect(items.map((i) => i.label)).not.toContain(PALETTE_LABEL)
  })

  it('excludes the child for unrelated grants', () => {
    const items = toPaletteItems(filterAccessibleGroups(navigationGroups, canAccessUnrelated()))
    expect(items.map((i) => i.label)).not.toContain(PALETTE_LABEL)
  })
})
