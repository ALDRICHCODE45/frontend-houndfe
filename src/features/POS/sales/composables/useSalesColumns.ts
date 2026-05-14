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
  deliveryStatus: true,
  cashier: false,
  seller: false,
  channel: false,
  invoice: false,
}

export function useSalesColumns() {
  const columns: TableColumn<ConfirmedSaleRow>[] = [
    { id: 'select', header: '', enableSorting: false, enableHiding: false },
    { id: 'venta', accessorKey: 'folio', header: 'Venta' },
    { accessorKey: 'confirmedAt', header: 'Fecha' },
    { accessorKey: 'customer', header: createSimpleHeader('Cliente') },
    { accessorKey: 'paymentStatus', header: createSimpleHeader('Pago') },
    { id: 'paymentMethods', accessorKey: 'paymentMethods', header: createSimpleHeader('Método'), enableSorting: false },
    { accessorKey: 'totalCents', header: 'Total' },
    { accessorKey: 'debtCents', header: createSimpleHeader('Deuda') },
    { accessorKey: 'deliveryStatus', header: createSimpleHeader('Productos') },
    { accessorKey: 'cashier', header: createSimpleHeader('Cajero') },
    { accessorKey: 'seller', header: createSimpleHeader('Vendedor') },
    { id: 'channel', header: createSimpleHeader('Canal'), enableSorting: false },
    { id: 'invoice', header: createSimpleHeader('Factura'), enableSorting: false },
  ]

  return { columns }
}
