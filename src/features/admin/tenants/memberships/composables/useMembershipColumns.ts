import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { MembershipTableRow } from '../interfaces/membership.types'

export function useMembershipColumns() {
  const columns: TableColumn<MembershipTableRow>[] = [
    {
      accessorKey: 'userName',
      header: 'Usuario',
    },
    {
      accessorKey: 'roleName',
      header: 'Rol',
    },
    {
      accessorKey: 'createdAt',
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
