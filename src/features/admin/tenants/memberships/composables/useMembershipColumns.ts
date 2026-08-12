import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { MembershipTableRow } from '../interfaces/membership.types'

export function useMembershipColumns() {
  const columns: TableColumn<MembershipTableRow>[] = [
    {
      accessorKey: 'userName',
      header: 'Usuario',
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'roleName',
      header: 'Rol',
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'createdAt',
      header: 'Fecha de ingreso',
      enableSorting: true,
      enableHiding: true,
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
