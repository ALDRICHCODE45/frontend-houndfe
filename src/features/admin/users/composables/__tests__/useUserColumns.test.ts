import { describe, it, expect } from 'vitest'
import { useUserColumns } from '../useUserColumns'

const keyOf = (column: { accessorKey?: unknown; id?: string }) =>
  (column.accessorKey as string | undefined) ?? column.id

describe('useUserColumns', () => {
  it('orders columns by job: user, status, roles, date, then the ⋮ column', () => {
    const { columns } = useUserColumns()
    expect(columns.map(keyOf)).toEqual(['name', 'status', 'roles', 'createdAt', 'actions'])
    expect(columns.length).toBeLessThanOrEqual(8)
  })

  it('folds the email under the name instead of a column of its own', () => {
    const { columns } = useUserColumns()
    expect(columns.map(keyOf)).not.toContain('email')
  })

  it('names the first column after the record and sorts by name and date', () => {
    const { columns } = useUserColumns()
    const byKey = (key: string) => columns.find((column) => keyOf(column) === key)!
    expect(byKey('name').header).toBe('Usuario')
    expect(byKey('name').enableSorting).toBe(true)
    expect(byKey('createdAt').enableSorting).toBe(true)
    for (const key of ['status', 'roles']) expect(byKey(key).enableSorting).toBe(false)
  })

  it('makes the actions column last, narrow, non-sortable and non-hideable', () => {
    const { columns } = useUserColumns()
    const actions = columns[columns.length - 1]!
    expect(keyOf(actions)).toBe('actions')
    expect(actions.enableSorting).toBe(false)
    expect(actions.enableHiding).toBe(false)
    expect(actions.meta?.class).toEqual({ th: 'w-16', td: 'w-16 text-right' })
  })
})
