import type { CommandPaletteItem } from '@nuxt/ui'
import type { NavAction, NavGroup, NavItem, PermissionTuple } from './navigation.types'

/**
 * Access guard predicate. Consumers build this once from the auth store and
 * pass it in — these helpers stay pure and store-agnostic (Dependency
 * Inversion), so they are trivially unit-testable.
 */
export type CanAccess = (permission?: PermissionTuple, requiresSuperAdmin?: boolean) => boolean

/** Drop permission/requiresSuperAdmin metadata from a returned nav entry. */
function stripMeta<T extends NavItem | NavAction>(item: T): T {
  const { permission: _permission, requiresSuperAdmin: _requiresSuperAdmin, ...rest } = item
  return rest as T
}

/**
 * Keep only the groups/children the user can access. Empty groups are dropped
 * and access metadata is stripped from the returned items.
 */
export function filterAccessibleGroups(groups: NavGroup[], canAccess: CanAccess): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      children: group.children
        .filter((child) => canAccess(child.permission, child.requiresSuperAdmin))
        .map(stripMeta),
    }))
    .filter((group) => group.children.length > 0)
}

/** Keep only the actions the user can access, stripping access metadata. */
export function filterAccessibleActions(actions: NavAction[], canAccess: CanAccess): NavAction[] {
  return actions
    .filter((action) => canAccess(action.permission, action.requiresSuperAdmin))
    .map(stripMeta)
}

/**
 * Flatten module groups into command-palette items, reproducing the
 * "Group / Child" label format (e.g. "POS / Ventas", "Admin / Usuarios").
 */
export function toPaletteItems(groups: NavGroup[]): CommandPaletteItem[] {
  return groups.flatMap((group) =>
    group.children.map((child) => ({
      id: child.id,
      label: `${group.label} / ${child.label}`,
      icon: child.icon,
      to: child.to,
    })),
  )
}
