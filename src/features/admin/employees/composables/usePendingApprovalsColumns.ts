/**
 * usePendingApprovalsColumns — WU-A (REQ-3)
 *
 * Column definitions for the PendingApprovalsView table (the desktop form of
 * the table + cards layout). Ordered by job: the person, the status, the dates
 * that decide when to act, then type, days, reason and when it was requested,
 * and the ⋮ column last: colaborador, estado, fechas, tipo, dias, motivo,
 * solicitada, acciones.
 *
 * Design contract:
 *  - 7 data columns are hideable (`enableHiding: true`)
 *  - `acciones` is NOT hideable (`enableHiding: false`), 64px, right-aligned
 *  - All columns explicitly disable sorting (sorting deferred per design)
 *  - `createSimpleHeader` produces the header cells (consistent with the
 *    `useEmployeeColumns` precedent); the acciones header is announced to
 *    assistive tech only, from the view's `#acciones-header` slot.
 */

import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { createSimpleHeader } from '@/core/shared/components/DataTable'
import type { TimeOffRequest } from '../interfaces/employee.types'

/**
 * usePendingApprovalsColumns — reactive column definitions for the
 * pending-approvals table.
 *
 * Returns:
 *  - columns — computed ref of TableColumn<TimeOffRequest>[]
 */
export function usePendingApprovalsColumns() {
  const columns = computed<TableColumn<TimeOffRequest>[]>(() => [
    {
      id: 'colaborador',
      header: createSimpleHeader('Colaborador'),
      enableHiding: true,
      enableSorting: false,
    },
    {
      id: 'estado',
      header: createSimpleHeader('Estado'),
      enableHiding: true,
      enableSorting: false,
    },
    {
      id: 'fechas',
      header: createSimpleHeader('Fechas'),
      enableHiding: true,
      enableSorting: false,
    },
    {
      id: 'tipo',
      header: createSimpleHeader('Tipo'),
      enableHiding: true,
      enableSorting: false,
    },
    {
      id: 'dias',
      header: createSimpleHeader('Días'),
      enableHiding: true,
      enableSorting: false,
    },
    {
      id: 'motivo',
      header: createSimpleHeader('Motivo'),
      enableHiding: true,
      enableSorting: false,
    },
    {
      id: 'solicitada',
      header: createSimpleHeader('Solicitada'),
      enableHiding: true,
      enableSorting: false,
    },
    {
      id: 'acciones',
      header: 'Acciones',
      enableHiding: false,
      enableSorting: false,
      meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
    },
  ])

  return { columns }
}