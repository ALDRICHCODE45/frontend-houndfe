import type { TableColumn } from '@nuxt/ui'
import type { HumanDecision } from '../interfaces/human-decision.types'
import {
  requestedQuantityPresentationLabel,
  resolvedResponseLabel,
} from '../utils/humanDecisionPresentation'

// The request first, then its status, then what decides the next action
// (how many, when) and the response. No branch column: the inbox is scoped to
// the current branch, so it would repeat the same name on every row. There is
// no ⋮ column: its only item would repeat the row click. Header text is
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
  ]

  return { columns }
}
