import type { TenantTableRow } from '../interfaces/tenant.types'

export type TenantRowAction = {
  label: string
  color?: 'error'
  onSelect: () => void
}

export type TenantRowActionSection = TenantRowAction[]

export function buildTenantRowActions(
  tenant: TenantTableRow,
  options: {
    canUpdate: boolean
    canDelete: boolean
    canManageMembers?: boolean
    onEdit: (tenant: TenantTableRow) => void
    onDeactivate: (tenant: TenantTableRow) => void
    onManageMembers?: (tenant: TenantTableRow) => void
  },
): TenantRowActionSection[] {
  const { canUpdate, canDelete, canManageMembers, onEdit, onDeactivate, onManageMembers } = options

  const mainActions: TenantRowAction[] = []
  
  if (canUpdate) {
    mainActions.push({ label: 'Editar', onSelect: () => onEdit(tenant) })
  }
  
  if (canManageMembers && onManageMembers) {
    mainActions.push({ label: 'Gestionar miembros', onSelect: () => onManageMembers(tenant) })
  }

  const destructiveActions: TenantRowAction[] = canDelete
    ? [
        {
          label: 'Desactivar',
          color: 'error' as const,
          onSelect: () => onDeactivate(tenant),
        },
      ]
    : []

  return [mainActions, destructiveActions].filter((section) => section.length > 0)
}
