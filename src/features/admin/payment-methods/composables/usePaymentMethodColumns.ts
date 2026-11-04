import type { TableColumn } from '@nuxt/ui'
import type { PaymentMethodTableRow } from '../interfaces/payment-method.types'

/**
 * usePaymentMethodColumns — sdd custom-payment-methods S2A (REQ-PM-001)
 *
 * Column definitions for `AppDataTable`. Cell rendering is delegated to the
 * view via `<template #column-cell="{ row }" />` slots so this file stays
 * purely structural.
 *
 * Ordered by job: the method's name (with its subtitle under it), whether it
 * is active, its category, when it changed, then the ⋮ column. `isActive` is
 * NOT a form field here but it is a column (REQ-PM-001): the cell renders the
 * Activo/Inactivo StatusBadge.
 */
export function usePaymentMethodColumns() {
  const columns: TableColumn<PaymentMethodTableRow>[] = [
    { accessorKey: 'name', header: 'Método', enableSorting: true },
    { id: 'isActive', header: 'Estado', enableSorting: false },
    { accessorKey: 'category', header: 'Categoría', enableSorting: true },
    { accessorKey: 'updatedAt', header: 'Actualizado', enableSorting: false },
    {
      id: 'actions',
      header: 'Acciones',
      enableHiding: false,
      enableSorting: false,
      meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
    },
  ]

  return { columns }
}
