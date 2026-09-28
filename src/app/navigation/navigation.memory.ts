/**
 * Root-landing memory: persists the last stable, authorized application route
 * per (user, tenant) scope so a visit to "/" can restore it.
 *
 * Storage contract:
 * - versioned key: `houndfe.landing-memory.v1:<encoded-user>:<encoded-tenant>`
 *   so a version bump never reinterprets an older shape;
 * - one record per scope, so switching tenant never deletes another scope's
 *   record;
 * - every storage access is best-effort: a throwing `localStorage` getter, or a
 *   throwing `getItem` / `setItem` / `removeItem`, degrades to "no memory" and
 *   never breaks navigation.
 *
 * This module stays pure and router-agnostic (Dependency Inversion): it only
 * knows about scopes and path strings. Whether a stored path is *eligible* to be
 * restored is decided by `navigation.landing.ts` against route metadata + CASL.
 */

/** Versioned prefix shared by every remembered-landing record. */
export const LANDING_MEMORY_PREFIX = 'houndfe.landing-memory.v1'

/** Identity scope a remembered destination belongs to. */
export interface LandingScope {
  userId: string | null | undefined
  tenantId: string | null | undefined
}

/**
 * Result of reading a scope's record. `hasRecord` distinguishes "no record"
 * from "a record exists but is unusable" (for example a blank value), so the
 * caller can invalidate the latter instead of silently ignoring it.
 */
export interface LandingMemoryReadResult {
  hasRecord: boolean
  path: string | null
}

/** Build the versioned, encoded storage key for a scope, or null when absent. */
export function buildLandingMemoryKey(scope: LandingScope): string | null {
  const userId = typeof scope.userId === 'string' ? scope.userId.trim() : ''
  const tenantId = typeof scope.tenantId === 'string' ? scope.tenantId.trim() : ''
  if (userId === '' || tenantId === '') return null
  return `${LANDING_MEMORY_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(tenantId)}`
}

/** Resolve the browser storage, or null when it is unavailable/throwing. */
function resolveStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Read the remembered path for a scope. Best-effort; never throws. */
export function readRememberedLanding(scope: LandingScope): LandingMemoryReadResult {
  const key = buildLandingMemoryKey(scope)
  if (key === null) return { hasRecord: false, path: null }

  const storage = resolveStorage()
  if (storage === null) return { hasRecord: false, path: null }

  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return { hasRecord: false, path: null }
  }

  if (raw === null) return { hasRecord: false, path: null }

  const trimmed = raw.trim()
  return { hasRecord: true, path: trimmed === '' ? null : trimmed }
}

/** Persist a canonical path for a scope. Best-effort; returns success. */
export function writeRememberedLanding(scope: LandingScope, path: string): boolean {
  const key = buildLandingMemoryKey(scope)
  if (key === null) return false
  if (typeof path !== 'string' || !path.startsWith('/')) return false

  const storage = resolveStorage()
  if (storage === null) return false

  try {
    storage.setItem(key, path)
    return true
  } catch {
    return false
  }
}

/** Remove the record for this scope only. Best-effort; never throws. */
export function clearRememberedLanding(scope: LandingScope): void {
  const key = buildLandingMemoryKey(scope)
  if (key === null) return

  const storage = resolveStorage()
  if (storage === null) return

  try {
    storage.removeItem(key)
  } catch {
    // An inaccessible record must never break navigation: clearing is best-effort.
  }
}
