import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { PendingHumanDecision } from '../interfaces/human-decision.types'
import {
  branchPresentationLabel,
  requestedQuantityPresentationLabel,
} from '../utils/humanDecisionPresentation'

export function useHumanDecisionColumns() {
  const columns: TableColumn<PendingHumanDecision>[] = [
    {
      id: 'product',
      accessorFn: (row) => row.snapshot.productName,
      header: createSimpleHeader('Producto'),
      enableSorting: false,
    },
    {
      id: 'branch',
      accessorFn: (row) => branchPresentationLabel(row.snapshot.branchName),
      header: createSimpleHeader('Sucursal'),
      enableSorting: false,
    },
    {
      id: 'requestedQuantity',
      accessorFn: (row) => requestedQuantityPresentationLabel(row.snapshot.requestedQuantity),
      header: createSimpleHeader('Solicitado'),
      enableSorting: false,
    },
    {
      id: 'createdAt',
      accessorFn: (row) => row.createdAt,
      header: createSimpleHeader('Creada'),
      enableSorting: false,
    },
    {
      id: 'actions',
      header: createSimpleHeader(''),
      enableSorting: false,
      enableHiding: false,
    },
  ]

  return { columns }
}
