import type { AuthTokens, AuthUser } from '../interfaces/auth.types'

const ACCESS_TOKEN_KEY = 'hound.auth.accessToken'
const REFRESH_TOKEN_KEY = 'hound.auth.refreshToken'
const USER_KEY = 'hound.auth.user'

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

  clear() {
    if (!isClient()) return
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}
