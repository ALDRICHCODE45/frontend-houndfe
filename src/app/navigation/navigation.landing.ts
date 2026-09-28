import { navigationGroups } from './navigation.registry'
import {
  buildCanAccess,
  canAccessMeta,
  filterAccessibleGroups,
  type AccessAuthStore,
  type CanAccess,
} from './navigation.access'
import type { AccessMeta, NavItem, PermissionTuple } from './navigation.types'

export const DASHBOARD_PATH = '/dashboard'
export const FORBIDDEN_PATH = '/403'

/** Resolver-only root route: the global guard always redirects it (replace). */
export const ROOT_PATH = '/'
export const ROOT_ROUTE_NAME = 'root'

export const DASHBOARD_PERMISSION: PermissionTuple = ['read', 'Analytics']

export const DASHBOARD_NAV_ITEM: NavItem = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: 'i-lucide-layout-dashboard',
  to: DASHBOARD_PATH,
  permission: DASHBOARD_PERMISSION,
}

/** Resolve the first real application route the current identity may enter. */
export function resolveLandingDestination(canAccess: CanAccess): string {
  if (canAccess(DASHBOARD_PERMISSION)) return DASHBOARD_PATH

  for (const group of filterAccessibleGroups(navigationGroups, canAccess)) {
    const firstChild = group.children[0]
    if (firstChild) return firstChild.to
  }

  return FORBIDDEN_PATH
}

export function resolveLandingDestinationForAuth(authStore: AccessAuthStore): string {
  return resolveLandingDestination(buildCanAccess(authStore))
}

/** Route metadata a remembered landing candidate is validated against. */
export interface LandingRouteMeta extends AccessMeta {
  public?: boolean
  /** Explicit opt-in: this stable module route may be remembered as landing. */
  rememberAsLanding?: boolean
}

/** Canonical facts the router reports for a resolved candidate path. */
export interface LandingRouteFacts {
  /** Vue Router `resolve(candidate).path` — the canonical matched path. */
  canonicalPath: string
  meta: LandingRouteMeta
  /** Dynamic param names the match captured (empty for static routes). */
  dynamicParams: readonly string[]
}

/** Resolve a candidate path to its canonical route facts, or null when unmatched. */
export type LandingRouteResolver = (path: string) => LandingRouteFacts | null

/**
 * Resolve a remembered destination to a restorable path, or null when it must
 * be ignored. Restoring is allowed only for an explicitly opted-in, stable,
 * non-dynamic application route the current identity may enter — never root,
 * auth, public, error, create or detail destinations, and never a value that
 * is malformed, external or non-canonical.
 */
export function resolveRememberedLandingPath(
  remembered: string | null,
  resolveRoute: LandingRouteResolver,
  canAccess: CanAccess,
): string | null {
  if (remembered === null) return null
  if (!remembered.startsWith('/')) return null
  if (remembered === ROOT_PATH) return null
  if (remembered.includes('?') || remembered.includes('#')) return null

  const facts = resolveRoute(remembered)
  if (facts === null) return null
  if (facts.canonicalPath !== remembered) return null
  if (facts.dynamicParams.length > 0) return null
  if (facts.meta.public === true) return null
  if (facts.meta.rememberAsLanding !== true) return null
  if (!canAccessMeta(facts.meta, canAccess)) return null

  return remembered
}

/** Location facts the router reports for a just-committed navigation. */
export interface LandingLocationFacts {
  path: string
  name?: string | null
  meta: LandingRouteMeta
  dynamicParams: readonly string[]
}

/**
 * Whether a successfully committed location may be persisted as the remembered
 * landing: an explicitly opted-in stable module route only, never root, public,
 * auth, error or dynamic. The caller persists `path` (never `fullPath`), so the
 * stored value never carries a query or hash.
 */
export function isRememberableLandingLocation(location: LandingLocationFacts): boolean {
  if (location.meta.rememberAsLanding !== true) return false
  if (location.meta.public === true) return false
  if (typeof location.name !== 'string' || location.name === '') return false
  if (location.name === ROOT_ROUTE_NAME) return false
  if (location.path === ROOT_PATH) return false
  if (location.dynamicParams.length > 0) return false

  return true
}
