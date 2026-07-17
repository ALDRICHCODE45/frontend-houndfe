import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'

/** Permission required to see a navigation entry: [action, subject]. */
export type PermissionTuple = [AppAction, AppSubject]

/** Access-control metadata shared by every guarded navigation entry. */
export interface AccessMeta {
  permission?: PermissionTuple
  requiresSuperAdmin?: boolean
}

/**
 * Shared fields for a navigable entry (a module item or an action shortcut).
 * {@link NavItem} and {@link NavAction} both derive from this single base.
 */
export interface NavEntry extends AccessMeta {
  id: string
  label: string
  icon: string
  to: string
}

/** A single navigable module entry, shared by the sidebar and the command palette. */
export type NavItem = NavEntry

/** A collapsible module group in the sidebar; flattened into palette items. */
export interface NavGroup {
  id: string
  label: string
  icon: string
  defaultOpen?: boolean
  children: NavItem[]
}

/** A create-shortcut surfaced in the command palette "Acciones" group. */
export type NavAction = NavEntry
