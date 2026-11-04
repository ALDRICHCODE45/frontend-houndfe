import { describe, it, expect } from 'vitest'
import { useRoleColumns } from '../useRoleColumns'

const keyOf = (column: { accessorKey?: unknown; id?: string }) =>
  (column.accessorKey as string | undefined) ?? column.id

describe('useRoleColumns', () => {
  it('orders columns by job: name, type, counts, date, then the ⋮ column', () => {
    const { columns } = useRoleColumns()
    expect(columns.map(keyOf)).toEqual([
      'name',
      'type',
      'permissionCount',
      'userCount',
      'createdAt',
      'actions',
    ])
  })

  it('keeps at most 8 columns and no description column (it rides under the name)', () => {
    const { columns } = useRoleColumns()
    expect(columns.length).toBeLessThanOrEqual(8)
    expect(columns.map(keyOf)).not.toContain('description')
  })

  it('names the first column after the record and keeps sorting where it decides the order', () => {
    const { columns } = useRoleColumns()
    const byKey = (key: string) => columns.find((column) => keyOf(column) === key)!
    expect(byKey('name').header).toBe('Rol')
    for (const key of ['name', 'permissionCount', 'userCount', 'createdAt']) {
      expect(byKey(key).enableSorting).toBe(true)
    }
    expect(byKey('type').enableSorting).toBe(false)
  })

  it('right-aligns the counts', () => {
    const { columns } = useRoleColumns()
    for (const key of ['permissionCount', 'userCount']) {
      const column = columns.find((candidate) => keyOf(candidate) === key)!
      expect(column.meta?.class).toEqual({ th: 'text-right', td: 'text-right' })
    }
  })

  it('makes the actions column last, narrow, non-sortable and non-hideable', () => {
    const { columns } = useRoleColumns()
    const actions = columns[columns.length - 1]!
    expect(keyOf(actions)).toBe('actions')
    expect(actions.enableSorting).toBe(false)
    expect(actions.enableHiding).toBe(false)
    expect(actions.meta?.class).toEqual({ th: 'w-16', td: 'w-16 text-right' })
  })
})
