import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { RoleTableRow } from '../interfaces/role.types'

export function useRoleColumns() {
  const columns: TableColumn<RoleTableRow>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
    },
    {
      accessorKey: 'permissionCount',
      header: createSimpleHeader('Permisos'),
      meta: { class: { td: 'text-left' } },
    },
    {
      accessorKey: 'userCount',
      header: createSimpleHeader('Usuarios'),
      meta: { class: { td: 'text-left' } },
    },
    {
      accessorKey: 'createdAt',
      header: 'Creación',
    },
    {
      id: 'actions',
      header: createSimpleHeader(''),
      enableSorting: false,
      enableHiding: false,
      meta: { class: { td: 'text-right' } },
    },
  ]

  return { columns }
}
