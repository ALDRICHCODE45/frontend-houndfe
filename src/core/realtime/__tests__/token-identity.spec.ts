import { describe, expect, it } from 'vitest'
import { readTokenIdentity, tokenBelongsTo } from '../token-identity'
import { b64url, jwtFor } from './helpers'

describe('token identity (read-only JWT payload)', () => {
  it('reads the user id from `sub` and the tenant from `tenantId`', () => {
    expect(readTokenIdentity(jwtFor({ sub: 'u1', tenantId: 't1', email: 'a@b.c' }))).toEqual({
      userId: 'u1',
      tenantId: 't1',
    })
  })

  it('decodes base64url (no padding, - and _, multi-byte characters)', () => {
    // '>>>???' yields '+' and '/' in plain base64 → '-' and '_' in base64url.
    const token = jwtFor({ sub: 'u>>>???', tenantId: 'téñant-ü', pad: 'x' })
    expect(readTokenIdentity(token)).toEqual({ userId: 'u>>>???', tenantId: 'téñant-ü' })
  })

  it('matches only when both user and tenant are the session ones', () => {
    const identity = { userId: 'u1', tenantId: 't1' }
    expect(tokenBelongsTo(jwtFor({ sub: 'u1', tenantId: 't1' }), identity)).toBe(true)
    expect(tokenBelongsTo(jwtFor({ sub: 'u2', tenantId: 't1' }), identity)).toBe(false)
    expect(tokenBelongsTo(jwtFor({ sub: 'u1', tenantId: 't2' }), identity)).toBe(false)
    expect(tokenBelongsTo(jwtFor({ sub: 'u1', tenantId: null }), identity)).toBe(false)
    expect(tokenBelongsTo(jwtFor({ sub: 'u1' }), identity)).toBe(false)
  })

  it.each([
    ['not a jwt', 'tok'],
    ['empty', ''],
    ['two segments', 'a.b'],
    ['payload is not base64', 'a.@@@.c'],
    ['payload is not JSON', `a.${b64url('nope')}.c`],
    ['payload is not an object', `a.${b64url('"str"')}.c`],
    ['sub is not a string', jwtFor({ sub: 7, tenantId: 't1' })],
  ])('an undecodable token (%s) belongs to nobody', (_label, token) => {
    expect(readTokenIdentity(token)).toBeNull()
    expect(tokenBelongsTo(token, { userId: 'u1', tenantId: 't1' })).toBe(false)
  })
})
