import type { TableColumn } from '@nuxt/ui'
import type { HumanDecision } from '../interfaces/human-decision.types'
import {
  branchPresentationLabel,
  requestedQuantityPresentationLabel,
  resolvedResponseLabel,
} from '../utils/humanDecisionPresentation'

// The request first, then its status, then what decides the next action
// (how many, where, when), the response, and the ⋮ column last. Header text is
// plain: the server owns ordering, so no column is sortable.
export function useHumanDecisionColumns() {
  const columns: TableColumn<HumanDecision>[] = [
    {
      id: 'product',
      accessorFn: (row) => row.snapshot.productName,
      header: 'Solicitud',
      enableSorting: false,
    },
    {
      id: 'status',
      accessorFn: (row) => (row.status === 'PENDING' ? 'Pendiente' : 'Respondida'),
      header: 'Estado',
      enableSorting: false,
    },
    {
      id: 'requestedQuantity',
      accessorFn: (row) =>
        row.type === 'EXPIRATION'
          ? '—'
          : requestedQuantityPresentationLabel(row.snapshot.requestedQuantity),
      header: 'Solicitado',
      enableSorting: false,
      meta: { class: { th: 'text-right', td: 'text-right' } },
    },
    {
      id: 'branch',
      accessorFn: (row) => branchPresentationLabel(row.snapshot.branchName),
      header: 'Sucursal',
      enableSorting: false,
    },
    {
      id: 'createdAt',
      accessorFn: (row) => row.createdAt,
      header: 'Creada',
      enableSorting: false,
    },
    {
      id: 'response',
      accessorFn: (row) =>
        row.status === 'RESOLVED' ? resolvedResponseLabel(row.resolution) : '—',
      header: 'Respuesta',
      enableSorting: false,
    },
    {
      id: 'actions',
      header: 'Acciones',
      enableSorting: false,
      enableHiding: false,
      meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
    },
  ]

  return { columns }
}
