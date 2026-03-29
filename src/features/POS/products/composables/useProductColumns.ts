import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Product } from '../interfaces/product.types'
import { createSortableHeader } from '@/core/shared/components/DataTable'

const statusConfig = {
  active: { color: 'success' as const, label: 'Activo' },
  inactive: { color: 'neutral' as const, label: 'Inactivo' },
  out_of_stock: { color: 'error' as const, label: 'Sin Stock' },
} as const

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function useProductColumns() {
  // MUST be called at setup scope — resolveComponent only works here
  const UBadge = resolveComponent('UBadge')
  const UButton = resolveComponent('UButton')
  const UDropdownMenu = resolveComponent('UDropdownMenu')
  const UCheckbox = resolveComponent('UCheckbox')

  const columns: TableColumn<Product>[] = [
    // Select checkbox
    {
      id: 'select',
      header: ({ table }) =>
        h(UCheckbox, {
          modelValue: table.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : table.getIsAllPageRowsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
            table.toggleAllPageRowsSelected(!!value),
          ariaLabel: 'Seleccionar todos',
        }),
      cell: ({ row }) =>
        h(UCheckbox, {
          modelValue: row.getIsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
          ariaLabel: 'Seleccionar fila',
        }),
      enableSorting: false,
      enableHiding: false,
    },
    // Name (sortable)
    {
      accessorKey: 'name',
      header: ({ column }) => createSortableHeader(column, 'Nombre', UButton),
      cell: ({ row }) => h('div', { class: 'font-medium' }, row.getValue('name') as string),
    },
    // SKU
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) =>
        h('span', { class: 'text-muted font-mono text-xs' }, row.getValue('sku') as string),
    },
    // Category (sortable)
    {
      accessorKey: 'category',
      header: ({ column }) => createSortableHeader(column, 'Categoría', UButton),
    },
    // Price (sortable, formatted)
    {
      accessorKey: 'price',
      header: ({ column }) => createSortableHeader(column, 'Precio', UButton),
      cell: ({ row }) => {
        const price = row.getValue('price') as number
        return h('span', { class: 'font-medium tabular-nums' }, currencyFormatter.format(price))
      },
      meta: { class: { th: 'text-right', td: 'text-right' } },
    },
    // Stock (sortable, color-coded)
    {
      accessorKey: 'stock',
      header: ({ column }) => createSortableHeader(column, 'Stock', UButton),
      cell: ({ row }) => {
        const stock = row.getValue('stock') as number
        const color = stock === 0 ? 'error' : stock < 10 ? 'warning' : 'success'
        return h(UBadge, { color, variant: 'subtle' }, () => String(stock))
      },
      meta: { class: { th: 'text-center', td: 'text-center' } },
    },
    // Status (badge)
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const status = row.getValue('status') as Product['status']
        const { color, label } = statusConfig[status]
        return h(UBadge, { color, variant: 'subtle', class: 'capitalize' }, () => label)
      },
    },
    // Actions (dropdown)
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        return h(
          UDropdownMenu,
          {
            content: { align: 'end' as const },
            items: [
              [
                {
                  label: 'Editar',
                  icon: 'i-lucide-pencil',
                  onSelect: () => {
                    console.log('Edit product:', row.original.id)
                  },
                },
              ],
              [
                {
                  label: 'Eliminar',
                  icon: 'i-lucide-trash-2',
                  color: 'error',
                  onSelect: () => {
                    console.log('Delete product:', row.original.id)
                  },
                },
              ],
            ],
          },
          () =>
            h(UButton, {
              icon: 'i-lucide-ellipsis-vertical',
              color: 'neutral',
              variant: 'ghost',
              class: 'size-7',
            }),
        )
      },
      enableHiding: false,
      enableSorting: false,
      meta: { class: { td: 'text-right' } },
    },
  ]

  return { columns }
}
