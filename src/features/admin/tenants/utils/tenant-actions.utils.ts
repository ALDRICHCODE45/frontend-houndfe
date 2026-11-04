import type { RowAction } from '@/core/shared/components/RowActionsMenu.vue'

export type TenantRowActionKey = 'edit' | 'members' | 'deactivate'

/**
 * Row actions for a tenant, in menu order: Editar, Gestionar miembros, then the
 * destructive Desactivar… last. Selecting an action emits its key; the view
 * decides what it does. No permission → no actions → no ⋮.
 */
export function buildTenantRowActions(options: {
  canUpdate: boolean
  canDelete: boolean
  canManageMembers?: boolean
}): RowAction[] {
  const { canUpdate, canDelete, canManageMembers } = options
  return [
    ...(canUpdate ? [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }] : []),
    ...(canManageMembers
      ? [{ key: 'members', label: 'Gestionar miembros', icon: 'i-lucide-users' }]
      : []),
    ...(canDelete
      ? [{ key: 'deactivate', label: 'Desactivar…', icon: 'i-lucide-power', destructive: true }]
      : []),
  ]
}
