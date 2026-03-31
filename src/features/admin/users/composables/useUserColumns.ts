import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { UserTableRow } from '../interfaces/user.types'

export function useUserColumns() {
  const columns: TableColumn<UserTableRow>[] = [
    {
      accessorKey: 'name',
      header: 'Usuario',
    },
    {
      id: 'roles',
      header: createSimpleHeader('Roles'),
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
