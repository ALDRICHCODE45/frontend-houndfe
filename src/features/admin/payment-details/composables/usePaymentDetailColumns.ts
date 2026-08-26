import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { PaymentDetailTableRow } from '../interfaces/payment-detail.types'

/**
 * usePaymentDetailColumns — sdd payment-details-admin S3 (REQ-PD-001)
 *
 * Column definitions for `AppDataTable`. The actual cell rendering is
 * delegated to the view via `<template #column-cell="{ row }" />` slots so
 * this file stays purely structural.
 *
 * Locked column rules:
 *   - The `actions` column is hidden from column-visibility and pinned right
 *     by the wrapper's `defaultPinning`.
 *   - Data columns (bankName / beneficiary / clabe / accountNumber / isActive
 *     / updatedAt) are sortable / hideable.
 *   - isActive is NOT a form field — it appears as a read-only "Activa" /
 *     "Inactiva" badge rendered by the view from the row.
 *
 * `createSimpleHeader` is used for non-sortable columns so the rendered
 * header stays a plain string and survives search-toolbar i18n passes.
 */
export function usePaymentDetailColumns() {
  const columns: TableColumn<PaymentDetailTableRow>[] = [
    {
      accessorKey: 'bankName',
      header: 'Banco',
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'beneficiary',
      header: 'Beneficiario',
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: 'clabe',
      header: 'CLABE',
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: 'accountNumber',
      header: 'Número de cuenta',
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'isActive',
      header: createSimpleHeader('Estado'),
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: 'updatedAt',
      header: 'Actualización',
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'actions',
      header: createSimpleHeader(''),
      enableSorting: false,
      enableHiding: false,
      meta: { class: { td: 'text-right' } },
    },
  ]

  return { columns }
}
