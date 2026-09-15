// navigation.catalogBackoffice.spec.ts — STRICT-TDD tests for the WU3A
// Sistema sidebar entry "Catálogo online" (REQ-3).
//
// The registry must carry a Sistema child gated by
// ['read', 'TenantCatalogSettings'], and the access filter must hide it
// when the permission is absent.

import { describe, expect, it } from 'vitest'
import { navigationGroups } from '../navigation.registry'
import { filterAccessibleGroups, type CanAccess } from '../navigation.access'
import type { NavGroup } from '../navigation.types'

const CATALOG_ENTRY = {
  id: 'sistema-catalog-settings',
  label: 'Catálogo online',
  to: '/system/catalog-settings',
  permission: ['read', 'TenantCatalogSettings'],
}

function findSistemaGroup(groups: NavGroup[]) {
  return groups.find((g) => g.id === 'sistema')
}

describe('navigation registry — Sistema "Catálogo online" entry (WU3A REQ-3)', () => {
  it('registers the entry inside the Sistema group', () => {
    const sistema = findSistemaGroup(navigationGroups)
    expect(sistema).toBeDefined()
    const entry = sistema!.children.find((c) => c.id === CATALOG_ENTRY.id)
    expect(entry).toBeDefined()
    expect(entry!.label).toBe(CATALOG_ENTRY.label)
    expect(entry!.to).toBe(CATALOG_ENTRY.to)
  })

  it('gates the entry with read:TenantCatalogSettings', () => {
    const sistema = findSistemaGroup(navigationGroups)
    const entry = sistema!.children.find((c) => c.id === CATALOG_ENTRY.id)
    expect(entry!.permission).toEqual(['read', 'TenantCatalogSettings'])
    expect(entry!.requiresSuperAdmin).toBeUndefined()
  })

  it('keeps the entry when read:TenantCatalogSettings is granted', () => {
    const canAccess: CanAccess = (permission) =>
      Boolean(
        permission &&
          permission[0] === 'read' &&
          permission[1] === 'TenantCatalogSettings',
      )
    const filtered = filterAccessibleGroups(navigationGroups, canAccess)
    const sistema = findSistemaGroup(filtered)
    expect(sistema!.children.some((c) => c.id === CATALOG_ENTRY.id)).toBe(true)
  })

  it('drops the entry when the permission is absent', () => {
    const canAccess: CanAccess = () => false
    const filtered = filterAccessibleGroups(navigationGroups, canAccess)
    const sistema = findSistemaGroup(filtered)
    expect(
      !sistema || !sistema.children.some((c) => c.id === CATALOG_ENTRY.id),
    ).toBe(true)
  })

  it('keeps the Sistema group alive with only accessible children', () => {
    // Only read:TenantCatalogSettings is granted: Notificaciones stays hidden
    // too (it needs its own perm), but the filter never drops extra children.
    const canAccess: CanAccess = (permission) =>
      Boolean(
        permission &&
          permission[0] === 'read' &&
          permission[1] === 'TenantCatalogSettings',
      )
    const filtered = filterAccessibleGroups(navigationGroups, canAccess)
    const sistema = findSistemaGroup(filtered)
    expect(sistema!.children.map((c) => c.id)).toEqual(['sistema-catalog-settings'])
  })
})
