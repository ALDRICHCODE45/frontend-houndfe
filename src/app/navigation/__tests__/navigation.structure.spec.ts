// navigation.structure.spec.ts — the sidebar stays scannable: 5-7 top-level
// groups, at most two levels, and every destination keeps its permission gate.

import { describe, expect, it } from 'vitest'
import { navigationGroups } from '../navigation.registry'

describe('navigation registry structure', () => {
  it('keeps 5 to 7 top-level groups', () => {
    expect(navigationGroups.length).toBeGreaterThanOrEqual(5)
    expect(navigationGroups.length).toBeLessThanOrEqual(7)
  })

  it('stays at two levels: groups hold destinations, never more groups', () => {
    for (const group of navigationGroups) {
      expect(group.children.length, group.id).toBeGreaterThan(0)
      for (const child of group.children) {
        expect(child, child.id).not.toHaveProperty('children')
        expect(child.to, child.id).toMatch(/^\//)
      }
    }
  })

  it('gates every destination by a permission or the super-admin flag', () => {
    const ungated = navigationGroups
      .flatMap((group) => group.children)
      .filter((child) => !child.permission && !child.requiresSuperAdmin)
      .map((child) => child.id)

    expect(ungated).toEqual([])
  })

  it('gives each group and destination a unique id and an icon', () => {
    const ids = navigationGroups.flatMap((group) => [group.id, ...group.children.map((c) => c.id)])

    expect(new Set(ids).size).toBe(ids.length)
    for (const group of navigationGroups) {
      expect(group.icon, group.id).toMatch(/^i-lucide-/)
      for (const child of group.children) expect(child.icon, child.id).toMatch(/^i-lucide-/)
    }
  })
})
