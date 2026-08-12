import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { UserTableRow } from '../interfaces/user.types'

export function useUserColumns() {
  const columns: TableColumn<UserTableRow>[] = [
    {
      accessorKey: 'name',
      header: 'Usuario',
      enableSorting: true,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      enableSorting: true,
      enableHiding: true,
    },
    {
      id: 'roles',
      header: createSimpleHeader('Roles'),
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: 'createdAt',
      header: 'Creación',
      enableSorting: true,
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
