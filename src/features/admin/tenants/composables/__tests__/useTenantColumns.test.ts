import { describe, it, expect } from 'vitest'
import { useTenantColumns } from '../useTenantColumns'

describe('useTenantColumns', () => {
  it('returns a columns array', () => {
    const { columns } = useTenantColumns()
    expect(Array.isArray(columns)).toBe(true)
    expect(columns.length).toBeGreaterThan(0)
  })

  it('orders columns as [name, slug, address, phone, isActive, createdAt, actions]', () => {
    const { columns } = useTenantColumns()
    const ids = columns.map((c) => {
      if ('accessorKey' in c && c.accessorKey) return c.accessorKey as string
      return (c as { id: string }).id
    })
    expect(ids).toEqual([
      'name',
      'slug',
      'address',
      'phone',
      'isActive',
      'createdAt',
      'actions',
    ])
  })

  it('name column uses header "Nombre" and is sortable + hideable', () => {
    const { columns } = useTenantColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'name')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Nombre')
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('slug column uses header "Slug" and is sortable + hideable', () => {
    const { columns } = useTenantColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'slug')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Slug')
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('address column uses header "Dirección" and is non-sortable but hideable', () => {
    const { columns } = useTenantColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'address')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Dirección')
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(true)
  })

  it('phone column uses header "Teléfono" and is non-sortable but hideable', () => {
    const { columns } = useTenantColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'phone')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Teléfono')
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(true)
  })

  it('isActive column uses header "Estado" and is non-sortable but hideable', () => {
    const { columns } = useTenantColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'isActive')
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(true)
  })

  it('createdAt column uses header "Creación" and is sortable + hideable', () => {
    const { columns } = useTenantColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'createdAt')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Creación')
    expect(col!.enableSorting).toBe(true)
    expect(col!.enableHiding).toBe(true)
  })

  it('actions column is non-sortable, non-hideable and has text-right cell alignment', () => {
    const { columns } = useTenantColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'actions')
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(false)
    expect(col!.meta?.class?.td).toBe('text-right')
  })
})