import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authStorage } from '../auth-storage'
import type { TenantSummary } from '../../interfaces/auth.types'

const ACCESS_KEY = 'hound.auth.accessToken'
const REFRESH_KEY = 'hound.auth.refreshToken'
const BASE = { sub: 'user-1', email: 'u@h.test', tenantId: 'tenant-1', tenantSlug: 'slug-1' }

const b64 = (value: string) => Buffer.from(value, 'utf8').toString('base64url')

function token(overrides: Record<string, unknown> = {}) {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64(JSON.stringify({ ...BASE, isSuperAdmin: false, ...overrides }))
  return `${header}.${body}.signature`
}

function pair(overrides: Record<string, unknown> = {}, refreshToken = 'refresh-token') {
  return { accessToken: token(overrides), refreshToken }
}

describe('authStorage tenant keys', () => {
  const membershipA: TenantSummary = { id: 'tenant-a', name: 'Sucursal A', slug: 'a' }
  const membershipB: TenantSummary = { id: 'tenant-b', name: 'Sucursal B', slug: 'b' }

  beforeEach(() => {
    localStorage.clear()
  })

  it('writes and reads current tenant', () => {
    authStorage.setCurrentTenant(membershipA)

    expect(authStorage.getCurrentTenant()).toEqual(membershipA)
  })

  it('writes and reads memberships list', () => {
    authStorage.setMemberships([membershipA, membershipB])

    expect(authStorage.getMemberships()).toEqual([membershipA, membershipB])
  })

  it('writes and reads super-admin flag', () => {
    authStorage.setIsSuperAdmin(true)

    expect(authStorage.getIsSuperAdmin()).toBe(true)
  })

  it('writes and reads temp token', () => {
    authStorage.setTempToken('temp-token')

    expect(authStorage.getTempToken()).toBe('temp-token')
  })

  it('clears all tenant-specific keys', () => {
    authStorage.setCurrentTenant(membershipA)
    authStorage.setMemberships([membershipA])
    authStorage.setIsSuperAdmin(true)
    authStorage.setTempToken('temp-token')

    authStorage.clearTenantState()

    expect(authStorage.getCurrentTenant()).toBeNull()
    expect(authStorage.getMemberships()).toBeNull()
    expect(authStorage.getIsSuperAdmin()).toBeNull()
    expect(authStorage.getTempToken()).toBeNull()
  })
})

