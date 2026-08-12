import { describe, it, expect } from 'vitest'
import { useUserColumns } from '../useUserColumns'

describe('useUserColumns', () => {
  it('returns a columns array', () => {
    const { columns } = useUserColumns()
    expect(Array.isArray(columns)).toBe(true)
    expect(columns.length).toBeGreaterThan(0)
  })

  it('orders columns as [name, email, roles, createdAt, actions]', () => {
    const { columns } = useUserColumns()
    const ids = columns.map((c) => {
      if ('accessorKey' in c && c.accessorKey) return c.accessorKey as string
      return (c as { id: string }).id
    })
    expect(ids).toEqual(['name', 'email', 'roles', 'createdAt', 'actions'])
  })

  it('name column uses header "Usuario" and is sortable', () => {
    const { columns } = useUserColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'name')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Usuario')
    expect(col!.enableSorting).toBe(true)
  })

  it('email column uses accessorKey "email" with header "Email" and is hideable + sortable', () => {
    const { columns } = useUserColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'email')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Email')
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('roles column uses createSimpleHeader (non-sortable string-returning fn)', () => {
    const { columns } = useUserColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'roles')
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(false)
    expect(typeof col!.header).toBe('function')
    expect((col!.header as () => string)()).toBe('Roles')
  })

  it('createdAt column uses header "Creación" and is sortable', () => {
    const { columns } = useUserColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'createdAt')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Creación')
    expect(col!.enableSorting).toBe(true)
  })

  it('actions column is non-sortable, non-hideable and has text-right cell alignment', () => {
    const { columns } = useUserColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'actions')
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(false)
    expect(col!.meta?.class?.td).toBe('text-right')
  })
})
