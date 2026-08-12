import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { TenantTableRow } from '../interfaces/tenant.types'

export function useTenantColumns() {
  const columns: TableColumn<TenantTableRow>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'address',
      header: 'Dirección',
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: 'phone',
      header: 'Teléfono',
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'isActive',
      header: createSimpleHeader('Estado'),
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: 'createdAt',
      header: 'Creación',
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