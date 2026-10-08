import type { AuthJwtClaims, AuthTokens, AuthUser, TenantSummary } from '../interfaces/auth.types'
import { decodeJwtClaims } from './jwt.utils'

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

const TOKEN_PATTERN = /^\S+$/

/** A store write prepared against one runtime session generation. */
export interface PreparedSessionWrite {
  readonly generation: number
  commit(): boolean
}

/** Result of a coherent, context-preserving refresh rotation. */
export type SessionRotationReceipt = Readonly<AuthTokens & { generation: number }>

let sessionGeneration = 0
function advanceSessionGeneration(): number {
  sessionGeneration += 1
  return sessionGeneration
}
function isTokenString(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value)
}
function snapshotTokenPair(tokens: unknown): AuthTokens | null {
  if (typeof tokens !== 'object' || tokens === null) return null
  const { accessToken, refreshToken } = tokens as { accessToken?: unknown; refreshToken?: unknown }
  if (!isTokenString(accessToken) || !isTokenString(refreshToken)) return null
  return { accessToken, refreshToken }
}
function readValidClaims(accessToken: string): AuthJwtClaims | null {
  let decoded: unknown
  try {
    decoded = decodeJwtClaims(accessToken)
  } catch {
    return null
  }
  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return null
  const { sub, tenantId, tenantSlug, isSuperAdmin } = decoded as Record<string, unknown>
  if (typeof sub !== 'string' || sub.length === 0) return null
  if (tenantId !== null && !(typeof tenantId === 'string' && tenantId.length > 0)) return null
  if (typeof isSuperAdmin !== 'boolean') return null
  if (tenantSlug !== null && typeof tenantSlug !== 'string') return null
  return decoded as AuthJwtClaims
}
function snapshotTenant(value: unknown): TenantSummary | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const { id, name, slug, address, status, onShiftCount } = value as Record<string, unknown>
  if (typeof id !== 'string' || !id.trim()) return null
  if (typeof name !== 'string' || typeof slug !== 'string') return null
  if (address != null && typeof address !== 'string') return null
  if (status != null && typeof status !== 'string') return null
  if (
    onShiftCount != null &&
    (typeof onShiftCount !== 'number' || !Number.isFinite(onShiftCount))
  ) {
    return null
  }
  return { id, name, slug, address, status, onShiftCount } as TenantSummary
}
function writeCredentialPair(tokens: AuthTokens) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}
function removeAllSessionKeys() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(PERMISSION_CODES_KEY)
  localStorage.removeItem(CURRENT_TENANT_KEY)
  localStorage.removeItem(MEMBERSHIPS_KEY)
  localStorage.removeItem(IS_SUPER_ADMIN_KEY)
  localStorage.removeItem(TEMP_TOKEN_KEY)
}
function writeOrInvalidate(effect: () => void) {
  try {
    effect()
  } catch (error) {
    advanceSessionGeneration()
    throw error
  }
}
function createPreparedWrite(generation: number, effect: () => void): PreparedSessionWrite {
  let consumed = false
  return {
    generation,
    commit(): boolean {
      if (consumed || sessionGeneration !== generation) return false
      consumed = true
      if (!isClient()) return false
      writeOrInvalidate(effect)
      return true
    },
  }
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

  getSessionGeneration(): number {
    return sessionGeneration
  },

  prepareReplacement(tokens: unknown): PreparedSessionWrite | null {
    const snapshot = snapshotTokenPair(tokens)
    if (!snapshot) return null
    return createPreparedWrite(advanceSessionGeneration(), () => writeCredentialPair(snapshot))
  },

  /**
   * Prepare credentials and their resolved tenant context under one generation.
   * Claims are decoded context metadata, not proof of token authenticity.
   * Persistence may be partial on error; no reactive store publication occurs here.
   */
  prepareContextReplacement(tokens: unknown, context: unknown): PreparedSessionWrite | null {
    const credentials = snapshotTokenPair(tokens)
    if (!credentials || typeof context !== 'object' || context === null || Array.isArray(context)) {
      return null
    }
    const { tenant, isSuperAdmin } = context as Record<string, unknown>
    if (typeof isSuperAdmin !== 'boolean') return null
    const resolvedTenant = tenant === null ? null : snapshotTenant(tenant)
    if (tenant !== null && !resolvedTenant) return null
    const claims = readValidClaims(credentials.accessToken)
    if (
      !claims ||
      claims.tenantId !== (resolvedTenant?.id ?? null) ||
      claims.isSuperAdmin !== isSuperAdmin
    ) {
      return null
    }
    // Serialize before preparation so later caller mutations cannot change the write.
    const serializedTenant = resolvedTenant === null ? null : JSON.stringify(resolvedTenant)
    return createPreparedWrite(advanceSessionGeneration(), () => {
      writeCredentialPair(credentials)
      if (serializedTenant === null) localStorage.removeItem(CURRENT_TENANT_KEY)
      else localStorage.setItem(CURRENT_TENANT_KEY, serializedTenant)
      localStorage.setItem(IS_SUPER_ADMIN_KEY, String(isSuperAdmin))
    })
  },

  prepareClear(): PreparedSessionWrite {
    return createPreparedWrite(advanceSessionGeneration(), removeAllSessionKeys)
  },

  commitRotation(expectedGeneration: number, tokens: unknown): SessionRotationReceipt | null {
    if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0) return null
    if (!isClient()) return null
    const next = snapshotTokenPair(tokens)
    if (!next) return null
    if (sessionGeneration !== expectedGeneration) return null

    const storedAccess = localStorage.getItem(ACCESS_TOKEN_KEY)
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!isTokenString(storedAccess) || !isTokenString(storedRefresh)) return null

    const currentClaims = readValidClaims(storedAccess)
    const nextClaims = readValidClaims(next.accessToken)
    if (!currentClaims || !nextClaims) return null
    const sameContext =
      currentClaims.sub === nextClaims.sub &&
      currentClaims.tenantId === nextClaims.tenantId &&
      currentClaims.isSuperAdmin === nextClaims.isSuperAdmin
    // Re-check ownership immediately before the write so a superseded rotation stays fail-closed.
    if (!sameContext || sessionGeneration !== expectedGeneration) return null

    writeOrInvalidate(() => writeCredentialPair(next))
    return {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      generation: expectedGeneration,
    }
  },

  setTokens(tokens: AuthTokens) {
    authStorage.prepareReplacement(tokens)?.commit()
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
      advanceSessionGeneration()
      localStorage.removeItem(CURRENT_TENANT_KEY)
      return
    }

    const current = authStorage.getCurrentTenant()
    if (!current || current.id !== tenant.id) {
      advanceSessionGeneration()
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
    advanceSessionGeneration()
    localStorage.removeItem(CURRENT_TENANT_KEY)
    localStorage.removeItem(MEMBERSHIPS_KEY)
    localStorage.removeItem(IS_SUPER_ADMIN_KEY)
    localStorage.removeItem(TEMP_TOKEN_KEY)
  },

  clear() {
    authStorage.prepareClear().commit()
  },
}
