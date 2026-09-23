// navigation.analytics.spec.ts — D1 contract: the Analítica group is gone,
// the Dashboard nav item is the single shared definition gated by
// exact read:Analytics, and no quick action or registry child may resolve
// to /dashboard or any /analytics path.
//
// Drift this suite must fail on: a return of the analytics group, an absent
// Dashboard item, a wrong subject/action, an exposed path target, an
// accidental super-admin gate, or registry mutation through the filter.

import { describe, expect, it } from 'vitest'
import { navigationGroups, quickActions } from '../navigation.registry'
import {
  buildCanAccess,
  filterAccessibleGroups,
  toPaletteItems,
  type AccessAuthStore,
} from '../navigation.access'
import { DASHBOARD_NAV_ITEM, DASHBOARD_PATH, DASHBOARD_PERMISSION } from '../navigation.landing'

const DASHBOARD_ID = 'dashboard'
const DASHBOARD_LABEL = 'Dashboard'

function store(granted: 'analytics' | 'unrelated' | 'none'): AccessAuthStore {
  if (granted === 'none') return { isSuperAdmin: false, userCan: () => false }
  if (granted === 'unrelated') {
    return { isSuperAdmin: false, userCan: (a, s) => a === 'read' && s === 'NotificationConfig' }
  }
  return { isSuperAdmin: false, userCan: (a, s) => a === 'read' && s === 'Analytics' }
}

describe('navigation registry — Dashboard contract (ODD dashboard-analytics D1)', () => {
  it('has no "Analítica" / "analytics" group and no /analytics path in the registry', () => {
    const offenders = navigationGroups.filter(
      (g) => g.id === 'analytics' || g.label === 'Analítica',
    )
    expect(offenders).toEqual([])
    const analyticsPaths = navigationGroups.flatMap((g) =>
      g.children.filter((c) => c.to.startsWith('/analytics')),
    )
    expect(analyticsPaths).toEqual([])
  })

  it('exports the shared Dashboard nav item with exact id, label, icon and target', () => {
    expect(DASHBOARD_NAV_ITEM.id).toBe(DASHBOARD_ID)
    expect(DASHBOARD_NAV_ITEM.label).toBe(DASHBOARD_LABEL)
    expect(DASHBOARD_NAV_ITEM.to).toBe(DASHBOARD_PATH)
    expect(DASHBOARD_NAV_ITEM.icon).toMatch(/^i-lucide-/)
  })

  it('gates the Dashboard item with exact read:Analytics and is not super-admin-only', () => {
    expect(DASHBOARD_NAV_ITEM.permission).toEqual(['read', 'Analytics'])
    expect(DASHBOARD_NAV_ITEM.permission).toEqual(DASHBOARD_PERMISSION)
    expect(DASHBOARD_NAV_ITEM.requiresSuperAdmin).toBeUndefined()
  })

  it('registers no analytics quick action (id, path or permission)', () => {
    const offenders = quickActions.filter(
      (a) =>
        a.id === DASHBOARD_ID || a.to.startsWith('/analytics') || a.permission?.[1] === 'Analytics',
    )
    expect(offenders).toEqual([])
  })
})

describe('registry and palette — Dashboard is shared, not registry-fed (ODD dashboard-analytics D1)', () => {
  it.each([
    {
      granted: 'analytics' as const,
      label: 'authorized users see no Dashboard child through the registry',
    },
    { granted: 'unrelated' as const, label: 'unrelated grants do not surface a Dashboard child' },
    { granted: 'none' as const, label: 'denied users do not surface a Dashboard child' },
  ])('$label', ({ granted }) => {
    const canAccess = buildCanAccess(store(granted))
    const items = filterAccessibleGroups(navigationGroups, canAccess).flatMap((g) => g.children)
    expect(items.some((c) => c.to === DASHBOARD_PATH)).toBe(false)
  })

  it('palette items never expose /analytics or /dashboard from the registry alone', () => {
    const items = toPaletteItems(
      filterAccessibleGroups(navigationGroups, buildCanAccess(store('analytics'))),
    )
    expect(
      items.some(
        (i) => (typeof i.to === 'string' && i.to.startsWith('/analytics')) || i.id === DASHBOARD_ID,
      ),
    ).toBe(false)
  })

  it('does not mutate the registry while filtering', () => {
    const before = navigationGroups.map((g) => g.id)
    filterAccessibleGroups(navigationGroups, buildCanAccess(store('none')))
    expect(navigationGroups.map((g) => g.id)).toEqual(before)
  })
})
