import type { TableColumn } from '@nuxt/ui'
import type { Product } from '../interfaces/product.types'

/**
 * Columns by job: the name (with the SKU under it) first, the status second,
 * then what decides the next action. Cells are rendered through the
 * `#<column>-cell` slots of `ProductList.vue`; sortable headers through
 * `#<column>-header`.
 */
export function useProductColumns() {
  const columns: TableColumn<Product>[] = [
    { accessorKey: 'name', header: 'Nombre' },
    { accessorKey: 'status', header: 'Estado', enableSorting: false },
    // Hideable (visible by default) so the user can toggle it in "Columnas".
    { id: 'type', header: 'Tipo', enableSorting: false, enableHiding: true },
    { accessorKey: 'categoryName', header: 'Categoría' },
    { accessorKey: 'brandName', header: 'Marca' },
    {
      accessorKey: 'priceCents',
      header: 'Precio',
      meta: { class: { th: 'text-right', td: 'text-right' } },
    },
    {
      accessorKey: 'quantity',
      header: 'Stock',
      meta: { class: { th: 'text-right', td: 'text-right' } },
    },
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
