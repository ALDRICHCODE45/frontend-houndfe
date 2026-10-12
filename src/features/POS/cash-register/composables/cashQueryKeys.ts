/**
 * Feature-local TanStack Query keys for the Caja module.
 *
 * The central `@/core/shared/constants/query-keys.ts` registry lives outside
 * this task's edit surface, so the cash keys are declared here, in the feature
 * that owns them.
 *
 * SECURITY: a tenant-scoped key is NOT enough for cash data. The same session
 * detail is a blind owner projection for the cashier but a wider audit
 * projection for an audit reader, and visibility depends on dynamic permission
 * grants. Every sensitive slot is therefore scoped by the full SESSION IDENTITY
 * — tenant + user + permission generation:
 *
 *   ['cash', tenantId, userId, permissionFingerprint, …]
 *
 * so a same-tenant user switch (or a permission change) can never read another
 * principal's cached rows. The scope is cache-isolation only: it is never sent
 * to the backend, which resolves tenant and user from the JWT.
 */
import type { CashSessionListParams } from '../interfaces/cash.types'
import type { CashIdentity } from './cashRules'

/**
 * The principal + session-lifecycle snapshot a cash cache slot belongs to. It is
 * the full {@link CashIdentity}: a tenant-scoped (or tenant+user+permission)
 * key still cannot tell two DIFFERENT sessions of the same principal apart.
 */
export type CashCacheScope = CashIdentity

function scopeSegments(scope: CashCacheScope): [string, string, string, string] {
  return [scope.tenantId, scope.userId, scope.permissionFingerprint, String(scope.generation)]
}

export const cashQueryKeys = {
  registers: (scope: CashCacheScope) => ['cash', ...scopeSegments(scope), 'registers'] as const,
  sessionsList: (scope: CashCacheScope, params: CashSessionListParams) =>
    ['cash', ...scopeSegments(scope), 'sessions', 'list', params] as const,
  sessionsListPrefix: (scope: CashCacheScope) =>
    ['cash', ...scopeSegments(scope), 'sessions', 'list'] as const,
  sessionDetail: (scope: CashCacheScope, sessionId: string) =>
    ['cash', ...scopeSegments(scope), 'sessions', 'detail', sessionId] as const,
  custody: (scope: CashCacheScope, page: number, limit: number) =>
    ['cash', ...scopeSegments(scope), 'custody', page, limit] as const,
  /** Prefix that matches every slot of one principal (used by invalidation). */
  principalPrefix: (scope: CashCacheScope) => ['cash', ...scopeSegments(scope)] as const,
} as const
