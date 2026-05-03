import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { TenantTableRow } from '../interfaces/tenant.types'

export function useTenantColumns() {
  const columns: TableColumn<TenantTableRow>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
    },
    {
      id: 'isActive',
      header: createSimpleHeader('Estado'),
    },
    {
      accessorKey: 'address',
      header: 'Dirección',
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
