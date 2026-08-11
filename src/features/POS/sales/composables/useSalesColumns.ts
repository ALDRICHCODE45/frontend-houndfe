import type { TableColumn } from '@nuxt/ui'
import type { VisibilityState } from '@tanstack/vue-table'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { ConfirmedSaleRow } from '../interfaces/sale.types'

export const defaultColumnVisibility: VisibilityState = {
  venta: true,
  confirmedAt: true,
  customer: true,
  paymentStatus: true,
  paymentMethods: true,
  totalCents: true,
  debtCents: true,
  dueDate: false,
  deliveryStatus: true,
  cashier: false,
  seller: false,
  channel: false,
  invoice: false,
}

export function useSalesColumns() {
  // `enableSorting` is declared explicitly on every column so no column silently
  // inherits TanStack's default-on behaviour. The nine `true` columns are the
  // ones the backend accepts as `sortBy`; their ids match those field names, so
  // `sorting[0].id` maps straight through with no translation layer.
  const columns: TableColumn<ConfirmedSaleRow>[] = [
    { id: 'select', header: '', enableSorting: false, enableHiding: false },
    { id: 'venta', accessorKey: 'folio', header: 'Venta', enableSorting: true },
    { accessorKey: 'confirmedAt', header: 'Fecha', enableSorting: true },
    { accessorKey: 'customer', header: createSimpleHeader('Cliente'), enableSorting: true },
    { accessorKey: 'paymentStatus', header: createSimpleHeader('Pago'), enableSorting: true },
    { id: 'paymentMethods', accessorKey: 'paymentMethods', header: createSimpleHeader('Método'), enableSorting: false },
    { accessorKey: 'totalCents', header: 'Total', enableSorting: true },
    { accessorKey: 'debtCents', header: createSimpleHeader('Deuda'), enableSorting: true },
    { accessorKey: 'dueDate', header: createSimpleHeader('Vence'), enableSorting: false },
    { accessorKey: 'deliveryStatus', header: createSimpleHeader('Productos'), enableSorting: true },
    { accessorKey: 'cashier', header: createSimpleHeader('Cajero'), enableSorting: true },
    { accessorKey: 'seller', header: createSimpleHeader('Vendedor'), enableSorting: true },
    { id: 'channel', header: createSimpleHeader('Canal'), enableSorting: false },
    { id: 'invoice', header: createSimpleHeader('Factura'), enableSorting: false },
  ]

  return { columns }
}
