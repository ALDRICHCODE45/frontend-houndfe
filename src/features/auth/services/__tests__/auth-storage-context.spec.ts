import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authStorage } from '../auth-storage'

const ACCESS = 'hound.auth.accessToken'
const REFRESH = 'hound.auth.refreshToken'
const TENANT = 'hound.auth.currentTenant'
const ADMIN = 'hound.auth.isSuperAdmin'
const tenant = { id: 'tenant-a', name: 'Branch A', slug: 'a' }

function tokens(tenantId: string | null = tenant.id, isSuperAdmin = false) {
  const claims = { sub: 'user-a', tenantId, tenantSlug: tenantId ? 'a' : null, isSuperAdmin }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return { accessToken: `e30.${payload}.signature`, refreshToken: 'next-refresh' }
}

function snapshot() {
  return Object.fromEntries(
    Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)!
      return [key, localStorage.getItem(key)]
    }),
  )
}

describe('prepared credential and tenant context replacement', () => {
  beforeEach(() => {
    authStorage.clear()
    authStorage.setTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    authStorage.setCurrentTenant({ id: 'old', name: 'Old branch', slug: 'old' })
    authStorage.setIsSuperAdmin(false)
    authStorage.setPermissionCodes(['read:Product'])
  })

  it.each([false, true])('persists a snapshotted context with one advance (admin=%s)', (admin) => {
    const context = { tenant: { ...tenant, address: 'Main street' }, isSuperAdmin: admin }
    const next = tokens(tenant.id, admin)
    const expectedTokens = { ...next }
    const expectedTenant = { ...context.tenant }
    const before = snapshot()
    const generation = authStorage.getSessionGeneration()
    const prepared = authStorage.prepareContextReplacement(next, context)!

    expect(prepared.generation).toBe(generation + 1)
    expect(authStorage.getSessionGeneration()).toBe(prepared.generation)
    expect(snapshot()).toEqual(before)
    next.refreshToken = 'mutated'
    context.tenant.id = 'mutated'
    context.tenant.address = 'Mutated street'
    context.isSuperAdmin = !admin
    expect(prepared.commit()).toBe(true)
    expect(authStorage.getSessionGeneration()).toBe(prepared.generation)
    expect(authStorage.getAccessToken()).toBe(expectedTokens.accessToken)
    expect(authStorage.getRefreshToken()).toBe(expectedTokens.refreshToken)
    expect(authStorage.getCurrentTenant()).toEqual(expectedTenant)
    expect(authStorage.getIsSuperAdmin()).toBe(admin)
    expect(authStorage.getPermissionCodes()).toEqual(['read:Product'])
    const committed = snapshot()
    expect(prepared.commit()).toBe(false)
    expect(snapshot()).toEqual(committed)
  })

  it('removes tenant context for a tenantless administrator without a second advance', () => {
    const generation = authStorage.getSessionGeneration()
    const prepared = authStorage.prepareContextReplacement(tokens(null, true), {
      tenant: null,
      isSuperAdmin: true,
    })!
    expect(prepared.commit()).toBe(true)
    expect(authStorage.getCurrentTenant()).toBeNull()
    expect(authStorage.getIsSuperAdmin()).toBe(true)
    expect(authStorage.getSessionGeneration()).toBe(generation + 1)
  })

  it('rejects invalid or claim-inconsistent inputs before preparation', () => {
    const valid = { tenant, isSuperAdmin: false }
    const cases: [unknown, unknown][] = [
      [null, valid],
      [{ accessToken: 'not-jwt', refreshToken: 'r' }, valid],
      [{ ...tokens(), refreshToken: 7 }, valid],
      [tokens(), null],
      [tokens(), []],
      [tokens(), { tenant, isSuperAdmin: 'false' }],
      [tokens(), { tenant: null, isSuperAdmin: false }],
      [tokens(), { tenant: { ...tenant, id: 'other' }, isSuperAdmin: false }],
      [tokens(), { tenant, isSuperAdmin: true }],
      [tokens(), { tenant: { ...tenant, name: 7 }, isSuperAdmin: false }],
      [tokens(), { tenant: { ...tenant, slug: null }, isSuperAdmin: false }],
      [tokens(), { tenant: { ...tenant, address: {} }, isSuperAdmin: false }],
      [tokens(), { tenant: { ...tenant, status: 7 }, isSuperAdmin: false }],
      [tokens(), { tenant: { ...tenant, onShiftCount: Number.NaN }, isSuperAdmin: false }],
    ]
    const before = snapshot()
    const generation = authStorage.getSessionGeneration()
    for (const [credentials, context] of cases) {
      expect(authStorage.prepareContextReplacement(credentials, context)).toBeNull()
    }
    expect(authStorage.getSessionGeneration()).toBe(generation)
    expect(snapshot()).toEqual(before)
  })

  it.each(['replacement', 'clear', 'tenant'] as const)('rejects a write superseded by %s', (by) => {
    const prepared = authStorage.prepareContextReplacement(tokens(), {
      tenant,
      isSuperAdmin: false,
    })!
    if (by === 'replacement') authStorage.setTokens({ accessToken: 'newer', refreshToken: 'newer' })
    if (by === 'clear') authStorage.clear()
    if (by === 'tenant') authStorage.setCurrentTenant(null)
    const before = snapshot()
    const generation = authStorage.getSessionGeneration()
    const write = vi.spyOn(localStorage, 'setItem')
    const remove = vi.spyOn(localStorage, 'removeItem')
    try {
      expect(prepared.commit()).toBe(false)
      expect(write).not.toHaveBeenCalled()
      expect(remove).not.toHaveBeenCalled()
      expect(snapshot()).toEqual(before)
      expect(authStorage.getSessionGeneration()).toBe(generation)
    } finally {
      write.mockRestore()
      remove.mockRestore()
    }
  })

  it.each([TENANT, ADMIN])(
    'invalidates a failed context write to %s without rollback',
    (failedKey) => {
      const next = tokens()
      const prepared = authStorage.prepareContextReplacement(next, { tenant, isSuperAdmin: false })!
      const error = new Error('tenant write denied')
      const original = localStorage.setItem.bind(localStorage)
      const write = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
        if (key === failedKey) throw error
        original(key, value)
      })
      let thrown: unknown
      try {
        prepared.commit()
      } catch (caught) {
        thrown = caught
      } finally {
        write.mockRestore()
      }
      expect(thrown).toBe(error)
      expect(authStorage.getSessionGeneration()).toBe(prepared.generation + 1)
      expect(localStorage.getItem(ACCESS)).toBe(next.accessToken)
      expect(localStorage.getItem(REFRESH)).toBe(next.refreshToken)
      expect(authStorage.getCurrentTenant()?.id).toBe(failedKey === TENANT ? 'old' : tenant.id)
      expect(localStorage.getItem(ADMIN)).toBe('false')
      const partial = snapshot()
      expect(prepared.commit()).toBe(false)
      expect(snapshot()).toEqual(partial)
    },
  )

  it('invalidates a failed tenant removal and consumes the prepared operation', () => {
    const prepared = authStorage.prepareContextReplacement(tokens(null, true), {
      tenant: null,
      isSuperAdmin: true,
    })!
    const error = new Error('tenant removal denied')
    const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw error
    })
    let thrown: unknown
    try {
      prepared.commit()
    } catch (caught) {
      thrown = caught
    } finally {
      remove.mockRestore()
    }
    expect(thrown).toBe(error)
    expect(authStorage.getSessionGeneration()).toBe(prepared.generation + 1)
    expect(authStorage.getAccessToken()).toBe(tokens(null, true).accessToken)
    expect(authStorage.getRefreshToken()).toBe('next-refresh')
    expect(authStorage.getCurrentTenant()?.id).toBe('old')
    expect(authStorage.getIsSuperAdmin()).toBe(false)
    expect(prepared.commit()).toBe(false)
  })
})
