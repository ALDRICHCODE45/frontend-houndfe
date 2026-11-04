import type { TableColumn } from '@nuxt/ui'
import type { TenantTableRow } from '../interfaces/tenant.types'

// Name first (the slug is an id-like value, so it is not shown), then the status, then how to find the
// branch, then the date and the ⋮ column. Sortable headers come from the
// #<key>-header slots (SortableHeader) in AdminTenantsView.vue, since NuxtUI
// components need template context.
export function useTenantColumns() {
  const columns: TableColumn<TenantTableRow>[] = [
    { accessorKey: 'name', header: 'Sucursal', enableSorting: true },
    { id: 'isActive', header: 'Estado', enableSorting: false },
    { accessorKey: 'address', header: 'Dirección', enableSorting: false },
    { accessorKey: 'phone', header: 'Teléfono', enableSorting: false },
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
