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
    {
      accessorKey: 'email',
      header: 'Email',
    },

    // ── Teléfono ───────────────────────────────────────────────────────
    {
      accessorKey: 'phone',
      header: createSimpleHeader('Teléfono'),
    },

    // ── Lista de Precios ───────────────────────────────────────────────
    {
      accessorKey: 'globalPriceListName',
      header: createSimpleHeader('Lista de Precios'),
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