describe('authStorage session generation', () => {
  const tenantA: TenantSummary = { id: 'tenant-a', name: 'Sucursal A', slug: 'a' }
  const tenantB: TenantSummary = { id: 'tenant-b', name: 'Sucursal B', slug: 'b' }

  beforeEach(() => {
    localStorage.clear()
  })

  it('advances before replacement writes, on empty clears and on tenant-state clears', () => {
    authStorage.setTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    const base = authStorage.getSessionGeneration()
    const identical = authStorage.prepareReplacement({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
    })!
    expect(identical.generation).toBe(base + 1)
    expect(authStorage.getSessionGeneration()).toBe(base + 1)
    expect(localStorage.getItem(ACCESS_KEY)).toBe('old-access')
    expect(identical.commit()).toBe(true)
    const replacement = authStorage.prepareReplacement({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })!
    expect(localStorage.getItem(ACCESS_KEY)).toBe('old-access')
    expect(replacement.commit()).toBe(true)
    expect(localStorage.getItem(ACCESS_KEY)).toBe('new-access')
    const beforeClear = authStorage.getSessionGeneration()
    authStorage.clear()
    authStorage.clear()
    authStorage.clearTenantState()
    authStorage.clearTenantState()
    expect(authStorage.getSessionGeneration()).toBe(beforeClear + 4)
  })
  it('gives prepared writes one-shot ownership against newer replacements and clears', () => {
    const first = authStorage.prepareReplacement({ accessToken: 'a1', refreshToken: 'r1' })!
    const second = authStorage.prepareReplacement({ accessToken: 'a2', refreshToken: 'r2' })!
    expect(first.commit()).toBe(false)
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull()
    expect(second.commit()).toBe(true)
    expect(second.commit()).toBe(false)
    expect(localStorage.getItem(ACCESS_KEY)).toBe('a2')
    authStorage.setTokens(pair())
    const clear = authStorage.prepareClear()
    expect(clear.commit()).toBe(true)
    expect(clear.commit()).toBe(false)
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull()
    const replacement = authStorage.prepareReplacement({ accessToken: 'a3', refreshToken: 'r3' })!
    expect(authStorage.prepareClear().commit()).toBe(true)
    expect(replacement.commit()).toBe(false)
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull()
    const supersededClear = authStorage.prepareClear()
    authStorage.setTokens(pair())
    expect(supersededClear.commit()).toBe(false)
    expect(localStorage.getItem(ACCESS_KEY)).not.toBeNull()
  })
  it('snapshots candidate token strings at preparation time', () => {
    const candidate = { accessToken: 'snap-access', refreshToken: 'snap-refresh' }
    const write = authStorage.prepareReplacement(candidate)!
    candidate.accessToken = 'mutated-access'
    candidate.refreshToken = 'mutated-refresh'
    expect(write.commit()).toBe(true)
    expect(localStorage.getItem(ACCESS_KEY)).toBe('snap-access')
    expect(localStorage.getItem(REFRESH_KEY)).toBe('snap-refresh')
  })
  it('rejects invalid token pairs with no write and no advance', () => {
    authStorage.setTokens(pair())
    const generation = authStorage.getSessionGeneration()
    const stored = localStorage.getItem(ACCESS_KEY)
    const invalid: unknown[] = [
      undefined,
      null,
      7,
      {},
      { accessToken: '', refreshToken: 'r' },
      { accessToken: 'a', refreshToken: ' ' },
      { accessToken: 1, refreshToken: 'r' },
      { accessToken: 'a' },
    ]
    for (const candidate of invalid) expect(authStorage.prepareReplacement(candidate)).toBeNull()
    expect(authStorage.getSessionGeneration()).toBe(generation)
    expect(localStorage.getItem(ACCESS_KEY)).toBe(stored)
  })
  it('advances only on tenant identity change or removal', () => {
    authStorage.setCurrentTenant(tenantA)
    const afterA = authStorage.getSessionGeneration()
    authStorage.setCurrentTenant({ ...tenantA, name: 'Sucursal A renombrada' })
    expect(authStorage.getSessionGeneration()).toBe(afterA)
    authStorage.setCurrentTenant(tenantB)
    const afterB = authStorage.getSessionGeneration()
    expect(afterB).toBe(afterA + 1)
    authStorage.setCurrentTenant(null)
    expect(authStorage.getSessionGeneration()).toBe(afterB + 1)
    expect(authStorage.getCurrentTenant()).toBeNull()
  })
  it('rotates same-context credentials without advancing or touching metadata', () => {
    const user = {
      id: 'u',
      email: 'u@h.test',
      name: 'User',
      isActive: true,
      createdAt: '2024-01-01',
    }
    authStorage.setUser(user)
    authStorage.setPermissionCodes(['read:Product'])
    authStorage.setMemberships([tenantA])
    authStorage.setTokens({ accessToken: token(), refreshToken: 'old-refresh' })
    const generation = authStorage.getSessionGeneration()
    const next = pair({ tenantSlug: 'renewed', permissions: ['write:Order'] }, 'new-refresh')
    expect(authStorage.commitRotation(generation, next)).toEqual({
      accessToken: next.accessToken,
      refreshToken: 'new-refresh',
      generation,
    })
    expect(authStorage.getSessionGeneration()).toBe(generation)
    expect(localStorage.getItem(ACCESS_KEY)).toBe(next.accessToken)
    expect(localStorage.getItem(REFRESH_KEY)).toBe('new-refresh')
    expect(authStorage.getUser()).toEqual(user)
    expect(authStorage.getPermissionCodes()).toEqual(['read:Product'])
    expect(authStorage.getMemberships()).toEqual([tenantA])
    const adminAccess = token({ tenantId: null, tenantSlug: null, isSuperAdmin: true })
    authStorage.setTokens({ accessToken: adminAccess, refreshToken: 'admin-refresh' })
    const adminGeneration = authStorage.getSessionGeneration()
    const receipt = authStorage.commitRotation(adminGeneration, {
      accessToken: token({ tenantId: null, tenantSlug: null, isSuperAdmin: true }),
      refreshToken: 'admin-next',
    })
    expect(receipt?.generation).toBe(adminGeneration)
    expect(localStorage.getItem(REFRESH_KEY)).toBe('admin-next')
  })
  it('rejects rotations that change context or carry malformed credentials', () => {
    const access = token()
    authStorage.setTokens({ accessToken: access, refreshToken: 'old-refresh' })
    const generation = authStorage.getSessionGeneration()
    for (const override of [{ sub: 'user-2' }, { tenantId: 'tenant-2' }, { isSuperAdmin: true }]) {
      expect(authStorage.commitRotation(generation, pair(override, 'new-refresh'))).toBeNull()
    }
    const malformed: unknown[] = [
      { accessToken: 'not-a-jwt', refreshToken: 'r' },
      pair({ sub: undefined }),
      pair({ sub: 7 }),
      pair({ tenantId: 7 }),
      pair({ tenantId: '' }),
      pair({ isSuperAdmin: 'yes' }),
      pair({ tenantSlug: 7 }),
    ]
    for (const candidate of malformed) {
      expect(authStorage.commitRotation(generation, candidate)).toBeNull()
    }
    for (const expected of [generation - 1, generation + 1, -1, 1.5, Number.NaN]) {
      expect(authStorage.commitRotation(expected, pair({}, 'new-refresh'))).toBeNull()
    }
    expect(authStorage.getSessionGeneration()).toBe(generation)
    expect(localStorage.getItem(ACCESS_KEY)).toBe(access)
    expect(localStorage.getItem(REFRESH_KEY)).toBe('old-refresh')
    localStorage.setItem(ACCESS_KEY, 'not-a-jwt')
    expect(authStorage.commitRotation(generation, pair())).toBeNull()
  })
  it('rethrows the original write error after exactly one bump, keeping the partial write', () => {
    authStorage.setTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    const prepared = authStorage.prepareReplacement({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })!
    const error = new Error('storage denied')
    const originalSetItem = globalThis.localStorage.setItem.bind(globalThis.localStorage)
    const setItem = vi
      .spyOn(globalThis.localStorage, 'setItem')
      .mockImplementation((key, value) => {
        if (key === REFRESH_KEY) throw error
        originalSetItem(key, value)
      })
    let thrown: unknown
    try {
      prepared.commit()
    } catch (caught) {
      thrown = caught
    } finally {
      setItem.mockRestore()
    }
    expect(thrown).toBe(error)
    expect(authStorage.getSessionGeneration()).toBe(prepared.generation + 1)
    expect(localStorage.getItem(ACCESS_KEY)).toBe('new-access')
    expect(localStorage.getItem(REFRESH_KEY)).toBe('old-refresh')
  })
})
