/** Pure tests for the editorial-live seed plan, plus the init script against a stub page. */
import { describe, expect, it, vi } from 'vitest'
import type { Page } from '@playwright/test'

import { AUTH_STORAGE_KEYS } from '../../responsive/fixtures/auth'
import { AUTH_SEED_ABSENT_KEYS, buildEditorialActorSeedPlan, seedEditorialActor } from '../support/auth-seed'
import type { ValidatedEditorialActor } from '../support/fixture'

const TENANT = { id: 'tenant-a', name: 'Tenant A', slug: 'tenant-a' }
const base: ValidatedEditorialActor = {
  role: 'manage-all', userId: 'u', email: 'u@example.test', isSuperAdmin: false, tenant: TENANT, permissionCodes: ['manage:all'],
  tokens: { access: 'live-token' }, expiresAt: '2099-01-01T00:00:00Z', ttlSeconds: 60,
  user: { id: 'u', email: 'u@example.test', name: 'U', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  memberships: [{ id: TENANT.id, name: TENANT.name, slug: TENANT.slug, roleName: 'Admin' }],
}
const value = (plan: ReturnType<typeof buildEditorialActorSeedPlan>, key: string) => plan.set.find(entry => entry.key === key)?.value

describe('buildEditorialActorSeedPlan', () => {
  it('seeds a tenant actor with its tenant, claim and fixture values only', () => {
    const plan = buildEditorialActorSeedPlan(base)
    expect(value(plan, AUTH_STORAGE_KEYS.accessToken)).toBe('live-token')
    expect(value(plan, AUTH_STORAGE_KEYS.currentTenant)).toBe(JSON.stringify(TENANT))
    expect(value(plan, AUTH_STORAGE_KEYS.isSuperAdmin)).toBe('false')
    expect(value(plan, AUTH_STORAGE_KEYS.permissionCodes)).toBe('["manage:all"]')
    expect(JSON.parse(value(plan, AUTH_STORAGE_KEYS.memberships)!)).toEqual([TENANT])
    expect(plan.remove).toEqual([...AUTH_SEED_ABSENT_KEYS])
  })

  it('global mode: Super Admin claim, NO current tenant (removed, never written)', () => {
    const plan = buildEditorialActorSeedPlan({ ...base, role: 'superadmin-global', isSuperAdmin: true, tenant: null, permissionCodes: [], memberships: [] })
    expect(value(plan, AUTH_STORAGE_KEYS.isSuperAdmin)).toBe('true')
    expect(value(plan, AUTH_STORAGE_KEYS.currentTenant)).toBeUndefined()
    expect(plan.remove).toContain(AUTH_STORAGE_KEYS.currentTenant)
    expect(value(plan, AUTH_STORAGE_KEYS.permissionCodes)).toBe('[]')
  })

  it('never writes a refresh or temp token', () => {
    const keys = buildEditorialActorSeedPlan(base).set.map(entry => entry.key)
    expect(keys).not.toContain(AUTH_STORAGE_KEYS.refreshToken)
    expect(keys).not.toContain(AUTH_STORAGE_KEYS.tempToken)
    expect(AUTH_SEED_ABSENT_KEYS).toEqual([AUTH_STORAGE_KEYS.refreshToken, AUTH_STORAGE_KEYS.tempToken])
  })
})

describe('seedEditorialActor', () => {
  it('installs one init script that removes then sets, on a fresh storage', async () => {
    const addInitScript = vi.fn()
    await seedEditorialActor({ addInitScript } as unknown as Page, { ...base, tenant: null, isSuperAdmin: true })
    expect(addInitScript).toHaveBeenCalledTimes(1)
    const [script, plan] = addInitScript.mock.calls[0] as [(p: unknown) => void, ReturnType<typeof buildEditorialActorSeedPlan>]
    const store = new Map<string, string>([[AUTH_STORAGE_KEYS.currentTenant, 'stale'], [AUTH_STORAGE_KEYS.refreshToken, 'stale']])
    const localStorage = { removeItem: (k: string) => store.delete(k), setItem: (k: string, v: string) => store.set(k, v) }
    vi.stubGlobal('window', { localStorage })
    try {
      script(plan)
    } finally {
      vi.unstubAllGlobals()
    }
    expect(store.has(AUTH_STORAGE_KEYS.currentTenant)).toBe(false)
    expect(store.has(AUTH_STORAGE_KEYS.refreshToken)).toBe(false)
    expect(store.get(AUTH_STORAGE_KEYS.isSuperAdmin)).toBe('true')
  })
})
