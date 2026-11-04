import { describe, it, expect } from 'vitest'
import { useTenantColumns } from '../useTenantColumns'

const keyOf = (column: { accessorKey?: unknown; id?: string }) =>
  (column.accessorKey as string | undefined) ?? column.id

describe('useTenantColumns', () => {
  it('orders columns by job: name, status, address, phone, date, then the ⋮ column', () => {
    const { columns } = useTenantColumns()
    expect(columns.map(keyOf)).toEqual(['name', 'isActive', 'address', 'phone', 'createdAt', 'actions'])
    expect(columns.length).toBeLessThanOrEqual(8)
  })

  it('folds the slug under the name instead of a column of its own', () => {
    const { columns } = useTenantColumns()
    expect(columns.map(keyOf)).not.toContain('slug')
  })

  it('names the first column after the record and sorts by name and date', () => {
    const { columns } = useTenantColumns()
    const byKey = (key: string) => columns.find((column) => keyOf(column) === key)!
    expect(byKey('name').header).toBe('Sucursal')
    expect(byKey('name').enableSorting).toBe(true)
    expect(byKey('createdAt').enableSorting).toBe(true)
    for (const key of ['isActive', 'address', 'phone']) expect(byKey(key).enableSorting).toBe(false)
  })

  it('makes the actions column last, narrow, non-sortable and non-hideable', () => {
    const { columns } = useTenantColumns()
    const actions = columns[columns.length - 1]!
    expect(keyOf(actions)).toBe('actions')
    expect(actions.enableSorting).toBe(false)
    expect(actions.enableHiding).toBe(false)
    expect(actions.meta?.class).toEqual({ th: 'w-16', td: 'w-16 text-right' })
  })
})
