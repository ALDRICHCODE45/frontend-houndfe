import { beforeEach, describe, expect, it } from 'vitest'
import { authStorage } from '../auth-storage'
import type { TenantSummary } from '../../interfaces/auth.types'

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
