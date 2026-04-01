import type { AuthTokens, AuthUser } from '../interfaces/auth.types'

const ACCESS_TOKEN_KEY = 'hound.auth.accessToken'
const REFRESH_TOKEN_KEY = 'hound.auth.refreshToken'
const USER_KEY = 'hound.auth.user'
const PERMISSION_CODES_KEY = 'hound.auth.permissionCodes'

function isClient() {
  return typeof window !== 'undefined'
}

export const authStorage = {
  getAccessToken(): string | null {
    if (!isClient()) return null
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },

  getRefreshToken(): string | null {
    if (!isClient()) return null
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },

  getUser(): AuthUser | null {
    if (!isClient()) return null
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null

    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      return null
    }
  },

  getPermissionCodes(): string[] | null {
    if (!isClient()) return null
    const raw = localStorage.getItem(PERMISSION_CODES_KEY)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      return parsed.filter((value): value is string => typeof value === 'string')
    } catch {
      return null
    }
  },

  setTokens(tokens: AuthTokens) {
    if (!isClient()) return
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  },

  setUser(user: AuthUser | null) {
    if (!isClient()) return

    if (!user) {
      localStorage.removeItem(USER_KEY)
      return
    }

    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  setPermissionCodes(permissionCodes: string[]) {
    if (!isClient()) return
    localStorage.setItem(PERMISSION_CODES_KEY, JSON.stringify(permissionCodes))
  },

  clearPermissionCodes() {
    if (!isClient()) return
    localStorage.removeItem(PERMISSION_CODES_KEY)
  },

  clear() {
    if (!isClient()) return
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(PERMISSION_CODES_KEY)
  },
}
