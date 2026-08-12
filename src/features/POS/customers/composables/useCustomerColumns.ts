import type { TableColumn } from '@nuxt/ui'
import type { Customer } from '../interfaces/customer.types'
import { createSimpleHeader } from '@/core/shared/components/DataTable'

export function useCustomerColumns() {
  const columns: TableColumn<Customer>[] = [
    // ── Select checkbox ────────────────────────────────────────────────
    // Header & cell rendered via #select-header / #select-cell slots
    // in CustomersView.vue (NuxtUI components need template context)
    {
      id: 'select',
      header: '',
      enableSorting: false,
      enableHiding: false,
    },

    // ── Nombre completo (sortable) ─────────────────────────────────────
    {
      accessorKey: 'fullName',
      header: 'Nombre',
    },

    // ── Email ──────────────────────────────────────────────────────────
    // header text comes from the #email-header slot (SortableHeader).
    {
      accessorKey: 'email',
      header: 'Email',
    },

    // ── Teléfono ───────────────────────────────────────────────────────
    // header text comes from the #phone-header slot (SortableHeader).
    {
      accessorKey: 'phone',
      header: 'Teléfono',
    },

    // ── Lista de Precios ───────────────────────────────────────────────
    // header text comes from the #globalPriceListName-header slot (SortableHeader).
    {
      accessorKey: 'globalPriceListName',
      header: 'Lista de Precios',
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

  return { columns }
}
