import { describe, it, expect } from 'vitest'
import { useMembershipColumns } from '../useMembershipColumns'

const keyOf = (column: { accessorKey?: unknown; id?: string }) =>
  (column.accessorKey as string | undefined) ?? column.id

describe('useMembershipColumns', () => {
  it('orders columns by job: user, status, role, date, then the ⋮ column', () => {
    const { columns } = useMembershipColumns()
    expect(columns.map(keyOf)).toEqual(['userName', 'status', 'roleName', 'createdAt', 'actions'])
    expect(columns.length).toBeLessThanOrEqual(8)
  })

  it('uses the Spanish headers and sorts by user, role and date', () => {
    const { columns } = useMembershipColumns()
    const byKey = (key: string) => columns.find((column) => keyOf(column) === key)!
    expect(columns.map((column) => column.header)).toEqual([
      'Usuario',
      'Estado',
      'Rol',
      'Ingreso',
      'Acciones',
    ])
    for (const key of ['userName', 'roleName', 'createdAt']) expect(byKey(key).enableSorting).toBe(true)
    expect(byKey('status').enableSorting).toBe(false)
  })

  it('makes the actions column last, narrow, non-sortable and non-hideable', () => {
    const { columns } = useMembershipColumns()
    const actions = columns[columns.length - 1]!
    expect(keyOf(actions)).toBe('actions')
    expect(actions.enableSorting).toBe(false)
    expect(actions.enableHiding).toBe(false)
    expect(actions.meta?.class).toEqual({ th: 'w-16', td: 'w-16 text-right' })
  })
})
