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

    // ── Tipo (SERVICE/PRODUCT badge, R-201 9→10) ─────────────────────
    // Hideable (visible by default) so the user can toggle it in the
    // "Columnas" selector. Cell rendered via #type-cell slot (AppBadge
    // tone + icon from getProductTypeBadge) in ProductsView.vue.
    {
      id: 'type',
      header: createSimpleHeader('Tipo'),
      enableSorting: false,
      enableHiding: true,
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

    // ── Marca (sortable) ─────────────────────────────────────────────
    // Header rendered via #brand-header slot
    {
      accessorKey: 'brandName',
      header: 'Marca',
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
