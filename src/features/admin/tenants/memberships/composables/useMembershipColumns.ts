import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { MembershipTableRow } from '../interfaces/membership.types'

export function useMembershipColumns() {
  const columns: TableColumn<MembershipTableRow>[] = [
    {
      accessorKey: 'userEmail',
      header: 'Email',
    },
    {
      accessorKey: 'userName',
      header: 'Nombre',
    },
    {
      accessorKey: 'roleName',
      header: 'Rol',
    },
    {
      accessorKey: 'id',
      header: 'Fecha de ingreso',
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
