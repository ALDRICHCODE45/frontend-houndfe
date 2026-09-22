import { describe, expect, it } from 'vitest'
import { navigationGroups } from '../navigation.registry'
import type { AccessAuthStore } from '../navigation.access'
import {
  DASHBOARD_NAV_ITEM,
  DASHBOARD_PATH,
  FORBIDDEN_PATH,
  resolveLandingDestinationForAuth,
} from '../navigation.landing'

function auth(userCan: AccessAuthStore['userCan'], isSuperAdmin = false): AccessAuthStore {
  return { isSuperAdmin, userCan }
}

function registrySnapshot() {
  return navigationGroups.map((group) => ({
    id: group.id,
    children: group.children.map((child) => ({ ...child })),
  }))
}

describe('resolveLandingDestinationForAuth', () => {
  it('prioritizes the exact permissioned Dashboard destination', () => {
    const store = auth((action, subject) => action === 'read' && subject === 'Analytics')

    expect(DASHBOARD_NAV_ITEM).toMatchObject({
      to: DASHBOARD_PATH,
      permission: ['read', 'Analytics'],
    })
    expect(resolveLandingDestinationForAuth(store)).toBe(DASHBOARD_PATH)
  })

  it('falls back to the first accessible ordered registry child', () => {
    const store = auth((action, subject) => action === 'read' && subject === 'Sale')
    expect(resolveLandingDestinationForAuth(store)).toBe('/pos/ventas')
  })

  it('honors the first super-admin-only registry destination', () => {
    expect(resolveLandingDestinationForAuth(auth(() => false, true))).toBe('/admin/tenants')
  })

  it('falls back to /403 when no application destination is accessible', () => {
    expect(resolveLandingDestinationForAuth(auth(() => false))).toBe(FORBIDDEN_PATH)
  })

  it('does not mutate the registry or inject Dashboard as a group child', () => {
    const before = registrySnapshot()
    resolveLandingDestinationForAuth(auth(() => true))

    expect(registrySnapshot()).toEqual(before)
    expect(navigationGroups.flatMap((group) => group.children)).not.toContainEqual(
      expect.objectContaining({ to: DASHBOARD_PATH }),
    )
  })
})
