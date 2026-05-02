import { describe, it, expect } from 'vitest'
import type { AuthJwtClaims, AuthPhase, LoginResponse, TenantSummary } from '../auth.types'

describe('auth.types', () => {
  it('defines TenantSummary shape', () => {
    const tenant: TenantSummary = {
      id: 'tenant-1',
      name: 'Sucursal Centro',
      slug: 'sucursal-centro',
    }

    expect(tenant.id).toBe('tenant-1')
    expect(tenant.name).toBe('Sucursal Centro')
    expect(tenant.slug).toBe('sucursal-centro')
  })

  it('defines AuthJwtClaims with nullable tenant fields', () => {
    const claims: AuthJwtClaims = {
      sub: 'user-1',
      email: 'user@hound.test',
      tenantId: null,
      tenantSlug: null,
      isSuperAdmin: true,
      iat: 1710000000,
      exp: 1710003600,
    }

    expect(claims.tenantId).toBeNull()
    expect(claims.tenantSlug).toBeNull()
    expect(claims.isSuperAdmin).toBe(true)
  })

  it('supports LoginResponse success discriminated union', () => {
    const response: LoginResponse = {
      requiresTenantSelection: false,
      user: {
        id: 'user-1',
        email: 'user@hound.test',
        name: 'User One',
        isActive: true,
        createdAt: '2026-05-02T00:00:00.000Z',
      },
      tenants: [{ id: 'tenant-1', name: 'Sucursal Norte', slug: 'sucursal-norte' }],
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }

    // response.requiresTenantSelection is false — TypeScript knows we're in the non-selection branch
    expect(response.requiresTenantSelection).toBe(false)
    expect(response.accessToken).toBe('access-token')
    expect(response.refreshToken).toBe('refresh-token')
  })

  it('supports LoginResponse tenant selection discriminated union', () => {
    const response: LoginResponse = {
      requiresTenantSelection: true,
      user: {
        id: 'user-1',
        email: 'user@hound.test',
        name: 'User One',
        isActive: true,
        createdAt: '2026-05-02T00:00:00.000Z',
      },
      tenants: [{ id: 'tenant-1', name: 'Sucursal Norte', slug: 'sucursal-norte' }],
      tempToken: 'temp-token',
      expiresIn: 300,
    }

    // response.requiresTenantSelection is true — TypeScript knows we're in the tenant-selection branch
    expect(response.requiresTenantSelection).toBe(true)
    expect(response.tempToken).toBe('temp-token')
    expect(response.expiresIn).toBe(300)
  })

  it('accepts all auth phases', () => {
    const phases: AuthPhase[] = [
      'idle',
      'authenticating',
      'needs-tenant-selection',
      'selecting-tenant',
      'authenticated',
    ]

    expect(phases).toHaveLength(5)
  })
})
