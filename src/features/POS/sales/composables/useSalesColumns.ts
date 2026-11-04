import type { TableColumn } from '@nuxt/ui'
import type { VisibilityState } from '@tanstack/vue-table'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { ConfirmedSaleRow } from '../interfaces/sale.types'

export const defaultColumnVisibility: VisibilityState = {
  venta: true,
  customer: true,
  paymentStatus: true,
  deliveryStatus: true,
  paymentMethods: false,
  totalCents: true,
  debtCents: true,
  confirmedAt: true,
  dueDate: false,
  cashier: false,
  seller: false,
  channel: false,
  invoice: false,
}

export function useSalesColumns() {
  // `enableSorting` is declared explicitly on every column so no column silently
  // inherits TanStack's default-on behaviour. Only the columns the backend
  // accepts as `sortBy` — `confirmedAt`, `totalCents` (and `createdAt`, which
  // is not a visible column but is offered by the USelect shortcut) — declare
  // `enableSorting: true`; their ids match those field names, so
  // `sorting[0].id` maps straight through with no translation layer. The rest
  // are explicitly false so no dead sort control appears on a column the
  // backend cannot order by (sorting by them returns a 400).
  const columns: TableColumn<ConfirmedSaleRow>[] = [
    { id: 'venta', accessorKey: 'folio', header: 'Venta', enableSorting: false },
    { accessorKey: 'customer', header: createSimpleHeader('Cliente'), enableSorting: false },
    { accessorKey: 'paymentStatus', header: createSimpleHeader('Pago'), enableSorting: false },
    { accessorKey: 'deliveryStatus', header: createSimpleHeader('Productos'), enableSorting: false },
    { id: 'paymentMethods', accessorKey: 'paymentMethods', header: createSimpleHeader('Método'), enableSorting: false },
    { accessorKey: 'totalCents', header: 'Total', enableSorting: true, meta: { class: { th: 'text-right', td: 'text-right' } } },
    { accessorKey: 'debtCents', header: createSimpleHeader('Deuda'), enableSorting: false, meta: { class: { th: 'text-right', td: 'text-right' } } },
    { accessorKey: 'confirmedAt', header: 'Fecha', enableSorting: true },
    { accessorKey: 'dueDate', header: createSimpleHeader('Vence'), enableSorting: false },
    { accessorKey: 'cashier', header: createSimpleHeader('Cajero'), enableSorting: false },
    { accessorKey: 'seller', header: createSimpleHeader('Vendedor'), enableSorting: false },
    { id: 'channel', header: createSimpleHeader('Canal'), enableSorting: false },
    { id: 'invoice', header: createSimpleHeader('Factura'), enableSorting: false },
  ]

  return { columns }
}
