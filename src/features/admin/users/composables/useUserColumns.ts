import type { TableColumn } from '@nuxt/ui'
import type { UserTableRow } from '../interfaces/user.types'

// Person first (name with the email under it), then whether they are active,
// then the roles that decide what they can do, then the date and the ⋮ column.
// Sortable headers come from the #<key>-header slots (SortableHeader) in
// AdminUsersView.vue, since NuxtUI components need template context.
export function useUserColumns() {
  const columns: TableColumn<UserTableRow>[] = [
    { accessorKey: 'name', header: 'Usuario', enableSorting: true },
    { id: 'status', header: 'Estado', enableSorting: false },
    { id: 'roles', header: 'Roles', enableSorting: false },
    { accessorKey: 'createdAt', header: 'Creación', enableSorting: true },
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
