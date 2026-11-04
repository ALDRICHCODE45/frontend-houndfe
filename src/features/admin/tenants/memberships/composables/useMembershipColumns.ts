import type { TableColumn } from '@nuxt/ui'
import type { MembershipTableRow } from '../interfaces/membership.types'

// Person first (name with the email under it), then whether they are active,
// then the role that decides what they can do, then when they joined and the ⋮
// column. Sortable headers come from the #<key>-header slots (SortableHeader)
// in AdminTenantMembersView.vue, since NuxtUI components need template context.
export function useMembershipColumns() {
  const columns: TableColumn<MembershipTableRow>[] = [
    { accessorKey: 'userName', header: 'Usuario', enableSorting: true },
    { id: 'status', header: 'Estado', enableSorting: false },
    { accessorKey: 'roleName', header: 'Rol', enableSorting: true },
    { accessorKey: 'createdAt', header: 'Ingreso', enableSorting: true },
    {
      id: 'actions',
      header: 'Acciones',
      enableHiding: false,
      enableSorting: false,
      meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
    },
  ]

  return { columns }
}
