import { describe, expect, it } from 'vitest'
import { decodeJwtClaims } from '../jwt.utils'

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createToken(payload: Record<string, unknown>) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64UrlEncode(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

describe('decodeJwtClaims', () => {
  it('decodes valid auth claims', () => {
    const token = createToken({
      sub: 'user-1',
      email: 'user@hound.test',
      tenantId: 'tenant-1',
      tenantSlug: 'tenant-1-slug',
      isSuperAdmin: false,
      iat: 1710000000,
      exp: 1710003600,
    })

    const claims = decodeJwtClaims(token)

    expect(claims.sub).toBe('user-1')
    expect(claims.tenantId).toBe('tenant-1')
    expect(claims.tenantSlug).toBe('tenant-1-slug')
    expect(claims.isSuperAdmin).toBe(false)
  })

  it('throws for malformed token', () => {
    expect(() => decodeJwtClaims('malformed-token')).toThrowError(/invalid|malformed|token/i)
  })

  it('keeps null tenant id for super-admin token', () => {
    const token = createToken({
      sub: 'super-admin',
      email: 'admin@hound.test',
      tenantId: null,
      tenantSlug: null,
      isSuperAdmin: true,
      iat: 1710000000,
      exp: 1710003600,
    })

    const claims = decodeJwtClaims(token)

    expect(claims.tenantId).toBeNull()
    expect(claims.tenantSlug).toBeNull()
    expect(claims.isSuperAdmin).toBe(true)
  })
})
