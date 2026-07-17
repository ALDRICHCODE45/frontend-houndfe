import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'

/** Permission required to see a navigation entry: [action, subject]. */
export type PermissionTuple = [AppAction, AppSubject]

/** A single navigable module entry, shared by the sidebar and the command palette. */
export interface NavItem {
  id: string
  label: string
  icon: string
  to: string
  permission?: PermissionTuple
  requiresSuperAdmin?: boolean
}

/** A collapsible module group in the sidebar; flattened into palette items. */
export interface NavGroup {
  id: string
  label: string
  icon: string
  defaultOpen?: boolean
  children: NavItem[]
}

/** A create-shortcut surfaced in the command palette "Acciones" group. */
export interface NavAction {
  id: string
  label: string
  icon: string
  to: string
  permission?: PermissionTuple
  requiresSuperAdmin?: boolean
}
