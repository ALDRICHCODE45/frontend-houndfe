import type { RowAction } from '@/core/shared/components/RowActionsMenu.vue'

/**
 * Row actions for a member, in menu order: Editar rol, then the destructive
 * Eliminar miembro… last.
 *
 * Opening the row already edits the role, so a menu whose only item would be
 * "Editar rol" duplicates the row click and is not shown at all (no ⋮).
 */
export function buildMembershipRowActions(options: {
  canUpdate: boolean
  canDelete: boolean
}): RowAction[] {
  const { canUpdate, canDelete } = options
  if (!canDelete) return []
  return [
    ...(canUpdate ? [{ key: 'edit', label: 'Editar rol', icon: 'i-lucide-user-cog' }] : []),
    { key: 'remove', label: 'Eliminar miembro…', icon: 'i-lucide-user-minus', destructive: true },
  ]
}
