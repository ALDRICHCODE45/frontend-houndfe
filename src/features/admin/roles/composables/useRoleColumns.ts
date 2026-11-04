import type { TableColumn } from '@nuxt/ui'
import type { RoleTableRow } from '../interfaces/role.types'

// Name first (with the description under it), then the type, then the counts
// that decide the next action, then the date and the ⋮ column. Sortable
// headers come from the #<key>-header slots (SortableHeader) in
// AdminRolesView.vue, since NuxtUI components need template context.
const right = { class: { th: 'text-right', td: 'text-right' } }

export function useRoleColumns() {
  const columns: TableColumn<RoleTableRow>[] = [
    { accessorKey: 'name', header: 'Rol', enableSorting: true },
    { id: 'type', header: 'Tipo', enableSorting: false },
    { accessorKey: 'permissionCount', header: 'Permisos', enableSorting: true, meta: right },
    { accessorKey: 'userCount', header: 'Usuarios', enableSorting: true, meta: right },
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
