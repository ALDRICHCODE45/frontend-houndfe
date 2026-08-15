/**
 * usePendingApprovalsColumns — WU-A (REQ-3)
 *
 * Column definitions for the PendingApprovalsView table (table mode of the
 * AppDataTable hybrid). The view uses these via `usePendingApprovalsColumns()`
 * to define the 8 columns: colaborador, tipo, fechas, dias, motivo, estado,
 * solicitada, acciones.
 *
 * Design contract:
 *  - 7 data columns are hideable (`enableHiding: true`)
 *  - `acciones` is NOT hideable (`enableHiding: false`) + right-aligned
 *  - All columns explicitly disable sorting (sorting deferred per design)
 *  - `createSimpleHeader` produces the header cells (consistent with the
 *    `useEmployeeColumns` precedent).
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
      id: 'tipo',
      header: createSimpleHeader('Tipo'),
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
      id: 'estado',
      header: createSimpleHeader('Estado'),
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
      header: createSimpleHeader(''),
      enableHiding: false,
      enableSorting: false,
      meta: { class: { td: 'text-right' } },
    },
  ])

  return { columns }
}