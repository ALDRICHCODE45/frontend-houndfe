import { describe, it, expect } from 'vitest'
import { usePromotionColumns } from '../usePromotionColumns'

describe('usePromotionColumns', () => {
  it('returns a columns array', () => {
    const { columns } = usePromotionColumns()
    expect(Array.isArray(columns)).toBe(true)
    expect(columns.length).toBeGreaterThan(0)
  })

  it('includes a title column with accessorKey "title"', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'title')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Título')
  })

  it('title column is sortable', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'title')
    expect(col!.enableSorting).toBe(true)
  })

  it('includes a createdAt column with header "Creada" that is sortable', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'createdAt')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Creada')
    expect(col!.enableSorting).toBe(true)
  })

  it('includes a startDate column with header "Inicio" that is sortable', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'startDate')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Inicio')
    expect(col!.enableSorting).toBe(true)
  })

  it('includes an updatedAt column that is sortable', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'updatedAt')
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(true)
  })

  it('updatedAt column has header "Actualizada"', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'updatedAt')
    expect(col!.header).toBe('Actualizada')
  })

  it('includes a status column with accessorKey "status"', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'status')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Estado')
  })

  it('includes a type column with accessorKey "type"', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'type')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Tipo')
  })

  it('includes a method column with accessorKey "method"', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === 'method')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Método')
  })

  it('includes an actions column with id "actions"', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'actions')
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(false)
  })

  it('actions column has text-right cell alignment', () => {
    const { columns } = usePromotionColumns()
    const col = columns.find((c) => 'id' in c && c.id === 'actions')
    expect(col!.meta?.class?.td).toBe('text-right')
  })

  it('exports statusConfig accessor helper', () => {
    const { getStatusConfig } = usePromotionColumns()
    const config = getStatusConfig('ACTIVE')
    expect(config.label).toBe('Activa')
    expect(config.color).toBe('success')
  })

  it('getStatusConfig returns correct config for SCHEDULED', () => {
    const { getStatusConfig } = usePromotionColumns()
    const config = getStatusConfig('SCHEDULED')
    expect(config.label).toBe('Programada')
    expect(config.color).toBe('info')
  })

  it('exports getTypeConfig helper', () => {
    const { getTypeConfig } = usePromotionColumns()
    const config = getTypeConfig('PRODUCT_DISCOUNT')
    expect(config.label).toBe('Descuento en productos')
    expect(config.icon).toBeDefined()
  })

  it('getTypeConfig returns correct config for BUY_X_GET_Y', () => {
    const { getTypeConfig } = usePromotionColumns()
    const config = getTypeConfig('BUY_X_GET_Y')
    expect(config.label).toBe('2x1, 3x2...')
  })

  it('exports getMethodConfig helper', () => {
    const { getMethodConfig } = usePromotionColumns()
    const config = getMethodConfig('AUTOMATIC')
    expect(config.label).toBe('Automático')
  })

  it('getMethodConfig returns correct config for MANUAL', () => {
    const { getMethodConfig } = usePromotionColumns()
    const config = getMethodConfig('MANUAL')
    expect(config.label).toBe('Manual')
  })
})
