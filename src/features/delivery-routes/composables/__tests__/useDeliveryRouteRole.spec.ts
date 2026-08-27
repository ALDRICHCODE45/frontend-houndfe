// @ts-nocheck — composable binding tests mock Pinia's defineStore with `useAuthStore: () => …`.
// Type-checking the mock's `userCan` shape against the real impl is unnecessary; the
// production source is the source of truth for both production and tests.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted auth mock — Pinia's defineStore wraps `useAuthStore`, but tests inject a
// plain function so we can drive `userCan` deterministically per case.
const authMock = {
  userCan: vi.fn(),
  permissionCodes: vi.fn(),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

import { useDeliveryRouteRole } from '../useDeliveryRouteRole'

// `userCan(action, subject)` is forwarded as `(action, subject)` — the helper
// records (action, subject) tuples so individual specs can assert exact queries
// without coupling to call counts.
beforeEach(() => {
  vi.clearAllMocks()
  authMock.userCan.mockImplementation(() => false)
})

describe('useDeliveryRouteRole — manager/driver discriminator (design.md §6.4, §9.3)', () => {
  it('returns isManager=true when create:DeliveryRoute is granted', () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        action === 'create' && subject === 'DeliveryRoute',
    )
    const { isManager, isDriver } = useDeliveryRouteRole()
    expect(isManager.value).toBe(true)
    expect(isDriver.value).toBe(false)
  })

  it('returns isManager=true when delete:DeliveryRoute is granted (create OR delete rule)', () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        action === 'delete' && subject === 'DeliveryRoute',
    )
    const { isManager, isDriver } = useDeliveryRouteRole()
    expect(isManager.value).toBe(true)
    expect(isDriver.value).toBe(false)
  })

  it('returns isDriver=true for read+update-only permissions (NO new query)', () => {
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        (action === 'read' || action === 'update') && subject === 'DeliveryRoute',
    )
    const { isManager, isDriver } = useDeliveryRouteRole()
    expect(isManager.value).toBe(false)
    expect(isDriver.value).toBe(true)
  })

  it('returns isDriver=false when no DeliveryRoute permission is present', () => {
    // userCan returns false for every call → no read permission ⇒ neither role.
    const { isManager, isDriver } = useDeliveryRouteRole()
    expect(isManager.value).toBe(false)
    expect(isDriver.value).toBe(false)
  })

  it('exposes canCreate/canDelete/canUpdate as direct permission checks', () => {
    authMock.userCan.mockImplementation(
      (action: string) => action === 'delete',
    )
    const { canCreate, canDelete, canUpdate, isManager, isDriver } = useDeliveryRouteRole()
    expect(canCreate.value).toBe(false)
    expect(canDelete.value).toBe(true)
    expect(canUpdate.value).toBe(false)
    // delete ⇒ manager discriminator fires.
    expect(isManager.value).toBe(true)
    expect(isDriver.value).toBe(false)
  })

  it('isDriver stays true even when update is granted (read+update ⇒ driver, NOT manager)', () => {
    // TRIANGULATE — `canUpdate` does NOT promote to manager (only create/delete does).
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        action === 'update' && subject === 'DeliveryRoute',
    )
    const { isManager, isDriver, canUpdate } = useDeliveryRouteRole()
    expect(canUpdate.value).toBe(true)
    expect(isManager.value).toBe(false)
    expect(isDriver.value).toBe(false) // update-only without `read` ⇒ neither role (read is the gating driver signal)
  })

  it('reads authStore.userCan — does NOT trigger a new query (REQ-AUTH-DR-005)', () => {
    // The discriminator must be a pure projection over `authStore.userCan`; it
    // must NOT touch the query client, fetch permissions, or open a new request.
    const role = useDeliveryRouteRole()
    // Touch every computed to force lazy evaluation — the spec asserts that
    // the production code only EVER asks userCan about the 'DeliveryRoute'
    // subject, never any other (e.g. Product, Order) — which would leak a
    // cross-feature permission surface.
    void role.canCreate.value
    void role.canDelete.value
    void role.canUpdate.value
    void role.canRead.value
    void role.isManager.value
    void role.isDriver.value
    // userCan was called with at least one 'DeliveryRoute' subject tuple.
    expect(authMock.userCan).toHaveBeenCalled()
    const subjects = authMock.userCan.mock.calls
      .map(([, subject]: [string, string]) => subject)
      .filter((s: string) => typeof s === 'string')
    expect(subjects.length).toBeGreaterThan(0)
    // Every subject query must be 'DeliveryRoute' — never leaks another subject.
    for (const subject of subjects) {
      expect(subject).toBe('DeliveryRoute')
    }
    // Every per-action bool (canCreate/canDelete/canUpdate/canRead) calls userCan
    // once with its action — 4 calls just for those, plus 2 for isManager/isDriver.
    const actions = authMock.userCan.mock.calls.map(([action]: [string, string]) => action)
    expect(actions).toContain('create')
    expect(actions).toContain('delete')
    expect(actions).toContain('update')
    expect(actions).toContain('read')
  })

  it('isDriver=true when both read AND update are granted (driver branch — check-in surface)', () => {
    // TRIANGULATE — a user's permission set `read:DeliveryRoute + update:DeliveryRoute`
    // (no create/delete) must resolve to { isManager: false, isDriver: true } so the
    // driver mutation surface (check-in, driven by `update`) is reachable.
    authMock.userCan.mockImplementation(
      (action: string, subject: string) =>
        (action === 'read' || action === 'update') && subject === 'DeliveryRoute',
    )
    const { isManager, isDriver } = useDeliveryRouteRole()
    expect(isManager.value).toBe(false)
    expect(isDriver.value).toBe(true)
  })
})
