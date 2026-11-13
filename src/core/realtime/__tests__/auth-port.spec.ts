import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ token: 'old' as string | null }))
const httpGet = vi.hoisted(() => vi.fn())

vi.mock('@/core/shared/api/http', () => ({ http: { get: httpGet } }))
vi.mock('@/features/auth/services/auth-storage', () => ({
  authStorage: { getAccessToken: () => state.token },
}))

import { createDefaultAuthPort } from '../auth-port'
import { jwtFor } from './helpers'

describe('default auth port', () => {
  beforeEach(() => {
    state.token = 'old'
    httpGet.mockReset()
  })

  it('reads the access token from the auth storage http.ts uses', () => {
    expect(createDefaultAuthPort().getAccessToken()).toBe('old')
    state.token = null
    expect(createDefaultAuthPort().getAccessToken()).toBeNull()
  })

  it('refresh goes through the shared http client (its 401 interceptor owns the refresh flight)', async () => {
    httpGet.mockImplementation(async () => {
      state.token = 'new'
    })
    await expect(createDefaultAuthPort().refresh('old')).resolves.toBe(true)
    expect(httpGet).toHaveBeenCalledWith('/auth/me/permissions')
  })

  it('does not call the API when another request already rotated the token', async () => {
    state.token = 'rotated'
    await expect(createDefaultAuthPort().refresh('old')).resolves.toBe(true)
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('returns false when there is no session left', async () => {
    state.token = null
    await expect(createDefaultAuthPort().refresh('old')).resolves.toBe(false)
  })

  it('returns false when the refresh failed with a 401 (session cleared by http.ts)', async () => {
    httpGet.mockImplementation(async () => {
      state.token = null
      throw Object.assign(new Error('401'), { response: { status: 401 } })
    })
    await expect(createDefaultAuthPort().refresh('old')).resolves.toBe(false)
  })

  it('treats a network error as retryable while the session still exists', async () => {
    httpGet.mockRejectedValue(new Error('Network Error'))
    await expect(createDefaultAuthPort().refresh('old')).resolves.toBe(true)
  })

  it('tokenMatches compares the JWT `sub` and `tenantId` with the session identity', () => {
    const port = createDefaultAuthPort()
    const me = { userId: 'u1', tenantId: 't1' }
    expect(port.tokenMatches?.(jwtFor({ sub: 'u1', tenantId: 't1' }), me)).toBe(true)
    expect(port.tokenMatches?.(jwtFor({ sub: 'u2', tenantId: 't1' }), me)).toBe(false)
    expect(port.tokenMatches?.(jwtFor({ sub: 'u1', tenantId: 't2' }), me)).toBe(false)
    expect(port.tokenMatches?.('opaque', me)).toBe(false)
  })
})
