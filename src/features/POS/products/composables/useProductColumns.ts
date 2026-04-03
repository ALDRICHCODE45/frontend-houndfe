import type { TableColumn } from '@nuxt/ui'
import type { Product } from '../interfaces/product.types'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import { currencyFormatter } from '@/core/shared/utils/currency.utils'

export function useProductColumns() {
  const columns: TableColumn<Product>[] = [
    // ── Select checkbox ──────────────────────────────────────────────
    // Header & cell rendered via #select-header / #select-cell slots
    // in ProductsView.vue (NuxtUI components need template context)
    {
      id: 'select',
      header: '',
      enableSorting: false,
      enableHiding: false,
    },

    // ── Nombre (sortable) ─────────────────────────────────────────────
    // Header rendered via #name-header slot (SortableHeader component)
    {
      accessorKey: 'name',
      header: 'Nombre',
    },

    // ── SKU ───────────────────────────────────────────────────────────
    {
      accessorKey: 'sku',
      header: createSimpleHeader('SKU'),
    },

    // ── Categoría (sortable) ──────────────────────────────────────────
    // Header rendered via #category-header slot
    {
      accessorKey: 'categoryName',
      header: 'Categoría',
    },

    // ── Precio (sortable, formateado) ─────────────────────────────────
    // Header rendered via #price-header slot
    {
      accessorKey: 'priceCents',
      header: 'Precio',
      meta: { class: { th: 'text-right', td: 'text-right' } },
    },

    // ── Stock (sortable, con color) ───────────────────────────────────
    // Header rendered via #stock-header slot
    {
      accessorKey: 'quantity',
      header: 'Stock',
      meta: { class: { th: 'text-center', td: 'text-center' } },
    },

    // ── Estado ────────────────────────────────────────────────────────
    {
      accessorKey: 'status',
      header: createSimpleHeader('Estado'),
    },

    // ── Acciones ──────────────────────────────────────────────────────
    {
      id: 'actions',
      header: createSimpleHeader(''),
      enableHiding: false,
      enableSorting: false,
      meta: { class: { td: 'text-right' } },
    },
  ]

  return { columns, currencyFormatter }
}
