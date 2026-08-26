import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { PaymentMethodTableRow } from '../interfaces/payment-method.types'

/**
 * usePaymentMethodColumns — sdd custom-payment-methods S2A (REQ-PM-001)
 *
 * Column definitions for `AppDataTable`. The actual cell rendering is
 * delegated to the view via `<template #column-cell="{ row }" />` slots so
 * this file stays purely structural.
 *
 * Locked column rules:
 *   - The `actions` column is hidden from column-visibility and pinned right
 *     by the wrapper's `defaultPinning`.
 *   - Data columns (name / category / subtitle / isActive / updatedAt) are
 *     sortable / hideable.
 *   - `isActive` is NOT a form field but it IS a sortable column on the table
 *     surface (REQ-PM-001). The cell renders the Activo/Inactivo badge.
 *
 * `createSimpleHeader` is used for non-sortable columns so the rendered
 * header stays a plain string and survives search-toolbar i18n passes.
 */
export function usePaymentMethodColumns() {
  const columns: TableColumn<PaymentMethodTableRow>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'category',
      header: 'Categoría',
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'subtitle',
      header: 'Subtítulo',
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