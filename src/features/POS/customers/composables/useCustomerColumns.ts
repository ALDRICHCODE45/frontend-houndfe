import type { TableColumn } from '@nuxt/ui'
import type { Customer } from '../interfaces/customer.types'

/**
 * Handoff 27 §4: «Bruno (mascota de Ana Pérez)» when the search matched the
 * customer only through an ACTIVE pet (`matchedPetName`), otherwise `null`.
 */
export function formatPetMatchHint(
  customer: Pick<Customer, 'fullName' | 'matchedPetName'>,
): string | null {
  return customer.matchedPetName
    ? `${customer.matchedPetName} (mascota de ${customer.fullName})`
    : null
}

// Name first, then how to reach them, then the price list, then the ⋮ column.
// Headers of the data columns come from the #<key>-header slots (SortableHeader)
// in CustomersView.vue, since NuxtUI components need template context.
export function useCustomerColumns() {
  const columns: TableColumn<Customer>[] = [
    { accessorKey: 'fullName', header: 'Nombre' },
    // Default widths that show a whole e-mail and phone; the name keeps the free space.
    { accessorKey: 'email', header: 'Correo electrónico', size: 240 },
    { accessorKey: 'phone', header: 'Teléfono', size: 168 },
    { accessorKey: 'globalPriceListName', header: 'Lista de precios', size: 160 },
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
