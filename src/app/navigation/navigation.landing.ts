import { navigationGroups } from './navigation.registry'
import {
  buildCanAccess,
  filterAccessibleGroups,
  type AccessAuthStore,
  type CanAccess,
} from './navigation.access'
import type { NavItem, PermissionTuple } from './navigation.types'

export const DASHBOARD_PATH = '/dashboard'
export const FORBIDDEN_PATH = '/403'
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
