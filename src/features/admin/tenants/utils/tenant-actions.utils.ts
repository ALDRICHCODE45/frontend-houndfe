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
    onEdit: (tenant: TenantTableRow) => void
    onDeactivate: (tenant: TenantTableRow) => void
  },
): TenantRowActionSection[] {
  const { canUpdate, canDelete, onEdit, onDeactivate } = options

  const mainActions: TenantRowAction[] = canUpdate
    ? [{ label: 'Editar', onSelect: () => onEdit(tenant) }]
    : []

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
