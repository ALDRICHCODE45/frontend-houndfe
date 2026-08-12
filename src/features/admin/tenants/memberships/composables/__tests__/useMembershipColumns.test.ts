import { describe, it, expect } from 'vitest'
import { useMembershipColumns } from '../useMembershipColumns'

describe('useMembershipColumns', () => {
  it('returns a columns array', () => {
    const { columns } = useMembershipColumns()
    expect(Array.isArray(columns)).toBe(true)
    expect(columns.length).toBeGreaterThan(0)
  })

  it('orders columns as [userName, roleName, createdAt, actions]', () => {
    const { columns } = useMembershipColumns()
    const ids = columns.map((c) => {
      if ('accessorKey' in c && c.accessorKey) return c.accessorKey as string
      return (c as { id: string }).id
    })
    expect(ids).toEqual(['userName', 'roleName', 'createdAt', 'actions'])
  })

  it('userName column uses header "Usuario" and is sortable + hideable', () => {
    const { columns } = useMembershipColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'userName')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Usuario')
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('roleName column uses header "Rol" and is sortable + hideable', () => {
    const { columns } = useMembershipColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'roleName')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Rol')
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('createdAt column uses header "Fecha de ingreso" and is sortable + hideable', () => {
    const { columns } = useMembershipColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'createdAt')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Fecha de ingreso')
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('actions column is non-sortable, non-hideable and has text-right cell alignment', () => {
    const { columns } = useMembershipColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'actions')
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(false)
    expect(col!.meta?.class?.td).toBe('text-right')
  })
})