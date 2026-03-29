import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Product } from '../interfaces/product.types'
import { createSortableHeader } from '@/core/shared/components/DataTable'

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function useProductColumns() {
  // resolveComponent() solo para los elementos que NECESITAN h():
  // headers con sort (dependen del estado de la columna en runtime)
  // y la columna select (checkbox de selección)
  const UButton = resolveComponent('UButton')
  const UCheckbox = resolveComponent('UCheckbox')

  const columns: TableColumn<Product>[] = [
    // ── Select checkbox ──────────────────────────────────────────────
    // Debe usar h() porque el estado indeterminate/checked se calcula
    // a partir del API de TanStack Table en runtime
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

    // ── Nombre (sortable) ─────────────────────────────────────────────
    // Header usa h() para el botón de sort interactivo
    // Cell usa slot #name-cell en ProductsView → Vue template puro
    {
      accessorKey: 'name',
      header: ({ column }) => createSortableHeader(column, 'Nombre', UButton),
    },

    // ── SKU ───────────────────────────────────────────────────────────
    // Slot #sku-cell en ProductsView
    {
      accessorKey: 'sku',
      header: 'SKU',
    },

    // ── Categoría (sortable) ──────────────────────────────────────────
    {
      accessorKey: 'category',
      header: ({ column }) => createSortableHeader(column, 'Categoría', UButton),
    },

    // ── Precio (sortable, formateado) ─────────────────────────────────
    // Slot #price-cell en ProductsView
    {
      accessorKey: 'price',
      header: ({ column }) => createSortableHeader(column, 'Precio', UButton),
      meta: { class: { th: 'text-right', td: 'text-right' } },
    },

    // ── Stock (sortable, con color) ───────────────────────────────────
    // Slot #stock-cell en ProductsView
    {
      accessorKey: 'stock',
      header: ({ column }) => createSortableHeader(column, 'Stock', UButton),
      meta: { class: { th: 'text-center', td: 'text-center' } },
    },

    // ── Estado ────────────────────────────────────────────────────────
    // Slot #status-cell en ProductsView
    {
      accessorKey: 'status',
      header: 'Estado',
    },

    // ── Acciones ──────────────────────────────────────────────────────
    // Slot #actions-cell en ProductsView
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      enableSorting: false,
      meta: { class: { td: 'text-right' } },
    },
  ]

  return { columns, currencyFormatter }
}
