import { describe, it, expect } from 'vitest'
import { useRoleColumns } from '../useRoleColumns'

describe('useRoleColumns', () => {
  it('returns a columns array', () => {
    const { columns } = useRoleColumns()
    expect(Array.isArray(columns)).toBe(true)
    expect(columns.length).toBeGreaterThan(0)
  })

  it('orders columns as [name, description, permissionCount, userCount, createdAt, actions]', () => {
    const { columns } = useRoleColumns()
    const ids = columns.map((c) => {
      if ('accessorKey' in c && c.accessorKey) return c.accessorKey as string
      return (c as { id: string }).id
    })
    expect(ids).toEqual([
      'name',
      'description',
      'permissionCount',
      'userCount',
      'createdAt',
      'actions',
    ])
  })

  it('name column uses header "Nombre" and is sortable + hideable', () => {
    const { columns } = useRoleColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'name')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Nombre')
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('description column is non-sortable but hideable', () => {
    const { columns } = useRoleColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'description')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Descripción')
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(true)
  })

  it('permissionCount column is sortable and hideable', () => {
    const { columns } = useRoleColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'permissionCount')
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('userCount column is sortable and hideable', () => {
    const { columns } = useRoleColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'userCount')
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('createdAt column uses header "Creación" and is sortable + hideable', () => {
    const { columns } = useRoleColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'createdAt')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Creación')
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('actions column is non-sortable, non-hideable and has text-right cell alignment', () => {
    const { columns } = useRoleColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'actions')
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(false)
    expect(col!.meta?.class?.td).toBe('text-right')
  })
})
