import type { AuthTokens, AuthUser, TenantSummary } from '../interfaces/auth.types'

const ACCESS_TOKEN_KEY = 'hound.auth.accessToken'
const REFRESH_TOKEN_KEY = 'hound.auth.refreshToken'
const USER_KEY = 'hound.auth.user'
const PERMISSION_CODES_KEY = 'hound.auth.permissionCodes'
const CURRENT_TENANT_KEY = 'hound.auth.currentTenant'
const MEMBERSHIPS_KEY = 'hound.auth.memberships'
const IS_SUPER_ADMIN_KEY = 'hound.auth.isSuperAdmin'
const TEMP_TOKEN_KEY = 'hound.auth.tempToken'

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

  getCurrentTenant(): TenantSummary | null {
    if (!isClient()) return null
    const raw = localStorage.getItem(CURRENT_TENANT_KEY)
    if (!raw) return null

    try {
      return JSON.parse(raw) as TenantSummary
    } catch {
      return null
    }
  },

  getMemberships(): TenantSummary[] | null {
    if (!isClient()) return null
    const raw = localStorage.getItem(MEMBERSHIPS_KEY)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      return parsed as TenantSummary[]
    } catch {
      return null
    }
  },

  getIsSuperAdmin(): boolean | null {
    if (!isClient()) return null
    const raw = localStorage.getItem(IS_SUPER_ADMIN_KEY)
    if (!raw) return null
    return raw === 'true'
  },

  getTempToken(): string | null {
    if (!isClient()) return null
    return localStorage.getItem(TEMP_TOKEN_KEY)
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

  setCurrentTenant(tenant: TenantSummary | null) {
    if (!isClient()) return
    if (!tenant) {
      localStorage.removeItem(CURRENT_TENANT_KEY)
      return
    }

    localStorage.setItem(CURRENT_TENANT_KEY, JSON.stringify(tenant))
  },

  setMemberships(memberships: TenantSummary[]) {
    if (!isClient()) return
    localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(memberships))
  },

  setIsSuperAdmin(isSuperAdmin: boolean) {
    if (!isClient()) return
    localStorage.setItem(IS_SUPER_ADMIN_KEY, String(isSuperAdmin))
  },

  setTempToken(tempToken: string | null) {
    if (!isClient()) return
    if (!tempToken) {
      localStorage.removeItem(TEMP_TOKEN_KEY)
      return
    }
    localStorage.setItem(TEMP_TOKEN_KEY, tempToken)
  },

  clearPermissionCodes() {
    if (!isClient()) return
    localStorage.removeItem(PERMISSION_CODES_KEY)
  },

  clearTenantState() {
    if (!isClient()) return
    localStorage.removeItem(CURRENT_TENANT_KEY)
    localStorage.removeItem(MEMBERSHIPS_KEY)
    localStorage.removeItem(IS_SUPER_ADMIN_KEY)
    localStorage.removeItem(TEMP_TOKEN_KEY)
  },

  clear() {
    if (!isClient()) return
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(PERMISSION_CODES_KEY)
    localStorage.removeItem(CURRENT_TENANT_KEY)
    localStorage.removeItem(MEMBERSHIPS_KEY)
    localStorage.removeItem(IS_SUPER_ADMIN_KEY)
    localStorage.removeItem(TEMP_TOKEN_KEY)
  },
}
