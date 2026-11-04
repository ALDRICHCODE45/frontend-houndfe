import type { TableColumn } from '@nuxt/ui'
import type { Customer } from '../interfaces/customer.types'

// Name first, then how to reach them, then the price list, then the ⋮ column.
// Headers of the data columns come from the #<key>-header slots (SortableHeader)
// in CustomersView.vue, since NuxtUI components need template context.
export function useCustomerColumns() {
  const columns: TableColumn<Customer>[] = [
    { accessorKey: 'fullName', header: 'Nombre' },
    { accessorKey: 'email', header: 'Correo electrónico' },
    { accessorKey: 'phone', header: 'Teléfono' },
    { accessorKey: 'globalPriceListName', header: 'Lista de precios' },
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
