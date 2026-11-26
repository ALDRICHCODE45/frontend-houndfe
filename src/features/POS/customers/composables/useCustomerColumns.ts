import type { TableColumn } from '@nuxt/ui'
import type { VisibilityState } from '@tanstack/vue-table'
import type { CustomerListingRow } from '../interfaces/customer-listing.types'

/**
 * Handoff 27 §4: «Bruno (mascota de Ana Pérez)» when the search matched the
 * customer only through an ACTIVE pet (`matchedPetName`), otherwise `null`.
 */
export function formatPetMatchHint(customer: {
  fullName: string
  matchedPetName?: string | null
}): string | null {
  return customer.matchedPetName
    ? `${customer.matchedPetName} (mascota de ${customer.fullName})`
    : null
}

/** Columns built from `metrics` (handoff 32 §2.6): absent without read:Sale. */
export const CUSTOMERS_MONEY_COLUMN_IDS = [
  'openDebt',
  'oldestOverdue',
  'lastPurchaseAt',
  'totalSold',
  'salesCount',
  'averageTicket',
] as const

/** S3: 7 data columns by default; the rest wait in «Columnas». */
export const CUSTOMERS_DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  name: true,
  openDebt: true,
  oldestOverdue: true,
  lastPurchaseAt: true,
  totalSold: true,
  pets: true,
  priceList: true,
  email: false,
  location: false,
  rfc: false,
  createdAt: false,
  salesCount: false,
  averageTicket: false,
  isTrusted: false,
}

const RIGHT = { class: { th: 'text-right', td: 'text-right' } }

/**
 * customers-module T6 (S3, artboard 01). The ids of the sortable columns are the backend's sortBy
 * values (handoff 32 §2.5), so `sorting[0].id` maps straight through; `enableSorting` is explicit
 * on every column so none inherits TanStack's default-on sort. Headers of the sortable columns come
 * from the #<id>-header slots (SortableHeader) in CustomersView.vue.
 */
export function useCustomerColumns({ canReadSales }: { canReadSales: boolean }) {
  const money = new Set<string>(CUSTOMERS_MONEY_COLUMN_IDS)
  const all: TableColumn<CustomerListingRow>[] = [
    // Name, phone and the pet-match hint; the only column that is always visible.
    { id: 'name', header: 'Cliente', enableSorting: true, enableHiding: false, meta: { primary: true } },
    { id: 'openDebt', header: 'Deuda', enableSorting: true, size: 168, meta: RIGHT },
    { id: 'oldestOverdue', header: 'Vencido desde', enableSorting: true, size: 144 },
    { id: 'lastPurchaseAt', header: 'Última compra', enableSorting: true, size: 144 },
    { id: 'totalSold', header: 'Total comprado', enableSorting: true, size: 152, meta: RIGHT },
    { id: 'pets', header: 'Mascotas', enableSorting: false, size: 120 },
    { id: 'priceList', header: 'Lista de precios', enableSorting: false, size: 160 },
    { id: 'email', header: 'Correo', enableSorting: false, size: 240 },
    { id: 'location', header: 'Colonia y ciudad', enableSorting: false, size: 220 },
    { id: 'rfc', header: 'RFC', enableSorting: false, size: 152 },
    { id: 'createdAt', header: 'Alta', enableSorting: true, size: 128 },
    { id: 'salesCount', header: 'Compras', enableSorting: true, size: 112, meta: RIGHT },
    { id: 'averageTicket', header: 'Ticket promedio', enableSorting: true, size: 152, meta: RIGHT },
    { id: 'isTrusted', header: 'De confianza', enableSorting: false, size: 144 },
    {
      id: 'actions',
      header: 'Acciones',
      enableHiding: false,
      enableSorting: false,
      meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
    },
  ]

  // Default columns first, then the ones hidden in «Columnas», then ⋮.
  const columns = all.filter((column) => canReadSales || !money.has(column.id!))

  return { columns }
}
