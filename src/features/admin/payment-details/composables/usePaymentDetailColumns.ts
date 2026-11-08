import type { TableColumn } from '@nuxt/ui'
import type { PaymentDetailTableRow } from '../interfaces/payment-detail.types'

/**
 * usePaymentDetailColumns — sdd payment-details-admin S3 (REQ-PD-001)
 *
 * Column definitions for `AppDataTable`. Cell rendering is delegated to the
 * view via `<template #column-cell="{ row }" />` slots so this file stays
 * purely structural.
 *
 * Ordered by job: the bank (with the beneficiary under it), whether the account
 * is active, the CLABE and account number that customers transfer to, when it
 * changed, then the ⋮ column. `isActive` is NOT a form field — it appears as a
 * read-only "Activa" / "Inactiva" StatusBadge rendered by the view.
 */
export function usePaymentDetailColumns() {
  const columns: TableColumn<PaymentDetailTableRow>[] = [
    { accessorKey: 'bankName', header: 'Banco', enableSorting: true },
    { id: 'isActive', header: 'Estado', enableSorting: false },
    // The CLABE (18 digits) and the account number read whole at their default width.
    { accessorKey: 'clabe', header: 'CLABE', enableSorting: false, size: 192 },
    { accessorKey: 'accountNumber', header: 'Número de cuenta', enableSorting: false, size: 168 },
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
